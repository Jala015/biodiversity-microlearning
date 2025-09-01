<script setup lang="ts">
import { PhGearFine, PhCardsThree, PhPackage } from "@phosphor-icons/vue";

const route = useRoute();
</script>

<template>
    <div class="dock z-40">
        <NuxtLink
            :class="{
                'dock-active text-secondary after:bg-secondary after:translate-y-2':
                    route.path.split('/').includes('flashcard') ||
                    route.path.split('/').includes('decks'),
            }"
        >
            <PhCardsThree :size="24" />
            <span class="dock-label">Aprender</span>
        </NuxtLink>

        <NuxtLink
            to="/configs"
            :class="{
                'dock-active text-secondary after:bg-secondary after:translate-y-2':
                    route.path.split('/').includes('configs'),
            }"
        >
            <PhGearFine :size="24" />
            <span class="dock-label">Configs</span>
        </NuxtLink>
    </div>
</template>
