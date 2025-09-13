<!-- pages/estudo.vue -->
<script setup>
import { computed, ref, onMounted, nextTick } from "vue";
import { useDecksStore } from "~/stores/decks";

const store = useDecksStore();
const currentCard = ref(null);
const currentCardOrigin = ref(null);
const updater = ref(0);

// Função para buscar próximo card
function fetchNextCard() {
    const cardData = store.getNextCard();
    console.debug("📋 Próximo card obtido:", cardData);

    if (cardData && cardData.card) {
        const card = cardData.card;
        console.debug("🔍 Detalhes do card:", {
            id: card.id,
            taxon: card.taxon,
            nomePopular: card.nomePopular,
            keys: Object.keys(card),
            card: card,
        });

        // Verificar se é um card válido (deve ter pelo menos id e taxon)
        if (card.id && card.taxon) {
            currentCard.value = card;
            currentCardOrigin.value = cardData.origin;
            console.debug(
                "✅ Card válido definido:",
                card.nomePopular || card.taxon,
            );
        } else {
            console.error(
                "❌ Card inválido - propriedades obrigatórias em falta:",
                card,
            );
            currentCard.value = null;
            currentCardOrigin.value = null;
        }
    } else {
        currentCard.value = null;
        currentCardOrigin.value = null;
        console.debug("❌ Nenhum card disponível");
    }
}

onMounted(() => {
    console.debug("🚀 Iniciando página de estudo");
    fetchNextCard();
});

// Processar resposta
async function handleAnswer(acertou) {
    console.debug(
        "💭 Resposta do usuário:",
        acertou ? "✅ Acertou" : "❌ Errou",
    );

    const card = currentCard.value;
    if (!card) {
        console.warn("⚠️ Tentativa de responder sem card ativo");
        return;
    }

    // Log detalhado do card antes de processar
    console.debug("🔄 Processando resposta para card:", {
        id: card.id,
        taxon: card.taxon,
        nomePopular: card.nomePopular,
        object: card,
    });

    // Processar a resposta no store
    await store.answerCard(card, acertou);

    // Aguardar próximo tick para garantir que o estado foi atualizado
    await nextTick();

    // Buscar próximo card
    fetchNextCard();

    // Forçar re-renderização
    updater.value++;

    console.debug("✅ Resposta processada, próximo card carregado");
}

// Estatísticas reativas
const deckStats = computed(() => {
    const stats = store.getDeckStats();
    console.debug("📊 Stats atualizadas:", stats);
    return stats;
});

// Verificar se pode avançar nível
const canAdvance = computed(() => {
    const can = store.canAdvanceLevel();
    console.debug("🎚️ Pode avançar nível:", can);
    return can;
});

function traduzirTaxonLevel(level) {
    if (!level) return "";
    const traducoes = {
        kingdom: "reino",
        phylum: "filo",
        class: "classe",
        order: "ordem",
        family: "família",
        genus: "gênero",
        species: "espécie",
    };
    return traducoes[level] || level;
}

function advanceLevel() {
    console.debug("🚀 Avançando para próximo nível");
    store.advanceLevel();
    fetchNextCard();
    updater.value++;
}

function resetDeck() {
    console.debug("🔄 Resetando deck");
    const activeDeck = store.getActiveDeck();
    if (activeDeck) {
        store.resetDeck(activeDeck.id);
        fetchNextCard();
        updater.value++;
    }
}
</script>

<template>
    <div class="min-h-screen">
        <!-- Loading/End state -->
        <div
            v-if="!currentCard"
            class="flex items-center justify-center min-h-screen"
        >
            <div class="text-center p-6">
                <!-- Nível concluído -->
                <div v-if="canAdvance" class="space-y-4">
                    <div class="text-6xl">🎉</div>
                    <h2 class="text-2xl font-bold text-gray-800">
                        Nível {{ deckStats?.currentLevel }} Concluído!
                    </h2>
                    <p class="text-gray-600">
                        Parabéns! Você completou todos os cards deste nível.
                    </p>
                    <button
                        @click="advanceLevel"
                        class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                    >
                        Avançar para o Próximo Nível
                    </button>
                </div>

                <!-- Deck concluído -->
                <div
                    v-else-if="deckStats?.totalSeen === deckStats?.total"
                    class="space-y-4"
                >
                    <div class="text-6xl">🏆</div>
                    <h2 class="text-2xl font-bold text-gray-800">
                        Deck Concluído!
                    </h2>
                    <p class="text-gray-600">
                        Parabéns! Você completou todo o deck de biodiversidade!
                    </p>
                </div>

                <!-- Aguardando cards -->
                <div v-else class="space-y-4">
                    <div class="text-6xl">⏳</div>
                    <h2 class="text-2xl font-bold text-gray-800">
                        Aguardando Cards
                    </h2>
                    <p class="text-gray-600">
                        Todos os cards estão em cooldown. Continue estudando
                        para liberar mais!
                    </p>
                </div>

                <!-- Estatísticas -->
                <div
                    v-if="deckStats"
                    class="mt-8 bg-white rounded-lg p-4 shadow-sm"
                >
                    <h3 class="text-lg font-semibold mb-3">📊 Estatísticas</h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div class="text-center">
                            <div class="text-2xl font-bold text-blue-600">
                                {{ deckStats.currentLevelSeen }}
                            </div>
                            <div class="text-gray-500">
                                de {{ deckStats.currentLevelTotal }} vistos
                            </div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-green-600">
                                {{ deckStats.review }}
                            </div>
                            <div class="text-gray-500">aguardando revisão</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-purple-600">
                                {{ deckStats.totalSeen }}
                            </div>
                            <div class="text-gray-500">
                                de {{ deckStats.total }} total
                            </div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-orange-600">
                                {{ deckStats.globalCounter }}
                            </div>
                            <div class="text-gray-500">contador global</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Card de estudo -->
        <div v-else class="pb-6">
            <!-- Banner do status -->
            <DeckBanner
                :status_atual="currentCardOrigin"
                :taxon_level="traduzirTaxonLevel(currentCard.nivel_taxonomico)"
            />

            <!-- Pergunta -->
            <DeckQuestion
                :card="currentCard"
                @resposta="handleAnswer"
                :key="`card-${currentCard.id}-${updater}`"
            />

            <!-- Debug Panel (abaixo do DeckQuestion) -->
            <div
                class="mt-6 mx-4 bg-black bg-opacity-80 text-white p-4 rounded-lg text-xs space-y-3"
            >
                <button
                    class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs w-full transition-colors"
                    @click="resetDeck"
                >
                    🔄 Resetar Deck
                </button>

                <div v-if="deckStats" class="space-y-2">
                    <div class="font-semibold">
                        🎯 {{ deckStats.currentLevel }} | 🔢
                        {{ deckStats.globalCounter }}
                    </div>
                    <div>
                        📚 Novos: {{ deckStats.new }} | 🔄 Revisão:
                        {{ deckStats.review }}
                    </div>
                    <div>
                        👁️ Nível: {{ deckStats.currentLevelSeen }}/{{
                            deckStats.currentLevelTotal
                        }}
                    </div>
                    <div class="text-yellow-300">
                        🎮 Card:
                        {{
                            currentCard?.nomePopular ||
                            currentCard?.taxon ||
                            currentCard?.id ||
                            "Nenhum"
                        }}
                    </div>
                    <div class="text-blue-300">
                        📍 Origem: {{ currentCardOrigin || "N/A" }}
                    </div>

                    <!-- Filas de espécies -->
                    <div class="space-y-2 pt-2 border-t border-gray-600">
                        <div class="font-semibold text-green-400">
                            📋 Filas por Espécies:
                        </div>

                        <!-- Fila de novos -->
                        <div class="bg-blue-900 bg-opacity-50 p-2 rounded">
                            <div class="font-semibold text-blue-300">
                                📚 Novos ({{
                                    deckStats.currentLevelQueue?.length || 0
                                }}):
                            </div>
                            <div
                                class="text-xs text-blue-200 max-h-20 overflow-y-auto"
                            >
                                <div v-if="deckStats.currentLevelQueue?.length">
                                    <div
                                        v-for="card in deckStats.currentLevelQueue"
                                        :key="card.id"
                                        class="truncate"
                                    >
                                        •
                                        {{
                                            card.nomePopular ||
                                            card.taxon ||
                                            card.id
                                        }}
                                    </div>
                                </div>
                                <div v-else class="text-gray-400 italic">
                                    Nenhum card novo
                                </div>
                            </div>
                        </div>

                        <!-- Fila de revisão -->
                        <div class="bg-green-900 bg-opacity-50 p-2 rounded">
                            <div class="font-semibold text-green-300">
                                🔄 Revisão ({{
                                    deckStats.currentReviewQueue?.length || 0
                                }}):
                            </div>
                            <div
                                class="text-xs text-green-200 max-h-20 overflow-y-auto"
                            >
                                <div
                                    v-if="deckStats.currentReviewQueue?.length"
                                >
                                    <div
                                        v-for="card in deckStats.currentReviewQueue"
                                        :key="card.id"
                                        class="truncate"
                                    >
                                        •
                                        {{
                                            card.nomePopular ||
                                            card.taxon ||
                                            card.id
                                        }}
                                    </div>
                                </div>
                                <div v-else class="text-gray-400 italic">
                                    Nenhum card em revisão
                                </div>
                            </div>
                        </div>

                        <!-- Fila de cooldown -->
                        <div class="bg-orange-900 bg-opacity-50 p-2 rounded">
                            <div class="font-semibold text-orange-300">
                                ⏳ Cooldown ({{
                                    deckStats.currentCooldownQueue?.length || 0
                                }}):
                            </div>
                            <div
                                class="text-xs text-orange-200 max-h-20 overflow-y-auto"
                            >
                                <div
                                    v-if="
                                        deckStats.currentCooldownQueue?.length
                                    "
                                >
                                    <div
                                        v-for="card in deckStats.currentCooldownQueue"
                                        :key="card.id"
                                        class="truncate"
                                    >
                                        •
                                        {{
                                            card.nomePopular ||
                                            card.taxon ||
                                            card.id
                                        }}
                                        <span class="text-gray-300"
                                            >({{
                                                card.cooldown -
                                                (deckStats.globalCounter -
                                                    card.lastSeenAt)
                                            }}
                                            restantes)</span
                                        >
                                    </div>
                                </div>
                                <div v-else class="text-gray-400 italic">
                                    Nenhum card em cooldown
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="text-green-300 text-xs" v-if="currentCard">
                        🔑 Keys: {{ Object.keys(currentCard).join(", ") }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
