/**
 * Arquivo principal do módulo API - Ponto de entrada centralized
 *
 * Este arquivo é chamado por:
 * - Componentes Vue/páginas da aplicação que precisam usar as funções da API
 * - Testes unitários (como api_inat.spec.ts)
 * - Outros módulos da aplicação que fazem import das funções
 *
 * Centraliza todas as exportações para facilitar imports e manter
 * uma interface limpa e organizada do módulo API.
 */

// Tipos
export type {
  INatTaxon,
  INatTaxaResponse,
  INatPhoto,
  MediaEspecie,
  EspecieComDados,
  Especie,
  ConsultaINatResult,
  SearchOptions,
  GbifOccResponse,
  GbifSpeciesResponse,
  ValidSpecies,
} from "./types";

// Funções do iNaturalist
export {
  consultarApiINat,
  obterTaxonsIrmaos,
  obterEspeciesAleatorias,
} from "./sources/inaturalist";

// Funções do GBIF
export { obterEspeciesMaisComuns } from "./sources/gbif";

// Geração de alternativas
export { gerarAlternativasIncorretas } from "./generators/alternativas";

// Construção de decks
export { criarDeckAutomatico } from "./deck-builder";
