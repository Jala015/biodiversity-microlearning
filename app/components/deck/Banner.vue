<script setup>
defineProps({
    status_atual: {
        type: String,
        default: "nova",
        validator: (value) => ["nova", "revisao"].includes(value),
    },
    taxon_level: {
        type: String,
        default: undefined,
    },
});

function generoDoTaxon(taxon_level, e = false) {
    if (!taxon_level) {
        return e ? "e" : "o";
    }
    if (
        ["espécie", "familia", "ordem", "classe"].includes(
            taxon_level.toLowerCase(),
        )
    ) {
        return "a";
    } else {
        return e ? "e" : "o";
    }
}
</script>

<template>
    <div
        role="alert"
        :class="{
            'bg-primary text-primary-content': status_atual === 'nova',
            'bg-info text-warning-content': status_atual === 'revisao',
        }"
        class="card select-none font-display relative border-4 border-double border-base-300 shadow-md font-light rounded-full text-center text-lg p-2 px-4 max-w-max mx-auto mb-8"
    >
        <span v-if="status_atual === 'nova'">
            Vamos aprender ess{{ generoDoTaxon(taxon_level, true) }}
            {{ taxon_level || "táxon" }} nov{{
                generoDoTaxon(taxon_level)
            }}</span
        >
        <span v-if="status_atual === 'revisao'">
            Vamos revisar ess{{ generoDoTaxon(taxon_level, true) }}
            {{ taxon_level || "táxon" }}</span
        >
        <div
            v-if="status_atual === 'nova'"
            class="absolute w-full left-0 bottom-0 h-3 font-emoji"
        >
            <div class="absolute -left-12 text-3xl -rotate-6 z-50">👇</div>
            <div class="absolute -right-12 text-3xl rotate-6 z-50 rotate-y-180">
                👇
            </div>
        </div>
        <div
            v-else-if="status_atual === 'revisao'"
            class="absolute left-1/2 -translate-x-1/2 text-3xl -top-5 font-emoji"
        >
            👀
        </div>
    </div>
</template>
