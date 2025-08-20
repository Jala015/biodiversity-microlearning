<script setup>
const circuloGeoJson = ref(null);
function handleCircle(geojson) {
  circuloGeoJson.value = geojson; // Armazena o GeoJSON do círculo
}
</script>

<template>
  <div class="prose">
    <h2>Gerar deck via iNaturalist</h2>
    <blockquote class="text-primary">
      Você pode gerar decks automaticamente usando dados do iNaturalist. <span class="text-white font-bold inline-block">Desenhe um círculo arrastando no mapa</span> e o app buscará automaticamente as principais espécies da região. Use o zoom para navegar.
    </blockquote>
  </div>
  <div class="rounded-xl outline-dashed outline-2 outline-offset-8 outline-primary overflow-clip m-4 my-6">
    <ClientOnly fallback-tag="span" fallback="Carregando mapa...">
      <GeradorMapa @circle-drawn="handleCircle" />
    </ClientOnly>
</div>
<!-- TODO colocar opções de filtros de grupos e seletor de dificuldade -->
<button :disabled="!circuloGeoJson" class="btn w-full rounded-xl btn-primary btn-lg">Gerar deck</button>
</template>
