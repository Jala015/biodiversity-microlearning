// stores/deck.ts
import { defineStore } from "pinia";
import { openDB, type IDBPDatabase } from "idb";
import { debounce } from "lodash";

export interface Card {
  id: string;
  taxon: string;
  nivel: "facil" | "medio" | "medio-avancado" | "dificil";
  cooldown: number;
  lastSeenAt: number;
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

export type NivelDificuldade = "facil" | "medio" | "medio-avancado" | "dificil";

export const ORDEM_NIVEIS: NivelDificuldade[] = [
  "facil",
  "medio",
  "medio-avancado",
  "dificil",
];

export const deck_list = defineStore("lista-decks", {
  state: () => ({
    decks: [] as DeckConfig[],
  }),
  persist: true,
});

export const useDeckStore = (deckId: string) =>
  defineStore(`deck-${deckId}`, {
    state: () => ({
      globalCounter: 0,
      currentLevel: "facil" as NivelDificuldade,
      levelsQueue: [] as Card[],
      cooldownQueue: [] as Card[],
      reviewQueue: [] as Card[],
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
      } as DeckConfig,
      _db: null as IDBPDatabase | null,
    }),

    getters: {
      // Estatísticas do nível atual
      currentLevelStats: (state) => {
        const cardsNivelAtual = state.levelsQueue.filter(
          (card) => card.nivel === state.currentLevel,
        );
        const cardsRevisaoNivelAtual = state.reviewQueue.filter(
          (card) => card.nivel === state.currentLevel,
        );
        const cardsCooldownNivelAtual = state.cooldownQueue.filter(
          (card) => card.nivel === state.currentLevel,
        );

        return {
          nivel: state.currentLevel,
          novos: cardsNivelAtual.length,
          revisao: cardsRevisaoNivelAtual.length,
          cooldown: cardsCooldownNivelAtual.length,
          total:
            cardsNivelAtual.length +
            cardsRevisaoNivelAtual.length +
            cardsCooldownNivelAtual.length,
        };
      },

      // Estatísticas gerais do deck
      deckStats: (state) => {
        const totalCards =
          state.levelsQueue.length +
          state.reviewQueue.length +
          state.cooldownQueue.length;

        return {
          totalCards,
          novos: state.levelsQueue.length,
          revisao: state.reviewQueue.length,
          cooldown: state.cooldownQueue.length,
          globalCounter: state.globalCounter,
        };
      },

      // Próximo nível disponível
      nextAvailableLevel: (state) => {
        const currentIndex = ORDEM_NIVEIS.indexOf(state.currentLevel);
        if (currentIndex < ORDEM_NIVEIS.length - 1) {
          return ORDEM_NIVEIS[currentIndex + 1];
        }
        return null;
      },

      // Verifica se há cards prontos para revisão do nível atual
      hasCurrentLevelReviews: (state) => {
        return state.reviewQueue.some(
          (card) => card.nivel === state.currentLevel,
        );
      },

      // Distribuição de cards por nível
      cardsByLevel: (state) => {
        const distribution: Record<
          NivelDificuldade,
          { novos: number; revisao: number; cooldown: number }
        > = {
          facil: { novos: 0, revisao: 0, cooldown: 0 },
          medio: { novos: 0, revisao: 0, cooldown: 0 },
          "medio-avancado": { novos: 0, revisao: 0, cooldown: 0 },
          dificil: { novos: 0, revisao: 0, cooldown: 0 },
        };

        state.levelsQueue.forEach((card) => distribution[card.nivel].novos++);
        state.reviewQueue.forEach((card) => distribution[card.nivel].revisao++);
        state.cooldownQueue.forEach(
          (card) => distribution[card.nivel].cooldown++,
        );

        return distribution;
      },
    },

    actions: {
      async initDB(dbName = `deckdb-${deckId}`, dbVersion = 1) {
        const db = await openDB(dbName, dbVersion, {
          upgrade(db) {
            db.createObjectStore("state");
          },
        });
        this._db = db;

        const saved = await db.get("state", "pinia");
        if (saved) Object.assign(this.$state, saved);

        // Hook com debounce para salvar automaticamente
        const saveDebounced = debounce(async () => {
          if (this._db) {
            await this._db.put("state", this.$state, "pinia");
          }
        }, 500); // salva no máximo a cada 500ms

        this.$subscribe(() => {
          saveDebounced();
        });
      },

      incrementGlobalCounter() {
        this.globalCounter += 1;
      },

      setCurrentLevel(level: NivelDificuldade) {
        this.currentLevel = level;
      },

      canAdvanceLevel(): boolean {
        // testa se pode avançar para o próximo nível (caso a fila de cartas esteja vazia)
        const currentIndex = ORDEM_NIVEIS.indexOf(this.currentLevel);
        return (
          currentIndex < ORDEM_NIVEIS.length - 1 && // o nivel atual não é o último
          this.levelsQueue.filter((card) => card.nivel === this.currentLevel)
            .length === 0 // não há cartas do nível atual na fila
        );
      },

      advanceLevel(): boolean {
        if (this.canAdvanceLevel()) {
          const currentIndex = ORDEM_NIVEIS.indexOf(this.currentLevel);
          const nextLevel = ORDEM_NIVEIS[currentIndex + 1];
          if (nextLevel) {
            this.currentLevel = nextLevel;
            return true;
          }
        }
        return false;
      },

      getAvailableCardsForCurrentLevel(): Card[] {
        return this.levelsQueue.filter(
          (card) => card.nivel === this.currentLevel,
        );
      },

      updateCooldown(card: Card, acertou: boolean) {
        const aleatoriedade_cooldown = Math.round(Math.random() * 10) - 5; // valor entre -5 e 5
        if (acertou) {
          card.cooldown =
            card.cooldown * this.config.taxaAcerto + aleatoriedade_cooldown;
        } else {
          card.cooldown =
            Math.max(
              this.config.minCooldown,
              card.cooldown / this.config.taxaErro,
            ) + aleatoriedade_cooldown;
        }
        card.lastSeenAt = this.globalCounter;

        if (!this.cooldownQueue.some((c) => c.id === card.id)) {
          this.cooldownQueue.push(card);
        }
      },

      refreshReviewQueue() {
        const readyCards = this.cooldownQueue.filter(
          (card) => this.globalCounter - card.lastSeenAt >= card.cooldown,
        );
        readyCards.sort((a, b) => a.lastSeenAt - b.lastSeenAt);
        this.reviewQueue.push(...readyCards);
        this.cooldownQueue = this.cooldownQueue.filter(
          (c) => !readyCards.includes(c),
        );
      },

      drawNextCard(): Card | null {
        /**
         * SISTEMA DE BALANCEAMENTO AUTOMÁTICO COM NÍVEIS
         *
         * A cada jogada, balanceia automaticamente entre:
         * • Mostrar cards novos do nível atual (prioridade máxima)
         * • Fazer revisão de cards antigos (consolidar conhecimento)
         *
         * O sistema prioriza cards do nível atual, mas pode avançar automaticamente
         * quando não há mais cards novos no nível atual.
         *
         * Quando o deck acaba, retorna null.
         */

        const cardsNovosNivelAtual = this.getAvailableCardsForCurrentLevel();
        const cardsRevisao = this.reviewQueue;

        // Se não há cards disponíveis
        if (cardsNovosNivelAtual.length === 0 && cardsRevisao.length === 0) {
          return null;
        }

        // Se só há revisões
        if (cardsNovosNivelAtual.length === 0) {
          return this.reviewQueue.shift() || null;
        }

        // Se só há cards novos
        if (cardsRevisao.length === 0) {
          if (cardsNovosNivelAtual.length > 0) {
            const cardIndex = this.levelsQueue.findIndex(
              (card) => card.nivel === this.currentLevel,
            );
            return this.levelsQueue.splice(cardIndex, 1)[0] || null;
          } else {
            // Tenta avançar nível automaticamente
            if (this.canAdvanceLevel()) {
              this.advanceLevel();
              return this.drawNextCard(); // Recursão para tentar novamente no novo nível
            } else {
              // Se não pode avançar, significa que o deck acabou.
              return null;
            }
          }
        }

        // BALANCEAMENTO AUTOMÁTICO COM PRIORIDADE DE NÍVEL

        // Peso para cards novos do nível atual (prioridade máxima)
        const pesoNivelAtual = cardsNovosNivelAtual.length;

        // Peso para revisões
        const pesoCardsRevisao = cardsRevisao.length * this.config.pesoRevisao;

        // Peso total para sorteio
        const pesoTotal = pesoNivelAtual + pesoCardsRevisao;

        // Sorteia um número entre 0 e o peso total
        const sorteio = Math.random() * pesoTotal;

        // Decide baseado no sorteio
        if (sorteio < pesoCardsRevisao) {
          // Revisão
          return this.reviewQueue.shift() || null;
        } else if (sorteio < pesoCardsRevisao + pesoNivelAtual) {
          // Card novo do nível atual
          if (cardsNovosNivelAtual.length > 0) {
            const cardIndex = this.levelsQueue.findIndex(
              (card) => card.nivel === this.currentLevel,
            );
            return this.levelsQueue.splice(cardIndex, 1)[0] || null;
          }
          // Fallback: se não há cards do nível atual, vai para outros níveis
          return this.levelsQueue.shift() || null;
        } else {
          // Card novo de outros níveis
          const cardIndex = this.levelsQueue.findIndex(
            (card) => card.nivel !== this.currentLevel,
          );
          if (cardIndex !== -1) {
            return this.levelsQueue.splice(cardIndex, 1)[0] || null;
          }
          // Fallback: pega qualquer card novo
          return this.levelsQueue.shift() || null;
        }
      },

      addCards(cards: Card[] | Card) {
        if (!Array.isArray(cards)) {
          cards = [cards];
        }
        cards.forEach((card) => {
          if (!this.levelsQueue.some((c) => c.id === card.id)) {
            this.levelsQueue.push(card);
          }
        });
      },
    },
  });
