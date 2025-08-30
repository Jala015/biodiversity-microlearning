<template>
    <DeckQuestionCard :card="deck.cards[3]" />
    <button class="btn" @click="updateNotification()">Push</button>
    {{ message }}
</template>

<script setup>
import { onMounted } from "vue";
import deck from "~/assets/deck-falso.json";

onMounted(() => {
    const notification = push.promise(message);
});

const message = ref("1");

function updateNotification() {
    message.value = "2";
}
</script>
