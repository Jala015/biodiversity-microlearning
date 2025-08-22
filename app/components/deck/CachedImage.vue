<!--
    Componente Vue para exibir uma imagem que é salva comprimida em cache local (indexedDB via localForage)
-->
<template>
    <img v-if="imageUrl" :src="imageUrl" :alt="alt" />
    <div v-else>Carregando...</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useNuxtApp } from "#app";
import imageCompression from "browser-image-compression";

defineProps({
    url: { type: String, required: true },
    alt: { type: String, default: "" },
});

const props = defineProps<{ url: string; alt?: string }>();
const imageUrl = ref<string | null>(null);
let objectUrl: string | null = null;

const { $localForage } = useNuxtApp();

onMounted(async () => {
    try {
        let blob = await $localForage.getItem<Blob>(props.url);

        if (!blob) {
            const response = await fetch(props.url);
            const fetchedBlob = await response.blob();

            // Convert Blob to File with a name derived from the URL
            const filename = props.url.split("/").pop() || "image.jpg";
            const fileFromBlob = new File([fetchedBlob], filename, {
                type: fetchedBlob.type || "image/jpeg",
                lastModified: new Date().getTime(),
            });

            blob = await imageCompression(fileFromBlob, {
                maxSizeMB: 0.5,
                maxWidthOrHeight: 1024,
                useWebWorker: true,
            });

            await $localForage.setItem(props.url, blob);
        }

        objectUrl = URL.createObjectURL(blob);
        imageUrl.value = objectUrl;
    } catch (err) {
        console.error("Erro ao carregar imagem:", err);
    }
});

onUnmounted(() => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
});
</script>
