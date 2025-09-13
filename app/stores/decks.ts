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

    async addCards(cards: Card[] | Card) {
      const deck = this.getActiveDeck();
      if (!deck) return;
      if (!Array.isArray(cards)) cards = [cards];

      cards.forEach((c) => {
        // Verificar duplicatas em todas as filas
        const existsInLevels = deck.levelsQueue.some(
          (card) => card.id === c.id,
        );
        const existsInCooldown = deck.cooldownQueue.some(
          (card) => card.id === c.id,
        );
        const existsInReview = deck.reviewQueue.some(
          (card) => card.id === c.id,
        );

        if (!existsInLevels && !existsInCooldown && !existsInReview) {
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

    getNextCard(): { card: Card; origin: "revisao" | "nova" } | null {
      console.debug("🎲 === INÍCIO getNextCard ===");
      const deck = this.getActiveDeck();
      if (!deck) return null;

      const cardsNovos = deck.levelsQueue.filter(
        (c) => c.nivel === deck.currentLevel,
      );
      const cardsRevisao = deck.reviewQueue;

      console.debug("📊 Estado das filas:", {
        currentLevel: deck.currentLevel,
        cardsNovos: cardsNovos.length,
        cardsRevisao: cardsRevisao.length,
        globalCounter: deck.globalCounter,
      });

      // se alguma das filas estiver vazia, retorna o primeiro card da outra fila
      if (!cardsNovos.length && !cardsRevisao.length) {
        console.debug("❌ Nenhuma carta disponível");
        return null;
      }

      let selectedCard: Card | null = null;
      let origin: "revisao" | "nova" = "nova"; // Default to 'nova'

      if (!cardsNovos.length) {
        selectedCard = cardsRevisao[0] || null;
        origin = "revisao";
      } else if (!cardsRevisao.length) {
        selectedCard = cardsNovos[0] || null;
        origin = "nova";
      } else {
        const pesoNovos = cardsNovos.length;
        const pesoRevisao = cardsRevisao.length * deck.config.pesoRevisao;
        const sorteio = Math.random() * (pesoNovos + pesoRevisao);

        if (sorteio < pesoRevisao) {
          selectedCard = cardsRevisao[0] || null;
          origin = "revisao";
        } else {
          selectedCard = cardsNovos[0] || null;
          origin = "nova";
        }
      }

      if (selectedCard) {
        console.debug(
          `🎯 Carta selecionada: ${selectedCard.id} (${selectedCard.nomePopular || selectedCard.taxon}), origin: ${origin}`,
        );
        console.debug("🎲 === FIM getNextCard ===");
        return { card: selectedCard, origin };
      } else {
        console.debug("❌ Nenhuma carta selecionada");
        return null;
      }
    },

    async answerCard(card: Card, acertou: boolean) {
      const deck = this.getActiveDeck();
      if (!deck) return;
      console.debug(1);
      await this.incrementGlobalCounter();
      await this.updateCooldown(card, acertou);
      await this.saveDeckDebounced(deck);
      console.debug(2);
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

      console.debug(`🔄 === REMOVENDO CARTA ${card.id} DAS FILAS ===`);
      console.debug("📊 Antes da remoção:", {
        levelsQueue: deck.levelsQueue.length,
        reviewQueue: deck.reviewQueue.length,
        cooldownQueue: deck.cooldownQueue.length,
      });

      const beforeLevels = deck.levelsQueue.length;
      const beforeReview = deck.reviewQueue.length;

      deck.reviewQueue = deck.reviewQueue.filter((c) => c.id !== card.id);
      deck.levelsQueue = deck.levelsQueue.filter((c) => c.id !== card.id);

      console.debug("📊 Após remoção:", {
        levelsQueue: deck.levelsQueue.length,
        reviewQueue: deck.reviewQueue.length,
        removidaDeLevels: beforeLevels !== deck.levelsQueue.length,
        removidaDeReview: beforeReview !== deck.reviewQueue.length,
      });

      // verifica se o cooldownQueue já contém o card
      const idx = deck.cooldownQueue.findIndex((c) => c.id === card.id);
      if (idx === -1) {
        deck.cooldownQueue.push(card);
        console.debug(
          `➕ Carta adicionada ao cooldown (posição ${deck.cooldownQueue.length - 1})`,
        );
      } else {
        deck.cooldownQueue[idx] = card;
        console.debug(`🔄 Carta atualizada no cooldown (posição ${idx})`);
      }

      console.debug(
        `✅ Card ${card.id} com cooldown ${card.cooldown}, será revisado após ${card.cooldown} jogadas`,
      );
      console.debug("🔄 === FIM updateCooldown ===");
    },

    // CORREÇÃO 6: refreshReviewQueue com debug e deduplicação
    async refreshReviewQueue() {
      const deck = this.getActiveDeck();
      if (!deck) return;

      console.debug("🔄 === REFRESH REVIEW QUEUE ===");
      console.debug(`🕐 GlobalCounter: ${deck.globalCounter}`);

      const ready = deck.cooldownQueue.filter((c) => {
        const cooldownPassed = deck.globalCounter - c.lastSeenAt >= c.cooldown;
        const remaining = c.cooldown - (deck.globalCounter - c.lastSeenAt);
        if (cooldownPassed) {
          console.debug(
            `✅ Card ${c.id} pronto para revisão: ${deck.globalCounter} - ${c.lastSeenAt} >= ${c.cooldown}`,
          );
        } else {
          console.debug(
            `⏳ Card ${c.id} ainda em cooldown: faltam ${remaining} turnos`,
          );
        }
        return cooldownPassed;
      });

      if (ready.length > 0) {
        console.debug(`📤 Movendo ${ready.length} cards para revisão`);
        ready.sort((a, b) => a.lastSeenAt - b.lastSeenAt);

        const readyIds = ready.map((c) => c.id);
        const beforeReviewCount = deck.reviewQueue.length;
        deck.reviewQueue = deck.reviewQueue.filter(
          (c) => !readyIds.includes(c.id),
        );
        deck.reviewQueue.push(...ready);

        deck.cooldownQueue = deck.cooldownQueue.filter(
          (c) => !ready.includes(c),
        );

        console.debug(
          `📊 Review queue: ${beforeReviewCount} → ${deck.reviewQueue.length}`,
        );
        console.debug(
          `📊 Cooldown queue: ${deck.cooldownQueue.length + ready.length} → ${deck.cooldownQueue.length}`,
        );
      } else {
        console.debug("⏸️  Nenhuma carta pronta para revisão");
      }
      console.debug("🔄 === FIM REFRESH REVIEW QUEUE ===");

      await this.saveDeckDebounced(deck);
    },

    // testa se o deck pode avançar de nível vendo se há cards no nível atual
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

    // o deck volta a ser como um deck novo, com os cooldowns zerados e todas as cartas na fila de niveis
    async resetDeck(deckId: string): Promise<void> {
      console.log("resetando deck");
      const deck = this.decks[deckId];
      if (!deck) return;

      //salvar as cartas removendo duplicatas
      const allCards = deck.levelsQueue
        .concat(deck.cooldownQueue)
        .concat(deck.reviewQueue);

      // Remover duplicatas usando Map baseado no ID
      const uniqueCardsMap = new Map();
      allCards.forEach((card) => {
        uniqueCardsMap.set(card.id, card);
      });
      const cards = Array.from(uniqueCardsMap.values());

      // limpar os cooldowns dos cards e lastseenat
      cards.forEach((card) => {
        card.cooldown = 0;
        delete card.lastSeenAt;
      });

      //limpar as filas
      deck.levelsQueue = [];
      deck.cooldownQueue = [];
      deck.reviewQueue = [];

      //adicionar as cartas novamente
      await this.addCards(cards);

      deck.currentLevel = "facil";
      deck.globalCounter = 0;
      console.info("Cards resetados");
      await this.saveDeckDebounced(deck);
    },

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

      //obter filas do deck no nivel atual
      const currentLevelQueue = deck.levelsQueue.filter(
        (c) => c.nivel === deck.currentLevel,
      );
      const currentCooldownQueue = deck.cooldownQueue.filter(
        (c) => c.nivel === deck.currentLevel,
      );
      const currentReviewQueue = deck.reviewQueue.filter(
        (c) => c.nivel === deck.currentLevel,
      );

      return {
        total: totalCards,
        totalSeen,
        currentLevelTotal: currentLevelCards.length + currentLevelSeen,
        currentLevelSeen,
        review: deck.reviewQueue.length,
        new: currentLevelCards.length,
        currentLevel: deck.currentLevel,
        globalCounter: deck.globalCounter,
        currentLevelQueue,
        currentCooldownQueue,
        currentReviewQueue,
      };
    },
  },
});
