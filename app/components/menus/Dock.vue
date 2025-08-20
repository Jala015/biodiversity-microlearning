<script setup lang="ts">
import { PhGearFine, PhCardsThree, PhPackage } from "@phosphor-icons/vue";

const route = useRoute();
</script>

<template>
  <div class="dock  z-40">
    <NuxtLink to="/decks" :class="{'dock-active text-secondary after:bg-secondary after:translate-y-2': route.path.split('/').includes('decks')}" >
        <PhPackage :size="24"  />
        <span class="dock-label">Decks</span>
    </NuxtLink>

    <button>
      <PhCardsThree :size="24"  />
      <span class="dock-label">Aprender</span>
    </button>

    <button>
      <PhGearFine :size="24" />
      <span class="dock-label">Configs</span>
    </button>
  </div>
</template>
