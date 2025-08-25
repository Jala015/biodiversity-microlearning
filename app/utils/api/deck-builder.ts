import { obterImagemCurada, obterMaxIdLevel } from "~/utils/redis";
import { consultarApiINat } from "./inaturalist";
import { obterEspeciesMaisComuns } from "./gbif";
import { gerarAlternativasIncorretas } from "./alternativas";
import type {
  EspecieComDados,
  MediaEspecie,
  ConsultaINatResult,
} from "./types";
import type { Card, NivelDificuldade } from "~/stores/decks";

//----------------------------//
//                            //
//  Construção de Decks       //
//                            //
//----------------------------//

/**
 * Função para determinar nível de dificuldade baseado no max_id_level
 */
function determinarNivelDificuldade(
  maxIdLevel: string,
  count: number, //numero de obs para esse taxon
  total: number, //numero total de observações
): NivelDificuldade {
  // frequência relativa
  let nivel = (1 - count / total) / 2; // de 0 a 0,5

  // espécies pouco avistadas têm penalidade no nível
  if (count == 1) {
    nivel += 0.3;
  } else if (count < 5) {
    nivel += 0.2;
  } else if (count < 10) {
    nivel += 0.1;
  } else if (count < 20) {
    nivel += 0.05;
  }

  switch (maxIdLevel.toLowerCase()) {
    case "species":
      nivel += 0.2;
      break;
    case "genus":
      nivel += 0.1;
      break;
    case "family":
      nivel += 0.05;
      break;
    default:
      break;
  }

  switch (true) {
    case nivel < 0.25:
      return "facil";
    case nivel < 0.5:
      return "medio";
    case nivel < 0.75:
      return "dificil";
    default:
      return "desafio";
  }
}

/**
 * Obter fotos, nome científico, nome popular e montar Cards completos com alternativas
 */
export async function montarCardsComAlternativas(
  scientificNames: string[],
  maxSpecies: number,
  counts: Map<string, number>,
): Promise<Card[]> {
  console.log(`🔍 Processando ${scientificNames.length} espécies...`);

  //obter o total de observações
  let total = 0;
  counts.forEach((v) => {
    total += v;
  });

  const cards: Card[] = [];
  let especiesComImagem = 0;

  // Primeiro: buscar todos os dados no iNaturalist
  console.log(`🔍 Buscando dados no iNaturalist...`);
  const dadosINat = new Map<string, ConsultaINatResult>();

  // Buscar dados do iNaturalist para todas as espécies usando GBIF species name
  for (const n of scientificNames.slice(0, maxSpecies * 2)) {
    try {
      const resultadoINat = await consultarApiINat(n);
      if (resultadoINat) {
        dadosINat.set(n, resultadoINat);
      }
    } catch (error) {
      console.error(`❌ Erro ao buscar dados iNaturalist para ${n}:`, error);
      continue;
    }
  }

  console.log(`📊 ${dadosINat.size} espécies encontradas no iNaturalist`);

  // Segundo: para cada espécie com dados do iNaturalist, verificar se tem imagem curada e gerar Card
  for (const [speciesKey, dados] of dadosINat) {
    if (especiesComImagem >= maxSpecies) break;

    if (dados.foto) {
      // Verificar se existe imagem curada
      let mediaFinal: MediaEspecie = dados.foto;
      let fonteImagem = "iNaturalist";

      const imagemCurada = await obterImagemCurada(speciesKey);
      if (imagemCurada) {
        mediaFinal = {
          identifier: imagemCurada,
          type: "StillImage",
          license: "Curada",
          rightsHolder: "Curadoria",
        };
        fonteImagem = "curada";
      }

      // Buscar max_id_level do Redis
      const max_id_level = await obterMaxIdLevel(dados.inatId);

      // Determinar nível de dificuldade
      const nivel = determinarNivelDificuldade(
        max_id_level,
        counts.get(speciesKey) ?? 0,
        total,
      );

      try {
        // Gerar alternativas incorretas
        const alternativasIncorretas = await gerarAlternativasIncorretas(
          dados.taxon,
          dados.nomePopularPt,
          max_id_level || "species",
        );

        // Criar Card
        const card: Card = {
          id: `${dados.inatId}-${Date.now()}`, // ID único baseado no iNat ID + timestamp
          taxon: speciesKey, //FIXME salvar do gbif toda a taxonomia e pegar o nivel equivalente ao max
          nivel: nivel,
          cooldown:
            nivel === "facil"
              ? 1
              : nivel === "medio"
                ? 2
                : nivel === "dificil"
                  ? 3
                  : 4,
          lastSeenAt: 0,
          alternativas_erradas: alternativasIncorretas,
        };

        cards.push(card);
        especiesComImagem++;

        console.log(
          `✓ Card criado para ${dados.nome_cientifico} (${dados.nomePopularPt || "sem nome popular"}) - Nível: ${nivel}`,
        );
      } catch (error) {
        console.error(
          `❌ Erro ao gerar alternativas para ${dados.nome_cientifico}:`,
          error,
        );
        continue;
      }
    }
  }

  console.log(`✅ Total: ${especiesComImagem} cards criados`);
  return cards;
}

/**
 * Função principal para criar um deck automático baseado em região geográfica
 */
export async function criarDeckAutomatico(
  geomCircle: any,
  maxSpecies: number = 20,
  taxonKeys?: number[],
) {
  try {
    // 1. Obter espécies mais comuns na região
    const { nomes_cientificos, speciesCounts } = await obterEspeciesMaisComuns({
      geomCircle,
      maxSpecies,
      taxonKeys,
    });

    if (nomes_cientificos.length === 0) {
      throw new Error("Nenhuma espécie encontrada na região especificada");
    }

    // 2. Montar Cards com alternativas
    const cards = await montarCardsComAlternativas(
      nomes_cientificos,
      maxSpecies,
      speciesCounts,
    );

    if (cards.length === 0) {
      throw new Error(
        "Não foi possível criar cards para as espécies encontradas",
      );
    }

    return {
      cards: cards,
      totalCards: cards.length,
      regiao: {
        coordenadas: geomCircle.geometry.coordinates,
        tipo: geomCircle.geometry.type,
      },
    };
  } catch (error) {
    console.error("❌ Erro ao criar deck automático:", error);
    throw error;
  }
}

/**
 * Função de compatibilidade - mantém a interface antiga para espécies detalhadas
 */
export async function montarDetalhesDasEspecies(
  scientificNames: string[],
  maxSpecies: number,
  counts: Map<string, number>,
): Promise<Map<string, EspecieComDados>> {
  console.log(`🔍 Processando ${scientificNames.length} espécies...`);

  const speciesMap = new Map<string, EspecieComDados>();
  let especiesComImagem = 0;

  // Primeiro: buscar todos os dados no iNaturalist
  console.log(`🔍 Buscando dados no iNaturalist...`);
  const dadosINat = new Map<string, ConsultaINatResult>();

  // Buscar dados do iNaturalist para todas as espécies usando GBIF species name
  for (const n of scientificNames.slice(0, maxSpecies * 2)) {
    try {
      const resultadoINat = await consultarApiINat(n);
      if (resultadoINat) {
        dadosINat.set(n, resultadoINat);
      }
    } catch (error) {
      console.error(`❌ Erro ao buscar dados iNaturalist para ${n}:`, error);
      continue;
    }
  }

  console.log(`📊 ${dadosINat.size} espécies encontradas no iNaturalist`);

  // Segundo: para cada espécie com dados do iNaturalist, verificar se tem imagem curada
  for (const [speciesKey, dados] of dadosINat) {
    if (especiesComImagem >= maxSpecies) break;

    if (dados.foto) {
      const count = counts.get(speciesKey) || 0;

      // Verificar se existe imagem curada
      let mediaFinal: MediaEspecie = dados.foto;
      let fonteImagem = "iNaturalist";

      const imagemCurada = await obterImagemCurada(speciesKey);
      if (imagemCurada) {
        mediaFinal = {
          identifier: imagemCurada,
          type: "StillImage",
          license: "Curada",
          rightsHolder: "Curadoria",
        };
        fonteImagem = "curada";
      }

      // Buscar max_id_level do Redis
      const max_id_level = await obterMaxIdLevel(dados.inatId);

      speciesMap.set(speciesKey, {
        speciesKey,
        nome_cientifico: dados.nome_cientifico,
        nome_popular: dados.nomePopularPt,
        media: [mediaFinal],
        contagemOcorrencias: count,
        max_id_level,
      });

      especiesComImagem++;
      console.log(
        `✓ Imagem ${fonteImagem} para ${dados.nome_cientifico} (${dados.nomePopularPt || "sem nome popular"})`,
      );
    }
  }

  console.log(`✅ Total: ${especiesComImagem} espécies processadas`);
  return speciesMap;
}
