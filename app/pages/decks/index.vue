<script setup lang="ts">
import type { DeckConfig } from "~/stores/decks";
import { PhBoxArrowDown, PhMapPinSimpleArea } from "@phosphor-icons/vue";

const decks = ref<DeckConfig[]>([]);
const decksStore = useDecksStore();

onMounted(async () => {
    decks.value = await decksStore.listDecksFromDB();
});

const selecionarDeck = async (deckId: string) => {
    await decksStore.activateDeck(deckId);
    await navigateTo(`/flashcard`);
};
</script>

<template>
    <div>
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
        <DeckList
            @selecionar="selecionarDeck"
            v-if="decks.length"
            :decks="decks"
            class="mt-8"
        />
    </div>
</template>
