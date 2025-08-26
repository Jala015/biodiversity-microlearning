<template>
    <div
        id="map-container"
        style="position: relative; height: 500px; width: 100%"
    >
        <div id="map" style="height: 100%; width: 100%"></div>
        <button @click="locateUser" class="locate-btn">
            <img src="@/assets/crosshair.svg" alt="Locate Me" />
        </button>
    </div>
</template>

<style scoped>
.locate-btn {
    position: absolute;
    top: 85px; /* Ajuste para não sobrepor o zoom */
    left: 10px;
    z-index: 1000;
    background: white;
    border: 2px solid rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    padding: 5px;
    cursor: pointer;
}
.locate-btn:hover {
    background-color: #f4f4f4;
}
.locate-btn img {
    width: 20px;
    height: 20px;
}
</style>

<script setup>
import { onMounted, onBeforeUnmount, defineEmits } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import circle from "@turf/circle";
import { max } from "lodash";

const emit = defineEmits(["circle-drawn"]);

let map = null;
let drawnItems = null;
let userMarker = null; // Guarda a referência do marcador do usuário
let drawingHandler = null; // Guarda a referência do handler de desenho

var dotIcon = L.divIcon({
    className: "custom-dot-marker", // CSS class for styling
    iconSize: [12, 12], // Width and height of the dot
    iconAnchor: [6, 6], // Center the dot on the coordinates
});

const createDefaultCircle = (userLocation) => {
    // Limpa círculos anteriores
    drawnItems.clearLayers();

    const DEFAULT_RADIUS_METERS = 2000; // 2 km

    // Cria círculo padrão de 2km na localização do usuário
    const defaultCircle = L.circle(userLocation, {
        radius: DEFAULT_RADIUS_METERS,
        color: "#74ac00",
        weight: 5,
    });

    drawnItems.addLayer(defaultCircle);

    // Gera círculo com Turf.js e emite evento
    const turfCircle = circle(
        [userLocation.lng, userLocation.lat], // [lon, lat]
        DEFAULT_RADIUS_METERS / 1000, // km (turf usa km)
        { steps: 16, units: "kilometers" },
    );

    emit("circle-drawn", turfCircle);
};

const locateUser = () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const userLocation = L.latLng(lat, lng);
                map.flyTo(userLocation, 13); // Anima o mapa para a localização

                // Remove o marcador antigo, se existir
                if (userMarker) {
                    userMarker.remove();
                }
                // Adiciona um novo marcador na posição do usuário
                userMarker = L.marker(userLocation, { icon: dotIcon }).addTo(
                    map,
                );

                // Cria círculo padrão de 2km na localização do usuário
                createDefaultCircle(userLocation);
            },
            () => {
                console.warn(
                    "Não foi possível obter a localização. O usuário negou ou houve um erro.",
                );
                // O mapa permanece na visão padrão se a localização falhar
            },
        );
    } else {
        console.error("Geolocalização não é suportada por este navegador.");
    }
};

const startDrawing = () => {
    if (drawingHandler) {
        drawingHandler.disable();
    }

    const drawOptions = {
        shapeOptions: { color: "#74ac00", weight: 5 },
    };

    drawingHandler = new L.Draw.Circle(map, drawOptions);
    drawingHandler.enable();
};

onMounted(() => {
    // ✨ Customização de texto para Português
    L.drawLocal.draw.toolbar.buttons.circle = "Desenhar um círculo";
    L.drawLocal.draw.handlers.circle.tooltip.start =
        "Clique e arraste para desenhar o círculo.";
    L.drawLocal.draw.handlers.simpleshape.tooltip.end =
        "Solte o mouse para finalizar.";

    // 1️⃣ Inicializa o mapa
    map = L.map("map", { dragging: false, maxZoom: 12 }).setView(
        [-23.55, -46.63],
        12,
    );

    // 2️⃣ Camada base OpenStreetMap
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    L.control.scale({ imperial: false, position: "topright" }).addTo(map);

    // 3️⃣ FeatureGroup para armazenar shapes
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // ✨ Inicia o desenho do círculo automaticamente
    startDrawing();

    // Tenta localizar o usuário ao carregar o mapa (depois de configurar o desenho)
    locateUser();

    // 5️⃣ Evento de criação
    const MIN_RADIUS_METERS = 1000; // 1 km
    map.on(L.Draw.Event.CREATED, (event) => {
        const layer = event.layer;
        let radius = layer.getRadius(); // em metros
        const center = layer.getLatLng();

        // Verifica se é um clique simples (raio muito pequeno)
        if (radius < 5) {
            // Se raio for menor que 5 metros, considera clique simples
            // Ignora o evento e reabilita o desenho
            layer.remove();
            startDrawing();
            return;
        }

        // Se o raio for menor que 1km, expande para 1km
        if (radius < MIN_RADIUS_METERS) {
            radius = MIN_RADIUS_METERS;
            // Remove o layer original
            layer.remove();

            // Cria um novo círculo com 1km de raio no mesmo centro
            const newLayer = L.circle(center, {
                radius: MIN_RADIUS_METERS,
                color: "#74ac00",
                weight: 5,
            });

            // Limpa círculos anteriores
            drawnItems.clearLayers();
            drawnItems.addLayer(newLayer);
        } else {
            // Limpa círculos anteriores
            drawnItems.clearLayers();
            drawnItems.addLayer(layer);
        }

        // Gera círculo com Turf.js
        const turfCircle = circle(
            [center.lng, center.lat], // [lon, lat]
            radius / 1000, // km (turf usa km)
            { steps: 64, units: "kilometers" },
        );

        emit("circle-drawn", turfCircle);

        // Reabilita o desenho para permitir novos círculos
        startDrawing();
    });
});

onBeforeUnmount(() => {
    if (drawingHandler) {
        drawingHandler.disable();
    }
    if (map) map.remove();
});
</script>

<style>
@reference "tailwindcss";
.custom-dot-marker {
    @apply rounded-full bg-blue-500  before:bg-blue-500 before:w-full before:h-full before:absolute before:rounded-full before:animate-ping before:opacity-50;
}
</style>
