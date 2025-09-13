# Sistema de Decks iNaturalist - Manual Técnico

## Visão Geral

O sistema de decks permite criar automaticamente conjuntos de flashcards baseados em observações do iNaturalist para uma região geográfica específica. Este documento detalha o funcionamento interno do sistema, desde a criação até o uso dos decks.

## Arquitetura do Sistema

### Componentes Principais

1. **novo-inat.vue** - Interface para criação de novos decks
2. **decks.ts (store)** - Gerenciamento de estado e lógica dos decks
3. **flashcard.vue** - Interface de estudo
4. **API iNaturalist** - Fonte dos dados de biodiversidade

### Estrutura de Dados

```typescript
interface Card {
  id: string;
  taxon: string;
  nomePopular?: string;
  nivel: NivelDificuldade; // "facil" | "medio" | "dificil" | "desafio"
  cooldown?: number;
  lastSeenAt?: number;
  // ... outras propriedades
}

interface DeckState {
  id: string;
  globalCounter: number;
  currentLevel: NivelDificuldade;
  levelsQueue: Card[];     // Cards novos organizados por nível
  cooldownQueue: Card[];   // Cards em período de cooldown
  reviewQueue: Card[];     // Cards prontos para revisão
  config: DeckConfig;
}
```

## Fluxo de Criação de Deck

### 1. Interface do Usuário (novo-inat.vue)

O processo inicia quando o usuário:

1. **Desenha um círculo no mapa** → Gera coordenadas (lat, lng, radius)
2. **Seleciona filtros taxonômicos** → Define grupos como "Aves", "Mamíferos", etc.
3. **Clica "Gerar deck"** → Dispara `montarDeck()`

### 2. Montagem do Deck (montarDeck)

```javascript
async function montarDeck(circulo) {
    // 1. Busca dados do iNaturalist
    const deck = await criarDeckAutomatico(circulo, 20, filtros);

    // 2. Obtém nome da cidade para o deck
    const cidade = await obterNomeCidade(circulo.lat, circulo.lng);

    // 3. Ativa/cria o deck no store
    await decksStore.activateDeck(deckId, nome);

    // 4. Adiciona as cartas ao deck
    decksStore.addCards(deck.cards);
}
```

### 3. Ativação do Deck (activateDeck)

```javascript
async activateDeck(deckId, nome) {
    // 1. Inicializa conexão IndexedDB
    await this.initDB();

    // 2. Cria estrutura inicial do deck se não existir
    if (!this.decks[deckId]) {
        this.decks[deckId] = {
            id: deckId,
            globalCounter: 0,
            currentLevel: "facil",  // Sempre inicia no nível fácil
            levelsQueue: [],
            cooldownQueue: [],
            reviewQueue: [],
            config: { /* configurações padrão */ }
        };
    }

    // 3. Carrega deck salvo do IndexedDB se existir
    const saved = await this.dbConnection.get(STORE_NAME, deckId);
    if (saved) {
        Object.assign(this.decks[deckId], saved);
    }

    // 4. Define como deck ativo
    this.activeDeckId = deckId;
}
```

### 4. Adição de Cartas (addCards)

```javascript
async addCards(cards) {
    const deck = this.getActiveDeck();

    cards.forEach((c) => {
        // VERIFICAÇÃO ANTI-DUPLICATA (correção do bug!)
        const existsInLevels = deck.levelsQueue.some(card => card.id === c.id);
        const existsInCooldown = deck.cooldownQueue.some(card => card.id === c.id);
        const existsInReview = deck.reviewQueue.some(card => card.id === c.id);

        if (!existsInLevels && !existsInCooldown && !existsInReview) {
            // Define cooldown inicial baseado no nível
            const cooldownMap = { facil: 3, medio: 5, dificil: 8, desafio: 12 };
            c.cooldown = cooldownMap[c.nivel] || 5;
            c.lastSeenAt = 0;

            // Adiciona à fila de níveis
            deck.levelsQueue.push(c);
        }
    });
}
```

## Sistema de Níveis e Filas

### Níveis de Dificuldade

```javascript
const ORDEM_NIVEIS = ["facil", "medio", "dificil", "desafio"];
```

### Distribuição das Cartas nas Filas

#### 1. **levelsQueue** - Cartas Novas
- Contém todas as cartas organizadas por nível de dificuldade
- O usuário estuda apenas cartas do `currentLevel` atual
- Progressão: `facil` → `medio` → `dificil` → `desafio`

#### 2. **cooldownQueue** - Cartas em Cooldown
- Cartas que foram respondidas e estão "descansando"
- Cada carta tem um `cooldown` (número de turnos até poder ser revisada)
- Cooldown é ajustado baseado em acerto/erro:
  - **Acerto**: `cooldown = cooldown * taxaAcerto` (padrão: 2x)
  - **Erro**: `cooldown = cooldown * taxaErro` (padrão: 0.5x)

#### 3. **reviewQueue** - Cartas para Revisão
- Cartas cujo cooldown já passou (`globalCounter - lastSeenAt >= cooldown`)
- Movidas automaticamente da `cooldownQueue` via `refreshReviewQueue()`

## Fluxo de Estudo

### 1. Seleção de Carta (getNextCard)

```javascript
getNextCard() {
    const cardsNovos = deck.levelsQueue.filter(c => c.nivel === deck.currentLevel);
    const cardsRevisao = deck.reviewQueue;

    // Algoritmo de seleção por peso
    const pesoNovos = cardsNovos.length;
    const pesoRevisao = cardsRevisao.length * deck.config.pesoRevisao;
    const sorteio = Math.random() * (pesoNovos + pesoRevisao);

    if (sorteio < pesoRevisao) {
        return { card: cardsRevisao[0], origin: "revisao" };
    } else {
        return { card: cardsNovos[0], origin: "nova" };
    }
}
```

### 2. Processamento de Resposta (answerCard)

```javascript
async answerCard(card, acertou) {
    // 1. Incrementa contador global
    await this.incrementGlobalCounter();

    // 2. Atualiza cooldown da carta
    await this.updateCooldown(card, acertou);

    // 3. Salva estado
    await this.saveDeckDebounced(deck);
}
```

### 3. Atualização de Cooldown (updateCooldown)

```javascript
async updateCooldown(card, acertou) {
    // Ajusta cooldown baseado na resposta
    if (acertou) {
        card.cooldown = Math.round(card.cooldown * deck.config.taxaAcerto);
    } else {
        card.cooldown = Math.max(
            deck.config.minCooldown,
            Math.round(card.cooldown * deck.config.taxaErro)
        );
    }

    // Marca quando foi vista pela última vez
    card.lastSeenAt = deck.globalCounter;

    // Remove das filas ativas e adiciona ao cooldown
    deck.reviewQueue = deck.reviewQueue.filter(c => c.id !== card.id);
    deck.levelsQueue = deck.levelsQueue.filter(c => c.id !== card.id);
    deck.cooldownQueue.push(card);
}
```

### 4. Refresh da Fila de Revisão (refreshReviewQueue)

```javascript
async refreshReviewQueue() {
    // Encontra cartas prontas para revisão
    const ready = deck.cooldownQueue.filter(c => {
        return deck.globalCounter - c.lastSeenAt >= c.cooldown;
    });

    if (ready.length > 0) {
        // Move para fila de revisão
        deck.reviewQueue.push(...ready);
        deck.cooldownQueue = deck.cooldownQueue.filter(c => !ready.includes(c));
    }
}
```

## Progressão de Níveis

### Verificação de Avanço (canAdvanceLevel)

```javascript
canAdvanceLevel() {
    const idx = ORDEM_NIVEIS.indexOf(deck.currentLevel);
    return (
        idx < ORDEM_NIVEIS.length - 1 &&
        deck.levelsQueue.filter(c => c.nivel === deck.currentLevel).length === 0
    );
}
```

### Avanço de Nível (advanceLevel)

```javascript
async advanceLevel() {
    const idx = ORDEM_NIVEIS.indexOf(deck.currentLevel);
    const next = ORDEM_NIVEIS[idx + 1];
    if (next) {
        deck.currentLevel = next;
        await this.saveDeckDebounced(deck);
        return true;
    }
    return false;
}
```

## Reset de Deck
```javascript
async resetDeck(deckId) {
    // 1. Coleta TODAS as cartas das filas
    const allCards = deck.levelsQueue
        .concat(deck.cooldownQueue)
        .concat(deck.reviewQueue);

    // 2. REMOVE DUPLICATAS usando Map
    const uniqueCardsMap = new Map();
    allCards.forEach(card => {
        uniqueCardsMap.set(card.id, card);
    });
    const cards = Array.from(uniqueCardsMap.values());

    // 3. Reset das propriedades
    cards.forEach(card => {
        card.cooldown = 0;
        delete card.lastSeenAt;
    });

    // 4. Limpa filas e recria
    deck.levelsQueue = [];
    deck.cooldownQueue = [];
    deck.reviewQueue = [];

    // 5. Re-adiciona cartas (agora sem duplicatas)
    await this.addCards(cards);

    // 6. Reset do estado
    deck.currentLevel = "facil";
    deck.globalCounter = 0;
}
```

## Persistência e Performance

### IndexedDB
- **Salvamento automático**: Debounced (500ms) para evitar writes excessivos
- **Carregamento**: Ao ativar deck, carrega estado salvo
- **Serialização**: Trata datas e objetos complexos

### Performance
- **Lazy loading**: Só carrega deck ativo
- **Debounced saves**: Evita saves desnecessários
- **Memory management**: Remove decks inativos da memória

## Debugging e Monitoramento

### Stats do Deck
```javascript
getDeckStats() {
    return {
        total: totalCards,
        totalSeen,
        currentLevelTotal,
        currentLevelSeen,
        review: deck.reviewQueue.length,
        new: currentLevelCards.length,
        currentLevel: deck.currentLevel,
        globalCounter: deck.globalCounter,
        // Filas para debugging
        currentLevelQueue,
        currentCooldownQueue,
        currentReviewQueue
    };
}
```

### Logs de Debug
- `console.debug()` para rastreamento de cartas
- Logs detalhados no painel de debug
- Tracking de origem das cartas (nova/revisão)

## Considerações Técnicas

### Configurações Padrão
- **taxaAcerto**: 2 (dobra cooldown em acerto)
- **taxaErro**: 0.5 (reduz cooldown pela metade em erro)
- **minCooldown**: Valor mínimo do cooldown
- **pesoRevisao**: 0.3 (peso das cartas de revisão na seleção)

### Limitações
- Máximo de cartas por nível definido na API
- Dependência da disponibilidade do iNaturalist
- Armazenamento local (IndexedDB) limitado pelo browser

Este sistema implementa um algoritmo de repetição espaçada adaptativo, balanceando aprendizado de conteúdo novo com revisão de conteúdo já visto, otimizado para o aprendizado de biodiversidade regional.
