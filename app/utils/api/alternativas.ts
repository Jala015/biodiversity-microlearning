import type { INatTaxon, Especie } from "./types";
import { obterTaxonsIrmaos, obterEspeciesAleatorias } from "./inaturalist";
import { obterAlternativasPreDefinidas } from "~/utils/redis";

//----------------------------//
//                            //
//  Geração de Alternativas   //
//                            //
//----------------------------//

/**
 * Extrai o epiteto específico de um nome científico binomial
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
 */
function extrairGenero(nomeCientifico: string): string | null {
  const partes = nomeCientifico.trim().split(" ");
  if (partes.length >= 1) {
    return partes[0] || null;
  }
  return null;
}

/**
 * Gera exatamente 3 alternativas incorretas para um flashcard
 */
export async function gerarAlternativasIncorretas(
  correctTaxon: INatTaxon,
  nomePopularCorreto: string | undefined,
  nivelTaxonomicoMaximo: string,
): Promise<Especie[]> {
  // Primeiro, tentar buscar alternativas pré-definidas no Redis
  const alternativasPreDefinidas = await obterAlternativasPreDefinidas(
    correctTaxon.id,
  );
  if (alternativasPreDefinidas && alternativasPreDefinidas.length >= 3) {
    console.log(
      `✅ Usando alternativas pré-definidas para ${correctTaxon.name}`,
    );
    return alternativasPreDefinidas.slice(0, 3);
  }

  console.log(
    `🎲 Gerando alternativas automaticamente para ${correctTaxon.name}`,
  );
  const alternativas: Especie[] = [];
  const alternativasUsadas = new Set<string>(); // Para evitar duplicatas

  if (nivelTaxonomicoMaximo === "species") {
    // Estratégias específicas para nível de espécie
    const estrategias = [];

    // 1. Nome popular certo, mas científico errado (só quando tem nome popular)
    if (nomePopularCorreto) {
      estrategias.push("nome_popular_correto");
    }

    // 2. Epiteto específico certo, mas gênero errado
    estrategias.push("epiteto_correto");

    // 3. Grupos irmãos (sempre disponível)
    estrategias.push("grupos_irmaos", "grupos_irmaos"); // Adiciona duas vezes para aumentar a chance

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
        } else if (estrategia === "grupos_irmaos") {
          // Grupos irmãos normais
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
        }
      } catch (error) {
        console.error(`Erro ao executar estratégia ${estrategia}:`, error);
        continue;
      }
    }
  } else {
    // Para gênero, família ou ordem: apenas grupos irmãos
    const taxonsIrmaos = await obterTaxonsIrmaos(correctTaxon, 10);
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
  }

  // Se não conseguimos 3 alternativas, completar com espécies aleatórias
  if (alternativas.length < 3) {
    console.warn(
      `Apenas ${alternativas.length} alternativas geradas, completando com espécies aleatórias...`,
    );
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
  }

  // Garantir que sempre temos exatamente 3 alternativas
  return alternativas.slice(0, 3);
}
