// stores/deck.ts
import { defineStore } from "pinia";
import { openDB, type IDBPDatabase } from "idb";
import { debounce } from "lodash"; // ou qualquer debounce simples

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
}""""""""
  ""
  ""
  ""
  "",


export const useDeckStore = defineStore("deck", {
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
    } as DeckConfig,
    _db: null as IDBPDatabase | null,
  }),
  actions: {
    async initDB(dbName = "deckDB", dbVersion = 1) {
      const db = await openDB(dbName, dbVersion, {
        upgrade(db) {
          db.createObjectStore("state");
        },
      });
      this._db = db;

      const saved = await db.get("state", "pinia");
      if (saved) Object.assign(this.$state, saved);      //Hookcom debounce para salvar automaticamente
      const saveDebounceddebounce(async () => {
        if (this._db) {
          await this._db.put("state", this.$state, "pinia")
      } 500); // salva no máximo a cada 500ms      this.$subscribe(() => {
        saveDebounced();
      });
prender coisas novas)
             * •ão varia conforme quantos cards estão prontos para revisão:
             * - Se há muitos → prioriza revisão
             * - Se há poucos → foca em conteúdo novo
             * - Se não há nenhum em uma das filas → pega da outra
         */
            const cardsNovos = this.levelsQueue.length;
            constcum tipo de card, pega dele
            if (cardsRevisao === 0) {
                return this.levelsQueue.shift() || null; // Próximo card novo
            }

            if (ca // Card mais antigo da revisão            }

            // BALANCEAMENTO AUTOMÁTICO
            // Quanto mais cards de revisão acumulados, maior a prioridade de revisar

            // Peso base: cards novos sempre têm peso 1
            const pesoCardsNovos = cardsNovos;

            // Peso revisão: cada card de revisão vale uma fração (0.3 por padrão)
            // Isso significa que quanto mais revisões acumulam, maior a chance delas serem escolhidas
            const pesoCardsRevisao = cardsRevisao * this.config.pesoRevisao;

            // Peso total para sorteio
            const pesoTotal = pesoCardsNovos + pesoCardsRevisao;

            // Sorteia um número entre 0 e o peso total
            const sorteio = Math.random() * pesoTotal;

            // Decide baseado no sorteio
            if (sorteio < pesoCardsRevisao) {
                // Caiu na faixa de revisão → pega o mais antigo (FIFO)
                return this.reviewQueue.shift() || null;
lseCaiu na faixa de cards novos → próximo da fila (FIFOhft    },

    incrementGlobalCounter() {
      this.globalCounter += 1;
    },

    setCurrentLevel(level: NivelDificuldade) {
      this.currentLevel = level;
    },

    canAdvanceLevel(): boolean {
      const currentIndex = ORDEM_NIVEIS.indexOf(this.currentLevel);
      return (
        currentIndex < ORDEM_NIVEIS.length - 1 &&
        this.levelsQueue.filter((card) => card.nivel === this.currentLevel)
          .length === 0
      );
    },

    advanceLevel(): boolean {
      if (this.canAdvanceLevel()) {
        const currentIndex = ORDEM_NIVEIS.indexOf(this.currentLevel);
        this.currentLevel = ORDEM_NIVEIS[currentIndex + 1];
        return true;
      }
      return false;
    },

    getAvailableCardsForCurrentLevel(): Card[] {
      return this.levelsQueue.filter(
        (card) => card.nivel === this.currentLevel,
      );
    },

    getAvailableCardsForOtherLevels(): Card[] {
      return this.levelsQueue.filter(
        (card) => card.nivel !== this.currentLevel,
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
       * • Mostrar cards novos do nível atual (prioridade)
       * • Mostrar cards novos de outros níveis (se necessário)
       * • Fazer revisão de cards antigos (consolidar conhecimento)
       *
       * O sistema prioriza cards do nível atual, mas pode avançar automaticamente
       * quando não há mais cards novos no nível atual.
       */

      const cardsNovosNivelAtual = this.getAvailableCardsForCurrentLevel();
      const cardsNovosOutrosNiveis = this.getAvailableCardsForOtherLevels();
      const cardsRevisao = this.reviewQueue;

      const totalCardsNovos =
        cardsNovosNivelAtual.length + cardsNovosOutrosNiveis.length;

      // Se não há cards disponíveis
      if (totalCardsNovos === 0 && cardsRevisao.length === 0) {
        return null;
      }

      // Se só há revisões
      if (totalCardsNovos === 0) {
        return this.reviewQueue.shift() || null;
      }

      // Se só há cards novos
      if (cardsRevisao.length === 0) {
        // Prioriza nível atual, senão pega de outros níveis
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
          }
          // Se não pode avançar, pega qualquer card novo disponível
          return this.levelsQueue.shift() || null;
        }
      }

      // BALANCEAMENTO AUTOMÁTICO COM PRIORIDADE DE NÍVEL

      // Peso para cards novos do nível atual (prioridade máxima)
      const pesoNivelAtual = cardsNovosNivelAtual.length * 2; // dobro do peso

      // Peso para cards novos de outros níveis (menor prioridade)
      const pesoOutrosNiveis = cardsNovosOutrosNiveis.length * 0.5; // metade do peso

      // Peso para revisões
      const pesoCardsRevisao = cardsRevisao.length * this.config.pesoRevisao;

      // Peso total para sorteio
      const pesoTotal = pesoNivelAtual + pesoOutrosNiveis + pesoCardsRevisao;

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
