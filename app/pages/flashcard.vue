<!-- pages/estudo.vue -->
<script setup>
import { computed, ref, onMounted } from "vue";
import { useDecksStore } from "~/stores/decks";

const store = useDecksStore();
const currentCard = ref();

onMounted(() => {
    currentCard.value = store.getNextCard();
});

// Status atual baseado na origem do card
const status_atual = computed(() => {
    const deck = store.getActiveDeck();
    if (!deck || !currentCard.value) return "carregando";

    const isReview = deck.reviewQueue.some(
        (c) => c.id === currentCard.value.id,
    );
    return isReview ? "revisao" : "nova";
});

// Processar resposta
function handleAnswer(acertou) {
    console.debug("resposta do usuário:", acertou);
    const card = currentCard.value;
    if (card) {
        store.answerCard(card, acertou);
        currentCard.value = store.getNextCard();
    }
}

// Estatísticas
const deckStats = computed(() => store.getDeckStats());

// NOVO: verificar se ainda existem cards
const hasAnyCards = computed(() => {
    const stats = deckStats.value;
    return stats && (stats.new > 0 || stats.review > 0 || canAdvance.value);
});

function traduzirTaxonLevel(level) {
    if (!level) return "";
    switch (level) {
        case "kingdom":
            return "reino";
        case "phylum":
            return "filo";
        case "class":
            return "classe";
        case "order":
            return "ordem";
        case "family":
            return "família";
        case "genus":
            return "gênero";
        case "species":
            return "espécie";
        default:
            return "";
    }
}

const canAdvance = computed(() => store.canAdvanceLevel());

function advanceLevel() {
    store.advanceLevel();
    store.getNextCard();
}
</script>

<template>
    <div>
        <!-- Loading/End state -->
        <div
            v-if="!currentCard"
            class="flex items-center justify-center min-h-screen"
        >
            <div class="text-center">
                <!-- Loading -->
                <div
                    class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"
                    v-if="!deckStats"
                ></div>

                <!-- Nível concluído -->
                <div v-if="deckStats && canAdvance" class="text-gray-600">
                    🎉 Você concluiu o nível {{ deckStats.currentLevel }}!
                    <button @click="advanceLevel" class="btn block my-4">
                        Avançar para o próximo nível
                    </button>
                </div>

                <!-- Deck concluído -->
                <div
                    v-else-if="deckStats && !hasAnyCards"
                    class="text-gray-600"
                >
                    🏆 Parabéns! Você concluiu todo o deck!
                </div>

                <!-- Carregando próximo -->
                <p v-else>Carregando próximo card...</p>

                <!-- Estatísticas -->
                <div v-if="deckStats" class="mt-4 text-sm text-gray-500">
                    <p>📊 Estatísticas:</p>
                    <p>
                        Nível {{ deckStats.currentLevel }}:
                        {{ deckStats.currentLevelSeen }}/{{
                            deckStats.currentLevelTotal
                        }}
                        cards vistos
                    </p>
                    <p>
                        Total do deck: {{ deckStats.totalSeen }}/{{
                            deckStats.total
                        }}
                        cards
                    </p>
                    <p>Aguardando revisão: {{ deckStats.review }}</p>
                    <p>Contador global: {{ deckStats.globalCounter }}</p>
                </div>
            </div>
        </div>

        <!-- Card de estudo -->
        <div v-else>
            <DeckBanner
                :status_atual="status_atual"
                :taxon_level="traduzirTaxonLevel(currentCard.nivel_taxonomico)"
            />

            <DeckQuestion
                :card="currentCard"
                @resposta="handleAnswer"
                :key="currentCard.id"
            />

            <!-- Debug -->
            <div
                v-if="deckStats"
                class="fixed bottom-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded text-xs"
            >
                <p>
                    🎯 {{ deckStats.currentLevel }} | 🔄
                    {{ deckStats.globalCounter }}
                </p>
                <p>
                    📚 Novos: {{ deckStats.new }} | 🔄 Revisão:
                    {{ deckStats.review }}
                </p>
                <p>
                    👁️ Nível: {{ deckStats.currentLevelSeen }}/{{
                        deckStats.currentLevelTotal
                    }}
                </p>
            </div>
        </div>
    </div>
</template>
