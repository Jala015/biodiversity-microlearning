<script setup lang="ts">
import { navigateTo } from "#imports";
import { PhCaretRight, PhPackage } from "@phosphor-icons/vue";
import { useTemplateRef } from "vue";

let modalDeck = useTemplateRef("dialogo");
</script>

<template>
    <div>
        <div class="container max-w-prose mx-auto">
            <button
                @click="modalDeck?.open()"
                class="btn btn-xl w-full justify-between"
            >
                <span class="flex items-center gap-2">
                    <PhPackage class="text-secondary" />
                    Alterar deck
                </span>
                <PhCaretRight weight="light" />
            </button>
        </div>
        <Dialogo
            titulo="Alterar deck atual?"
            @confirmar="navigateTo('/decks')"
            ref="dialogo"
        >
            O seu progresso será salvo, mas a aprendizagem por repetição
            espaçada pode ser afetada.
        </Dialogo>
    </div>
</template>
