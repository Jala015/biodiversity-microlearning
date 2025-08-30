<script setup lang="ts">
import type { DeckConfig } from "~/stores/decks";
import { PhBoxArrowDown, PhMapPinSimpleArea } from "@phosphor-icons/vue";

const decks = ref<
    Omit<
        DeckConfig,
        "taxaAcerto" | "taxaErro" | "pesoRevisao" | "minCooldown"
    >[]
>([
    {
        id: "1",
        nome: "Deck 1",
        descricao: "Description for Deck 1",
        source: "generated",
    },
    {
        id: "2",
        nome: "Deck 2",
        descricao: "Description for Deck 2",
        source: "curated",
        favorite: true,
    },
]);
</script>

<template>
    <div class="flex mx-auto items-center my-4 gap-2 justify-center">
        Novo Deck:
        <NuxtLink to="/decks/novo-inat" class="btn btn-dash btn-primary"
            ><PhMapPinSimpleArea :size="20" />Gerar do iNat</NuxtLink
        >
        ou
        <button class="btn btn-dash btn-warning">
            <PhBoxArrowDown :size="20" />Pacotes pré-montados
        </button>
    </div>
    <DeckList v-if="decks.length" :decks="decks" class="mt-8" />
</template>
