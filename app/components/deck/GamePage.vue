<!--
Página para lidar com os cards exibidos, animações de acertos e erros e feedback ao usuário.
-->
<script setup>
const currentCard = ref();

//provisorio
import deck from "~/assets/deck-falso.json";
currentCard.value = deck.cards[0];
const status_atual = ref("nova");
</script>
<template>
    <!-- Banner -->
    <DeckBanner :status_atual="status_atual" />

    <!-- Cartão com foto e perguntas -->
    <DeckQuestionCard :card="currentCard" />
</template>
