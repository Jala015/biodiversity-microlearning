<script setup lang="ts">
import type { Card } from "~/stores/decks";
import type { Especie } from "~/utils/api";

const props = defineProps<{ card: Card }>();

interface Botoes extends Especie {
    correta?: boolean;
}

const botoes = ref([] as Botoes[]);

const shuffle = (array: string[]) => { 
    return array.map((a) => ({ sort: Math.random(), value: a }))
        .sort((a, b) => a.sort - b.sort)
        .map((a) => a.value); 
}; 

onMounted(() => {
    botoes.value = [
        ...props.card.alternativas_erradas,
        {
            nome_cientifico: props.card.taxon,
            nome_popular: props.card.nomePopular ?? "",
            correta: true,
        },
    ];
    botoes.value = shuffle(botoes.value as unknown as string[]) as unknown as Especie[];
});
</script>

<template>
    <div class="card max-w-prose mx-auto bg-base-100 p-4 shadow-md">
        <DeckCachedImage
            class="rounded-lg overflow-clip outline outline-base-content/50"
            :url="props.card.imagem.identifier"
        />
    </div>
    <div class="grid grid-cols-2 space-y-2 gap-2 max-w-prose mx-auto mt-4">
        <button
            v-for="alternativa in botoes"
            class="card bg-base-100 p-2 w-full h-18 flex flex-col justify-center items-center text-center"
        >
            <div class="italic text-lg">
                {{ alternativa.nome_cientifico }}
            </div>
            <div v-if="alternativa.nome_popular" class="text-sm opacity-80">
                ({{ alternativa.nome_popular }})
            </div>
        </button>
    </div>
</template>
