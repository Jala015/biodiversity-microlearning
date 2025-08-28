import { obterImagemCurada, obterMaxIdLevel } from "~/utils/redis";
import type {
  INatTaxaResponse,
  INatTaxon,
  MediaEspecie,
  ConsultaINatResult,
  INatChildren,
} from "../types";

//----------------------------//
//                            //
//   Funções do iNaturalist   //
//                            //
//----------------------------//

/**
 * Consulta a API do iNaturalist para obter dados completos de uma espécie
 *
 * Chamada por: montarCardsComAlternativas() em deck-builder.ts - para obter dados detalhados (taxon, foto, nomes) das espécies encontradas no GBIF
 */
/**
 * Consulta a API do iNaturalist para obter dados completos de uma espécie
 *
 * O resultado inclui ancestor_ids que são usados para:
 * 1. Enriquecer ValidSpecies (evitando consultas redundantes)
 * 2. Permitir busca de táxons irmãos taxonomicamente relacionados
 *
 * Chamada por: montarCardsComAlternativas() em deck-builder.ts - para obter dados detalhados (taxon, foto, nomes) das espécies encontradas no GBIF
 */
export async function consultarApiINat(
  scientificName: string,
): Promise<ConsultaINatResult | null> {
  try {
    const inatUrl = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(
      scientificName,
    )}&locale=pt-BR`;
    console.log(
      `ℹ️ Consultando iNaturalist para ${scientificName}. URL: ${inatUrl}`,
    );
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
        `❌ Erro ao consultar iNaturalist para ${scientificName} na URL ${inatUrl}:`,
        error,
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
      ancestor_ids: taxon.ancestor_ids,
    };
  } catch (error) {
    console.error(`❌ Erro ao unificar espécie ${scientificName}:`, error);
    return null;
  }
}

/**
 * Gera uma lista de táxons distratores (grupos irmãos) para um táxon correto
 * Usa ancestorids do iNaturalist para buscar táxons relacionados taxonomicamente
 *
 * Chamada por: gerarAlternativasIncorretas() em alternativas.ts - para buscar táxons relacionados taxonomicamente como alternativas incorretas
 */
export async function obterTaxonsIrmaos(
  correctTaxon: INatTaxon,
  count: number = 5,
): Promise<INatChildren[]> {
  if (!correctTaxon.ancestor_ids || correctTaxon.ancestor_ids.length === 0) {
    console.warn(
      `Táxon ${correctTaxon.name} não possui ancestor_ids, não é possível buscar irmãos.`,
    );
    return [];
  }

  try {
    // Usar ancestor_ids para buscar táxons do mesmo grupo taxonômico
    const last_ancestor_id =
      correctTaxon.ancestor_ids[correctTaxon.ancestor_ids.length - 2];
    const inatUrl = `https://api.inaturalist.org/v1/taxa/${last_ancestor_id}?locale=pt-BR`;

    console.log(
      `ℹ️ Buscando táxons irmãos para ${correctTaxon.name} usando ancestor_ids. URL: ${inatUrl}`,
    );

    await new Promise((resolve) => setTimeout(resolve, 1001)); // Adiciona um delay de 1001ms

    const { data: inatResp, error } = await useFetch<INatTaxaResponse>(
      inatUrl,
      {
        key: `inat-taxa-${last_ancestor_id}`,
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
        `❌ Erro ao buscar táxons irmãos para ${correctTaxon.name} na URL ${inatUrl}:`,
        error,
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

    if (!inatResp.value.results[0] || !inatResp.value.results[0].children) {
      return [];
    }

    const candidatos = inatResp.value.results[0].children.filter(
      (children) => children.id !== correctTaxon.id,
    );

    //priorizar distratores com mais espécies (proxy para mais famosos)
    const ordenados = candidatos.sort(
      (a, b) => b.complete_species_count - a.complete_species_count,
    );

    return ordenados.slice(0, count);
  } catch (error) {
    console.error(
      `❌ Erro ao buscar táxons irmãos para ${correctTaxon.name}:`,
      error,
    );
    return [];
  }
}

/**
 * Gera uma lista de táxons primos (netos do mesmo avô taxonômico) para um táxon correto
 * Usa ancestor_ids do iNaturalist para buscar um nível acima dos irmãos
 * Em seguida, busca os filhos dos "tios" para encontrar os verdadeiros primos
 *
 * Chamada por: gerarAlternativasIncorretas() em alternativas.ts - como fallback quando obterTaxonsIrmaos falha
 */
export async function obterTaxonsPrimos(
  correctTaxon: INatTaxon,
  count: number = 5,
): Promise<INatChildren[]> {
  if (!correctTaxon.ancestor_ids || correctTaxon.ancestor_ids.length < 2) {
    console.warn(
      `Táxon ${correctTaxon.name} não possui ancestor_ids suficientes para buscar primos.`,
    );
    return [];
  }

  try {
    // Usar o penúltimo ancestor_id (avô) em vez do último (pai)
    const granparent_id =
      correctTaxon.ancestor_ids[correctTaxon.ancestor_ids.length - 2];
    const inatUrl = `https://api.inaturalist.org/v1/taxa/${granparent_id}?locale=pt-BR`;

    console.log(
      `ℹ️ Buscando táxons primos para ${correctTaxon.name} usando avô taxonômico. URL: ${inatUrl}`,
    );

    await new Promise((resolve) => setTimeout(resolve, 1001)); // Adiciona um delay de 1001ms

    const { data: inatResp, error } = await useFetch<INatTaxaResponse>(
      inatUrl,
      {
        key: `inat-taxa-grandparent-${granparent_id}`,
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
        `❌ Erro ao buscar táxons primos para ${correctTaxon.name} na URL ${inatUrl}:`,
        error,
      );
      return [];
    }

    if (
      !inatResp.value ||
      !inatResp.value.results ||
      !inatResp.value.results[0] ||
      !inatResp.value.results[0].children
    ) {
      return [];
    }

    const avô = inatResp.value.results[0];

    if (!avô.children) {
      return [];
    }

    // Filtrar os "tios" (irmãos do pai)
    // Excluir o pai do táxon correto para evitar duplicação com irmãos
    const tios = avô.children.filter(
      (tio) => tio.id !== correctTaxon.parent_id && tio.id !== correctTaxon.id,
    );

    // Ordenar tios por número de espécies (priorizar os mais conhecidos)
    const tiosOrdenados = tios.sort(
      (a, b) => b.complete_species_count - a.complete_species_count,
    );

    // Buscar filhos dos tios (primos verdadeiros)
    const primos: INatChildren[] = [];

    // Iterar sobre os tios até obter primos suficientes
    for (const tio of tiosOrdenados) {
      if (primos.length >= count) break; // Já temos primos suficientes

      const tioUrl = `https://api.inaturalist.org/v1/taxa/${tio.id}?locale=pt-BR`;

      console.log(
        `ℹ️ Buscando filhos do táxon ${tio.name} (tio) para encontrar primos. URL: ${tioUrl}`,
      );

      await new Promise((resolve) => setTimeout(resolve, 1001)); // Delay entre requisições

      const { data: tioResp, error: tioError } =
        await useFetch<INatTaxaResponse>(tioUrl, {
          key: `inat-taxa-uncle-${tio.id}`,
          server: false,
          default: () => ({
            results: [],
            total_results: 0,
            page: 1,
            per_page: 0,
          }),
        });

      if (tioError.value) {
        console.error(
          `❌ Erro ao buscar filhos do táxon ${tio.name} na URL ${tioUrl}:`,
          tioError,
        );
        continue; // Tentar próximo tio
      }

      if (
        !tioResp.value ||
        !tioResp.value.results ||
        !tioResp.value.results[0] ||
        !tioResp.value.results[0].children
      ) {
        continue; // Tentar próximo tio
      }

      // Adicionar os filhos do tio (primos) à lista
      const primosDoTio = tioResp.value.results[0].children;

      // Ordenar primos deste tio por número de espécies
      const primosOrdenados = primosDoTio.sort(
        (a, b) => b.complete_species_count - a.complete_species_count,
      );

      // Adicionar primos à lista principal
      primos.push(...primosOrdenados);

      console.log(
        `✓ Encontrados ${primosOrdenados.length} primos do táxon ${tio.name}`,
      );
    }

    // Se não encontramos primos, retornar os tios como fallback
    if (primos.length === 0) {
      console.log(
        `⚠️ Não foram encontrados primos verdadeiros, usando tios como fallback.`,
      );
      return tiosOrdenados.slice(0, count);
    }

    return primos.slice(0, count);
  } catch (error) {
    console.error(
      `❌ Erro ao buscar táxons primos para ${correctTaxon.name}:`,
      error,
    );
    return [];
  }
}

/**
 * Busca espécies aleatórias para usar como distratores genéricos
 *
 * Chamada por: gerarAlternativasIncorretas() em alternativas.ts - para completar alternativas incorretas quando não há táxons irmãos suficientes
 */
export async function obterEspeciesAleatorias(
  count: number = 3,
): Promise<INatTaxon[]> {
  try {
    const randomPage = Math.floor(Math.random() * 100) + 1;
    const inatUrl = `https://api.inaturalist.org/v1/taxa?rank=species&is_active=true&per_page=${count * 2}&page=${randomPage}&locale=pt-BR`;
    console.log(`ℹ️ Buscando ${count} espécies aleatórias. URL: ${inatUrl}`);
    await new Promise((resolve) => setTimeout(resolve, 1001)); // Adiciona um delay de 1001ms
    const { data: inatResp, error } = await useFetch<INatTaxaResponse>(
      inatUrl,
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
      console.error(
        `❌ Erro ao buscar espécies aleatórias na URL ${inatUrl}:`,
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

    const shuffled = inatResp.value.results.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  } catch (error) {
    console.error("❌ Erro ao buscar espécies aleatórias:", error);
    return [];
  }
}
