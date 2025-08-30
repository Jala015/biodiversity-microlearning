import { getCache, setCache } from "~/utils/function-cache";
import type { ConsultaINatResult, Especie, MediaEspecie } from "..";

interface UpstashResponse<T = string> {
  result: T;
}

export async function obterImagemCurada(
  speciesKey: string,
): Promise<MediaEspecie | null> {
  const cacheKey = `redis-imagem-${speciesKey}`;
  const cached = await getCache<MediaEspecie | null>(cacheKey);

  if (cached !== null) {
    return cached;
  }

  //cache miss:

  try {
    const { data: img_url, error } = await useFetch<
      UpstashResponse<string | null>
    >(`/api/valid_species/get/species:imagem:${speciesKey}`, {
      key: `redis-imagem-${speciesKey}`,
      server: false,
      default: () => ({ result: null }),
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN}`,
      },
    });

    if (error.value || img_url.value?.result === null) {
      console.error(`❌ Sem imagem curada ${speciesKey}:`, error.value);
      return null;
    }

    const { data: img_attr, error: erro2 } = await useFetch<
      UpstashResponse<string | null>
    >(`/api/valid_species/get/species:atribuicaoImg:${speciesKey}`, {
      key: `redis-licensaimagem-${speciesKey}`,
      server: false,
      default: () => ({ result: null }),
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN}`,
      },
    });

    if (erro2.value) {
      console.error(
        `❌ Erro ao obter licença de imagem curada para ${speciesKey}:`,
        erro2.value,
      );
      return null;
    }

    const result = {
      identifier: img_url.value?.result ?? "",
      type: "StillImage",
      license: "CC",
      rightsHolder: img_attr.value?.result || "imagem obtida do iNaturalist",
    };

    await setCache(cacheKey, result); // Salva resultado no cache
    return result;
  } catch (error) {
    console.error(`Erro ao buscar imagem curada para ${speciesKey}:`, error);
    return null;
  }
}

// Função para obter o máximo nível de taxonomia identificável para um determinado ID de iNaturalist
export async function obterMaxIdLevel(
  // FIXME
  dados: ConsultaINatResult,
): Promise<string> {
  const cacheKey = `redis-maxIdLevel-${dados.inatId}`;
  const cached = await getCache<string | null>(cacheKey);

  if (cached !== null) {
    return cached;
  }

  // Cache miss, buscar no Redis

  let maxLevel = "species";
  if (!dados) {
    console.error("Erro ao obter maxIdLevel. Dados inválidos");
    return maxLevel;
  }
  if (!dados.ancestor_ids || !Array.isArray(dados.ancestor_ids)) {
    console.error("Erro ao obter maxIdLevel. ancestorIds com problema");
    return maxLevel;
  }

  // Iterar entre os níveis de taxonomia, do mais específico ao mais genérico
  for (let i = dados.ancestor_ids.length - 1; i >= 0; i--) {
    const ancestorId = dados.ancestor_ids[i];
    try {
      const redisKey = `species:taxonomiclevel:${ancestorId}`;
      const { data: response, error } = await useFetch<
        UpstashResponse<string | null>
      >(`/api/valid_species/get/${redisKey}`, {
        server: false,
        default: () => ({ result: null }),
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN}`,
        },
      });

      // Verificar se encontrou um valor válido no Redis (não nulo)
      if (
        !error.value &&
        response.value &&
        response.value.result !== null &&
        response.value.result !== undefined &&
        response.value.result !== ""
      ) {
        maxLevel = response.value.result;
        break;
      }
    } catch (error) {
      console.error(`💥 Erro consultando ${ancestorId}: ${error}`);
      continue;
    }
  }

  // Salvar no cache
  await setCache(`redis-maxIdLevel-${dados.inatId}`, maxLevel, 1);

  return maxLevel;
}

// Função para obter alternativas pré-definidas do Redis
export async function obterAlternativasPreDefinidas(
  inatId: number,
): Promise<Especie[] | null> {
  const cacheKey = `redis-alternativas-${inatId}`;
  const cached = await getCache<Especie[] | null>(cacheKey);

  if (cached !== null) {
    return cached;
  }

  // Cache miss. Buscando alternativas.

  try {
    const alternativas: Especie[] = [];

    // Buscar cada alternativa possível (1, 2, 3)
    for (let i = 1; i <= 3; i++) {
      const redisKey = `species:alternativas:${inatId}:${i}`;

      const { data: response, error } = await useFetch<
        UpstashResponse<string | null>
      >(`/api/valid_species/get/${redisKey}`, {
        key: `redis-alternativas-${inatId}-${i}`,
        server: false,
        default: () => ({ result: null }),
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN}`,
        },
      });

      if (error.value) {
        console.error(
          `❌ Erro ao obter alternativa ${i} para ${inatId}:`,
          error.value,
        );
        continue;
      }

      // Se encontrou uma alternativa, parsear o JSON
      if (response.value?.result) {
        try {
          const especie = JSON.parse(response.value.result);
          alternativas.push(especie);
        } catch (parseError) {
          console.error(
            `❌ Erro ao parsear alternativa ${i} para ${inatId}:`,
            parseError,
          );
        }
      }
    }

    const result = alternativas.length > 0 ? alternativas : [];
    //salvar no cache
    await setCache(cacheKey, result, 4);
    return result;
  } catch (error) {
    console.error(
      `Erro ao buscar alternativas pré-definidas para iNat ID ${inatId}:`,
      error,
    );
    return null;
  }
}

// Função auxiliar para testar a conexão
export async function verificarConexaoRedis(): Promise<boolean> {
  try {
    const { error } = await useFetch<UpstashResponse<string>>(
      `/api/valid_species/ping`,
      {
        key: "redis-ping-check",
        server: false,
        default: () => ({ result: "PONG" }),
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN}`,
        },
      },
    );

    if (error.value) {
      console.error("❌ Erro ao verificar conexão Redis:", error.value);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
