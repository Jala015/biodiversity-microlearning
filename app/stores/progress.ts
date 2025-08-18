// Store que lida com o progresso de revisão de cartas de diferentes decks usando o algoritmo FSRS (Fuzzy Spaced Repetition System).

import { defineStore } from "pinia"
import { generatorParameters, createEmptyCard, fsrs } from 'ts-fsrs'; 
// @ts-ignore
import app_config from "/app_config.yaml"
import type { Deck, CardWithData } from "~~/types";

// ----------------- Tipos -----------------
export type ReviewRating = "again" | "hard" | "good" | "easy"



export interface ProgressState {
    decks: Record<string, Deck>
    params: ReturnType<typeof generatorParameters>
}

// ----------------- Store -----------------
// @ts-ignore
export const useProgressStore = defineStore("progress", {
    state: (): ProgressState => ({
        decks: {} as Record<string, Deck>,
        params: generatorParameters({
            enable_fuzz: app_config.spaced_repetition?.use_fuzz ?? true,
            request_retention: app_config.target_retention ?? 0.9,
            maximum_interval: app_config.maximum_interval ?? 730,
        }),
    }),
    persist: {
        // @ts-ignore
        storage: piniaPluginPersistedstate.localStorage(), // salva no localStorage
    },
    actions: {
        /**
         * Inicializa um novo deck com lista de cards
         */
        initDeck(deckId: string, title: string, cardIds: string[], source: 'curated'|'generated' = 'generated') {
            if (this.decks[deckId]) return

            const cards: Record<string, CardWithData> = {}
            cardIds.forEach((id) => {
                const base = createEmptyCard()
                cards[id] = { ...base, id }
            })

            const deck: Deck = {
                id: deckId,
                title,
                cards,
                source
            }

            this.decks[deckId] = deck
        },

        /**
         * Registra a resposta do usuário para um card
         */
        reviewCard(deckId: string, cardId: string, rating: ReviewRating) {
            const deck = this.decks[deckId]
            if (!deck) return

            const card = deck.cards[cardId]
            if (!card) return

            const now = new Date()
            // Crie uma instância do FSRS com os parâmetros atuais
            const f = fsrs(this.params)
            // Converta o rating para o enum do ts-fsrs
            const ratingMap = {
                again: 1,
                hard: 2,
                good: 3,
                easy: 4,
            }
            const fsrsRating = ratingMap[rating]
            // Use o método next para obter o novo estado do card
            const result = f.next(card, now, fsrsRating)

            deck.cards[cardId] = { ...result.card, id: cardId }
        },

        /**
         * Retorna todos os cards de um deck que estão prontos para revisão. Se não passar nenhum deckId, retorna todos os cards de todos os decks, mas mostra apenas os ids e datas de vencimento.
         */
        getDueCards(deckId: string): CardWithData[] | {due:Date, id:string}[] {
            const deck = this.decks[deckId]
            if (!deck) {
                // Se não passar deckId, retorna todos os cards de todos os decks
                return Object.values(this.decks).flatMap((d) => {
                    const deck = d as Deck
                    return Object.values(deck.cards).filter((c) => new Date(c.due) <= new Date())
                        .map((c) => ({ id: c.id, due: c.due }))
                })
            }

            const now = new Date()
            return Object.values(deck.cards).filter((c) => {
                const card = c as CardWithData
                return new Date(card.due) <= now
            }) as CardWithData[]
        },

        /**
         * Reseta o progresso de um deck
         */
        resetDeck(deckId: string) {
            const deck = this.decks[deckId]
            if (!deck) return

            Object.keys(deck.cards).forEach((cardId) => {
                const base = createEmptyCard()
                deck.cards[cardId] = { ...base, id: cardId }
            })
        },

        listDecks(): Omit<Deck, 'cards'>[] {
            return Object.values(this.decks).map((deck) => ({
                id: deck.id,
                title: deck.title,
                source: deck.source,
                description: deck.description,
            }))
        }
    },
})
