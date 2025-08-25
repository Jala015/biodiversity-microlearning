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
    >(`${process.env.UPSTASH_REDIS_REST_URL}/hgetall/${redisKey}`, {
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      },
    });

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
