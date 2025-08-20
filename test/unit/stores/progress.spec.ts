import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProgressStore } from '~/stores/progress'
import type { CardWithData } from '~/types'

// Mock a data para garantir que os testes sejam consistentes
vi.useFakeTimers()
vi.setSystemTime(new Date('2025-08-20T10:00:00.000Z'))


describe('Progress Store', () => {
    beforeEach(() => {
        // Cria uma nova instância do Pinia para cada teste para isolá-los
        setActivePinia(createPinia())
        // Reseta os timers antes de cada teste
        vi.clearAllMocks()
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2025-08-20T10:00:00.000Z'))
    })

    it('deve inicializar um novo deck com cards', () => {
        const progress = useProgressStore()
        progress.initDeck('deck1', 'Test Deck', ['card1', 'card2'])
        
        expect(progress.decks['deck1']).toBeDefined()
        expect(progress.decks['deck1'].title).toBe('Test Deck')
        expect(Object.keys(progress.decks['deck1'].cards).length).toBe(2)
        expect(progress.decks['deck1'].cards['card1']).toBeDefined()
        expect(progress.decks['deck1'].source).toBe('generated')
    })

    it('não deve reinicializar um deck existente', () => {
        const progress = useProgressStore()
        progress.initDeck('deck1', 'First Deck', ['card1'])

        progress.initDeck('deck1', 'Second Deck', ['card2'])
        
        expect(progress.decks['deck1'].title).toBe('First Deck')
        expect(Object.keys(progress.decks['deck1'].cards).length).toBe(1)
    })

    it('deve registrar a revisão de um card e atualizar seu estado', () => {
        const progress = useProgressStore()
        progress.initDeck('deck1', 'Test Deck', ['card1'])
        
        const initialCard = { ...progress.decks['deck1'].cards['card1'] }
        expect(initialCard.stability).toBe(0)

        progress.reviewCard('deck1', 'card1', 'good')
        
        const reviewedCard = progress.decks['deck1'].cards['card1']
        expect(reviewedCard.stability).toBeGreaterThan(0)
        expect(reviewedCard.due).not.toEqual(initialCard.due)
        expect(reviewedCard.reps).toBe(1)
    })

    it('deve retornar os cards que precisam de revisão para um deck específico', () => {
        const progress = useProgressStore()
        progress.initDeck('deck1', 'Test Deck', ['card1', 'card2'])

        // Avança o tempo para que o card2 não precise de revisão
        vi.advanceTimersByTime(1000 * 60 * 60 * 24 * 5) // 5 dias
        progress.reviewCard('deck1', 'card2', 'easy')

        const dueCards = progress.getDueCards('deck1') as CardWithData[]
        
        // Apenas o card1 deve precisar de revisão, pois nunca foi revisado
        expect(dueCards.length).toBe(1)
        expect(dueCards[0].id).toBe('card1')
    })

    it('deve retornar todos os cards que precisam de revisão de todos os decks', () => {
        const progress = useProgressStore()
        progress.initDeck('deck1', 'Deck 1', ['d1c1'])
        progress.initDeck('deck2', 'Deck 2', ['d2c1', 'd2c2'])

        // d1c1 precisa de revisão (nunca revisado)
        // d2c1 precisa de revisão (nunca revisado)
        
        // d2c2 não precisa de revisão
        vi.advanceTimersByTime(1000 * 60 * 60 * 24 * 5) // 5 dias
        progress.reviewCard('deck2', 'd2c2', 'easy')

        const dueCards = progress.getDueCards()
        expect(dueCards.length).toBe(2)
        const dueCardIds = dueCards.map(c => c.id).sort()
        expect(dueCardIds).toEqual(['d1c1', 'd2c1'])
    })


    it('deve resetar o progresso de um deck', () => {
        const progress = useProgressStore()
        progress.initDeck('deck1', 'Test Deck', ['card1'])
        progress.reviewCard('deck1', 'card1', 'good')

        const reviewedCard = progress.decks['deck1'].cards['card1']
        expect(reviewedCard.reps).toBe(1)

        progress.resetDeck('deck1')
        
        const resetCard = progress.decks['deck1'].cards['card1']
        expect(resetCard.reps).toBe(0)
        expect(resetCard.stability).toBe(0)
    })

    it('deve listar todos os decks sem os detalhes dos cards', () => {
        const progress = useProgressStore()
        progress.initDeck('deck1', 'Deck 1', [])
        progress.initDeck('deck2', 'Deck 2', [])

        const decks = progress.listDecks()
        expect(decks.length).toBe(2)
        expect(decks[0].title).toBe('Deck 1')
        expect(decks[1].id).toBe('deck2')
        // @ts-ignore
        expect(decks[0].cards).toBeUndefined()
    })
})
