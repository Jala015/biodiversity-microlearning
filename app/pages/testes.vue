<template>
    <div>
        <button class="btn" @click="updateNotification()">
            Atualizar Toast
        </button>
        <p>Mensagem atual: {{ messageRef }}</p>
        <p>Valor direto do ref: {{ messageRef?.value }}</p>
    </div>
</template>

<script setup>
import { onMounted } from "vue";

const toast = useToast();
let messageRef;

onMounted(() => {
    console.log("=== INÍCIO DO TESTE ===");

    // Cria o ref
    messageRef = toast.createMessageRef("teste", "Mensagem inicial");

    // Registra no notivue
    push.promise(messageRef);
});

function updateNotification() {
    toast.setMessage("teste", `Nova mensagem: ${Date.now()}`);

    // Verificar se o ref ainda é o mesmo objeto
    const sameRef = toast.getMessageRef("teste");
}
</script>
