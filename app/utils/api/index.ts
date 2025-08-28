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
} from "./types";

// Funções do iNaturalist
export {
  consultarApiINat,
  obterTaxonsIrmaos,
  obterEspeciesAleatorias,
} from "./inaturalist";

// Funções do GBIF
export { obterEspeciesMaisComuns } from "./gbif";

// Geração de alternativas
export { gerarAlternativasIncorretas } from "./alternativas";

// Construção de decks
export {
  montarCardsComAlternativas,
  criarDeckAutomatico,
} from "./deck-builder";
