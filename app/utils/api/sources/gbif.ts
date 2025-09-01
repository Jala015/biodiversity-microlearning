import type {
  SearchOptions,
  GbifOccResponse,
  GbifSpeciesResponse,
} from "../types";

//----------------------------//
//                            //
//     Funções do GBIF        //
//                            //
//----------------------------//

/**
 * Obter espécies mais comuns na região usando API do GBIF
 *
 * Chamada por: criarDeckAutomatico() em deck-builder.ts - para obter lista inicial de espécies mais registradas na região
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

  let url = `${import.meta.env.VITE_HONO_URL}/api/gbif/v1/occurrence/search?${params.toString()}`;
  let fallbackUrl = `/api/gbif/occurrence/search?${params.toString()}`;

  try {
    let { data: response, error } = await useFetch<GbifOccResponse>(
      decodeURIComponent(url),
      {
        key: `gbif-${btoa(url).slice(0, 10)}`, // Cache key único baseado na URL
        server: import.meta.dev, // Force client-side apenas em produção
        default: () => ({ facets: [] }),
        headers: {
          "Cache-Control": "max-age=3600",
          "X-API-Key": import.meta.env.VITE_HONO_API_KEY,
        },
      },
    );

    if (error.value) {
      console.error("Erro na requisição GBIF via Deno:", error.value);
      const { data: response2, error: error2 } =
        await useFetch<GbifOccResponse>(decodeURIComponent(fallbackUrl), {
          key: `gbif-${btoa(url).slice(0, 10)}`, // Cache key único baseado na URL
          server: import.meta.dev, // Force client-side apenas em produção
          default: () => ({ facets: [] }),
          headers: {
            "Cache-Control": "max-age=3600",
            "X-API-Key": import.meta.env.VITE_HONO_API_KEY,
          },
        });
      if (error2.value) {
        console.error("Erro na requisição direta GBIF:", error2.value);
        throw new Error(
          `Erro ao buscar dados do GBIF: ${error2.value.message}`,
        );
      }
      response.value = response2.value;
    }

    console.log("Dados do GBIF carregados", response.value);

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

    // Buscar nomes científicos e dados taxonômicos para cada speciesKey
    const speciesResults = [];
    for (let i = 0; i < speciesKeys.length; i++) {
      const speciesKey = speciesKeys[i];
      if (!speciesKey) continue;
      try {
        // Buscar dados básicos do GBIF
        const speciesUrl = `${import.meta.env.VITE_HONO_URL}/api/gbif/v1/species/${speciesKey}`;
        const { data: speciesData } = await useFetch<any>(speciesUrl, {
          key: `gbif-species-${speciesKey}`,
          server: false,
          headers: {
            "X-API-Key": import.meta.env.VITE_HONO_API_KEY,
          },
          default: () => ({}),
        });

        speciesResults.push({
          key: parseInt(speciesKey) || 0,
          scientificName: speciesData.value?.canonicalName || "",
          canonicalName: speciesData.value?.canonicalName || "",
          reino: speciesData.value?.kingdom || "",
          filo: speciesData.value?.phylum || "",
          classe: speciesData.value?.class || "",
          ordem: speciesData.value?.order || "",
          familia: speciesData.value?.family || "",
          genero: speciesData.value?.genus || "",
        });

        // Delay entre consultas para respeitar rate limits
        if (i < speciesKeys.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 510));
        }
      } catch (error) {
        console.warn(`⚠️ Erro ao buscar espécie ${speciesKey}:`, error);
        speciesResults.push({
          key: parseInt(speciesKey || "0") || 0,
          scientificName: "",
          canonicalName: "",
          reino: "",
          filo: "",
          classe: "",
          ordem: "",
          familia: "",
          genero: "",
        });
      }
    }

    // Filtrar apenas espécies com nome científico válido
    const validSpecies = speciesResults.filter((s) => s.scientificName);
    const nomes_cientificos = validSpecies
      .map((s) => s.scientificName)
      .slice(0, opcoes.maxSpecies);

    // Montar um map com os respectivos counts usando scientificName
    const speciesCounts = new Map<string, number>();
    response.value.facets?.[0]?.counts.forEach((count: any) => {
      const species = validSpecies.find((s) => s.key.toString() === count.name);
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

//----------------------------//
//                            //
//     Funções auxiliares     //
//                            //
//----------------------------//

export async function obterNomeCidade(lat: string, lon: string) {
  const { data: response } = await useFetch<{ cidade: string }>(
    `${import.meta.env.VITE_HONO_URL}/cidade?lat=${lat}&lon=${lon}`,
    {
      key: `cidade-${lat}-${lon}`,
      server: false,
      headers: {
        "X-API-Key": import.meta.env.VITE_HONO_API_KEY,
      },
      default: () => ({
        cidade: "",
      }),
    },
  );

  return response.value.cidade;
}
