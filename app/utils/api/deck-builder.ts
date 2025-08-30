import { obterImagemCurada, obterMaxIdLevel } from "~/utils/api/sources/redis";
import { consultarApiINat } from "./sources/inaturalist";
import { obterEspeciesMaisComuns } from "./sources/gbif";
import { gerarAlternativasIncorretas } from "./generators/alternativas";
import type { MediaEspecie, ConsultaINatResult, ValidSpecies } from "./types";
import type { Card, NivelDificuldade } from "~/types";
import app_config from "../../app_config.yaml";
import { useToastStore } from "~/stores/toast";

const toast = useToastStore();

//----------------------------//
//                            //
//  Construção de Decks       //
//                            //
//----------------------------//

/**
 * Função para determinar nível de dificuldade baseado na posição do ranking
 * de frequência relativa para distribuição homogênea
 *
 * Chamada por: construirCards() - para definir o nível de dificuldade dos Cards criados
 */
function determinarNivelDificuldadePorRanking(
  posicaoRanking: number,
  totalCards: number,
): NivelDificuldade {
  const quartil = posicaoRanking / totalCards;

  if (quartil <= 0.25) {
    return "facil";
  } else if (quartil <= 0.5) {
    return "medio";
  } else if (quartil <= 0.75) {
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
  toast.setMessage("inat", "🌍 Listando espécies da região");

  let dadosGBIF;
  let currentRadius = circleData.radiusKm;
  let tentativas = 0;
  const maxTentativas = 3;

  // 1.1 Buscar espécies mais comuns no GBIF com expansão automática do raio
  while (tentativas < maxTentativas) {
    tentativas++;

    console.log(
      `🔍 Tentativa ${tentativas}/${maxTentativas} - Raio: ${currentRadius.toFixed(1)}km`,
    );

    dadosGBIF = await obterEspeciesMaisComuns({
      lat: circleData.lat,
      lng: circleData.lng,
      radiusKm: currentRadius,
      maxSpecies,
      taxonKeys,
    });

    if (!dadosGBIF || dadosGBIF) {
      console.warn(
        `⚠️ Nenhuma espécie encontrada após ${tentativas} tentativas`,
      );
      continue;
    }

    if (dadosGBIF.nomes_cientificos.length > 0) {
      if (tentativas > 1) {
        toast.setMessage(
          "inat",
          `✅ Espécies encontradas após expandir o raio para ${currentRadius.toFixed(1)}km`,
        );
      }
      break;
    }

    if (tentativas < maxTentativas) {
      console.warn(
        `⚠️ Nenhuma espécie encontrada. Expandindo raio de ${currentRadius.toFixed(1)}km para ${(currentRadius * 2).toFixed(1)}km...`,
      );
      currentRadius *= 2;
    }
  }

  if (dadosGBIF.nomes_cientificos.length === 0) {
    throw new Error(
      `Nenhuma espécie encontrada na região especificada após ${maxTentativas} tentativas (raio final: ${currentRadius.toFixed(1)}km)`,
    );
  }

  // 1.2 Enriquecer com dados do iNaturalist
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
  toast.setMessage("inat", "🐦 Obtendo informações do iNaturalist");

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
    } catch (error) {
      console.error(`❌ Erro ao buscar dados iNaturalist para ${n}:`, error);
      continue;
    }
  }

  toast.setMessage(
    "inat",
    `📊 ${dadosINat.size} espécies encontradas no iNaturalist`,
  );

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
  toast.setMessage("inat", `📋 Processando e agrupando táxons`);

  // 2.1 Buscar max_id_level para todas as espécies

  const speciesComMaxId = new Map<
    string,
    { dados: ConsultaINatResult; maxIdLevel: string }
  >();

  for (const [speciesKey, dados] of dadosINat) {
    if (dados.foto) {
      const max_id_level = await obterMaxIdLevel(dados);

      speciesComMaxId.set(speciesKey, {
        dados,
        maxIdLevel: max_id_level || "species",
      });
    }
  }

  // 2.2 Agrupar espécies por táxon no nível do max_id_level

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
  toast.setMessage("inat", `🃏 Construindo cards...`);
  // 3.1 Converter grupos para array e ordenar por frequência relativa (mais comum primeiro)
  const gruposOrdenados = Array.from(gruposTaxon.entries())
    .slice(0, maxSpecies) // Limitar ao número máximo de cards
    .sort(([, a], [, b]) => {
      const freqA = a.countTotal / total;
      const freqB = b.countTotal / total;
      return freqB - freqA; // Ordem decrescente (mais comum primeiro)
    });

  gruposOrdenados.forEach(([taxonKey, grupo], index) => {
    const freq = ((grupo.countTotal / total) * 100).toFixed(2);
    console.log(
      `${index + 1}. ${grupo.dados.nome_cientifico} - ${freq}% (${grupo.countTotal}/${total})`,
    );
  });

  const cards: Card[] = [];
  let cardsProcessados = 0;

  for (let i = 0; i < gruposOrdenados.length; i++) {
    const [taxonKey, grupo] = gruposOrdenados[i];
    const { especiesRepresentativa, dados, maxIdLevel, countTotal, especies } =
      grupo;

    try {
      // 3.2 Obter imagem (Redis primeiro, senão iNat)
      let mediaFinal: MediaEspecie = dados.foto!;
      const imagemCurada = await obterImagemCurada(especiesRepresentativa);
      if (imagemCurada != null) {
        mediaFinal = imagemCurada;
      }

      // Se não tiver imagem, remover o card
      //TODO

      // 3.3 Determinar nível de dificuldade baseado na posição no ranking
      const nivel = determinarNivelDificuldadePorRanking(
        i + 1,
        gruposOrdenados.length,
      );

      // 3.4 Gerar alternativas incorretas
      toast.setMessage("inat", "🤭 Gerando alternativas incorretas");

      const alternativasIncorretas = await gerarAlternativasIncorretas(
        dados.taxon,
        dados.nomePopularPt,
        maxIdLevel,
        gruposTaxon,
      );

      // 3.5 Determinar nome do táxon para o card
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

      // 3.6 Criar card
      const card: Card = {
        id: `${dados.inatId}-${Date.now()}-${cardsProcessados}`,
        taxon: taxonNome,
        nomePopular: dados.nomePopularPt,
        nivel: nivel,
        cooldown:
          nivel === "facil"
            ? app_config.min_cooldown + 4
            : nivel === "medio"
              ? app_config.min_cooldown + 3
              : nivel === "dificil"
                ? app_config.min_cooldown + 2
                : app_config.min_cooldown + 1,
        lastSeenAt: 0,
        alternativas_erradas: alternativasIncorretas,
        imagem: mediaFinal,
      };

      cards.push(card);
      cardsProcessados++;

      const especiesInfo =
        especies.length > 1
          ? ` (agrupando ${especies.length} espécies: ${especies.join(", ")})`
          : "";
    } catch (error) {
      console.error(
        `❌ Erro ao criar card para ${dados.nome_cientifico}:`,
        error,
      );
      continue;
    }
  }

  // Log da distribuição final por nível
  const distribuicao = cards.reduce(
    (acc, card) => {
      acc[card.nivel] = (acc[card.nivel] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
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
): Promise<Card[]> {
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
