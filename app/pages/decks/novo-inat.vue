<script setup>
import { ref } from "vue";
import { useDeck } from "~/stores/decks";
import { criarDeckAutomatico } from "~/utils/api";
import { customAlphabet } from "nanoid/non-secure";
import { onMounted } from "vue";

const nanoid = customAlphabet("1234567890abcdef", 11);

let deckstore_id = ref(null);

let carregando = ref(false);

onMounted(() => {
    deckstore_id.value = nanoid();
});

const circuloGeoJson = ref(null);
function handleCircle(geojson) {
    circuloGeoJson.value = geojson; // Armazena o GeoJSON do círculo
}

async function montarDeck(circulo) {
    console.log("Montando deck");
    carregando.value = true;
    const deck = await criarDeckAutomatico(circulo, 20);
    console.log("deck_id.value:", deckstore_id.value);
    const deckComposable = useDeck(deckstore_id.value);
    deckComposable.addCards(deck.cards);
    console.log("Deck montado com sucesso");
    carregando.value = false;
}
</script>

<template>
    <div class="prose mx-auto">
        <h2>Gerar deck via iNaturalist</h2>
        <blockquote class="text-primary">
            Você pode gerar decks automaticamente usando dados do iNaturalist.
            <span class="text-base-content font-bold inline-block"
                >Desenhe um círculo arrastando no mapa</span
            >
            e o app buscará automaticamente as principais espécies da região.
            Use o zoom para navegar.
        </blockquote>
        <div
            class="rounded-xl outline-dashed outline-2 border border-primary/30 outline-offset-4 outline-primary overflow-clip m-4 my-6"
        >
            <ClientOnly fallback-tag="span" fallback="Carregando mapa...">
                <GeradorMapa @circle-drawn="handleCircle" />
            </ClientOnly>
        </div>
        <GeradorFiltroGrupos />
        <button
            :disabled="!circuloGeoJson || carregando"
            class="btn w-full rounded-xl btn-primary btn-lg"
            @click="montarDeck(circuloGeoJson)"
        >
            {{ carregando ? "Gerando deck..." : "Gerar deck" }}
        </button>
    </div>
</template>
