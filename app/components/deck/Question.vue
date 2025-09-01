<script setup lang="ts">
import type { Card } from "~/stores/decks";
import type { Especie } from "~/utils/api";

const props = defineProps<{ card: Card }>();

interface Botoes extends Especie {
    correta?: boolean;
}

const botoes = ref([] as Botoes[]);

const shuffle = (array: string[]) => {
    return array
        .map((a) => ({ sort: Math.random(), value: a }))
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
    botoes.value = shuffle(
        botoes.value as unknown as string[],
    ) as unknown as Especie[];
});

const emit = defineEmits(["resposta"]);

const bloquear = ref(false);

const handleChute = (correta: boolean) => {
    bloquear.value = true;
    if (correta) {
        emit("resposta", true);
    } else {
        emit("resposta", false);
    }
};
</script>

<template>
    <div class="card max-w-prose mx-auto bg-base-100 p-4 shadow-md">
        <div
            id="img-container"
            class="rounded-lg relative max-h-[50vh] overflow-clip outline outline-base-content/50"
        >
            <DeckCachedImage :url="props.card.imagem.identifier" />
            <div
                class="bg-gradient-to-t text-nowrap text-white/70 from-black/50 to-black/5 absolute bottom-0 w-full text-center text-xs p-0"
            >
                <div class="scale-80">
                    {{ props.card.imagem.rightsHolder }}
                </div>
            </div>
        </div>
    </div>
    <div
        class="grid grid-cols-2 gap-4 max-w-prose mx-auto mt-8"
        :class="{
            'pointer-events-none': bloquear,
        }"
    >
        <button
            @click="handleChute(alternativa.correta ?? false)"
            v-for="alternativa in botoes"
            :class="{
                'focus:bg-error focus:text-error-content': !alternativa.correta,
                'focus:bg-success focus:text-success-content':
                    alternativa.correta,
            }"
            class="card hover:outline-1 outline-0 outline-transparent outline-offset-4 hover:outline-base-content/50 focus:outline-2! focus:outline-solid focus:outline-base-content/80 focus:outline-offset-0 hover:scale-[102%] duration-300 ease-in-out cursor-pointer transition-all bg-base-100 p-2 w-full h-18 flex flex-col justify-center items-center text-center"
        >
            <div class="italic text-lg">
                {{ alternativa.nome_cientifico }}
            </div>
            <div
                v-if="alternativa.nome_popular"
                class="text-sm opacity-80 lowercase"
            >
                ({{ alternativa.nome_popular }})
            </div>
        </button>
    </div>
</template>
