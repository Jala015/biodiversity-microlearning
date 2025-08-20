<script setup lang="ts">
import { PhBoxArrowDown, PhMapPinSimpleArea } from "@phosphor-icons/vue";
import type { Deck } from "~~/types";

const decks = ref<Omit<Deck, "cards">[]>([
  {
    id: "1",
    title: "Deck 1",
    description: "Description for Deck 1",
    source: "generated",
  },
  {
    id: "2",
    title: "Deck 2",
    description: "Description for Deck 2",
    source: "curated",
    favorite: true,
  },
]);
</script>

<template>
  <div class="flex mx-auto items-center my-4 gap-2 justify-center">
    Novo: 
    <NuxtLink to="/decks/novo-inat" class="btn btn-outline btn-primary"><PhMapPinSimpleArea :size="20" />Gerar do iNat</NuxtLink>
    ou
    <button class="btn btn-outline btn-warning"><PhBoxArrowDown :size="20" />Pacotes pré-montados</button>
  </div>
  <DeckList v-if="decks.length" :decks="decks" class="mt-8" />
</template>
