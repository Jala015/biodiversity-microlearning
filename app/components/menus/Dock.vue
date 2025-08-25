<script setup lang="ts">
import { PhGearFine, PhCardsThree, PhPackage } from "@phosphor-icons/vue";

const route = useRoute();
</script>

<template>
  <div class="dock  z-40">


    <button>
      <PhCardsThree :size="24"  />
      <span class="dock-label">Aprender</span>
    </button>

    <NuxtLink to="/configs" :class="{'dock-active text-secondary after:bg-secondary after:translate-y-2': route.path.split('/').includes('configs')}">
      <PhGearFine :size="24" />
      <span class="dock-label">Configs</span>
    </NuxtLink>
  </div>
</template>
