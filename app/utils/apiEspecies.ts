// Importar a função do Redis
import { obterImagemCurada } from "~/utils/redisImageCache";

// tipos
export interface INatTaxaResponse {
  total_results: number;
  page: number;
  per_page: number;
  results: INatTaxon[];
}

export interface INatTaxon {
  id: number;
  rank: string;
  rank_level: number;
  iconic_taxon_id: number;
  ancestor_ids: number[];
  is_active: boolean;
  name: string;
  parent_id: number;
  ancestry: string;
  extinct: boolean;
  default_photo?: INatPhoto;
  taxon_changes_count: number;
  taxon_schemes_count: number;
  observations_count: number;
  flag_counts: {
    resolved: number;
    unresolved: number;
  };
  current_synonymous_taxon_ids: number[] | null;
  atlas_id: number | null;
  complete_species_count: number | null;
  wikipedia_url: string | null;
  complete_rank: string;
  matched_term: string;
  iconic_taxon_name: string;
  preferred_common_name?: string;
  english_common_name?: string;
}

export interface INatPhoto {
  id: number;
  license_code: string | null;
  attribution: string;
  attribution_name: string;
  url: string;
  square_url: string;
  medium_url: string;
  original_dimensions: {
    height: number;
    width: number;
  };
  flags: any[];
}

interface MediaEspecie {
  identifier: string;
  type: string;
  license: string;
  rightsHolder: string;
}

interface EspecieComDados {
  speciesKey: string;
  nome_cientifico: string;
  contagemOcorrencias?: number; // opcional, usado para contar ocorrências na região
  nome_popular?: string;
  media?: MediaEspecie[];
}

//funções helper

export async function consultarApiINat(scientificName: string): Promise<{
  inatId: number;
  foto: MediaEspecie | undefined;
  nomePopularPt: string | undefined;
  nome_cientifico: string;
} | null> {
  try {
    // 1. Buscar no iNaturalist
    const inatUrl = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(
      scientificName,
    )}&locale=pt-BR`;
    const inatResp = await $fetch<INatTaxaResponse>(inatUrl);

    if (!inatResp.results || inatResp.results.length === 0) {
      console.warn(`Nenhum resultado iNat para ${scientificName}`);
      return null;
    }

    const taxon = inatResp.results[0];

    if (!taxon) {
      console.warn(`Taxon não encontrado para ${scientificName}`);
      return null;
    }

    //2. Nome cientifico
    const nome_cientifico = taxon.name;

    // 3. Nome popular em pt
    let nomePopularPt: string | undefined = taxon.preferred_common_name;

    // 4. Foto com licença válida
    let foto: MediaEspecie | undefined = taxon.default_photo
      ? {
          identifier: taxon.default_photo.medium_url,
          type: "StillImage",
          license: taxon.default_photo.license_code!,
          rightsHolder: taxon.default_photo.attribution,
        }
      : undefined;

    return {
      inatId: taxon.id,
      nome_cientifico,
      nomePopularPt,
      foto,
    };
  } catch (error) {
    console.error(`❌ Erro ao unificar espécie ${scientificName}:`, error);
    return null;
  }
}

function turfToWkt(polygon: any): string {
  const coordinates = polygon.geometry.coordinates[0]
    .map((p: any) => `${p[0]} ${p[1]}`)
    .join(",");
  return `POLYGON((${coordinates}))`;
}

// funções para montar o deck

// obter espécies mais comuns na região
interface SearchOptions {
  geomCircle: any; // Geometria do círculo (turf.js)
  maxSpecies: number; // Número máximo de espécies (padrão: 10)
  taxonId?: number; // ID do grupo taxonômico (padrão: 3 = Aves)
}
export async function obterEspeciesMaisComuns(opcoes: SearchOptions): Promise<{
  nomes_cientificos: string[];
  speciesCounts: Map<string, number>;
}> {
  const geomWkt = turfToWkt(opcoes.geomCircle);
  const params = new URLSearchParams({
    geometry: geomWkt,
    facet: "scientificName",
    limit: "0", // Usar '0' para obter apenas os facetas
    datasetKey: "50c9509d-22c7-4a22-a47d-8c48425ef4a7", //iNat research grade
  });
  if (opcoes.taxonId) {
    params.append("taxon_key", opcoes.taxonId.toString());
  }

  const url = `https://api.gbif.org/v1/occurrence/search?${params.toString()}`;
  // realizar a requisição
  const response = await $fetch<{
    facets: { counts: { name: string; count: number }[] }[];
  }>(url, {
    headers: {
      "Cache-Control": "max-age=3600",
    },
  });

  const nomes_cientificos =
    response.facets?.[0]?.counts
      .map((c) => c.name)
      .slice(0, opcoes.maxSpecies * 2) || []; // Buscar o dobro para filtrar depois (pode ser que algumas espécies só tenham registros com problemas)

  //montar um map com os respectivos counts
  const speciesCounts = new Map<string, number>();
  response.facets?.[0]?.counts.forEach((count) => {
    speciesCounts.set(count.name, count.count);
  });
  console.log(`📊 ${nomes_cientificos.length} espécies encontradas na região`);

  return { nomes_cientificos, speciesCounts };
}

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
  const dadosINat = new Map<
    string,
    {
      inatId: number;
      foto: MediaEspecie | undefined;
      nomePopularPt: string | undefined;
      nome_cientifico: string;
    }
  >();

  // Buscar dados do iNaturalist para todas as espécies usando GBIF species name
  for (const n of scientificNames.slice(0, maxSpecies * 3)) {
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

      speciesMap.set(speciesKey, {
        speciesKey,
        nome_cientifico: dados.nome_cientifico,
        nome_popular: dados.nomePopularPt,
        media: [mediaFinal],
        contagemOcorrencias: count,
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
