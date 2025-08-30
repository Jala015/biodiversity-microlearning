import type { INatTaxon, Especie } from "../types";
import {
  obterTaxonsIrmaos,
  obterTaxonsPrimos,
  obterEspeciesAleatorias,
} from "../sources/inaturalist";
import { obterAlternativasPreDefinidas } from "~/utils/api/sources/redis";

//----------------------------//
//                            //
//  Geração de Alternativas   //
//                            //
//----------------------------//

/**
 * Extrai o epiteto específico de um nome científico binomial
 *
 * Chamada por: gerarAlternativasIncorretas() - para criar alternativas usando epiteto correto + gênero errado
 */
function extrairEpitetoEspecifico(nomeCientifico: string): string | null {
  const partes = nomeCientifico.trim().split(" ");
  if (partes.length >= 2) {
    return partes[1] || null;
  }
  return null;
}

/**
 * Extrai o gênero de um nome científico binomial
 *
 * Chamada por: gerarAlternativasIncorretas() - para criar alternativas misturando gênero de irmão com epiteto correto
 */
function extrairGenero(nomeCientifico: string): string | null {
  const partes = nomeCientifico.trim().split(" ");
  if (partes.length >= 1) {
    return partes[0] || null;
  }
  return null;
}

/**
 * Busca alternativas dentro dos grupos taxonômicos processados por processarEAgrupar()
 *
 * Chamada por: gerarAlternativasIncorretas() - para buscar alternativas dentro do mesmo grupo taxonômico
 */
function buscarAlternativasNoGrupo(
  correctTaxon: INatTaxon,
  maxIdLevel: string,
  gruposTaxon: Map<
    string,
    {
      especiesRepresentativa: string;
      dados: any;
      maxIdLevel: string;
      countTotal: number;
      especies: string[];
    }
  >,
): Especie[] {
  const alternativas: Especie[] = [];

  // Determinar chave do táxon correto
  let taxonKey: string;
  switch (maxIdLevel.toLowerCase()) {
    case "species":
      taxonKey = `species:${correctTaxon.name}`;
      break;
    case "genus":
      const genero = correctTaxon.name.split(" ")[0] || "";
      taxonKey = `genus:${genero}`;
      break;
    case "family":
      taxonKey = `family:${correctTaxon.parent_id || correctTaxon.id}`;
      break;
    default:
      taxonKey = `${maxIdLevel}:${correctTaxon.id}`;
      break;
  }

  // Buscar grupo do táxon
  const grupoCorreto = gruposTaxon.get(taxonKey);
  if (!grupoCorreto) {
    console.warn(
      `Grupo não encontrado para ${correctTaxon.name} com chave ${taxonKey}`,
    );
    return alternativas;
  }

  // Se o grupo tem múltiplas espécies, usar as outras como alternativas
  const outrasEspecies = grupoCorreto.especies.filter(
    (especie) => especie !== correctTaxon.name,
  );

  for (const especie of outrasEspecies) {
    if (alternativas.length >= 3) break;
    alternativas.push({
      nome_cientifico: especie,
      nome_popular: undefined, // Será preenchido depois se disponível
    });
  }

  return alternativas;
}

/**
 * Gera exatamente 3 alternativas incorretas para um flashcard
 * Usa os grupos taxonômicos processados por processarEAgrupar() como primeira opção
 */
export async function gerarAlternativasIncorretas(
  correctTaxon: INatTaxon,
  nomePopularCorreto: string | undefined,
  nivelTaxonomicoMaximo: string,
  gruposTaxon?: Map<
    string,
    {
      especiesRepresentativa: string;
      dados: any;
      maxIdLevel: string;
      countTotal: number;
      especies: string[];
    }
  >,
): Promise<Especie[]> {
  //FIXME alternativas tem que ser do mesmo nivel taxonomico do taxon correto

  // 1. PRIMEIRA PRIORIDADE: tentar buscar alternativas pré-definidas no Redis
  const alternativasPreDefinidas = await obterAlternativasPreDefinidas(
    correctTaxon.id,
  );
  if (alternativasPreDefinidas && alternativasPreDefinidas.length >= 3) {
    return alternativasPreDefinidas.slice(0, 3);
  }
  let alternativas: Especie[] = [];
  const alternativasUsadas = new Set<string>(); // Para evitar duplicatas

  // 2. SEGUNDA PRIORIDADE: Buscar no mesmo grupo taxonômico processado por processarEAgrupar()
  if (gruposTaxon) {
    const alternativasGrupo = buscarAlternativasNoGrupo(
      correctTaxon,
      nivelTaxonomicoMaximo,
      gruposTaxon,
    );

    for (const alt of alternativasGrupo) {
      if (alternativas.length >= 3) break;
      const key = `${alt.nome_cientifico}|${alt.nome_popular || ""}`;
      if (!alternativasUsadas.has(key)) {
        alternativas.push(alt);
        alternativasUsadas.add(key);
      }
    }
  }

  // 3. TERCEIRA PRIORIDADE: Se não tiver 3 alternativas, usar obterTaxonsIrmaos(). Não uso esse em espécies para evitar problemas com híbridos.
  if (alternativas.length < 3 && nivelTaxonomicoMaximo !== "species") {
    try {
      const taxonsIrmaos = await obterTaxonsIrmaos(correctTaxon, 5);
      for (const irmao of taxonsIrmaos) {
        if (alternativas.length >= 3) break;
        const key = `${irmao.name}|${irmao.preferred_common_name || ""}`;
        if (!alternativasUsadas.has(key)) {
          alternativas.push({
            nome_cientifico: irmao.name,
            nome_popular: irmao.preferred_common_name,
          });
          alternativasUsadas.add(key);
        }
      }
    } catch (error) {
      console.error(`Erro ao buscar táxons irmãos:`, error);
    }
  }

  // 4. QUARTA PRIORIDADE: Se obterTaxonsIrmaos falhou ou não tiver 3 alternativas, usar obterTaxonsPrimos().
  if (alternativas.length < 3) {
    try {
      const taxonsPrimos = await obterTaxonsPrimos(correctTaxon, 5);
      for (const primo of taxonsPrimos) {
        if (alternativas.length >= 3) break;
        const key = `${primo.name}|${primo.preferred_common_name || ""}`;
        if (!alternativasUsadas.has(key)) {
          alternativas.push({
            nome_cientifico: primo.name,
            nome_popular: primo.preferred_common_name,
          });
          alternativasUsadas.add(key);
        }
      }
    } catch (error) {
      console.error(`Erro ao buscar táxons primos:`, error);
    }
  }

  //fatiar cada resultado para não ter mais de duas palavras (evitar subespecies)
  alternativas.forEach((alternativa) => {
    alternativa.nome_cientifico = alternativa.nome_cientifico
      .split(" ")
      .slice(0, 2)
      .join(" ");
  });

  //remover alternativas repetidas (eram mesma esppécie com subespecies diferentes)
  alternativas = alternativas.filter(
    (alternativa, index, self) =>
      index ===
      self.findIndex((a) => a.nome_cientifico === alternativa.nome_cientifico),
  );

  // 5. ESTRATÉGIAS ESPECÍFICAS PARA NÍVEL DE ESPÉCIE (apenas se ainda faltarem alternativas)
  if (alternativas.length < 3 && nivelTaxonomicoMaximo === "species") {
    const faltam = 3 - alternativas.length;

    const estrategias = [];

    // Nome popular certo, mas científico errado (só quando tem nome popular)
    if (nomePopularCorreto) {
      estrategias.push("nome_popular_correto");
    }

    // Epiteto específico certo, mas gênero errado
    estrategias.push("epiteto_correto");

    // Embaralha as estratégias
    const estrategiasEmbaralhadas = estrategias.sort(() => 0.5 - Math.random());

    for (const estrategia of estrategiasEmbaralhadas) {
      if (alternativas.length >= 3) break;

      try {
        if (estrategia === "nome_popular_correto" && nomePopularCorreto) {
          // Nome popular correto, científico aleatório
          const especiesAleatorias = await obterEspeciesAleatorias(3);
          for (const especie of especiesAleatorias) {
            if (alternativas.length >= 3) break;
            const key = `${especie.name}|${nomePopularCorreto}`;
            if (!alternativasUsadas.has(key)) {
              alternativas.push({
                nome_cientifico: especie.name,
                nome_popular: nomePopularCorreto,
              });
              alternativasUsadas.add(key);
            }
          }
        } else if (estrategia === "epiteto_correto") {
          // Epiteto específico correto, gênero de irmão
          const epitetoEspecifico = extrairEpitetoEspecifico(correctTaxon.name);
          if (epitetoEspecifico) {
            const taxonsIrmaos = await obterTaxonsIrmaos(correctTaxon, 5);
            for (const irmao of taxonsIrmaos) {
              if (alternativas.length >= 3) break;
              const generoIrmao = extrairGenero(irmao.name);
              if (generoIrmao) {
                const nomeMisturado = `${generoIrmao} ${epitetoEspecifico}`;
                const key = `${nomeMisturado}|${irmao.preferred_common_name || ""}`;
                if (!alternativasUsadas.has(key)) {
                  alternativas.push({
                    nome_cientifico: nomeMisturado,
                    nome_popular: irmao.preferred_common_name,
                  });
                  alternativasUsadas.add(key);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Erro ao executar estratégia ${estrategia}:`, error);
        continue;
      }
    }
  }

  // 6. FALLBACK FINAL: Se ainda não conseguimos 3 alternativas, completar com espécies aleatórias
  if (alternativas.length < 3) {
    console.warn(
      `⚠️ Apenas ${alternativas.length} alternativas geradas, completando com espécies aleatórias...`,
    );
    try {
      const especiesAleatorias = await obterEspeciesAleatorias(5);
      for (const especie of especiesAleatorias) {
        if (alternativas.length >= 3) break;
        const key = `${especie.name}|${especie.preferred_common_name || ""}`;
        if (!alternativasUsadas.has(key)) {
          alternativas.push({
            nome_cientifico: especie.name,
            nome_popular: especie.preferred_common_name,
          });
          alternativasUsadas.add(key);
        }
      }
    } catch (error) {
      console.error(`Erro ao buscar espécies aleatórias:`, error);
    }
  }

  // Garantir que sempre temos exatamente 3 alternativas
  const resultado = alternativas.slice(0, 3);

  // se o correctTaxon tiver nome popular, garantir que alternativas também tenham
  if (
    correctTaxon.preferred_common_name &&
    resultado.some((a) => !a.nome_popular)
  ) {
    // lista de alternativas que ja tem nome popular
    let temNomePopular = resultado.filter((a) => a.nome_popular);
    resultado.forEach((a) => {
      if (!a.nome_popular) {
        if (temNomePopular?.length > 0) {
          //sortear entre o nome popular da alternativa e o nome popular do correctTaxon
          a.nome_popular =
            Math.random() < 0.5
              ? correctTaxon.preferred_common_name
              : (temNomePopular?.pop()?.nome_popular ??
                correctTaxon.preferred_common_name);
        } else {
          // usar o nome popular do correctTaxon
          a.nome_popular = correctTaxon.preferred_common_name;
        }
      }
    });
  }

  return resultado;
}
