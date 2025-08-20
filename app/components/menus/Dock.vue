<script setup lang="ts">
import { PhGearFine, PhCardsThree, PhPackage } from "@phosphor-icons/vue";

const route = useRoute();
</script>

<template>
  <div class="dock  z-40">
    <button :class="{'dock-active text-secondary after:bg-secondary after:translate-y-2': route.name === 'index'}" >
        <PhPackage :size="24"  />
        <span class="dock-label">Decks</span>
    </button>

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
