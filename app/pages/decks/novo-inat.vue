<script setup>
function handleCircle(geojson) {
  console.log("Círculo Turf:", geojson);
  // Aqui já está pronto para análises com Turf.js
  // ex: turf.area(geojson)
}
</script>

<template>
  <div class="prose">
    <h2 class="text-primary">Gerar deck via iNaturalist</h2>
    <blockquote>
      Você pode gerar decks automaticamente usando dados do iNaturalist. Desenhe um
      círculo no mapa e o app buscará automaticamente as principais espécies da região.
    </blockquote>
  </div>
  <ClientOnly fallback-tag="span" fallback="Carregando mapa...">
    <GeradorMapa @circle-drawn="handleCircle" />
  </ClientOnly>
</template>
