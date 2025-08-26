// stores/deck.ts
import { defineStore } from "pinia";
import { openDB, type IDBPDatabase } from "idb";
import { debounce } from "lodash";
import { storeToRefs } from "pinia";
import type { Especie } from "~/utils/api/types";

export interface Card {
  id: string;
  taxon: string;
  nivel: "facil" | "medio" | "dificil" | "desafio";
  cooldown: number;
  lastSeenAt: number;
  alternativas_erradas: Especie[];
}

export interface DeckConfig {
  taxaAcerto: number;
  taxaErro: number;
  minCooldown: number;
  pesoRevisao: number;
  id: string;
  nome: string;
  descricao: string;
  source: string;
  favorite?: boolean;
}

export interface DeckState {
  globalCounter: number;
  currentLevel: NivelDificuldade;
  levelsQueue: Card[];
  cooldownQueue: Card[];
  reviewQueue: Card[];
  config: DeckConfig;
  _db: IDBPDatabase | null;
}

export type NivelDificuldade = "facil" | "medio" | "dificil" | "desafio";

export const ORDEM_NIVEIS: NivelDificuldade[] = [
  "facil",
  "medio",
  "dificil",
  "desafio",
];

export const deck_list = defineStore("lista-decks", {
  state: () => ({
    decks: [] as DeckConfig[],
  }),
  persist: true,
});

// Store global para todos os decks
export const useAllDecksStore = defineStore("all-decks", {
  state: () => ({
    decks: {} as Record<string, DeckState>,
  }),

  actions: {
    // Inicializa um deck se ele não existir
    initializeDeck(deckId: string): DeckState {
      if (!this.decks[deckId]) {
        this.decks[deckId] = {
          globalCounter: 0,
          currentLevel: "facil",
          levelsQueue: [],
          cooldownQueue: [],
          reviewQueue: [],
          config: {
            taxaAcerto: 2,
            taxaErro: 0.5,
            minCooldown: 3,
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
      return this.decks[deckId];
    },

    // Remove um deck
    removeDeck(deckId: string) {
      delete this.decks[deckId];
    },

    // Salva o estado de um deck específico no IndexedDB
    async saveDeckToDb(deckId: string) {
      const deckState = this.decks[deckId];
      if (deckState?._db) {
        await deckState._db.put("state", deckState, "pinia");
      }
    },
  },

  persist: true,
});

// Composable para trabalhar com um deck específico
export const useDeck = (deckId: string) => {
  const allDecks = useAllDecksStore();

  // Inicializa o deck se necessário
  const deckState = allDecks.initializeDeck(deckId);

  // Computed para acessar o estado reativo do deck
  const state = computed(() => allDecks.decks[deckId]);

  // Getters
  const currentLevelStats = computed(() => {
    const deck = state.value;
    const cardsNivelAtual = deck.levelsQueue.filter(
      (card) => card.nivel === deck.currentLevel,
    );
    const cardsRevisaoNivelAtual = deck.reviewQueue.filter(
      (card) => card.nivel === deck.currentLevel,
    );
    const cardsCooldownNivelAtual = deck.cooldownQueue.filter(
      (card) => card.nivel === deck.currentLevel,
    );

    return {
      nivel: deck.currentLevel,
      novos: cardsNivelAtual.length,
      revisao: cardsRevisaoNivelAtual.length,
      cooldown: cardsCooldownNivelAtual.length,
      total:
        cardsNivelAtual.length +
        cardsRevisaoNivelAtual.length +
        cardsCooldownNivelAtual.length,
    };
  });

  const deckStats = computed(() => {
    const deck = state.value;
    const totalCards =
      deck.levelsQueue.length +
      deck.reviewQueue.length +
      deck.cooldownQueue.length;

    return {
      totalCards,
      novos: deck.levelsQueue.length,
      revisao: deck.reviewQueue.length,
      cooldown: deck.cooldownQueue.length,
      globalCounter: deck.globalCounter,
    };
  });

  const nextAvailableLevel = computed(() => {
    const deck = state.value;
    const currentIndex = ORDEM_NIVEIS.indexOf(deck.currentLevel);
    if (currentIndex < ORDEM_NIVEIS.length - 1) {
      return ORDEM_NIVEIS[currentIndex + 1];
    }
    return null;
  });

  const hasCurrentLevelReviews = computed(() => {
    const deck = state.value;
    return deck.reviewQueue.some((card) => card.nivel === deck.currentLevel);
  });

  const cardsByLevel = computed(() => {
    const deck = state.value;
    const distribution: Record<
      NivelDificuldade,
      { novos: number; revisao: number; cooldown: number }
    > = {
      facil: { novos: 0, revisao: 0, cooldown: 0 },
      medio: { novos: 0, revisao: 0, cooldown: 0 },
      dificil: { novos: 0, revisao: 0, cooldown: 0 },
      desafio: { novos: 0, revisao: 0, cooldown: 0 },
    };

    deck.levelsQueue.forEach((card) => distribution[card.nivel].novos++);
    deck.reviewQueue.forEach((card) => distribution[card.nivel].revisao++);
    deck.cooldownQueue.forEach((card) => distribution[card.nivel].cooldown++);

    return distribution;
  });

  // Actions
  const initDB = async (dbName = `deckdb-${deckId}`, dbVersion = 1) => {
    const db = await openDB(dbName, dbVersion, {
      upgrade(db) {
        db.createObjectStore("state");
      },
    });
    allDecks.decks[deckId]._db = db;

    const saved = await db.get("state", "pinia");
    if (saved) {
      Object.assign(allDecks.decks[deckId], saved);
    }

    // Hook com debounce para salvar automaticamente
    const saveDebounced = debounce(async () => {
      await allDecks.saveDeckToDb(deckId);
    }, 500);

    // Observa mudanças no deck específico
    watch(
      state,
      () => {
        saveDebounced();
      },
      { deep: true },
    );
  };

  const incrementGlobalCounter = () => {
    allDecks.decks[deckId].globalCounter += 1;
  };

  const setCurrentLevel = (level: NivelDificuldade) => {
    allDecks.decks[deckId].currentLevel = level;
  };

  const canAdvanceLevel = (): boolean => {
    const deck = state.value;
    const currentIndex = ORDEM_NIVEIS.indexOf(deck.currentLevel);
    return (
      currentIndex < ORDEM_NIVEIS.length - 1 &&
      deck.levelsQueue.filter((card) => card.nivel === deck.currentLevel)
        .length === 0
    );
  };

  const advanceLevel = (): boolean => {
    if (canAdvanceLevel()) {
      const deck = state.value;
      const currentIndex = ORDEM_NIVEIS.indexOf(deck.currentLevel);
      const nextLevel = ORDEM_NIVEIS[currentIndex + 1];
      if (nextLevel) {
        allDecks.decks[deckId].currentLevel = nextLevel;
        return true;
      }
    }
    return false;
  };

  const getAvailableCardsForCurrentLevel = (): Card[] => {
    const deck = state.value;
    return deck.levelsQueue.filter((card) => card.nivel === deck.currentLevel);
  };

  const updateCooldown = (card: Card, acertou: boolean) => {
    const deck = allDecks.decks[deckId];
    const aleatoriedade_cooldown = Math.round(Math.random() * 10) - 5;
    if (acertou) {
      card.cooldown =
        card.cooldown * deck.config.taxaAcerto + aleatoriedade_cooldown;
    } else {
      card.cooldown =
        Math.max(
          deck.config.minCooldown,
          card.cooldown / deck.config.taxaErro,
        ) + aleatoriedade_cooldown;
    }
    card.lastSeenAt = deck.globalCounter;

    if (!deck.cooldownQueue.some((c) => c.id === card.id)) {
      deck.cooldownQueue.push(card);
    }
  };

  const refreshReviewQueue = () => {
    const deck = allDecks.decks[deckId];
    const readyCards = deck.cooldownQueue.filter(
      (card) => deck.globalCounter - card.lastSeenAt >= card.cooldown,
    );
    readyCards.sort((a, b) => a.lastSeenAt - b.lastSeenAt);
    deck.reviewQueue.push(...readyCards);
    deck.cooldownQueue = deck.cooldownQueue.filter(
      (c) => !readyCards.includes(c),
    );
  };

  const drawNextCard = (): Card | null => {
    const deck = allDecks.decks[deckId];
    const cardsNovosNivelAtual = getAvailableCardsForCurrentLevel();
    const cardsRevisao = deck.reviewQueue;

    // Se não há cards disponíveis
    if (cardsNovosNivelAtual.length === 0 && cardsRevisao.length === 0) {
      return null;
    }

    // Se só há revisões
    if (cardsNovosNivelAtual.length === 0) {
      return deck.reviewQueue.shift() || null;
    }

    // Se só há cards novos
    if (cardsRevisao.length === 0) {
      if (cardsNovosNivelAtual.length > 0) {
        const cardIndex = deck.levelsQueue.findIndex(
          (card) => card.nivel === deck.currentLevel,
        );
        return deck.levelsQueue.splice(cardIndex, 1)[0] || null;
      } else {
        if (canAdvanceLevel()) {
          advanceLevel();
          return drawNextCard();
        } else {
          return null;
        }
      }
    }

    // BALANCEAMENTO AUTOMÁTICO COM PRIORIDADE DE NÍVEL
    const pesoNivelAtual = cardsNovosNivelAtual.length;
    const pesoCardsRevisao = cardsRevisao.length * deck.config.pesoRevisao;
    const pesoTotal = pesoNivelAtual + pesoCardsRevisao;
    const sorteio = Math.random() * pesoTotal;

    if (sorteio < pesoCardsRevisao) {
      return deck.reviewQueue.shift() || null;
    } else if (sorteio < pesoCardsRevisao + pesoNivelAtual) {
      if (cardsNovosNivelAtual.length > 0) {
        const cardIndex = deck.levelsQueue.findIndex(
          (card) => card.nivel === deck.currentLevel,
        );
        return deck.levelsQueue.splice(cardIndex, 1)[0] || null;
      }
      return deck.levelsQueue.shift() || null;
    } else {
      const cardIndex = deck.levelsQueue.findIndex(
        (card) => card.nivel !== deck.currentLevel,
      );
      if (cardIndex !== -1) {
        return deck.levelsQueue.splice(cardIndex, 1)[0] || null;
      }
      return deck.levelsQueue.shift() || null;
    }
  };

  const addCards = (cards: Card[] | Card) => {
    const deck = allDecks.decks[deckId];
    if (!Array.isArray(cards)) {
      cards = [cards];
    }
    cards.forEach((card) => {
      if (!deck.levelsQueue.some((c) => c.id === card.id)) {
        deck.levelsQueue.push(card);
      }
    });
  };

  return {
    // Estado reativo
    state: readonly(state),

    // Getters
    currentLevelStats,
    deckStats,
    nextAvailableLevel,
    hasCurrentLevelReviews,
    cardsByLevel,

    // Actions
    initDB,
    incrementGlobalCounter,
    setCurrentLevel,
    canAdvanceLevel,
    advanceLevel,
    getAvailableCardsForCurrentLevel,
    updateCooldown,
    refreshReviewQueue,
    drawNextCard,
    addCards,
  };
};

// Mantém a função original para compatibilidade (deprecated)
export const useDeckStore = (deckId: string) => {
  console.warn("useDeckStore is deprecated, use useDeck instead");
  return useDeck(deckId);
};
