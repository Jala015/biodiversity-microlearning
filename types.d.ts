import type { Card } from "ts-fsrs"

interface CardData {
    scientificName: string
    commonName: string
    taxonomy: { class: '', order: '', family: '' }
    description: string
    photos:  { url: str, caption: str }[]
}

export interface CardWithData extends Card {
    id: string // id único do card (ligado à espécie/pacote)
    data: CardData // dados adicionais do card
}

export interface Deck {
    id: string
    title: string
    cards: Record<string, CardWithData>,
    source: 'curated'|'generated' // curated or auto-generated
    description?: string,
    favorite?: boolean // se o deck é favorito
}