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
  _db: IDBPDatabase | null;
}

export const useDecksStore = defineStore("decks", {
  state: () => ({
    activeDeckId: null as string | null,
    decks: {} as Record<string, DeckState>,
  }),

  actions: {
    // Inicializa IndexedDB
    async initDB(deckId: string) {
      let deck = this.decks[deckId];
      if (!deck) return;

      if (!deck._db) {
        deck._db = await openDB(`deckdb-${deckId}`, 1, {
          upgrade(db) {
            if (!db.objectStoreNames.contains("state")) {
              db.createObjectStore("state");
            }
          },
        });
      }

      // Carrega estado salvo
      const saved = await deck._db.get("state", "pinia");
      if (saved) {
        const dbRef = deck._db;
        Object.assign(deck, saved);
        deck._db = dbRef;
      }
    },

    // Ativa ou cria um deck
    async activateDeck(deckId: string) {
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
            nome: "",
            descricao: "",
            id: deckId,
            source: "",
            favorite: false,
          },
          _db: null,
        };
      }
      await this.initDB(deckId);
      this.activeDeckId = deckId;
    },

    // obtém o deck ativo
    getActiveDeck(): DeckState | null {
      if (!this.activeDeckId) return null;
      return this.decks[this.activeDeckId] || null;
    },

    // salva o deck atual (função interna)
    saveDeck(deckId: string) {
      const deck = this.decks[deckId];
      if (!deck?._db) return;
      const { _db, ...toSave } = deck;
      deck._db.put("state", toSave, "pinia");
    },

    // salva o deck atual com debounce
    saveDeckDebounced: debounce(function (this: any, deckId: string) {
      this.saveDeck(deckId);
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
      this.saveDeckDebounced(deck.id);
    },

    // Incrementa o contador global do deck
    incrementGlobalCounter() {
      const deck = this.getActiveDeck();
      if (!deck) return;
      deck.globalCounter++;

      this.refreshReviewQueue(); // Chame a função de atualização da fila de revisão
      this.saveDeckDebounced(deck.id); // Salva o deck atual com debounce
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

      // garante que o card esteja na fila de cooldown
      if (!deck.cooldownQueue.some((c) => c.id === card.id)) {
        deck.cooldownQueue.push(card);
      }
      this.saveDeckDebounced(deck.id);
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
      this.saveDeckDebounced(deck.id);
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
        this.saveDeckDebounced(deck.id);
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

      // Remove do IndexedDB
      if (deck._db) {
        try {
          await deck._db.delete("state", "pinia");
          await deck._db.close(); // fecha o DB para liberar recursos
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
