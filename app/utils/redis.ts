import type { ConsultaINatResult, Especie, MediaEspecie } from "./api";

<<<<<<< HEAD
const redis_url = "/api/valid_species/";
const redis_api_key = "ApPiAAIgcDEdSow3u_0gj_Y4i-PLM7zHNLf6uEuJmr4PLNwD-X13nA";
=======
const runtimeConfig = useRuntimeConfig();
>>>>>>> parent of cbb2cd8 (url do redis hard coded)

interface UpstashResponse<T = string> {
  result: T;
}

export async function obterImagemCurada(
  speciesKey: string,
): Promise<MediaEspecie | null> {
  try {
    const { data: img_url, error } = await useFetch<
      UpstashResponse<string | null>
    >(`${runtimeConfig.upstashRedisRestUrl}/get/species:imagem:${speciesKey}`, {
      key: `redis-imagem-${speciesKey}`,
      server: false,
      default: () => ({ result: null }),
      headers: {
        Authorization: `Bearer ${runtimeConfig.upstashRedisRestToken}`,
      },
    });

    if (error.value || img_url.value?.result === null) {
      console.error(
        `❌ Sem imagem curada ${speciesKey}:`,
        error.value,
      );
      return null;
    }

    console.log(`Imagem curada para ${speciesKey}:`, img_url.value?.result);

    const { data: img_attr, error: erro2 } = await useFetch<
      UpstashResponse<string | null>
    >(`${redis_url}/get/species:atribuicaoImg:${speciesKey}`, {
      key: `redis-licensaimagem-${speciesKey}`,
      server: false,
      default: () => ({ result: null }),
      headers: {
        Authorization: `Bearer ${redis_api_key}`,
      },
    });

    if (erro2.value) {
      console.error(
        `❌ Erro ao obter licença de imagem curada para ${speciesKey}:`,
        erro2.value,
      );
      return null;
    }

    return {
      identifier: img_url.value?.result ?? '',
      type: "StillImage",
      license: "CC",
      rightsHolder: img_attr.value?.result || "imagem obtida do iNaturalist",
    };
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
    console.info(`Buscando max id no nivel ${i}`);
    try {
      const redisKey = `species:taxonomiclevel:${ancestorId}`;
      const { data: response, error } = await useFetch<
        UpstashResponse<string | null>
      >(`${runtimeConfig.upstashRedisRestUrl}/get/${redisKey}`, {
        server: false,
        default: () => ({ result: null }),
        headers: {
          Authorization: `Bearer ${runtimeConfig.upstashRedisRestToken}`,
        },
      });

<<<<<<< HEAD
=======
      // Debug detalhado
      console.info(`🔍 DEBUG ancestorId ${ancestorId}:`);
      console.info(
        `   - URL: ${runtimeConfig.upstashRedisRestUrl}/get/${redisKey}`,
      );
      console.info(`   - error.value:`, error.value);
      console.info(`   - response.value:`, response.value);
      console.info(`   - response.value?.result:`, response.value?.result);
      console.info(`   - typeof result:`, typeof response.value?.result);

>>>>>>> parent of cbb2cd8 (url do redis hard coded)
      // Verificar se encontrou um valor válido no Redis (não nulo)
      if (
        !error.value &&
        response.value &&
        response.value.result !== null &&
        response.value.result !== undefined &&
        response.value.result !== ""
      ) {
        console.info(
          `✅ SUCESSO! ancestorId ${ancestorId} → maxLevel: ${response.value.result}`,
        );
        maxLevel = response.value.result;
        break;
      } else {
        console.info(`❌ ancestorId ${ancestorId} não tem maxLevel no Redis`);
        if (ancestorId === 3) {
          console.error(
            `🚨 ATENÇÃO: ID 3 (Aves) deveria ter valor 'species' mas não foi encontrado!`,
          );
        }
      }
    } catch (error) {
      console.error(`💥 Erro consultando ${ancestorId}: ${error}`);
      continue;
    }
  }
  return maxLevel;
}

// Função para obter alternativas pré-definidas do Redis
export async function obterAlternativasPreDefinidas(
  inatId: number,
): Promise<Especie[]> {
  try {
<<<<<<< HEAD
    const alternativas: Especie[] = [];
=======
    const redisKey = `especies:alternativas:${inatId}`;
    const { data: response, error } = await useFetch<
      UpstashResponse<Record<string, string> | null>
    >(`${runtimeConfig.upstashRedisRestUrl}/hgetall/${redisKey}`, {
      key: `redis-alternativas-${inatId}`,
      server: false,
      default: () => ({ result: null }),
      headers: {
        Authorization: `Bearer ${runtimeConfig.upstashRedisRestToken}`,
      },
    });
>>>>>>> parent of cbb2cd8 (url do redis hard coded)

    // Buscar cada alternativa possível (1, 2, 3)
    for (let i = 1; i <= 3; i++) {
      const redisKey = `species:alternativas:${inatId}:${i}`;

      const { data: response, error } = await useFetch<
        UpstashResponse<string | null>
      >(`${redis_url}/get/${redisKey}`, {
        key: `redis-alternativas-${inatId}-${i}`,
        server: false,
        default: () => ({ result: null }),
        headers: {
          Authorization: `Bearer ${redis_api_key}`,
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

    return alternativas.length > 0 ? alternativas : null;
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
      `${runtimeConfig.upstashRedisRestUrl}/ping`,
      {
        key: "redis-ping-check",
        server: false,
        default: () => ({ result: "PONG" }),
        headers: {
          Authorization: `Bearer ${runtimeConfig.upstashRedisRestToken}`,
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
