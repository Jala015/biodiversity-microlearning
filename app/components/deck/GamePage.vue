<!--
Página para lidar com os cards exibidos, animações de acertos e erros e feedback ao usuário.
-->
<script setup>
const currentCard = ref();

//provisorio
import deck from "~/assets/deck-falso.json";
currentCard.value = deck.cards[7];
const status_atual = ref("revisao");

function traduzirTaxonLevel(level) {
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
</script>
<template>
    <!-- Banner -->
    <DeckBanner
        :status_atual="status_atual"
        :taxon_level="traduzirTaxonLevel(currentCard.nivel_taxonomico)"
    />

    <!-- Cartão com foto e perguntas -->
    <DeckQuestionCard :card="currentCard" />
</template>
