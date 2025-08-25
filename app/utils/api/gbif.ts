import type { SearchOptions, GBIFResponse } from "./types";

//----------------------------//
//                            //
//     Funções do GBIF        //
//                            //
//----------------------------//

/**
 * Converte geometria Turf.js para formato WKT
 */
function turfToWkt(polygon: any): string {
  const coordinates = polygon.geometry.coordinates[0]
    .map((p: any) => `${p[0]} ${p[1]}`)
    .join(",");
  return `POLYGON((${coordinates}))`;
}

/**
 * Obter espécies mais comuns na região usando API do GBIF
 */
export async function obterEspeciesMaisComuns(opcoes: SearchOptions): Promise<{
  nomes_cientificos: string[];
  speciesCounts: Map<string, number>;
}> {
  opcoes.maxSpecies = opcoes.maxSpecies || 20;

  const geomWkt = turfToWkt(opcoes.geomCircle);
  const params = new URLSearchParams({
    geometry: geomWkt,
    facet: "scientificName",
    limit: "0", // Usar '0' para obter apenas os facetas
    datasetKey: "50c9509d-22c7-4a22-a47d-8c48425ef4a7", //iNat research grade
  });

  if (opcoes.taxonKeys && opcoes.taxonKeys.length > 0) {
    opcoes.taxonKeys.forEach((key) => {
      params.append("taxon_key", key.toString());
    });
  }

  const url = `https://api.gbif.org/v1/occurrence/search?${params.toString()}`;

  // realizar a requisição
  const response = await $fetch<GBIFResponse>(url, {
    headers: {
      "Cache-Control": "max-age=3600",
    },
  });

  const nomes_cientificos =
    response.facets?.[0]?.counts
      .map((c) => c.name)
      .slice(0, opcoes.maxSpecies * 2) || []; // Buscar o dobro para filtrar depois (pode ser que algumas espécies só tenham registros com problemas)

  //montar um map com os respectivos counts
  const speciesCounts = new Map<string, number>();
  response.facets?.[0]?.counts.forEach((count) => {
    speciesCounts.set(count.name, count.count);
  });

  console.log(`📊 ${nomes_cientificos.length} espécies encontradas na região`);

  return { nomes_cientificos, speciesCounts };
}
