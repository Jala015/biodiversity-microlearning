// stores/deck.ts
import { defineStore } from 'pinia';
import { openDB, type IDBPDatabase } from 'idb';
import { debounce } from 'lodash'; // ou qualquer debounce simples

export interface Card {
    id: string;
    taxon: string;
    nivel: 'facil' | 'medio' | 'medio-avancado' | 'dificil';
    cooldown: number;
    lastSeenAt: number;
}

export interface DeckConfig {
    taxaAcerto: number;
    taxaErro: number;
    minCooldown: number;
    pesoRevisao: number;
}

export const useDeckStore = defineStore('deck', {
    state: () => ({
        globalCounter: 0,
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
        async initDB(dbName = 'deckDB', dbVersion = 1) {
            const db = await openDB(dbName, dbVersion, {
                upgrade(db) {
                    db.createObjectStore('state');
                },
            });
            this._db = db;

            const saved = await db.get('state', 'pinia');
            if (saved) Object.assign(this.$state, saved);

            // Hook com debounce para salvar automaticamente
            const saveDebounced = debounce(async () => {
                if (this._db) {
                    await this._db.put('state', this.$state, 'pinia');
                }
            }, 500); // salva no máximo a cada 500ms

            this.$subscribe(() => {
                saveDebounced();
            });
        },

        incrementGlobalCounter() {
            this.globalCounter += 1;
        },

        updateCooldown(card: Card, acertou: boolean) {
            if (acertou) {
                card.cooldown = card.cooldown * 2 * this.config.taxaAcerto;
            } else {
                card.cooldown = Math.max(this.config.minCooldown, (card.cooldown / 2) * this.config.taxaErro);
            }
            card.lastSeenAt = this.globalCounter;

            if (!this.cooldownQueue.includes(card)) {
                this.cooldownQueue.push(card);
            }
        },

        refreshReviewQueue() {
            const readyCards = this.cooldownQueue.filter(
                (card) => (this.globalCounter - card.lastSeenAt) >= card.cooldown
            );
            readyCards.sort((a, b) => a.lastSeenAt - b.lastSeenAt);
            this.reviewQueue.push(...readyCards);
            this.cooldownQueue = this.cooldownQueue.filter((c) => !readyCards.includes(c));
        },

        drawNextCard(): Card | null {
            if (!this.levelsQueue.length && !this.reviewQueue.length) return null;

            const totalWeight = this.levelsQueue.length + this.reviewQueue.length * this.config.pesoRevisao;
            const rnd = Math.random() * totalWeight;

            if (rnd < this.reviewQueue.length * this.config.pesoRevisao) {
                return this.reviewQueue.shift() || null;
            } else {
                return this.levelsQueue.shift() || null;
            }
        },
    },
});
