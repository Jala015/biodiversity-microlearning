<script setup>
import { computed } from "vue";

const selectedIds = ref([]);

const expandir = ref(false);

const grupos = ref([
    { nome: "Animais", gbifId: 1, nivel: 1 },
    { nome: "Vertebrados", gbifId: 44, nivel: 2 },
    { nome: "Aves", gbifId: 212, incluido_por: [1, 44], nivel: 3 },
    { nome: "Mamíferos", gbifId: 359, incluido_por: [1, 44], nivel: 3 },
    { nome: "Répteis", gbifId: 358, incluido_por: [1, 44], nivel: 3 },
    { nome: "Anfíbios", gbifId: 131, incluido_por: [1, 44], nivel: 3 },
    { nome: "Moluscos", gbifId: 52, incluido_por: [1], nivel: 2 },
    { nome: "Artrópodes", gbifId: 54, incluido_por: [1], nivel: 2 },
    {
        nome: "Crustáceos (Malacostraca)",
        gbifId: 229,
        incluido_por: [1, 54],
        nivel: 3,
    },
    { nome: "Aracnídeos", gbifId: 367, incluido_por: [1, 54], nivel: 3 },
    { nome: "Insetos", gbifId: 216, incluido_por: [1, 54], nivel: 3 },
    { nome: "Besouros", gbifId: 1470, incluido_por: [1, 54, 216], nivel: 4 },
    { nome: "Borboletas", gbifId: 797, incluido_por: [1, 54, 216], nivel: 4 },
    {
        nome: "Abelhas",
        gbifId: 112871059,
        incluido_por: [1, 54, 216],
        nivel: 4,
    },
    { nome: "Plantas", gbifId: 6, nivel: 1 },
    { nome: "Fungos", gbifId: 5, nivel: 1 },
]);

// Computed para verificar se um grupo deve estar desabilitado
const isGrupoDesabilitado = (grupo) => {
    if (!grupo.incluido_por) return false;
    // Desabilita se algum grupo pai está selecionado
    return grupo.incluido_por.some((paiId) =>
        selectedIds.value.includes(paiId),
    );
};

// Verifica se um grupo pai tem filhos selecionados
const temFilhosSelecionados = (grupoPai) => {
    return grupos.value.some(
        (grupo) =>
            grupo.incluido_por &&
            grupo.incluido_por.includes(grupoPai.gbifId) &&
            selectedIds.value.includes(grupo.gbifId),
    );
};

// Computed para IDs filtrados (remove filhos que têm pais selecionados)
const selectedIdsFiltrados = computed(() => {
    return selectedIds.value.filter((id) => {
        const grupo = grupos.value.find((g) => g.gbifId === id);
        // Se não tem incluido_por, mantém
        if (!grupo?.incluido_por) return true;
        // Remove se algum pai está selecionado
        return !grupo.incluido_por.some((paiId) =>
            selectedIds.value.includes(paiId),
        );
    });
});

// gerar uma stringarray dos nomes dos grupos selecionados
const filtrosStr = computed(() => {
    return selectedIdsFiltrados.value.map((id) => {
        const grupo = grupos.value.find((g) => g.gbifId === id);
        return grupo?.nome;
    });
});

// Expõe a lista de IDs filtrados para o componente pai
defineExpose({
    taxonKeys: selectedIdsFiltrados,

    filtros_str: filtrosStr,
});
</script>

<template>
    <div class="collapse bg-base-200 border-base-300 border my-4">
        <input type="checkbox" v-model="expandir" />
        <div class="collapse-title">
            <div class="m-0! font-semibold text-lg">Filtrar grupos</div>
            <div class="italic" v-if="expandir">
                Deixe em branco para incluir todos os seres vivos
            </div>

            <div class="italic" v-else>
                {{
                    filtrosStr.length > 0
                        ? filtrosStr.join(", ").replace(/,(?!.*,)/g, " e ")
                        : "Todos os seres vivos"
                }}
            </div>
        </div>
        <div class="collapse-content text-sm">
            <ul class="list divide-y divide-base-content/10">
                <label
                    class="label mx-2 py-2"
                    v-for="grupo in grupos"
                    :key="grupo.gbifId"
                    :class="{
                        'text-success/50': isGrupoDesabilitado(grupo),
                        'text-success': selectedIds.includes(grupo.gbifId),
                    }"
                    :style="{ paddingLeft: `${grupo.nivel * 2}rem` }"
                >
                    <input
                        type="checkbox"
                        class="checkbox checkbox-sm"
                        :value="grupo.gbifId"
                        v-model="selectedIds"
                        :class="{
                            'checkbox-success': isGrupoDesabilitado(grupo),
                            'checkbox-warning':
                                !selectedIds.includes(grupo.gbifId) &&
                                temFilhosSelecionados(grupo),
                            'checkbox-error':
                                !isGrupoDesabilitado(grupo) &&
                                !temFilhosSelecionados(grupo) &&
                                selectedIdsFiltrados.length > 0 &&
                                !selectedIds.includes(grupo.gbifId),
                        }"
                        :disabled="isGrupoDesabilitado(grupo)"
                    />
                    {{ grupo.nome }}
                </label>
            </ul>
        </div>
    </div>
</template>
