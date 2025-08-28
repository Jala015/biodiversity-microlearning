# API Utils Module

Este módulo contém todas as funções relacionadas à consulta de APIs externas (GBIF, iNaturalist) e processamento de dados de espécies, organizadas de forma modular para facilitar manutenção e reutilização.

## 📁 Estrutura

```
api/
├── README.md           # Esta documentação
├── index.ts           # Exportações centralizadas
├── types.ts           # Tipos TypeScript compartilhados
├── inaturalist.ts     # Funções do iNaturalist API
├── gbif.ts            # Funções do GBIF API
├── alternativas.ts    # Geração de alternativas incorretas (com cache Redis)
└── deck-builder.ts    # Construção de decks automáticos com Cards
```

## 🔧 Módulos

### `types.ts`
Contém todas as interfaces TypeScript usadas pelos outros módulos:
- `INatTaxon` - Dados de um táxon do iNaturalist
- `MediaEspecie` - Informações de mídia (fotos)
- `EspecieComDados` - Espécie com dados completos para o deck
- `Especie` - Tipo simplificado para alternativas de jogo

### `inaturalist.ts`
Funções para interação com a API do iNaturalist:
- `consultarApiINat()` - Busca dados completos de uma espécie
- `obterTaxonsIrmaos()` - Encontra táxons no mesmo nível taxonômico
- `obterEspeciesAleatorias()` - Busca espécies aleatórias para distratores

### `gbif.ts`
Funções para interação com a API do GBIF:
- `obterEspeciesMaisComuns()` - Lista espécies mais registradas em uma região

### `alternativas.ts`
Lógica para geração de alternativas incorretas em flashcards com cache Redis:
- `gerarAlternativasIncorretas()` - Cria 3 distratores, primeiro buscando no Redis, senão gera automaticamente
- Cache Redis: `especies:alternativas:{inatID}` com hash contendo alternativas 1, 2, 3

### `deck-builder.ts`
Funções de alto nível para construção de decks:
- `montarCardsComAlternativas()` - **NOVA** - Processa espécies e cria Cards com alternativas prontas, agrupando por max_id_level para evitar repetições
- `criarDeckAutomatico()` - **REFATORADA** - Pipeline completo retornando Cards prontos para `addCards()`
- `montarDetalhesDasEspecies()` - Função de compatibilidade (interface antiga)

## 📊 Fluxo de Dados

```mermaid
---
config:
  layout: elk
---
flowchart TB
    START[("🌍 Circle Data<br>(lat, lng, radiusKm)")] --> CRIAR["🎯 criarDeckAutomatico()"]
    CRIAR --> GBIF["🌐 obterEspeciesMaisComuns()"]
    GBIF --> GBIF_API[("GBIF API")] & SPECIES_DATA[("📊 Nomes científicos e counts")]
    GBIF_API --> GBIF
    SPECIES_DATA --> MONTAR["🔧 montarCardsComAlternativas()"]
    MONTAR --> CONSULTAR["🔍 consultarApiINat()"]
    CONSULTAR --> INAT_API1[("iNaturalist API")] & INAT_DATA[("🐾 Taxon + Photo + Names")]
    INAT_API1 --> CONSULTAR
    INAT_DATA --> GET_LEVEL["🏷️ obterMaxIdLevel()"] & CARD_ASSEMBLY["🃏 Assemble Card"]
    GET_LEVEL --> REDIS1[("Redis Cache")] & MAX_LEVEL[("📋 max_id_level")]
    REDIS1 --> GET_LEVEL
    MAX_LEVEL --> GRUPO["📂 Agrupadas por nivel taxonômico"]
    GRUPO --> IMG_CURADA["🖼️ obterImagemCurada()"] & DIFICULDADE["⚡ determinarNivelDificuldade()"] & ALTERNATIVAS["🎲 gerarAlternativasIncorretas()"]
    IMG_CURADA --> REDIS1[("Redis Cache")] & FINAL_IMG[("🖼️ Imagem Final")]
    REDIS1 --> IMG_CURADA
    DIFICULDADE --> NIVEL[("📈 Nível de dificuldade")]
    ALTERNATIVAS --> PRE_DEF["📦 obterAlternativasPreDefinidas()"]
    PRE_DEF --> REDIS1[("Redis Cache")] & CACHED{"✅ Encontrou no Cache?"}
    REDIS1 --> PRE_DEF
    CACHED -- Yes --> USE_CACHED[("✓ Usa Alternativas do Redis")]
    CACHED -- No --> IRMAOS["👥 obterTaxonsIrmaos()"] & ALEATORIAS["🎯 obterEspeciesAleatorias()"]
    IRMAOS --> INAT_API2[("iNaturalist API")] & WRONG_OPTIONS[("❌ Alternativas falsas")]
    INAT_API2 --> IRMAOS
    ALEATORIAS --> INAT_API3[("iNaturalist API")] & WRONG_OPTIONS
    INAT_API3 --> ALEATORIAS
    USE_CACHED --> WRONG_OPTIONS
    NIVEL --> CARD_ASSEMBLY
    FINAL_IMG --> CARD_ASSEMBLY
    WRONG_OPTIONS --> CARD_ASSEMBLY
    CARD_ASSEMBLY --> CARDS[("🎴 Array final de cards")]
    CARDS --> DECK_RESULT[("🎯 Objeto de Deck<br>{cards, totalCards}")]
     START:::inputData
     CRIAR:::process
     GBIF:::process
     GBIF_API:::apiCall
     SPECIES_DATA:::dataOutput
     MONTAR:::process
     CONSULTAR:::process
     INAT_API1:::apiCall
     INAT_DATA:::dataOutput
     GET_LEVEL:::process
     CARD_ASSEMBLY:::process
     REDIS1:::redisCall
     MAX_LEVEL:::dataOutput
     GRUPO:::process
     IMG_CURADA:::process
     DIFICULDADE:::process
     ALTERNATIVAS:::process
     REDIS1:::redisCall
     FINAL_IMG:::dataOutput
     NIVEL:::dataOutput
     PRE_DEF:::process
     REDIS1:::redisCall
     CACHED:::decision
     USE_CACHED:::dataOutput
     IRMAOS:::process
     ALEATORIAS:::process
     INAT_API2:::apiCall
     WRONG_OPTIONS:::dataOutput
     INAT_API3:::apiCall
     CARDS:::dataOutput
     DECK_RESULT:::dataOutput
    classDef apiCall fill:#ffcccc,stroke:#ff0000,stroke-width:2px
    classDef redisCall fill:#e6ccff,stroke:#9900cc,stroke-width:2px
    classDef dataOutput fill:#ccffcc,stroke:#00aa00,stroke-width:2px
    classDef inputData fill:#cce6ff,stroke:#0066cc,stroke-width:2px
    classDef process fill:#ffe6cc,stroke:#cc6600,stroke-width:2px
    classDef decision fill:#fff2cc,stroke:#ccaa00,stroke-width:2px
    style START stroke-width:4px,stroke-dasharray: 0
    style GRUPO stroke-width:4px,stroke-dasharray: 0
    style DECK_RESULT stroke-width:4px,stroke-dasharray: 0
    linkStyle 0 stroke:#0066cc,stroke-width:3px,fill:none
    linkStyle 1 stroke:#000000,stroke-width:3px,fill:none
    linkStyle 2 stroke:#ff0000,stroke-width:3px,fill:none
    linkStyle 3 stroke:#0066cc,stroke-width:3px,fill:none
    linkStyle 4 stroke:#00aa00,stroke-width:3px,fill:none
    linkStyle 5 stroke:#00aa00,stroke-width:3px,fill:none
    linkStyle 6 stroke:#000000,stroke-width:3px,fill:none
    linkStyle 7 stroke:#ff0000,stroke-width:3px,fill:none
    linkStyle 8 stroke:#0066cc,stroke-width:3px,fill:none
    linkStyle 9 stroke:#00aa00,stroke-width:3px,fill:none
    linkStyle 10 stroke:#00aa00,stroke-width:3px,fill:none
    linkStyle 12 stroke:#9900cc,stroke-width:3px,fill:none
    linkStyle 13 stroke:#00aa00,stroke-width:3px,fill:none
    linkStyle 14 stroke:#00aa00,stroke-width:3px,fill:none
    linkStyle 15 stroke:#00aa00,stroke-width:3px,fill:none
    linkStyle 16 stroke:#0066cc,stroke-width:3px,fill:none
    linkStyle 17 stroke:#000000,stroke-width:3px,fill:none
    linkStyle 18 stroke:#00aa00,stroke-width:3px,fill:none
    linkStyle 19 stroke:#0066cc,stroke-width:3px,fill:none
    linkStyle 20 stroke:#00aa00,stroke-width:3px,fill:none
    linkStyle 21 stroke:#0066cc,stroke-width:3px,fill:none
    linkStyle 22 stroke:#000000,stroke-width:3px,fill:none
    linkStyle 23 stroke:#000000,stroke-width:3px,fill:none
    linkStyle 24 stroke:#9900cc,stroke-width:3px,fill:none
    linkStyle 25 stroke:#00aa00,stroke-width:3px,fill:none
    linkStyle 26 stroke:#00aa00,stroke-width:3px,fill:none
    linkStyle 27 stroke:#00aa00,stroke-width:3px,fill:none
    linkStyle 28 stroke:#ff0000,stroke-width:3px,fill:none
    linkStyle 29 stroke:#00aa00,stroke-width:3px,fill:none
    linkStyle 30 stroke:#ff0000,stroke-width:3px,fill:none
    linkStyle 31 stroke:#0066cc,stroke-width:3px,fill:none
    linkStyle 32 stroke:#00aa00,stroke-width:3px,fill:none
    linkStyle 33 stroke:#ff0000,stroke-width:3px,fill:none
    linkStyle 34 stroke:#0066cc,stroke-width:3px,fill:none
    linkStyle 35 stroke:#00aa00,stroke-width:3px,fill:none
    linkStyle 36 stroke:#0066cc,stroke-width:3px,fill:none
    linkStyle 37 stroke:#000000,stroke-width:3px,fill:none

```

## 🚀 Como Usar

### Importação Simples
```typescript
// Importe do index principal
import {
  criarDeckAutomatico,
  montarCardsComAlternativas,
  gerarAlternativasIncorretas,
  consultarApiINat
} from '~/utils/api';
```

### Importação Específica
```typescript
// Importe de módulos específicos
import { obterTaxonsIrmaos } from '~/utils/api/inaturalist';
import { obterEspeciesMaisComuns } from '~/utils/api/gbif';
```

### Exemplo Prático

#### 1. Criar Deck Automático com Cards
```typescript
const circleData = {
  lat: -15.5, // Latitude do centro
  lng: -47.5, // Longitude do centro
  radiusKm: 50 // Raio em quilômetros
};

const deck = await criarDeckAutomatico(circleData, 20);
console.log(`Deck criado com ${deck.totalCards} cards`);

// Os cards já vêm com alternativas prontas e são agrupados por max_id_level:
// - Se várias espécies têm max_id_level="genus", apenas 1 card é criado para o gênero
// - O count usado na dificuldade é a soma de todas as espécies do grupo
const deckStore = useDeckStore('meu-deck');
await deckStore.addCards(deck.cards); // ✅ Cards prontos para uso
```

#### 2. Gerar Alternativas para Flashcard
```typescript
// Primeiro, obter o táxon correto
const resultado = await consultarApiINat("Panthera onca");
if (resultado) {
  // Gerar alternativas incorretas
  const alternativas = await gerarAlternativasIncorretas(
    resultado.taxon,
    resultado.nomePopularPt,
    "species"
  );

  console.log("Alternativas incorretas:", alternativas);
  // Pode retornar:
  // [
  //   { nome_cientifico: "Felis onca", nome_popular: "Leopardo" },
  //   { nome_cientifico: "Puma concolor", nome_popular: "Onça-parda" },
  //   { nome_cientifico: "Lynx rufus", nome_popular: "Onça-pintada" }
  // ]
}
```

## ⚡ Otimizações Implementadas

### Cache Redis para Alternativas
- **NOVA**: Busca alternativas pré-curadas no Redis antes de gerar automaticamente
- Chave: `especies:alternativas:{inatID}` com hash `1:nome_popular`, `1:nome_cientifico`, etc.
- Reduz tempo de processamento e melhora qualidade das alternativas

### Redução de Chamadas API
- `consultarApiINat()` retorna o objeto `INatTaxon` completo, eliminando necessidade de chamadas adicionais
- Cache local de dados de espécies durante processamento em lote

### Estratégias Inteligentes para Alternativas
1. **Cache Redis prioritário**: Usa alternativas pré-curadas quando disponíveis
2. **Nome popular correto + científico errado**: Confunde usuário testando reconhecimento científico
3. **Epiteto específico correto + gênero errado**: Testa conhecimento de taxonomia
4. **Grupos irmãos**: Alternativas botanicamente/zoologicamente relacionadas

### Cards com Níveis Automáticos e Agrupamento Inteligente
- **NOVA**: Determina nível de dificuldade baseado no `max_id_level` do Redis
- **NOVA**: Agrupa espécies pelo mesmo `max_id_level` para evitar cards repetidos
  - Ex: Se *Turdus leucomelas* e *Turdus rufiventris* têm `max_id_level = "genus"`, cria apenas 1 card para "Turdus"
  - Soma os counts de todas as espécies do grupo para calcular dificuldade corretamente
- `species` → `facil`, `genus` → `medio`, `family` → `dificil`, outros → `desafio`
- Cooldown inicial baseado no nível de dificuldade

### Fallbacks Robustos
- Se não conseguir alternativas específicas, completa com espécies aleatórias
- Sempre garante exatamente 3 alternativas incorretas
- Evita duplicatas usando `Set` interno


## 📝 Contribuição

Ao adicionar novas funcionalidades:

1. **Coloque a função no módulo apropriado** (inaturalist.ts, gbif.ts, etc.)
2. **Adicione tipos em types.ts** se necessário
3. **Exporte em index.ts** para disponibilizar publicamente
4. **Adicione testes** em `/test/unit/`
5. **Documente aqui** com exemplos de uso

## 🚨 Rate Limiting

As APIs têm limites de requisições:
- **iNaturalist**: ~1 req/seg


Para uso em produção, considere implementar:
- Cache Redis para respostas das APIs externas
- Rate limiting client-side
- Autenticação para limites maiores
- **NOVO**: Popular o Redis com alternativas pré-curadas para species comuns
