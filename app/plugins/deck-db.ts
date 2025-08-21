import { defineNuxtPlugin } from '#app';
import { useDeckStore } from '~/stores/decks';

export default defineNuxtPlugin(async (nuxtApp) => {
    const deck = useDeckStore();

    // Pegando configs do nuxt.config.ts
    const dbName = nuxtApp.$config.deckDBName || 'deckDB';
    const dbVersion = nuxtApp.$config.deckDBVersion || 1;

    await deck.initDB('idb_decks', 1); // carrega IndexedDB antes de usar
});
