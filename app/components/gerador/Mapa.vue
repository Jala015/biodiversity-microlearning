<template>
  <div id="map" style="height: 500px; width: 100%;"></div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, defineEmits } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import circle from '@turf/circle';


const emit = defineEmits(['circle-drawn']);

let map = null;
let drawnItems = null;

onMounted(() => {
  // ✨ Customização de texto para Português
  L.drawLocal.draw.toolbar.buttons.circle = 'Desenhar um círculo';
  L.drawLocal.draw.handlers.circle.tooltip.start = 'Clique e arraste para desenhar o círculo.';
  L.drawLocal.draw.handlers.simpleshape.tooltip.end = 'Solte o mouse para finalizar.';

  // 1️⃣ Inicializa o mapa
  map = L.map('map').setView([-23.55, -46.63], 12);

  // 2️⃣ Camada base OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // 3️⃣ FeatureGroup para armazenar shapes
  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  // 4️⃣ Controle de desenho (apenas círculo)
  const drawControl = new L.Control.Draw({
    edit: { featureGroup: drawnItems },
    draw: {
      polygon: false,
      polyline: false,
      rectangle: false,
      marker: false,
      circlemarker: false,
      circle: { shapeOptions: { color: '#ff0000' } }
    }
  });
  map.addControl(drawControl);

  // ✨ Inicia o desenho do círculo automaticamente
  new L.Draw.Circle(map, drawControl.options.draw.circle).enable();

  // 5️⃣ Evento de criação
  map.on(L.Draw.Event.CREATED, event => {
    const layer = event.layer;
    drawnItems.addLayer(layer);

    // Captura centro e raio
    const center = layer.getLatLng();
    const radius = layer.getRadius(); // em metros

    // Gera círculo com Turf.js
    const turfCircle = circle(
      [center.lng, center.lat],  // [lon, lat]
      radius / 1000,             // km (turf usa km)
      { steps: 64, units: 'kilometers' }
    );

    emit('circle-drawn', turfCircle);
  });
});

onBeforeUnmount(() => {
  if (map) map.remove();
});
</script>
