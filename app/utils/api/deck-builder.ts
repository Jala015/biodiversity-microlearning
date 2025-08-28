import { obterImagemCurada, obterMaxIdLevel } from "~/utils/redis";
import { consultarApiINat } from "./sources/inaturalist";
import { obterEspeciesMaisComuns } from "./sources/gbif";
import { gerarAlternativasIncorretas } from "./generators/alternativas";
import type {
  EspecieComDados,
  MediaEspecie,
  ConsultaINatResult,
  ValidSpecies,
} from "./types";
import type { Card, NivelDificuldade } from "~/stores/decks";

//----------------------------//
//                            //
//  Construção de Decks       //
//                            //
//----------------------------//

/**
 * Função para determinar nível de dificuldade baseado no max_id_level
 *
 * Chamada por: construirCards() - para definir o nível de dificuldade dos Cards criados
 */
function determinarNivelDificuldade(
  maxIdLevel: string,
  count: number,
  total: number,
): NivelDificuldade {
  // frequência relativa
  let nivel = 1 - count / total; // de 0 a 1

  // // espécies pouco avistadas têm penalidade no nível
  // if (count == 1) {
  //   nivel += 0.03;
  // } else if (count < 5) {
  //   nivel += 0.02;
  // } else if (count < 10) {
  //   nivel += 0.01;
  // } else if (count < 20) {
  //   nivel += 0.005;
  // }

  console.log("calculo do nível: ", nivel);

  if (nivel < 0.25) {
    return "facil";
  } else if (nivel < 0.5) {
    return "medio";
  } else if (nivel < 0.75) {
    return "dificil";
  } else {
    return "desafio";
  }
}

// ========================================
// FUNÇÕES GUARDA-CHUVA DO PIPELINE
// ========================================

/**
 * FASE 1: Coleta dados das espécies (GBIF + iNaturalist)
 */
async function coletarDados(
  circleData: { lat: number; lng: number; radiusKm: number },
  maxSpecies: number,
  taxonKeys?: number[],
) {
  console.log("🌍 FASE 1: Coletando dados das espécies...");

  // 1.1 Buscar espécies mais comuns no GBIF
  const dadosGBIF = await obterEspeciesMaisComuns({
    lat: circleData.lat,
    lng: circleData.lng,
    radiusKm: circleData.radiusKm,
    maxSpecies,
    taxonKeys,
  });

  if (dadosGBIF.nomes_cientificos.length === 0) {
    throw new Error("Nenhuma espécie encontrada na região especificada");
  }

  // 1.2 Enriquecer com dados do iNaturalist
  console.log(`🔍 Buscando dados no iNaturalist...`);
  const dadosINat = new Map<string, ConsultaINatResult>();
  // Criar um mapa para enriquecer ValidSpecies com ancestor_ids
  const validSpeciesMap = new Map<string, ValidSpecies>();

  // Converter array para mapa para acesso mais eficiente
  dadosGBIF.validSpecies.forEach((species) => {
    validSpeciesMap.set(species.scientificName, {
      ...species,
      ancestorIds: [], // Inicializar com array vazio
    });
  });

  const speciesSlice = dadosGBIF.nomes_cientificos.slice(0, maxSpecies * 2);
  for (let i = 0; i < speciesSlice.length; i++) {
    const n = speciesSlice[i];
    if (!n) continue;
    try {
      const resultadoINat = await consultarApiINat(n);
      if (resultadoINat) {
        dadosINat.set(n, resultadoINat);

        // Enriquecer ValidSpecies com ancestor_ids da resposta do iNaturalist
        const validSpecies = validSpeciesMap.get(n);
        if (validSpecies && resultadoINat.taxon.ancestor_ids) {
          validSpecies.ancestorIds = resultadoINat.taxon.ancestor_ids;
        }
      }

      // Delay de 1001ms entre consultas
      if (i < speciesSlice.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1001));
      }
    } catch (error) {
      console.error(`❌ Erro ao buscar dados iNaturalist para ${n}:`, error);
      continue;
    }
  }

  console.log(`📊 ${dadosINat.size} espécies encontradas no iNaturalist`);

  // Converter o mapa de volta para array
  const validSpeciesEnriquecidos = Array.from(validSpeciesMap.values());

  return {
    dadosGBIF,
    dadosINat,
    validSpecies: validSpeciesEnriquecidos,
    total: Array.from(dadosGBIF.speciesCounts.values()).reduce(
      (a, b) => a + b,
      0,
    ),
  };
}

/**
 * FASE 2: Processa e agrupa táxons por nível taxonômico
 */
async function processarEAgrupar(
  dadosINat: Map<string, ConsultaINatResult>,
  counts: Map<string, number>,
) {
  console.log("📋 FASE 2: Processando e agrupando táxons...");

  // 2.1 Buscar max_id_level para todas as espécies
  console.log(`🔍 Buscando max_id_level...`);
  const speciesComMaxId = new Map<
    string,
    { dados: ConsultaINatResult; maxIdLevel: string }
  >();

  for (const [speciesKey, dados] of dadosINat) {
    if (dados.foto) {
      const max_id_level = await obterMaxIdLevel(dados);
      console.log(`Max IdLevel para ${dados.nome_cientifico}: ${max_id_level}`);
      speciesComMaxId.set(speciesKey, {
        dados,
        maxIdLevel: max_id_level || "species",
      });
    }
  }

  // 2.2 Agrupar espécies por táxon no nível do max_id_level
  console.log(`📊 Agrupando por nível taxonômico...`);
  const gruposTaxon = new Map<
    string,
    {
      especiesRepresentativa: string;
      dados: ConsultaINatResult;
      maxIdLevel: string;
      countTotal: number;
      especies: string[];
    }
  >();

  for (const [speciesKey, { dados, maxIdLevel }] of speciesComMaxId) {
    // Determinar chave do táxon
    let taxonKey: string;
    switch (maxIdLevel.toLowerCase()) {
      case "species":
        taxonKey = `species:${dados.nome_cientifico}`;
        break;
      case "genus":
        const genero = dados.nome_cientifico.split(" ")[0] || "";
        taxonKey = `genus:${genero}`;
        break;
      case "family":
        taxonKey = `family:${dados.taxon.parent_id || dados.inatId}`;
        break;
      default:
        taxonKey = `${maxIdLevel}:${dados.inatId}`;
        break;
    }

    if (gruposTaxon.has(taxonKey)) {
      // Adicionar ao grupo existente
      const grupo = gruposTaxon.get(taxonKey)!;
      grupo.countTotal += counts.get(speciesKey) ?? 0;
      grupo.especies.push(speciesKey);
    } else {
      // Criar novo grupo
      gruposTaxon.set(taxonKey, {
        especiesRepresentativa: speciesKey,
        dados: dados,
        maxIdLevel: maxIdLevel,
        countTotal: counts.get(speciesKey) ?? 0,
        especies: [speciesKey],
      });
    }
  }

  console.log(`📊 ${gruposTaxon.size} grupos taxonômicos únicos criados`);
  return gruposTaxon;
}

/**
 * FASE 3: Constrói os cards finais com alternativas e imagens
 */
async function construirCards(
  gruposTaxon: Map<
    string,
    {
      especiesRepresentativa: string;
      dados: ConsultaINatResult;
      maxIdLevel: string;
      countTotal: number;
      especies: string[];
    }
  >,
  maxSpecies: number,
  total: number,
): Promise<Card[]> {
  console.log("🃏 FASE 3: Construindo cards...");

  const cards: Card[] = [];
  let cardsProcessados = 0;

  for (const [taxonKey, grupo] of gruposTaxon) {
    if (cardsProcessados >= maxSpecies) break;

    const { especiesRepresentativa, dados, maxIdLevel, countTotal, especies } =
      grupo;

    try {
      // 3.1 Obter imagem (Redis primeiro, senão iNat)
      let mediaFinal: MediaEspecie = dados.foto!;
      const imagemCurada = await obterImagemCurada(especiesRepresentativa);
      if (imagemCurada) {
        mediaFinal = {
          identifier: imagemCurada,
          type: "StillImage",
          license: "Curada",
          rightsHolder: "Curadoria",
        };
      }

      // 3.2 Determinar nível de dificuldade
      const nivel = determinarNivelDificuldade(maxIdLevel, countTotal, total);

      // 3.3 Gerar alternativas incorretas
      const alternativasIncorretas = await gerarAlternativasIncorretas(
        dados.taxon,
        dados.nomePopularPt,
        maxIdLevel,
        gruposTaxon,
      );

      // 3.4 Determinar nome do táxon para o card
      let taxonNome: string;
      switch (maxIdLevel.toLowerCase()) {
        case "species":
          taxonNome = dados.nome_cientifico;
          break;
        case "genus":
          taxonNome = dados.nome_cientifico.split(" ")[0] ?? "";
          break;
        default:
          taxonNome = dados.nome_cientifico;
          break;
      }

      // 3.5 Criar card
      const card: Card = {
        id: `${dados.inatId}-${Date.now()}-${cardsProcessados}`,
        taxon: taxonNome,
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
      cardsProcessados++;

      const especiesInfo =
        especies.length > 1
          ? ` (agrupando ${especies.length} espécies: ${especies.join(", ")})`
          : "";

      console.log(
        `✓ Card criado para ${taxonNome} (${dados.nomePopularPt || "sem nome popular"}) - Nível: ${nivel}${especiesInfo}`,
      );
    } catch (error) {
      console.error(
        `❌ Erro ao criar card para ${dados.nome_cientifico}:`,
        error,
      );
      continue;
    }
  }

  console.log(`✅ Total: ${cardsProcessados} cards criados`);
  return cards;
}

// ========================================
// FUNÇÃO PRINCIPAL
// ========================================

/**
 * Função principal para criar um deck automático baseado em região geográfica
 *
 * Chamada por: Componentes Vue/páginas da aplicação - entry point para criação automática de decks
 */
export async function criarDeckAutomatico(
  circleData: { lat: number; lng: number; radiusKm: number },
  maxSpecies: number = 20,
  taxonKeys?: number[],
) {
  try {
    console.log("🎯 Iniciando criação de deck automático...");

    // FASE 1: Coletar dados (GBIF + iNaturalist)
    const { dadosGBIF, dadosINat, validSpecies, total } = await coletarDados(
      circleData,
      maxSpecies,
      taxonKeys,
    );

    // FASE 2: Processar e agrupar táxons
    const gruposTaxon = await processarEAgrupar(
      dadosINat,
      dadosGBIF.speciesCounts,
    );

    // FASE 3: Construir cards
    const cards = await construirCards(gruposTaxon, maxSpecies, total);

    if (cards.length === 0) {
      throw new Error(
        "Não foi possível criar cards para as espécies encontradas",
      );
    }

    console.log(`🎉 Deck criado com sucesso! ${cards.length} cards`);
    return {
      cards: cards,
      totalCards: cards.length,
    };
  } catch (error) {
    console.error("❌ Erro ao criar deck automático:", error);
    throw error;
  }
}

/**
 * Obter fotos, nome científico, nome popular e montar Cards completos com alternativas
 *
 * Chamada por: criarDeckAutomatico() - função principal que cria deck automático baseado em região geográfica
 *
 * @deprecated Use criarDeckAutomatico() instead. Mantida para compatibilidade.
 */
export async function montarCardsComAlternativas(
  scientificNames: string[],
  maxSpecies: number,
  counts: Map<string, number>,
): Promise<Card[]> {
  console.warn(
    "⚠️ montarCardsComAlternativas está deprecated. Use criarDeckAutomatico.",
  );

  // Implementação simplificada usando a nova estrutura
  const dadosINat = new Map<string, ConsultaINatResult>();

  // Buscar dados do iNaturalist
  for (let i = 0; i < scientificNames.slice(0, maxSpecies * 2).length; i++) {
    const n = scientificNames[i];
    if (!n) continue;
    try {
      const resultadoINat = await consultarApiINat(n);
      if (resultadoINat) {
        dadosINat.set(n, resultadoINat);
      }
      if (i < scientificNames.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1001));
      }
    } catch (error) {
      console.error(`❌ Erro ao buscar dados iNaturalist para ${n}:`, error);
      continue;
    }
  }

  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  const gruposTaxon = await processarEAgrupar(dadosINat, counts);
  return await construirCards(gruposTaxon, maxSpecies, total);
}
