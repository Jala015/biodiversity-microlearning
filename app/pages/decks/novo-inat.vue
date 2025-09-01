<script setup lang="ts">
import { ref } from "vue";
import { useDecksStore } from "~/stores/decks";
import { criarDeckAutomatico } from "~/utils/api";
import { customAlphabet } from "nanoid/non-secure";
import { onMounted } from "vue";
import { obterNomeCidade } from "~/utils/api/sources/gbif";

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
    console.log("🗺️⭕", geojson);
    circuloGeoJson.value = geojson; // Armazena o GeoJSON do círculo
}

const toast = useToast();
let messageRef;
async function montarDeck(circulo: {
    lat: number;
    lng: number;
    radius: number;
}) {
    messageRef = toast.createMessageRef("inat", "Montando deck...");

    const notification = push.promise(messageRef);
    carregando.value = true;
    try {
        const deck = await criarDeckAutomatico(
            circulo,
            20,
            filtro.value.taxonKeys,
        );

        const cidade = await obterNomeCidade(circulo.lat, circulo.lng);

        //unir os nomes de filtros com vírgula e o último com 'e'
        const filtros = filtro.value?.filtros_str
            ? filtro.value.filtros_str.join(", ").replace(/,(?!.*,)/g, " e ")
            : "";

        const nome = `${cidade}: ${filtros}`;

        // Cria o deck, inicializando o IndexedDB
        await decksStore.activateDeck(deckstore_id.value, nome);
        // Adiciona os cards ao deck ativo
        decksStore.addCards(deck.cards);

        notification.resolve("Deck montado com sucesso");
        carregando.value = false;
    } catch (error) {
        notification.reject("Erro ao montar deck");
        console.error("Erro ao montar deck:", error);
        carregando.value = false;
    }
}
</script>

<template>
    <div>
        <div class="prose mx-auto">
            <h2>Gerar deck via iNaturalist</h2>
            <blockquote class="text-primary">
                Você pode gerar decks automaticamente usando dados do
                iNaturalist.
                <span class="text-base-content font-bold inline-block"
                    >Desenhe um círculo arrastando no mapa</span
                >
                e o app buscará automaticamente as principais espécies da
                região. Use o zoom para navegar.
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
    </div>
</template>
