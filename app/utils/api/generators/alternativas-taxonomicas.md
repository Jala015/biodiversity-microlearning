# Sistema de Alternativas Taxonômicas

## Visão Geral

O sistema foi atualizado para usar grupos taxonômicos mais inteligentes na geração de alternativas incorretas para os flashcards. Agora o sistema:

1. **Usa grupos taxonômicos processados**: As alternativas são buscadas primeiro nos grupos criados por `processarEAgrupar()`
2. **Integra ancestor_ids do iNaturalist**: Usa dados taxonômicos mais precisos da API do iNaturalist (sem consultas redundantes)
3. **Fallback inteligente**: Se não houver alternativas suficientes no grupo, usa `obterGruposIrmaos()` com ancestor_ids
4. **Otimização de consultas**: Reutiliza dados de `consultarApiINat()` para extrair ancestor_ids

## Arquitetura das Mudanças

### 1. ValidSpecies Interface (types.ts)

```typescript
export interface ValidSpecies {
  key: number;
  scientificName: string;
  canonicalName: string;
  reino: string;
  filo: string;
  classe: string;
  ordem: string;
  familia: string;
  genero: string;
  ancestorIds?: number[];  // ← NOVO: IDs dos ancestrais taxonômicos (opcional)
}
```

### 2. Otimização das Consultas

A função `coletarDados()` em deck-builder.ts agora:
- Obtém dados básicos do GBIF via `obterEspeciesMaisComuns()`
- Consulta o iNaturalist uma única vez por espécie via `consultarApiINat()`
- Extrai os `ancestor_ids` dessas consultas já realizadas
- Enriquece o objeto `ValidSpecies` com esses dados, sem consultas adicionais

### 3. Nova lógica do obterTaxonsIrmaos (inaturalist.ts)

```typescript
// ANTES: Usava apenas parent_id
const inatUrl = `https://api.inaturalist.org/v1/taxa?parent_id=${correctTaxon.parent_id}...`

// AGORA: Usa ancestor_ids para busca mais precisa
const ancestorIdsStr = correctTaxon.ancestor_ids.join(",");
const inatUrl = `https://api.inaturalist.org/v1/taxa?ancestor_ids=${ancestorIdsStr}...`
```

### 4. Sistema de Alternativas Inteligente (alternativas.ts)

A função `gerarAlternativasIncorretas()` agora segue esta prioridade:

1. **Primeira prioridade**: Buscar no mesmo grupo taxonômico de `processarEAgrupar()`
2. **Segunda prioridade**: Usar `obterTaxonsIrmaos()` com ancestor_ids
3. **Terceira prioridade**: Estratégias específicas (epiteto correto, nome popular correto)
4. **Fallback final**: Espécies aleatórias

## Exemplo de Uso

### Como funciona na prática:

```typescript
// 1. O GBIF retorna espécies da região
const { dadosGBIF, dadosINat, validSpecies } = await coletarDados({
  lat: -15.7942,
  lng: -47.8822,
  radiusKm: 50,
  maxSpecies: 20
});

// 2. consultarApiINat() já retorna os dados completos incluindo ancestor_ids
// validSpecies é enriquecido com esses dados:
// {
//   scientificName: "Ardea herodias",
//   ancestorIds: [48460,1,2,355675,3,67566,4929,597395,4950]
// }

// 3. processarEAgrupar() cria grupos como:
// "genus:Ardea" -> { especies: ["Ardea herodias", "Ardea alba", "Ardea cinerea"] }

// 4. gerarAlternativasIncorretas() para "Ardea herodias":
//    - Primeiro: busca outras espécies do grupo "genus:Ardea"
//    - Se não tiver 3, usa ancestor_ids para buscar táxons relacionados
//    - Fallback: estratégias tradicionais
```

### Exemplo da resposta iNaturalist com ancestor_ids:

```json
{
  "results": [{
    "id": 4950,
    "name": "Ardea",
    "rank": "genus",
    "ancestor_ids": [48460,1,2,355675,3,67566,4929,597395],
    "parent_id": 597395,
    "preferred_common_name": "Great Herons and Egrets"
  }]
}
```

Os `ancestor_ids` representam:
- 48460: Life
- 1: Animalia (Kingdom)
- 2: Chordata (Phylum)
- 355675: Vertebrata (Subphylum)
- 3: Aves (Class)
- 67566: Pelecaniformes (Order)
- 4929: Ardeidae (Family)
- 597395: Ardeinae (Subfamily)

## Vantagens do Novo Sistema

1. **Alternativas mais relevantes**: Usa espécies do mesmo grupo taxonômico real
2. **Consultas otimizadas**: Evita consultas redundantes ao iNaturalist
3. **Taxonomia mais precisa**: ancestor_ids fornecem relações taxonômicas completas
4. **Fallback robusto**: Sistema degrada graciosamente se dados não estão disponíveis
5. **Performance melhor**: Extrair ancestor_ids de consultas que já são necessárias
6. **Menor carga na API**: Reduz o número de requisições ao iNaturalist

## Funções Principais

### `gerarAlternativasIncorretas()`
```typescript
await gerarAlternativasIncorretas(
  correctTaxon: INatTaxon,
  nomePopularCorreto: string | undefined,
  nivelTaxonomicoMaximo: string,
  gruposTaxon?: Map<string, GrupoTaxon>  // ← NOVO parâmetro opcional
)
```

### `obterTaxonsIrmaos()`
```typescript
// Agora usa ancestor_ids em vez de apenas parent_id
await obterTaxonsIrmaos(correctTaxon, count)
```

## Rate Limiting

O sistema mantém delays de 1001ms entre consultas à API do iNaturalist para respeitar os rate limits tanto no GBIF quanto nas buscas de ancestor_ids e táxons irmãos.
