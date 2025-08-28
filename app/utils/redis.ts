import type { ConsultaINatResult } from "./api";

const runtimeConfig = useRuntimeConfig();

interface UpstashResponse<T = string> {
  result: T;
}

export async function obterImagemCurada(
  speciesKey: string,
): Promise<string | null> {
  try {
    const response = await $fetch<UpstashResponse<string | null>>(
      `${runtimeConfig.upstashRedisRestUrl}/get/species:imagem:${speciesKey}`,
      {
        headers: {
          Authorization: `Bearer ${runtimeConfig.upstashRedisRestToken}`,
        },
      },
    );

    if (!response || response.error) {
      console.error(
        `❌ Erro ao obter imagem curada para ${speciesKey}:`,
        response?.error || "Unknown error",
      );
      return null;
    }

    return response.value?.result || null;
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
      const response = await $fetch<UpstashResponse<string | null>>(
        `${runtimeConfig.upstashRedisRestUrl}/get/${redisKey}`,
        {
          headers: {
            Authorization: `Bearer ${runtimeConfig.upstashRedisRestToken}`,
          },
        },
      );

      // Debug detalhado
      console.info(`🔍 DEBUG ancestorId ${ancestorId}:`);
      console.info(
        `   - URL: ${runtimeConfig.upstashRedisRestUrl}/get/${redisKey}`,
      );
      console.info(`   - response?.error:`, response?.error);
      console.info(`   - response:`, response);
      console.info(`   - response?.result:`, response?.result);
      console.info(`   - typeof result:`, typeof response?.result);

      // Verificar se encontrou um valor válido no Redis (não nulo)
      if (
        !response?.error &&
        response?.result !== null &&
        response?.result !== undefined &&
        response?.result !== ""
      ) {
        console.info(
          `✅ SUCESSO! ancestorId ${ancestorId} → maxLevel: ${response.result}`,
        );
        maxLevel = response.result;
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
): Promise<Array<{
  nome_popular: string | undefined;
  nome_cientifico: string;
}> | null> {
  try {
    const redisKey = `especies:alternativas:${inatId}`;
    const response = await $fetch<
      UpstashResponse<Record<string, string> | null>
    >(`${runtimeConfig.upstashRedisRestUrl}/hgetall/${redisKey}`, {
      key: `redis-alternativas-${inatId}`,
      server: false,
      default: () => ({ result: null }),
      headers: {
        Authorization: `Bearer ${runtimeConfig.upstashRedisRestToken}`,
      },
    });

    if (!response || response.error) {
      console.error(
        `❌ Erro ao obter alternativas pré-definidas para ${inatId}:`,
        response?.error || "Unknown error",
      );
      return [];
    }

    if (!response.result) {
      return null;
    }

    const alternativas = [];
    const hashData = response.result;

    // Processar os dados do hash (1, 2, 3)
    for (let i = 1; i <= 3; i++) {
      const nomePopularKey = `${i}:nome_popular`;
      const nomeCientificoKey = `${i}:nome_cientifico`;

      if (hashData[nomeCientificoKey]) {
        alternativas.push({
          nome_popular: hashData[nomePopularKey] || undefined,
          nome_cientifico: hashData[nomeCientificoKey],
        });
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
    const response = await $fetch<UpstashResponse<string>>(
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

    if (!response || response.error) {
      console.error(
        "❌ Erro ao verificar conexão Redis:",
        response?.error || "Unknown error",
      );
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
