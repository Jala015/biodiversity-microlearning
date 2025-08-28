import { isNative, max } from "lodash";
import type { ConsultaINatResult } from "./api";

interface UpstashResponse<T = string> {
  result: T;
}

export async function obterImagemCurada(
  speciesKey: string,
): Promise<string | null> {
  try {
    const { data: response, error } = await useFetch<
      UpstashResponse<string | null>
    >(
      `${process.env.UPSTASH_REDIS_REST_URL}/get/species:imagem:${speciesKey}`,
      {
        key: `redis-imagem-${speciesKey}`,
        server: false,
        default: () => ({ result: null }),
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      },
    );

    if (error.value) {
      console.error(
        `❌ Erro ao obter imagem curada para ${speciesKey}:`,
        error.value,
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
      const { data: response, error } = await useFetch<
        UpstashResponse<string | null>
      >(`${process.env.UPSTASH_REDIS_REST_URL}/get/${redisKey}`, {
        server: false,
        default: () => ({ result: null }),
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      });

      // Debug detalhado
      console.info(`🔍 DEBUG ancestorId ${ancestorId}:`);
      console.info(
        `   - URL: ${process.env.UPSTASH_REDIS_REST_URL}/get/${redisKey}`,
      );
      console.info(`   - error.value:`, error.value);
      console.info(`   - response.value:`, response.value);
      console.info(`   - response.value?.result:`, response.value?.result);
      console.info(`   - typeof result:`, typeof response.value?.result);

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
): Promise<Array<{
  nome_popular: string | undefined;
  nome_cientifico: string;
}> | null> {
  try {
    const redisKey = `especies:alternativas:${inatId}`;
    const { data: response, error } = await useFetch<
      UpstashResponse<Record<string, string> | null>
    >(`${process.env.UPSTASH_REDIS_REST_URL}/hgetall/${redisKey}`, {
      key: `redis-alternativas-${inatId}`,
      server: false,
      default: () => ({ result: null }),
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      },
    });

    if (error.value) {
      console.error(
        `❌ Erro ao obter alternativas pré-definidas para ${inatId}:`,
        error.value,
      );
      return [];
    }

    if (!response.value?.result) {
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
    const { error } = await useFetch<UpstashResponse<string>>(
      `${process.env.UPSTASH_REDIS_REST_URL}/ping`,
      {
        key: "redis-ping-check",
        server: false,
        default: () => ({ result: "PONG" }),
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
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
