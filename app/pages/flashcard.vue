<!--
Página para lidar com os cards exibidos, animações de acertos e erros e feedback ao usuário.
-->
<script setup>
import { computed, provide } from "vue";
import { useDecksStore } from "~/stores/decks";

const store = useDecksStore();

// Card atual do deck ativo
const currentCard = store.getNextCard();

// Status atual baseado na origem do card
const status_atual = computed(() => {
    const deck = store.getActiveDeck();
    if (!deck || !currentCard.value) return "carregando";

    // Verifica se o card está na fila de revisão
    const isReview = deck.reviewQueue.some(
        (c) => c.id === currentCard.value.id,
    );
    return isReview ? "revisao" : "nova";
});

// Função para processar resposta do usuário
function handleAnswer(acertou) {
    const card = currentCard.value;
    if (card) {
        store.answerCard(card, acertou);
        currentCard = store.getNextCard();
    }
}

// Estatísticas do deck
const deckStats = computed(() => store.getDeckStats());

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

// Verificar se pode avançar de nível (para componente de aviso)
const canAdvance = computed(() => store.canAdvanceLevel());
</script>

<template>
    <div>
        <!-- Loading state -->
        <div
            v-if="!currentCard"
            class="flex items-center justify-center min-h-screen"
        >
            <div class="text-center">
                <div
                    class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"
                ></div>
                <p class="text-gray-600">
                    {{
                        deckStats?.total
                            ? "Parabéns! Você estudou todos os cards disponíveis."
                            : "Carregando deck..."
                    }}
                </p>
                <div v-if="deckStats" class="mt-4 text-sm text-gray-500">
                    <p>📊 Estatísticas:</p>
                    <p>
                        Cards estudados: {{ deckStats.studied }}/{{
                            deckStats.total
                        }}
                    </p>
                    <p>Nível atual: {{ deckStats.currentLevel }}</p>
                    <p>Para revisão: {{ deckStats.review }}</p>
                </div>
            </div>
        </div>

        <!-- Card de estudo -->
        <div v-else>
            <!-- Banner -->
            <DeckBanner
                :status_atual="status_atual"
                :taxon_level="traduzirTaxonLevel(currentCard.nivel_taxonomico)"
            />

            <!-- Cartão com foto e perguntas -->
            <DeckQuestion :card="currentCard" @resposta="handleAnswer" />

            <!-- Debug info (remover em produção) -->
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
            </div>
        </div>
    </div>
</template>
