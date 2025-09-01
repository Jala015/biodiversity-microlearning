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

// Remova a propriedade _db da interface DeckState.
export interface DeckState {
  id: string;
  globalCounter: number;
  currentLevel: NivelDificuldade;
  levelsQueue: Card[];
  cooldownQueue: Card[];
  reviewQueue: Card[];
  config: DeckConfig;
}

// Esta função agora está fora da store e não depende de 'this'.
function saveDeck(deck: DeckState, db: IDBPDatabase) {
  if (!db) return;
  // A chave agora é o ID do deck
  const rawDeck = toRaw(deck);
  db.put("state", rawDeck, deck.id);
}

const DB_NAME = "decks-main-db";
const STORE_NAME = "state";

export const useDecksStore = defineStore("decks", {
  state: () => ({
    activeDeckId: null as string | null,
    decks: {} as Record<string, DeckState>,
    // Uma única conexão para o banco de dados principal
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
    async activateDeck(deckId: string) {
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
            nome: deckId, //TODO adaptar para filtros de fauna e local
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
        const saved = await this.dbConnection.get(STORE_NAME, deckId);
        if (saved) {
          Object.assign(this.decks[deckId], saved);
        }
      }

      this.activeDeckId = deckId;
    },

    // obtém o deck ativo
    getActiveDeck(): DeckState | null {
      if (!this.activeDeckId) return null;
      return this.decks[this.activeDeckId] || null;
    },

    // A função debounce agora chama o utilitário 'saveDeck' com a conexão e o deck.
    saveDeckDebounced: debounce(function (this: any, deck: DeckState) {
      if (this.dbConnection) {
        saveDeck(deck, this.dbConnection);
      }
    }, 500),

    // Adiciona cards à fila de níveis
    addCards(cards: Card[] | Card) {
      const deck = this.getActiveDeck();
      if (!deck) return;
      if (!Array.isArray(cards)) cards = [cards];
      cards.forEach((c) => {
        if (!deck.levelsQueue.some((card) => card.id === c.id)) {
          deck.levelsQueue.push(c);
        }
      });
      this.saveDeckDebounced(deck);
    },

    // Incrementa o contador global do deck
    incrementGlobalCounter() {
      const deck = this.getActiveDeck();
      if (!deck) return;
      deck.globalCounter++;

      this.refreshReviewQueue();
      this.saveDeckDebounced(deck);
    },

    // atualiza o cooldown do card atual
    updateCooldown(card: Card, acertou: boolean) {
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

      if (!deck.cooldownQueue.some((c) => c.id === card.id)) {
        deck.cooldownQueue.push(card);
      }
      this.saveDeckDebounced(deck);
    },

    // função para atualizar a fila de revisão
    refreshReviewQueue() {
      const deck = this.getActiveDeck();
      if (!deck) return;

      const ready = deck.cooldownQueue.filter(
        (c) => deck.globalCounter - c.lastSeenAt >= c.cooldown,
      );
      ready.sort((a, b) => a.lastSeenAt - b.lastSeenAt);
      deck.reviewQueue.push(...ready);
      deck.cooldownQueue = deck.cooldownQueue.filter((c) => !ready.includes(c));
      this.saveDeckDebounced(deck);
    },

    // função para obter a próxima carta
    getNextCard(): Card | null {
      const deck = this.getActiveDeck();
      if (!deck) return null;

      const cardsNovos = deck.levelsQueue.filter(
        (c) => c.nivel === deck.currentLevel,
      );
      const cardsRevisao = deck.reviewQueue;

      if (!cardsNovos.length && !cardsRevisao.length) return null;
      if (!cardsNovos.length) return deck.reviewQueue.shift() || null;
      if (!cardsRevisao.length) {
        const idx = deck.levelsQueue.findIndex(
          (c) => c.nivel === deck.currentLevel,
        );
        return deck.levelsQueue.splice(idx, 1)[0] || null;
      }

      const pesoNovos = cardsNovos.length;
      const pesoRevisao = cardsRevisao.length * deck.config.pesoRevisao;
      const sorteio = Math.random() * (pesoNovos + pesoRevisao);

      if (sorteio < pesoRevisao) return deck.reviewQueue.shift() || null;
      else {
        const idx = deck.levelsQueue.findIndex(
          (c) => c.nivel === deck.currentLevel,
        );
        return deck.levelsQueue.splice(idx, 1)[0] || null;
      }
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

    advanceLevel(): boolean {
      const deck = this.getActiveDeck();
      if (!deck || !this.canAdvanceLevel()) return false;
      const idx = ORDEM_NIVEIS.indexOf(deck.currentLevel);
      const next = ORDEM_NIVEIS[idx + 1];
      if (next) {
        deck.currentLevel = next;
        this.saveDeckDebounced(deck);
        return true;
      }
      return false;
    },

    // Lista de decks em memória
    listDecks(): DeckState[] {
      return Object.values(this.decks);
    },

    // Remove um deck permanentemente
    async removeDeck(deckId: string) {
      const deck = this.decks[deckId];
      if (!deck) return;

      if (this.dbConnection) {
        try {
          // Usa o ID do deck como chave para apagar
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
  },
});
