//----------------------------//
//                            //
//           Tipos            //
//                            //
//----------------------------//

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

export interface MediaEspecie {
  identifier: string;
  type: string;
  license: string;
  rightsHolder: string;
}

export interface EspecieComDados {
  speciesKey: string;
  nome_cientifico: string;
  contagemOcorrencias?: number;
  nome_popular?: string;
  media?: MediaEspecie[];
  max_id_level: string;
}

// Tipo para as alternativas erradas do jogo
export interface Especie {
  nome_cientifico: string;
  nome_popular?: string;
}

// Tipo para resultado da consulta iNaturalist
export interface ConsultaINatResult {
  taxon: INatTaxon;
  inatId: number;
  foto: MediaEspecie | undefined;
  nomePopularPt: string | undefined;
  nome_cientifico: string;
}

// Tipo para opções de busca GBIF
export interface SearchOptions {
  geomCircle: any; // Geometria do círculo (turf.js)
  maxSpecies?: number; // Número máximo de espécies (padrão: 20)
  taxonKeys?: number[]; // IDs de grupo taxonômico para filtro
}

// Tipo para resposta GBIF
export interface GBIFResponse {
  facets: { counts: { name: string; count: number }[] }[];
}
