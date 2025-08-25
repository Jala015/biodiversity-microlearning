// Arquivo principal do módulo API
// Centraliza todas as exportações para facilitar imports

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
  GBIFResponse,
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
  montarDetalhesDasEspecies,
  montarCardsComAlternativas,
  criarDeckAutomatico,
} from "./deck-builder";
