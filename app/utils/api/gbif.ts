import type { SearchOptions, GBIFResponse } from "./types";

//----------------------------//
//                            //
//     Funções do GBIF        //
//                            //
//----------------------------//

/**
 * Obter espécies mais comuns na região usando API do GBIF
 */
export async function obterEspeciesMaisComuns(opcoes: SearchOptions): Promise<{
  nomes_cientificos: string[];
  speciesCounts: Map<string, number>;
}> {
  opcoes.maxSpecies = opcoes.maxSpecies || 20;

  const geoDistance = `${opcoes.lat},${opcoes.lng},${opcoes.radiusKm}km`;
  console.log("GeoDistance:", geoDistance);

  const params = new URLSearchParams({
    geoDistance: geoDistance,
    facet: "species",
    limit: "0", // Usar '0' para obter apenas os facetas
    datasetKey: "50c9509d-22c7-4a22-a47d-8c48425ef4a7", //iNat research grade
  });

  if (opcoes.taxonKeys && opcoes.taxonKeys.length > 0) {
    opcoes.taxonKeys.forEach((key) => {
      params.append("taxon_key", key.toString());
    });
  }

  const url = `/api/gbif/occurrence/search?${params.toString()}`;

  try {
    // Usar useFetch com URL direta do GBIF (Vercel rewrites vai fazer o proxy)
    const { data: response, error } = await useFetch<GBIFResponse>(
      decodeURIComponent(url),
      {
        key: `gbif-${btoa(url).slice(0, 10)}`, // Cache key único baseado na URL
        server: false, // Force client-side apenas (importante para client-only apps)
        default: () => ({ facets: [] }),
        headers: {
          "Cache-Control": "max-age=3600",
        },
      },
    );

    if (error.value) {
      console.error("❌ Erro na requisição GBIF:", error.value);
      throw new Error(`Erro ao buscar dados do GBIF: ${error.value.message}`);
    }

    if (!response.value) {
      throw new Error("Resposta inválida do GBIF");
    }

    const nomes_cientificos =
      response.value.facets?.[0]?.counts
        .map((c) => c.name)
        .slice(0, opcoes.maxSpecies * 2) || []; // Buscar o dobro para filtrar depois

    // Montar um map com os respectivos counts
    const speciesCounts = new Map<string, number>();
    response.value.facets?.[0]?.counts.forEach((count) => {
      speciesCounts.set(count.name, count.count);
    });

    console.log(
      `📊 ${nomes_cientificos.length} espécies encontradas na região`,
    );
    return { nomes_cientificos, speciesCounts };
  } catch (error) {
    console.error("❌ Erro ao processar dados do GBIF:", error);
    throw error;
  }
}
