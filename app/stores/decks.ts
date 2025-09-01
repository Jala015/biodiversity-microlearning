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

// Serialização segura para IndexedDB
function serializeDeck(deck: DeckState): DeckState {
  return JSON.parse(JSON.stringify(toRaw(deck)));
}

// Salvar deck no IndexedDB
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
  persist: {
    key: "decks",
    storage: indexedDB,
    paths: ["decks"],
    pick: ["activeDeckId", "dbConnection"],
  },
  actions: {
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

      if (this.dbConnection) {
        try {
          const saved = await this.dbConnection.get(STORE_NAME, deckId);
          if (saved) {
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
      sessionStorage.setItem("ActiveDeckId", deckId);
      this.activeDeckId = deckId;
    },

    getActiveDeck(): DeckState | null {
      if (!this.activeDeckId) return null;
      return this.decks[this.activeDeckId] || null;
    },

    saveDeckDebounced: debounce(async function (this: any, deck: DeckState) {
      if (this.dbConnection) {
        await saveDeck(deck, this.dbConnection);
      }
    }, 500),

    // CORREÇÃO 3: adicionar cards com cooldown inicial e lastSeenAt
    async addCards(cards: Card[] | Card) {
      const deck = this.getActiveDeck();
      if (!deck) return;
      if (!Array.isArray(cards)) cards = [cards];

      cards.forEach((c) => {
        if (!deck.levelsQueue.some((card) => card.id === c.id)) {
          if (
            c.cooldown === undefined ||
            c.cooldown === null ||
            c.cooldown === 0
          ) {
            const cooldownMap = { facil: 3, medio: 5, dificil: 8, desafio: 12 };
            c.cooldown = cooldownMap[c.nivel] || 5;
          }
          if (!c.lastSeenAt) {
            c.lastSeenAt = 0;
          }
          deck.levelsQueue.push(c);
        }
      });

      await this.saveDeckDebounced(deck);
    },

    async incrementGlobalCounter() {
      const deck = this.getActiveDeck();
      if (!deck) return;

      deck.globalCounter++;
      this.refreshReviewQueue();
      await this.saveDeckDebounced(deck);
    },

    getNextCard():  {
      console.debug("sorteando próximo card");
      const deck = this.getActiveDeck();
      if (!deck) return null;
      console.debug("deck encontrado");
      
      let returnValue = null;
      const cardsNovos = deck.levelsQueue.filter(
        (c) => c.nivel === deck.currentLevel,
      );
      const cardsRevisao = deck.reviewQueue;

      // se alguma das filas estiver vazia, retorna o primeiro card da outra fila
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

    async answerCard(card: Card, acertou: boolean) {
      const deck = this.getActiveDeck();
      if (!deck) return;

      await this.incrementGlobalCounter();
      await this.updateCooldown(card, acertou);
      await this.saveDeckDebounced(deck);
    },

    async updateCooldown(card: Card, acertou: boolean) {
      const deck = this.getActiveDeck();
      if (!deck) return;

      if (!card.cooldown || card.cooldown <= 0) {
        const cooldownMap = { facil: 3, medio: 5, dificil: 8, desafio: 12 };
        card.cooldown = cooldownMap[card.nivel] || 5;
      }

      const aleatorio = Math.round(Math.random() * 2) - 1;
      if (acertou) {
        card.cooldown =
          Math.round(card.cooldown * deck.config.taxaAcerto) + aleatorio;
      } else {
        card.cooldown =
          Math.max(
            deck.config.minCooldown,
            Math.round(card.cooldown * deck.config.taxaErro),
          ) + aleatorio;
      }
      card.lastSeenAt = deck.globalCounter;

      deck.reviewQueue = deck.reviewQueue.filter((c) => c.id !== card.id);
      deck.levelsQueue = deck.levelsQueue.filter((c) => c.id !== card.id);

      // verifica se o cooldownQueue já contém o card
      const idx = deck.cooldownQueue.findIndex((c) => c.id === card.id);
      if (idx === -1) deck.cooldownQueue.push(card);
      else deck.cooldownQueue[idx] = card;

      console.debug(
        `Card ${card.id} com cooldown ${card.cooldown}, será revisado após ${card.cooldown} jogadas`,
      );
    },

    // CORREÇÃO 6: refreshReviewQueue com debug e deduplicação
    async refreshReviewQueue() {
      const deck = this.getActiveDeck();
      if (!deck) return;

      const ready = deck.cooldownQueue.filter((c) => {
        const cooldownPassed = deck.globalCounter - c.lastSeenAt >= c.cooldown;
        if (cooldownPassed) {
          console.debug(
            `Card ${c.id} pronto para revisão: ${deck.globalCounter} - ${c.lastSeenAt} >= ${c.cooldown}`,
          );
        }
        return cooldownPassed;
      });

      if (ready.length > 0) {
        console.debug(`Movendo ${ready.length} cards para revisão`);
        ready.sort((a, b) => a.lastSeenAt - b.lastSeenAt);

        const readyIds = ready.map((c) => c.id);
        deck.reviewQueue = deck.reviewQueue.filter(
          (c) => !readyIds.includes(c.id),
        );
        deck.reviewQueue.push(...ready);

        deck.cooldownQueue = deck.cooldownQueue.filter(
          (c) => !ready.includes(c),
        );
      }

      await this.saveDeckDebounced(deck);
    },

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

    async listDecksFromDB(): Promise<DeckState[]> {
      await this.initDB();
      if (!this.dbConnection) return [];

      try {
        const allDecks = await this.dbConnection.getAll(STORE_NAME);

        return allDecks.map((deck) => {
          if (
            deck.config?.data_criacao &&
            typeof deck.config.data_criacao === "string"
          ) {
            deck.config.data_criacao = new Date(deck.config.data_criacao);
          }
          delete deck.config.fila_cooldown;
          deck.levelsQueue = [deck.levelsQueue[0]];
          deck.reviewQueue = [deck.reviewQueue[0]];
          return deck;
        });
      } catch (error) {
        console.error("Erro ao listar decks:", error);
        return [];
      }
    },

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

      delete this.decks[deckId];
      if (this.activeDeckId === deckId) {
        this.activeDeckId = null;
      }
    },

    hasAvailableCards(): boolean {
      const deck = this.getActiveDeck();
      if (!deck) return false;

      const hasNewCards = deck.levelsQueue.some(
        (c) => c.nivel === deck.currentLevel,
      );
      const hasReviewCards = deck.reviewQueue.length > 0;

      return hasNewCards || hasReviewCards;
    },

    // CORREÇÃO 4: getDeckStats com estatísticas mais precisas
    getDeckStats() {
      const deck = this.getActiveDeck();
      if (!deck) return null;

      const totalCards =
        deck.levelsQueue.length +
        deck.cooldownQueue.length +
        deck.reviewQueue.length;

      const totalSeen = deck.cooldownQueue.length + deck.reviewQueue.length;

      const currentLevelCards = deck.levelsQueue.filter(
        (c) => c.nivel === deck.currentLevel,
      );
      const currentLevelSeen =
        deck.cooldownQueue.filter((c) => c.nivel === deck.currentLevel).length +
        deck.reviewQueue.filter((c) => c.nivel === deck.currentLevel).length;

      return {
        total: totalCards,
        totalSeen,
        currentLevelTotal: currentLevelCards.length + currentLevelSeen,
        currentLevelSeen,
        review: deck.reviewQueue.length,
        new: currentLevelCards.length,
        currentLevel: deck.currentLevel,
        globalCounter: deck.globalCounter,
      };
    },
  },
});
