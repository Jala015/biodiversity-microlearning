import { getCache, setCache } from "~/utils/function-cache";
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
 */
export async function consultarApiINat(
  scientificName: string,
): Promise<ConsultaINatResult | null> {
  // Tenta buscar do cache primeiro
  const cacheKey = `inat-${scientificName}`;
  const cached = await getCache<ConsultaINatResult | null>(cacheKey);

  if (cached !== null) {
    return cached;
  }

  // Cache miss:

  try {
    const inatUrl = `${import.meta.env.VITE_HONO_URL}/api/inat/v1/taxa?q=${encodeURIComponent(
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
        headers: {
          "X-API-Key": import.meta.env.VITE_HONO_API_KEY,
        },
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
      await setCache(cacheKey, null); // salva o null no cache para evitar chamadas desnecessárias
      return null;
    }

    const taxon = inatResp.value.results[0];

    if (!taxon) {
      console.warn(`Taxon não encontrado para ${scientificName}`);
      await setCache(cacheKey, null); // salva o null no cache para evitar chamadas desnecessárias
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

    const result = {
      taxon,
      inatId: taxon.id,
      nome_cientifico,
      nomePopularPt,
      foto,
      ancestor_ids: taxon.ancestor_ids,
      nivel_taxonomico: taxon.rank,
    };
    await setCache(cacheKey, result); // Salva resultado no cache
    await new Promise((resolve) => setTimeout(resolve, 1001)); // Adiciona um delay de 1001ms
    return result;
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

  const cacheKey = `inat-taxons-irmaos-${correctTaxon.id}-${count}`;
  const cached = await getCache<INatChildren[] | null>(cacheKey);

  if (cached !== null) {
    return cached;
  }

  //cache miss. Buscar na api do iNat:

  try {
    // Usar ancestor_ids para buscar táxons do mesmo grupo taxonômico
    const last_ancestor_id =
      correctTaxon.ancestor_ids[correctTaxon.ancestor_ids.length - 2];
    const inatUrl = `${import.meta.env.VITE_HONO_URL}/api/inat/v1/taxa/${last_ancestor_id}?locale=pt-BR`;

    console.log(
      `ℹ️ Buscando táxons irmãos para ${correctTaxon.name} usando ancestor_ids. URL: ${inatUrl}`,
    );

    await new Promise((resolve) => setTimeout(resolve, 1001)); // Adiciona um delay de 1001ms

    const { data: inatResp, error } = await useFetch<INatTaxaResponse>(
      inatUrl,
      {
        key: `inat-taxa-${last_ancestor_id}`,
        server: false,
        headers: {
          "X-API-Key": import.meta.env.VITE_HONO_API_KEY,
        },
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

    // caso não tenha resultados
    if (
      !inatResp.value ||
      !inatResp.value.results ||
      inatResp.value.results.length === 0
    ) {
      await setCache(cacheKey, []);
      return [];
    }

    // caso os resultados não tenham filhos
    if (!inatResp.value.results[0] || !inatResp.value.results[0].children) {
      await setCache(cacheKey, []);
      return [];
    }

    const candidatos = inatResp.value.results[0].children.filter(
      (children) => children.id !== correctTaxon.id,
    );

    //priorizar distratores com mais espécies (proxy para mais famosos)
    const ordenados = candidatos.sort(
      (a, b) => b.complete_species_count - a.complete_species_count,
    );

    const result = ordenados.slice(0, count);
    await setCache(cacheKey, result);
    return result;
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

  const cacheKey = `inat-taxa-primos-${correctTaxon.id}-${count}`;
  const cachedResult = await getCache<INatChildren[]>(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  // cache miss, buscar na API do iNat:

  try {
    // Usar o penúltimo ancestor_id (avô) em vez do último (pai)
    const granparent_id =
      correctTaxon.ancestor_ids[correctTaxon.ancestor_ids.length - 2];
    const inatUrl = `${import.meta.env.VITE_HONO_URL}/api/inat/v1/taxa/${granparent_id}?locale=pt-BR`;

    await new Promise((resolve) => setTimeout(resolve, 1001)); // Adiciona um delay de 1001ms

    const { data: inatResp, error } = await useFetch<INatTaxaResponse>(
      inatUrl,
      {
        key: `inat-taxa-grandparent-${granparent_id}`,
        server: false,
        headers: {
          "X-API-Key": import.meta.env.VITE_HONO_API_KEY,
        },
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
      await setCache(cacheKey, []);
      return [];
    }

    const avô = inatResp.value.results[0];

    if (!avô.children) {
      await setCache(cacheKey, []);
      return [];
    }

    // Filtrar os "tios" (irmãos do pai)
    // Excluir o pai do táxon correto para evitar duplicação com irmãos
    let tios = avô.children.filter(
      (tio) => tio.id !== correctTaxon.parent_id && tio.id !== correctTaxon.id,
    );

    // Ordenar tios por número de espécies (priorizar os mais conhecidos)
    let tiosOrdenados = tios.sort(
      (a, b) => b.complete_species_count - a.complete_species_count,
    );

    // Buscar filhos dos tios (primos verdadeiros)
    let primos: INatChildren[] = [];

    // Iterar sobre os tios até obter primos suficientes
    let iterator_limiter = 0; //evitar consultas excessivas, caso não haja primos suficientes
    for (const tio of tiosOrdenados) {
      if (primos.length >= count) break; // Já temos primos suficientes
      if (iterator_limiter >= 3) break; // Evitar consultas excessivas

      const tioUrl = `${import.meta.env.VITE_HONO_URL}/api/inat/v1/taxa/${tio.id}?locale=pt-BR`;

      await new Promise((resolve) => setTimeout(resolve, 1001)); // Delay entre requisições

      const { data: tioResp, error: tioError } =
        await useFetch<INatTaxaResponse>(tioUrl, {
          key: `inat-taxa-uncle-${tio.id}`,
          server: false,
          headers: {
            "X-API-Key": import.meta.env.VITE_HONO_API_KEY,
          },
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
        iterator_limiter++;
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
    }

    // Se não encontramos primos, retornar os tios como fallback
    if (primos.length === 0) {
      return tiosOrdenados.slice(0, count);
    }

    const result = primos.slice(0, count);
    await setCache(cacheKey, result);
    return result;
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
  rank: string = "species",
): Promise<INatTaxon[]> {
  try {
    const randomPage = Math.floor(Math.random() * 100) + 1;
    const inatUrl = `${import.meta.env.VITE_HONO_URL}/api/inat/v1/taxa?rank=${rank}&is_active=true&per_page=${count * 2}&page=${randomPage}&locale=pt-BR`;
    await new Promise((resolve) => setTimeout(resolve, 1001)); // Adiciona um delay de 1001ms
    const { data: inatResp, error } = await useFetch<INatTaxaResponse>(
      inatUrl,
      {
        key: `inat-random-${randomPage}-${count}`,
        server: false,
        headers: {
          "X-API-Key": import.meta.env.VITE_HONO_API_KEY,
        },
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
