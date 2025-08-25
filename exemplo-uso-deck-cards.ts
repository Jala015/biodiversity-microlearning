// Exemplo de uso do novo sistema de Cards com deck-builder refatorado
import { criarDeckAutomatico, montarCardsComAlternativas } from '~/utils/api';
import { useDeckStore, deck_list } from '~/stores/decks';
import type { DeckConfig } from '~/stores/decks';

/**
 * Exemplo 1: Criar deck automático completo com Cards
 */
async function exemploCrearDeckCompleto() {
  console.log('🚀 Exemplo 1: Criando deck automático...');

  // Definir região geográfica (exemplo: Cerrado brasileiro)
  const geometriaCirculo = {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[[-48, -16], [-47, -16], [-47, -15], [-48, -15], [-48, -16]]]
    }
  };

  try {
    // Criar deck automático - agora retorna Cards prontos!
    const resultado = await criarDeckAutomatico(geometriaCirculo, 15);

    console.log(`✅ Deck criado com ${resultado.totalCards} cards`);
    console.log(`📍 Região: ${resultado.regiao.tipo}`);

    // Configurar deck
    const deckConfig: DeckConfig = {
      id: 'cerrado-birds-2024',
      nome: 'Aves do Cerrado',
      descricao: 'Espécies de aves mais comuns no Cerrado brasileiro',
      source: 'GBIF + iNaturalist',
      taxaAcerto: 2.0,
      taxaErro: 0.5,
      minCooldown: 3,
      pesoRevisao: 0.3,
      favorite: false
    };

    // Inicializar store do deck
    const deckStore = useDeckStore(deckConfig.id)();
    await deckStore.initDB();

    // Configurar deck
    deckStore.config = deckConfig;

    // Adicionar cards ao deck - agora é direto!
    deckStore.addCards(resultado.cards);

    // Adicionar à lista de decks
    const listStore = deck_list();
    if (!listStore.decks.some(d => d.id === deckConfig.id)) {
      listStore.decks.push(deckConfig);
    }

    console.log(`🎯 Cards distribuídos por nível:`, deckStore.cardsByLevel);
    console.log(`📊 Estatísticas:`, deckStore.deckStats);

    return deckStore;

  } catch (error) {
    console.error('❌ Erro ao criar deck:', error);
    throw error;
  }
}

/**
 * Exemplo 2: Verificar como as alternativas funcionam
 */
async function exemploAlternativasDetalhado() {
  console.log('🔍 Exemplo 2: Analisando alternativas geradas...');

  const geometriaCirculo = {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[[-23.6, -46.7], [-23.5, -46.7], [-23.5, -46.6], [-23.6, -46.6], [-23.6, -46.7]]]
    }
  };

  const resultado = await criarDeckAutomatico(geometriaCirculo, 5);

  console.log('\n📋 Análise detalhada dos cards:');
  resultado.cards.forEach((card, index) => {
    console.log(`\n--- Card ${index + 1} ---`);
    console.log(`🔬 Taxon: ${card.taxon}`);
    console.log(`📊 Nível: ${card.nivel}`);
    console.log(`⏱️ Cooldown inicial: ${card.cooldown}`);
    console.log(`🎲 Alternativas incorretas:`);

    card.alternativas_erradas.forEach((alt, i) => {
      console.log(`  ${i + 1}. ${alt.nome_cientifico}${alt.nome_popular ? ` (${alt.nome_popular})` : ''}`);
    });
  });
}

/**
 * Exemplo 3: Simulação de jogabilidade
 */
async function exemploJogabilidade() {
  console.log('🎮 Exemplo 3: Simulando jogabilidade...');

  const deckStore = await exemploCrearDeckCompleto();

  console.log('\n🎯 Iniciando simulação de jogo...');

  // Simular algumas rodadas
  for (let rodada = 1; rodada <= 5; rodada++) {
    console.log(`\n--- Rodada ${rodada} ---`);

    // Atualizar fila de revisão
    deckStore.refreshReviewQueue();

    // Puxar próximo card
    const card = deckStore.drawNextCard();

    if (!card) {
      console.log('🏁 Deck finalizado!');
      break;
    }

    console.log(`📄 Card atual: ${card.taxon} (${card.nivel})`);
    console.log(`🎲 Alternativas: ${card.alternativas_erradas.map(a => a.nome_cientifico).join(', ')}`);

    // Simular resposta (aleatória para exemplo)
    const acertou = Math.random() > 0.3; // 70% de chance de acerto
    console.log(`${acertou ? '✅' : '❌'} ${acertou ? 'Acertou!' : 'Errou!'}`);

    // Atualizar cooldown
    deckStore.updateCooldown(card, acertou);
    deckStore.incrementGlobalCounter();

    // Tentar avançar nível
    if (deckStore.canAdvanceLevel()) {
      const avancou = deckStore.advanceLevel();
      if (avancou) {
        console.log(`🆙 Avançou para nível: ${deckStore.currentLevel}`);
      }
    }

    console.log(`📊 Stats atuais:`, deckStore.currentLevelStats);
  }
}

/**
 * Exemplo 4: Usando cache Redis para alternativas
 */
async function exemploCacheRedis() {
  console.log('💾 Exemplo 4: Demonstrando uso do cache Redis...');

  console.log(`
📝 Para popular o Redis com alternativas pré-definidas, use:

HSET especies:alternativas:12345
  "1:nome_popular" "Bem-te-vi-de-bico-chato"
  "1:nome_cientifico" "Megarynchus pitangua"
  "2:nome_popular" "Bem-te-vi-pequeno"
  "2:nome_cientifico" "Pitangus lictor"
  "3:nome_popular" "Neinei"
  "3:nome_cientifico" "Megarynchus chrysocephalus"

Onde 12345 é o iNaturalist ID da espécie.

🎯 Benefícios:
- Alternativas de maior qualidade
- Redução de chamadas API
- Consistência entre sessões
- Curadoria especializada

⚡ O sistema automaticamente:
1. Busca alternativas no Redis primeiro
2. Se não encontrar, gera automaticamente
3. Sempre garante 3 alternativas por card
  `);
}

/**
 * Função principal para executar todos os exemplos
 */
export async function executarExemplos() {
  console.log('🎓 Executando exemplos do sistema de Cards...\n');

  try {
    await exemploCrearDeckCompleto();
    await exemploAlternativasDetalhado();
    await exemploJogabilidade();
    await exemploCacheRedis();

    console.log('\n✅ Todos os exemplos executados com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante execução dos exemplos:', error);
  }
}

// Exemplo de uso direto
// executarExemplos();
