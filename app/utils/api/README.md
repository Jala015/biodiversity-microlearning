# API Utils Module

Este módulo contém todas as funções relacionadas à consulta de APIs externas (GBIF, iNaturalist) e processamento de dados de espécies, organizadas de forma modular para facilitar manutenção e reutilização.

## 📁 Estrutura

```
app/utils/api/
├── README.md           # Esta documentação
├── index.ts           # Exportações centralizadas
├── types.ts           # Tipos TypeScript compartilhados
├── deck-builder.ts     # Construção de decks automáticos
├── sources/            # APIs externas
│   ├── gbif.ts        # Funções do GBIF API
│   └── inaturalist.ts # Funções do iNaturalist API
└── generators/         # Geradores de conteúdo
    └── alternativas.ts # Geração de alternativas
```

## 🔧 Módulos

### `types.ts`

Contém todas as interfaces TypeScript usadas pelos outros módulos:
- `INatTaxon` - Dados de um táxon do iNaturalist
- `MediaEspecie` - Informações de mídia (fotos)
- `EspecieComDados` - Espécie com dados completos para o deck
- `Especie` - Tipo simplificado para alternativas de jogo

### `sources/gbif.ts`

Funções para interação com a API do GBIF:
- `obterEspeciesMaisComuns()` - Lista espécies mais registradas em uma região

### `sources/inaturalist.ts`

Funções para interação com a API do iNaturalist:
- `consultarApiINat()` - Busca dados completos de uma espécie
- `obterTaxonsIrmaos()` - Encontra táxons no mesmo nível taxonômico
- `obterEspeciesAleatorias()` - Busca espécies aleatórias para distratores

### `generators/alternativas.ts`

Lógica para geração de alternativas incorretas em flashcards com cache Redis:
- `gerarAlternativasIncorretas()` - Cria 3 distratores, primeiro buscando no Redis, senão gera automaticamente

### `deck-builder.ts`

Funções de alto nível para construção de decks:
- `criarDeckAutomatico()` - Pipeline completo retornando Cards prontos para `addCards()`

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
  - Ex: Se *Turdus leucomelas* e *Turdus rufiventris* têm `max_id_level = \"genus\"`, cria apenas 1 card para \"Turdus\"
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
