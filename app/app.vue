<script setup lang="ts">
const decks = ref<Omit<Deck, 'cards'>[]>([
  {
    id: '1',
    title: 'Deck 1',
    description: 'Description for Deck 1',
    source: 'generated',
  },
  {
    id: '2',
    title: 'Deck 2',
    description: 'Description for Deck 2',
    source: 'curated',
    favorite: true,
  }
]);
</script>

<template>
  <DeckList
    v-if="decks.length"
    :decks="decks"
    class="deck-list"
  />
</template>
