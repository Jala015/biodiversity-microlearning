import { obterImagemCurada, obterMaxIdLevel } from "~/utils/redis";
import type {
  INatTaxaResponse,
  INatTaxon,
  MediaEspecie,
  ConsultaINatResult,
  Especie,
} from "./types";

//----------------------------//
//                            //
//   Funções do iNaturalist   //
//                            //
//----------------------------//

/**
 * Consulta a API do iNaturalist para obter dados completos de uma espécie
 */
export async function consultarApiINat(
  scientificName: string,
): Promise<ConsultaINatResult | null> {
  try {
    const inatUrl = `/api/inaturalist/taxa?q=${encodeURIComponent(
      scientificName,
    )}&locale=pt-BR`;
    const { data: inatResp, error } = await useFetch<INatTaxaResponse>(
      decodeURIComponent(inatUrl),
      {
        key: `inat-taxa-${btoa(scientificName).slice(0, 10)}`,
        server: false,
        default: () => ({
          results: [],
          total_results: 0,
          page: 1,
          per_page: 0,
        }),
      },
    );

    if (error.value) {
      console.error(
        `❌ Erro ao consultar iNaturalist para ${scientificName}:`,
        error.value,
      );
      return null;
    }

    if (
      !inatResp.value ||
      !inatResp.value.results ||
      inatResp.value.results.length === 0
    ) {
      console.warn(`Nenhum resultado iNat para ${scientificName}`);
      return null;
    }

    const taxon = inatResp.value.results[0];

    if (!taxon) {
      console.warn(`Taxon não encontrado para ${scientificName}`);
      return null;
    }

    const nome_cientifico = taxon.name;
    let nomePopularPt: string | undefined = taxon.preferred_common_name;

    let foto: MediaEspecie | undefined = taxon.default_photo
      ? {
          identifier: taxon.default_photo.medium_url,
          type: "StillImage",
          license: taxon.default_photo.license_code!,
          rightsHolder: taxon.default_photo.attribution,
        }
      : undefined;

    return {
      taxon,
      inatId: taxon.id,
      nome_cientifico,
      nomePopularPt,
      foto,
    };
  } catch (error) {
    console.error(`❌ Erro ao unificar espécie ${scientificName}:`, error);
    return null;
  }
}

/**
 * Gera uma lista de táxons distratores (grupos irmãos) para um táxon correto
 */
export async function obterTaxonsIrmaos(
  correctTaxon: INatTaxon,
  count: number = 5,
): Promise<INatTaxon[]> {
  if (!correctTaxon.parent_id) {
    console.warn(
      `Táxon ${correctTaxon.name} não possui parent_id, não é possível buscar irmãos.`,
    );
    return [];
  }

  try {
    const inatUrl = `/api/inaturalist/taxa?parent_id=${correctTaxon.parent_id}&per_page=${
      count * 3
    }&is_active=true&rank_level=${correctTaxon.rank_level}&locale=pt-BR`;
    const { data: inatResp, error } = await useFetch<INatTaxaResponse>(
      decodeURIComponent(inatUrl),
      {
        key: `inat-siblings-${correctTaxon.parent_id}-${correctTaxon.rank_level}`,
        server: false,
        default: () => ({
          results: [],
          total_results: 0,
          page: 1,
          per_page: 0,
        }),
      },
    );

    if (error.value) {
      console.error(
        `❌ Erro ao buscar táxons irmãos para ${correctTaxon.name}:`,
        error.value,
      );
      return [];
    }

    if (
      !inatResp.value ||
      !inatResp.value.results ||
      inatResp.value.results.length === 0
    ) {
      return [];
    }

    const distractorCandidates = inatResp.value.results.filter(
      (taxon) => taxon.id !== correctTaxon.id,
    );

    const shuffled = distractorCandidates.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  } catch (error) {
    console.error(
      `❌ Erro ao buscar táxons irmãos para ${correctTaxon.name}:`,
      error,
    );
    return [];
  }
}

/**
 * Busca espécies aleatórias para usar como distratores genéricos
 */
export async function obterEspeciesAleatorias(
  count: number = 3,
): Promise<INatTaxon[]> {
  try {
    const randomPage = Math.floor(Math.random() * 100) + 1;
    const inatUrl = `/api/inaturalist/taxa?rank=species&is_active=true&per_page=${count * 2}&page=${randomPage}&locale=pt-BR`;
    const { data: inatResp, error } = await useFetch<INatTaxaResponse>(
      decodeURIComponent(inatUrl),
      {
        key: `inat-random-${randomPage}-${count}`,
        server: false,
        default: () => ({
          results: [],
          total_results: 0,
          page: 1,
          per_page: 0,
        }),
      },
    );

    if (error.value) {
      console.error("❌ Erro ao buscar espécies aleatórias:", error.value);
      return [];
    }

    if (
      !inatResp.value ||
      !inatResp.value.results ||
      inatResp.value.results.length === 0
    ) {
      return [];
    }

    const shuffled = inatResp.value.results.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  } catch (error) {
    console.error("❌ Erro ao buscar espécies aleatórias:", error);
    return [];
  }
}
