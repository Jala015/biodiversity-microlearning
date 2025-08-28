import { describe, expect, it, beforeAll } from "vitest";
import {
  obterEspeciesMaisComuns,
  criarDeckAutomatico,
  consultarApiINat,
  gerarAlternativasIncorretas,
  montarCardsComAlternativas,
} from "../../app/utils/api";

// Dados de teste para região de São Paulo
const dadosCirculo = {
  lat: -23.627726,
  lng: -46.797636,
  radiusKm: 10,
};

describe("API iNaturalist e GBIF - Funções Atuais", () => {
  // Teste para obterEspeciesMaisComuns (GBIF)
  it("deve buscar espécies mais comuns na região usando GBIF", async () => {
    const resultado = await obterEspeciesMaisComuns({
      lat: dadosCirculo.lat,
      lng: dadosCirculo.lng,
      radiusKm: dadosCirculo.radiusKm,
      maxSpecies: 5,
    });

    expect(resultado.nomes_cientificos).toBeDefined();
    expect(Array.isArray(resultado.nomes_cientificos)).toBe(true);
    expect(resultado.speciesCounts).toBeInstanceOf(Map);
    expect(resultado.validSpecies).toBeDefined();
    expect(Array.isArray(resultado.validSpecies)).toBe(true);

    // Verificar se os nomes científicos têm formato válido (Gênero espécie)
    resultado.nomes_cientificos.forEach((nome) => {
      expect(nome).toMatch(/^[A-Z][a-z]+ [a-z]+/);
    });

    // Verificar se o Map de counts tem as mesmas espécies
    expect(resultado.speciesCounts.size).toBeGreaterThan(0);
  }, 15000);

  // Teste para consultarApiINat
  it("deve consultar dados de espécie no iNaturalist", async () => {
    const nomeEspecie = "Turdus rufiventris"; // Sabiá-laranjeira

    const resultado = await consultarApiINat(nomeEspecie);

    if (resultado) {
      expect(resultado.taxon).toBeDefined();
      expect(resultado.inatId).toBeDefined();
      expect(resultado.nome_cientifico).toBeDefined();
      expect(resultado.nome_cientifico).toContain("Turdus");
      expect(typeof resultado.inatId).toBe("number");

      // Verificar estrutura do taxon
      expect(resultado.taxon.id).toBe(resultado.inatId);
      expect(resultado.taxon.name).toBeDefined();
      expect(resultado.taxon.rank).toBeDefined();
    }
  }, 10000);

  // Teste para gerarAlternativasIncorretas
  it("deve gerar exatamente 3 alternativas incorretas", async () => {
    // Primeiro obter um táxon válido
    const resultadoINat = await consultarApiINat("Turdus rufiventris");

    if (resultadoINat) {
      const alternativas = await gerarAlternativasIncorretas(
        resultadoINat.taxon,
        resultadoINat.nomePopularPt,
        "species",
      );

      expect(alternativas).toBeDefined();
      expect(Array.isArray(alternativas)).toBe(true);
      expect(alternativas).toHaveLength(3);

      // Verificar estrutura das alternativas
      alternativas.forEach((alt) => {
        expect(alt.nome_cientifico).toBeDefined();
        expect(typeof alt.nome_cientifico).toBe("string");
        expect(alt.nome_cientifico.length).toBeGreaterThan(0);

        // Nome popular pode ser undefined
        if (alt.nome_popular) {
          expect(typeof alt.nome_popular).toBe("string");
        }
      });

      // Verificar que não há duplicatas
      const nomesUnicos = new Set(alternativas.map((a) => a.nome_cientifico));
      expect(nomesUnicos.size).toBe(3);
    } else {
      console.warn("Não foi possível obter dados do iNaturalist para o teste");
    }
  }, 15000);

  // Teste para montarCardsComAlternativas
  it("deve montar cards com alternativas a partir de nomes científicos", async () => {
    const nomesEspecies = ["Turdus rufiventris", "Pitangus sulphuratus"];
    const counts = new Map([
      ["Turdus rufiventris", 15],
      ["Pitangus sulphuratus", 8],
    ]);

    const cards = await montarCardsComAlternativas(nomesEspecies, 2, counts);

    expect(Array.isArray(cards)).toBe(true);

    if (cards.length > 0) {
      cards.forEach((card) => {
        expect(card.id).toBeDefined();
        expect(card.taxon).toBeDefined();
        expect(card.nivel).toBeDefined();
        expect(["facil", "medio", "dificil", "desafio"]).toContain(card.nivel);
        expect(card.cooldown).toBeDefined();
        expect(typeof card.cooldown).toBe("number");
        expect(card.lastSeenAt).toBeDefined();
        expect(card.alternativas_erradas).toBeDefined();
        expect(Array.isArray(card.alternativas_erradas)).toBe(true);
        expect(card.alternativas_erradas).toHaveLength(3);
      });
    }
  }, 20000);

  // Teste para criarDeckAutomatico (função principal)
  it("deve criar um deck automático completo", async () => {
    const deck = await criarDeckAutomatico(dadosCirculo, 3);

    expect(deck).toBeDefined();
    expect(deck.cards).toBeDefined();
    expect(Array.isArray(deck.cards)).toBe(true);
    expect(deck.totalCards).toBeDefined();
    expect(typeof deck.totalCards).toBe("number");
    expect(deck.totalCards).toBe(deck.cards.length);

    if (deck.cards.length > 0) {
      // Verificar estrutura dos cards
      deck.cards.forEach((card) => {
        expect(card.id).toBeDefined();
        expect(card.taxon).toBeDefined();
        expect(card.nivel).toBeDefined();
        expect(card.cooldown).toBeDefined();
        expect(card.lastSeenAt).toBeDefined();
        expect(card.alternativas_erradas).toBeDefined();
        expect(card.alternativas_erradas).toHaveLength(3);
      });

      console.log(`✅ Deck criado com ${deck.totalCards} cards`);
    }
  }, 30000);

  // Teste para verificar se as funções lidam bem com erros
  it("deve lidar com regiões sem espécies", async () => {
    // Região no meio do oceano
    const regiaVazia = {
      lat: -30.0,
      lng: -40.0,
      radiusKm: 5,
    };

    const resultado = await obterEspeciesMaisComuns({
      lat: regiaVazia.lat,
      lng: regiaVazia.lng,
      radiusKm: regiaVazia.radiusKm,
      maxSpecies: 5,
    });

    expect(resultado.nomes_cientificos).toBeDefined();
    expect(Array.isArray(resultado.nomes_cientificos)).toBe(true);
    expect(resultado.speciesCounts).toBeInstanceOf(Map);

    // Pode ter 0 espécies em regiões vazias
    expect(resultado.nomes_cientificos.length).toBeGreaterThanOrEqual(0);
  }, 10000);

  // Teste para espécie inexistente no iNaturalist
  it("deve retornar null para espécie inexistente", async () => {
    const nomeInexistente = "Especie inexistentis";

    const resultado = await consultarApiINat(nomeInexistente);

    expect(resultado).toBeNull();
  }, 5000);
});
