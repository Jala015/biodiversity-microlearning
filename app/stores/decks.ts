// stores/decks.ts
import { defineStore } from "pinia";
import { openDB, type IDBPDatabase } from "idb";
import { debounce } from "lodash";
import type { Card, NivelDificuldade, DeckConfig } from "~/types";
import app_config from "~/app_config.yaml";

export const ORDEM_NIVEIS: NivelDificuldade[] = [
  "facil",
  "medio",
  "dificil",
  "desafio",
];

export interface DeckState {
  id: string;
  globalCounter: number;
  currentLevel: NivelDificuldade;
  levelsQueue: Card[];
  cooldownQueue: Card[];
  reviewQueue: Card[];
  config: DeckConfig;
}

// Função para serializar deck de forma segura para IndexedDB
function serializeDeck(deck: DeckState): DeckState {
  // Usa JSON.parse(JSON.stringify()) para criar uma cópia profunda
  // e remover qualquer propriedade não serializável
  return JSON.parse(JSON.stringify(toRaw(deck)));
}

// Função para salvar deck no IndexedDB
async function saveDeck(deck: DeckState, db: IDBPDatabase) {
  if (!db) return;

  try {
    const serializedDeck = serializeDeck(deck);
    await db.put("state", serializedDeck, deck.id);
  } catch (error) {
    console.error("Erro ao salvar deck no IndexedDB:", error);
    console.error("Deck que causou erro:", deck);
  }
}

const DB_NAME = "decks-main-db";
const STORE_NAME = "state";

export const useDecksStore = defineStore("decks", {
  state: () => ({
    activeDeckId: null as string | null,
    decks: {} as Record<string, DeckState>,
    dbConnection: null as IDBPDatabase | null,
  }),

  actions: {
    /**
     * Inicializa a conexão com o banco de dados principal.
     */
    async initDB() {
      if (!this.dbConnection) {
        this.dbConnection = await openDB(DB_NAME, 1, {
          upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME);
            }
          },
        });
      }
    },

    /**
     * Ativa um deck. Garante que o DB principal esteja conectado
     * e carrega o estado do deck do IndexedDB se existir.
     */
    async activateDeck(deckId: string, nome: string = "") {
      await this.initDB();

      if (!this.decks[deckId]) {
        this.decks[deckId] = {
          id: deckId,
          globalCounter: 0,
          currentLevel: "facil",
          levelsQueue: [],
          cooldownQueue: [],
          reviewQueue: [],
          config: {
            taxaAcerto: 2,
            taxaErro: 0.5,
            minCooldown: app_config.min_cooldown,
            pesoRevisao: 0.3,
            nome: nome ?? deckId,
            descricao: "",
            id: deckId,
            source: "inat",
            favorite: false,
            data_criacao: new Date(),
          },
        };
      }

      // Carrega estado salvo do DB
      if (this.dbConnection) {
        try {
          const saved = await this.dbConnection.get(STORE_NAME, deckId);
          if (saved) {
            // Converte datas de string para Date se necessário
            if (
              saved.config?.data_criacao &&
              typeof saved.config.data_criacao === "string"
            ) {
              saved.config.data_criacao = new Date(saved.config.data_criacao);
            }
            Object.assign(this.decks[deckId], saved);
          }
        } catch (error) {
          console.error(`Erro ao carregar deck ${deckId}:`, error);
        }
      }

      this.activeDeckId = deckId;
    },

    // obtém o deck ativo
    getActiveDeck(): DeckState | null {
      if (!this.activeDeckId) return null;
      return this.decks[this.activeDeckId] || null;
    },

    // Função debounce atualizada para ser async
    saveDeckDebounced: debounce(async function (this: any, deck: DeckState) {
      if (this.dbConnection) {
        await saveDeck(deck, this.dbConnection);
      }
    }, 500),

    // Adiciona cards à fila de níveis
    async addCards(cards: Card[] | Card) {
      const deck = this.getActiveDeck();
      if (!deck) return;
      if (!Array.isArray(cards)) cards = [cards];

      cards.forEach((c) => {
        if (!deck.levelsQueue.some((card) => card.id === c.id)) {
          deck.levelsQueue.push(c);
        }
      });

      await this.saveDeckDebounced(deck);
    },

    // Incrementa o contador global do deck
    async incrementGlobalCounter() {
      const deck = this.getActiveDeck();
      if (!deck) return;

      deck.globalCounter++;
      this.refreshReviewQueue();
      await this.saveDeckDebounced(deck);
    },

    // Sorteia o próximo card SEM remover das filas
    getNextCard(): Card | null {
      const deck = this.getActiveDeck();
      if (!deck) return null;

      const cardsNovos = deck.levelsQueue.filter(
        (c) => c.nivel === deck.currentLevel,
      );
      const cardsRevisao = deck.reviewQueue;

      if (!cardsNovos.length && !cardsRevisao.length) return null;
      if (!cardsNovos.length) return cardsRevisao[0] || null;
      if (!cardsRevisao.length) return cardsNovos[0] || null;

      const pesoNovos = cardsNovos.length;
      const pesoRevisao = cardsRevisao.length * deck.config.pesoRevisao;
      const sorteio = Math.random() * (pesoNovos + pesoRevisao);

      if (sorteio < pesoRevisao) {
        return cardsRevisao[0] || null;
      } else {
        return cardsNovos[0] || null;
      }
    },

    // Processa resposta e move card entre filas
    async answerCard(card: Card, acertou: boolean) {
      const deck = this.getActiveDeck();
      if (!deck) return;

      // Incrementa contador global
      await this.incrementGlobalCounter();

      // Atualiza cooldown e move para fila de cooldown
      await this.updateCooldown(card, acertou);

      await this.saveDeckDebounced(deck);
    },

    // Atualiza cooldown e move card para fila de cooldown
    async updateCooldown(card: Card, acertou: boolean) {
      const deck = this.getActiveDeck();
      if (!deck) return;

      const aleatorio = Math.round(Math.random() * 10) - 5;
      if (acertou) {
        card.cooldown = card.cooldown * deck.config.taxaAcerto + aleatorio;
      } else {
        card.cooldown =
          Math.max(
            deck.config.minCooldown,
            card.cooldown / deck.config.taxaErro,
          ) + aleatorio;
      }
      card.lastSeenAt = deck.globalCounter;

      // Remove das filas originais
      const reviewIndex = deck.reviewQueue.findIndex((c) => c.id === card.id);
      if (reviewIndex !== -1) {
        deck.reviewQueue.splice(reviewIndex, 1);
      }

      const levelIndex = deck.levelsQueue.findIndex((c) => c.id === card.id);
      if (levelIndex !== -1) {
        deck.levelsQueue.splice(levelIndex, 1);
      }

      // Adiciona à cooldownQueue se não estiver lá
      if (!deck.cooldownQueue.some((c) => c.id === card.id)) {
        deck.cooldownQueue.push(card);
      }
    },

    // função para atualizar a fila de revisão
    async refreshReviewQueue() {
      const deck = this.getActiveDeck();
      if (!deck) return;

      const ready = deck.cooldownQueue.filter(
        (c) => deck.globalCounter - c.lastSeenAt >= c.cooldown,
      );
      ready.sort((a, b) => a.lastSeenAt - b.lastSeenAt);
      deck.reviewQueue.push(...ready);
      deck.cooldownQueue = deck.cooldownQueue.filter((c) => !ready.includes(c));
      await this.saveDeckDebounced(deck);
    },

    // verificar se pode subir de nível
    canAdvanceLevel(): boolean {
      const deck = this.getActiveDeck();
      if (!deck) return false;
      const idx = ORDEM_NIVEIS.indexOf(deck.currentLevel);
      return (
        idx < ORDEM_NIVEIS.length - 1 &&
        deck.levelsQueue.filter((c) => c.nivel === deck.currentLevel).length ===
          0
      );
    },

    async advanceLevel(): Promise<boolean> {
      const deck = this.getActiveDeck();
      if (!deck || !this.canAdvanceLevel()) return false;

      const idx = ORDEM_NIVEIS.indexOf(deck.currentLevel);
      const next = ORDEM_NIVEIS[idx + 1];
      if (next) {
        deck.currentLevel = next;
        await this.saveDeckDebounced(deck);
        return true;
      }
      return false;
    },

    //lista decks do idb
    async listDecksFromDB(): Promise<DeckState[]> {
      await this.initDB();
      if (!this.dbConnection) return [];

      try {
        const allDecks = await this.dbConnection.getAll(STORE_NAME);

        // Converte datas de string para Date se necessário
        return allDecks.map((deck) => {
          if (
            deck.config?.data_criacao &&
            typeof deck.config.data_criacao === "string"
          ) {
            deck.config.data_criacao = new Date(deck.config.data_criacao);
          }
          return deck;
        });
      } catch (error) {
        console.error("Erro ao listar decks:", error);
        return [];
      }
    },

    // Remove um deck permanentemente
    async removeDeck(deckId: string) {
      const deck = this.decks[deckId];
      if (!deck) return;

      if (this.dbConnection) {
        try {
          await this.dbConnection.delete(STORE_NAME, deckId);
        } catch (error) {
          console.error(`Erro ao apagar deck ${deckId} do IndexedDB:`, error);
        }
      }

      // Remove da memória
      delete this.decks[deckId];

      // Se era o deck ativo, desativa
      if (this.activeDeckId === deckId) {
        this.activeDeckId = null;
      }
    },

    // Verifica se há cards disponíveis para estudo
    hasAvailableCards(): boolean {
      const deck = this.getActiveDeck();
      if (!deck) return false;

      const hasNewCards = deck.levelsQueue.some(
        (c) => c.nivel === deck.currentLevel,
      );
      const hasReviewCards = deck.reviewQueue.length > 0;

      return hasNewCards || hasReviewCards;
    },

    // Estatísticas do deck atual
    getDeckStats() {
      const deck = this.getActiveDeck();
      if (!deck) return null;

      const totalCards =
        deck.levelsQueue.length +
        deck.cooldownQueue.length +
        deck.reviewQueue.length;
      const studiedCards = deck.cooldownQueue.length;
      const reviewCards = deck.reviewQueue.length;
      const newCards = deck.levelsQueue.filter(
        (c) => c.nivel === deck.currentLevel,
      ).length;

      return {
        total: totalCards,
        studied: studiedCards,
        review: reviewCards,
        new: newCards,
        currentLevel: deck.currentLevel,
        globalCounter: deck.globalCounter,
      };
    },
  },
});
