<script setup>
import { ref } from "vue";
import { useDecksStore } from "~/stores/decks";
import { criarDeckAutomatico } from "~/utils/api";
import { customAlphabet } from "nanoid/non-secure";
import { onMounted } from "vue";

const nanoid = customAlphabet("1234567890abcdef", 11);
const decksStore = useDecksStore();

let deckstore_id = ref(null);
let carregando = ref(false);

const filtro = useTemplateRef("filtro");

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
    try {
        const deck = await criarDeckAutomatico(
            circulo,
            20,
            filtro.value.taxonKeys,
        );
        console.log("deck_id.value:", deckstore_id.value);

        // Ativa ou cria o deck, inicializando o IndexedDB
        await decksStore.activateDeck(deckstore_id.value);

        // Adiciona os cards ao deck ativo
        decksStore.addCards(deck.cards);

        console.log("Deck montado com sucesso");
        console.log("deck:", deck);
        carregando.value = false;
    } catch (error) {
        console.error("Erro ao montar deck:", error);
        carregando.value = false;
    }
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
        <GeradorFiltroGrupos ref="filtro" />
        <button
            :disabled="!circuloGeoJson || carregando"
            class="btn w-full rounded-xl btn-primary btn-lg"
            @click="montarDeck(circuloGeoJson)"
        >
            {{ carregando ? "Gerando deck..." : "Gerar deck" }}
        </button>
    </div>
</template>
