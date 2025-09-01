<template>
    <img
        class="w-full object-center h-full max-h-[50vh] object-cover"
        v-if="imageUrl"
        :src="imageUrl"
        :alt="alt"
    />
    <div v-else class="h-full w-full">Carregando...</div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { openDB } from "idb";
import imageCompression from "browser-image-compression";

const props = defineProps<{ url: string; alt?: string }>();
const imageUrl = ref<string | null>(null);
let objectUrl: string | null = null;

function normalizeUrl(url: string) {
    try {
        const u = new URL(url);
        return u.origin + u.pathname;
    } catch {
        return url;
    }
}

const dbPromise = openDB("image-cache", 1, {
    upgrade(db) {
        if (!db.objectStoreNames.contains("images")) {
            db.createObjectStore("images");
        }
    },
});

onMounted(async () => {
    const timeoutId = setTimeout(() => {
        console.log("Timeout atingido, carregando imagem diretamente da URL.");
        imageUrl.value = props.url;
    }, 5000);

    try {
        const db = await dbPromise;
        const key = normalizeUrl(props.url);
        let blob = await db.get("images", key);

        if (!blob) {
            console.debug("Fetching image from URL");
            const response = await fetch(props.url);
            const fetchedBlob = await response.blob();

            const filename = props.url.split("/").pop() || "image.jpg";
            const fileFromBlob = new File([fetchedBlob], filename, {
                type: fetchedBlob.type || "image/jpeg",
                lastModified: new Date().getTime(),
            });

            const compressedFile = await imageCompression(fileFromBlob, {
                maxSizeMB: 1,
                maxWidthOrHeight: 1024,
                useWebWorker: true,
            });

            blob = compressedFile.slice(
                0,
                compressedFile.size,
                compressedFile.type,
            );
            await db.put("images", blob, key);
        } else {
            console.debug("imagem já constava no cache");
        }

        clearTimeout(timeoutId);
        objectUrl = URL.createObjectURL(blob);
        imageUrl.value = objectUrl;
    } catch (err) {
        console.error("Erro ao carregar imagem:", err);
        clearTimeout(timeoutId);
        imageUrl.value = props.url;
    }
});

onUnmounted(() => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
});
</script>
