<script>
export default {
    props: {
        status_atual: "nova" | "revisao",
    },
};
</script>

<template>
    <div
        role="alert"
        :class="{
            'bg-success text-success-content': status_atual === 'nova',
            'bg-info text-warning-content': status_atual === 'revisao',
        }"
        class="card relative border-4 border-double border-base-300 shadow-md font-bold uppercase rounded-full text-center text-lg p-2 px-4 max-w-max mx-auto mb-8"
    >
        <span v-if="status_atual === 'nova'">
            Vamos aprender essa espécie nova</span
        >
        <span v-if="status_atual === 'revisao'">
            Vamos revisar essa espécie</span
        >
        <div
            v-if="status_atual === 'nova'"
            class="animate-bounce absolute w-full left-0 bottom-0 h-3"
        >
            <div class="absolute -left-12 text-3xl -rotate-6 z-50">👇</div>
            <div class="absolute -right-12 text-3xl rotate-6 z-50 rotate-y-180">
                👇
            </div>
        </div>
        <div
            v-else-if="status_atual === 'revisao'"
            class="absolute right-12 rotate-6 text-2xl -top-5"
        >
            👀
        </div>
    </div>
</template>
