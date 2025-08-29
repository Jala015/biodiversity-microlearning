<!--
    Componente Vue para exibir uma imagem que é salva comprimida em cache local (indexedDB via idb)
-->
<template>
    <img v-if="imageUrl" :src="imageUrl" :alt="alt" />
    <div v-else>Carregando...</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { openDB } from "idb";
import imageCompression from "browser-image-compression";

const props = defineProps<{ url: string; alt?: string }>();
const imageUrl = ref<string | null>(null);
let objectUrl: string | null = null;

const dbPromise = openDB("image-cache", 1, {
    upgrade(db) {
        db.createObjectStore("images");
    },
});

onMounted(async () => {
    try {
        const db = await dbPromise;
        let blob = await db.get("images", props.url);

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
                maxSizeMB: 1,
                maxWidthOrHeight: 1024,
                useWebWorker: true,
            });

            await db.put("images", blob, props.url);
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
