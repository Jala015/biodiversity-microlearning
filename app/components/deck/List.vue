<script setup lang="ts">
import { PhTagChevron } from "@phosphor-icons/vue";
import type { DeckState } from "~/stores/decks";

defineProps<{
    decks: Omit<DeckState, "cards">[];
}>();
</script>

<template>
    <div class="flex gap-3 flex-col items-center justify-center">
        <button
            v-for="deck in decks"
            :key="deck.config.id"
            class="stack h-48 aspect-video cursor-pointer! text-left"
            @click="$emit('selecionar', deck.config.id)"
        >
            <div
                class="card outline-2 outline-offset-4 transition-all outline-base-content/0 duration-75 hover:outline-base-content/50 shadow-md bg-base-100 dark:brightness-125 overflow-clip"
            >
                <DeckCachedImage
                    v-if="deck.levelsQueue[0] || deck.reviewQueue[0]"
                    class="-z-10 absolute opacity-10"
                    :url="
                        deck.levelsQueue[0]?.imagem.identifier ??
                        deck.reviewQueue[0]?.imagem.identifier ??
                        ''
                    "
                />
                <div class="tag" v-if="deck.config.favorite">
                    <PhTagChevron weight="fill" />
                </div>
                <div class="card-body flex justify-center items-center">
                    <div class="text-center">
                        <h3 class="text-xl font-bold">
                            {{ deck.config.nome }}
                        </h3>
                        <p v-if="deck.config.descricao">
                            {{ deck.config.descricao }}
                        </p>
                        <!-- Mostrar nível atual -->
                        <p v-if="deck.levelsQueue[0]">
                            Nível atual: {{ deck.levelsQueue[0].nivel }}
                        </p>
                    </div>
                </div>
                <div class="card-actions justify-end p-2">
                    <button
                        class="badge badge-soft"
                        :class="{
                            'badge-warning': deck.config.source === 'curated',
                            'badge-primary': deck.config.source === 'inat',
                        }"
                    >
                        {{
                            deck.config.source === "curated"
                                ? "Pré-montado"
                                : "iNat"
                        }}
                    </button>
                </div>
            </div>
            <div class="card shadow-md bg-base-100 dark:brightness-110">
                <div class="card-body"></div>
            </div>
            <div class="card shadow-md bg-base-100 dark:brightness-105">
                <div class="card-body"></div>
            </div>
        </button>
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
