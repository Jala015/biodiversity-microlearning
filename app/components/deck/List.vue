<script setup lang="ts">
import { PhTagChevron } from "@phosphor-icons/vue";
import type { Deck } from "~~/types";

defineProps<{
  decks: Omit<Deck, "cards">[];
}>();
</script>

<template>
  <div class="flex gap-3 flex-col items-center justify-center">
    <div v-for="deck in decks" :key="deck.id" class="stack h-48 aspect-video">
      <div class="card shadow-md bg-base-100 dark:brightness-125">
        <div class="tag" v-if="deck.favorite">
          <PhTagChevron weight="fill" />
        </div>
        <div class="card-body">
          <h3 class="text-xl font-bold">{{ deck.title }}</h3>
          <p>{{ deck.description }}</p>
        </div>
        <div class="card-actions justify-end p-2">
          <button
            class="badge badge-primary badge-soft"
            :class="{ 'badge-warning!': deck.source === 'curated' }"
          >
            {{ deck.source === "curated" ? "Pré-montado" : "iNat" }}
          </button>
        </div>
      </div>
      <div class="card shadow-md bg-base-200 dark:brightness-110">
        <div class="card-body"></div>
      </div>
      <div class="card shadow-md bg-base-200 dark:brightness-105">
        <div class="card-body"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.tag {
  @apply overflow-clip absolute -translate-y-1 rounded-t-xl top-0 right-5 text-red-800;
}
.tag > svg {
  @apply -rotate-90 -translate-y-3 text-4xl;
}
</style>
