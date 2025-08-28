import type {
  SearchOptions,
  GbifOccResponse,
  GbifSpeciesResponse,
} from "./types";

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
  validSpecies: GbifSpeciesResponse[];
}> {
  opcoes.maxSpecies = opcoes.maxSpecies || 20;

  const geoDistance = `${opcoes.lat},${opcoes.lng},${opcoes.radiusKm}km`;

  const params = new URLSearchParams({
    geoDistance: geoDistance,
    facet: "speciesKey",
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
    const { data: response, error } = await useFetch<GbifOccResponse>(
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

    // Obter speciesKeys do facet
    const speciesKeys =
      response.value.facets?.[0]?.counts
        .map((c) => c.name)
        .slice(0, opcoes.maxSpecies * 2) || [];

    if (speciesKeys.length === 0) {
      console.log("📊 Nenhuma espécie encontrada na região");
      return {
        nomes_cientificos: [],
        speciesCounts: new Map(),
        validSpecies: [],
      };
    }

    // Buscar nomes científicos para cada speciesKey com delay
    const speciesResults = [];
    for (let i = 0; i < speciesKeys.length; i++) {
      const speciesKey = speciesKeys[i];
      try {
        const speciesUrl = `/api/gbif/species/${speciesKey}`;
        const { data: speciesData } = await useFetch<GbifSpeciesResponse>(
          speciesUrl,
          {
            key: `gbif-species-${speciesKey}`,
            server: false,
            default: () => ({
              canonicalName: "",
              kingdom: "",
              phylum: "",
              class: "",
              order: "",
              family: "",
              genus: "",
            }),
          },
        );
        speciesResults.push({
          speciesKey,
          scientificName: speciesData.value?.canonicalName || "",
          reino: speciesData.value?.kingdom || "",
          filo: speciesData.value?.phylum || "",
          classe: speciesData.value?.class || "",
          ordem: speciesData.value?.order || "",
          familia: speciesData.value?.family || "",
          genero: speciesData.value?.genus || "",
        });

        // Delay de 510ms entre consultas
        if (i < speciesKeys.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 510));
        }
      } catch (error) {
        console.warn(`⚠️ Erro ao buscar espécie ${speciesKey}:`, error);
        speciesResults.push({ speciesKey, scientificName: "" });
      }
    }

    // Filtrar apenas espécies com nome científico válido
    const validSpecies = speciesResults.filter((s) => s.scientificName);
    const nomes_cientificos = validSpecies
      .map((s) => s.scientificName)
      .slice(0, opcoes.maxSpecies);

    // Montar um map com os respectivos counts usando scientificName
    const speciesCounts = new Map<string, number>();
    response.value.facets?.[0]?.counts.forEach((count) => {
      const species = validSpecies.find((s) => s.speciesKey === count.name);
      if (species?.scientificName) {
        speciesCounts.set(species.scientificName, count.count);
      }
    });

    console.log(
      `📊 ${nomes_cientificos.length} espécies encontradas na região`,
    );
    return { nomes_cientificos, speciesCounts, validSpecies };
  } catch (error) {
    console.error("❌ Erro ao processar dados do GBIF:", error);
    throw error;
  }
}
