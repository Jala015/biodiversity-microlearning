<script setup>
const props = defineProps({
    titulo: String,
    botaoCancelar: String | undefined | null,
    botaoConfirmar: String | undefined,
});

const modal = useTemplateRef("dialogTag");

function open() {
    if (modal.value) {
        modal.value.showModal();
    }
}

defineExpose({
    open,
});
</script>

<template>
    <dialog ref="dialogTag" class="modal">
        <div class="modal-box">
            <h3 class="text-lg font-bold text-center">{{ titulo }}</h3>
            <p class="py-4">
                <slot />
            </p>
            <div class="modal-action justify-center">
                <form method="dialog">
                    <div class="grid grid-cols-2 gap-4">
                        <button
                            @click="$emit('cancelar')"
                            class="btn btn-soft btn-error"
                            v-if="botaoCancelar !== null"
                        >
                            {{ botaoCancelar ?? "Cancelar" }}
                        </button>
                        <button
                            @click="$emit('confirmar')"
                            class="btn btn-soft btn-success"
                        >
                            {{ botaoConfirmar ?? "OK" }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </dialog>
</template>
