interface UpstashResponse<T = string> {
  result: T;
}

export async function obterImagemCurada(
  speciesKey: string,
): Promise<string | null> {
  try {
    const response = await $fetch<UpstashResponse<string | null>>(
      `${process.env.UPSTASH_REDIS_REST_URL}/get/species:imagem:${speciesKey}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      },
    );

    return response.result;
  } catch (error) {
    console.error(`Erro ao buscar imagem curada para ${speciesKey}:`, error);
    return null;
  }
}

// Função para obter o máximo nível de taxonomia identificável para um determinado ID de iNaturalist
export async function obterMaxIdLevel(inatId: number): Promise<string> {
  try {
    const redisKey = `species:taxonomiclevel:${inatId}`;
    const response = await $fetch<UpstashResponse<string | null>>(
      `${process.env.UPSTASH_REDIS_REST_URL}/get/${redisKey}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      },
    );

    return response.result || "";
  } catch (error) {
    return "";
  }
}

// Função auxiliar para testar a conexão
export async function verificarConexaoRedis(): Promise<boolean> {
  try {
    await $fetch<UpstashResponse<string>>(
      `${process.env.UPSTASH_REDIS_REST_URL}/ping`,
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      },
    );
    return true;
  } catch {
    return false;
  }
}
