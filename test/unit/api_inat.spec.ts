import { describe, expect, it, beforeAll } from "vitest";
import {
  obterEspeciesMaisComuns,
  criarDeckAutomatico,
  consultarApiINat,
  gerarAlternativasIncorretas,
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

// teste com obterMaxId
import { obterMaxIdLevel } from "../../app/utils/redis";

it("deve retornar o maior ID de uma espécie", async () => {
  const nomeValido = "Felis catus";

  const resultado = await obterMaxIdLevel({
    taxon: {
      id: 904336,
      complete_rank: "species",
      children: [],
      rank: "species",
      rank_level: 10,
      iconic_taxon_id: 47119,
      ancestor_ids: [
        48460, 1, 47120, 245097, 47119, 47118, 120474, 342614, 319384, 1492653,
        904332, 904336,
      ],
      is_active: true,
      name: "Trichonephila clavipes",
      parent_id: 904332,
      ancestry:
        "48460/1/47120/245097/47119/47118/120474/342614/319384/1492653/904332",
      extinct: false,
      default_photo: {
        id: 504064519,
        license_code: "cc-by-nc",
        attribution:
          "(c) Francisco Herrera, some rights reserved (CC BY-NC), uploaded by Francisco Herrera",
        url: "https://inaturalist-open-data.s3.amazonaws.com/photos/504064519/square.jpg",
        original_dimensions: {
          height: 2048,
          width: 1638,
        },
        flags: [],
        attribution_name: "Francisco Herrera",
        square_url:
          "https://inaturalist-open-data.s3.amazonaws.com/photos/504064519/square.jpg",
        medium_url:
          "https://inaturalist-open-data.s3.amazonaws.com/photos/504064519/medium.jpg",
      },
      taxon_changes_count: 1,
      taxon_schemes_count: 0,
      observations_count: 52903,
      flag_counts: {
        resolved: 0,
        unresolved: 0,
      },
      current_synonymous_taxon_ids: null,
      atlas_id: 28525,
      complete_species_count: null,
      wikipedia_url: "https://en.wikipedia.org/wiki/Trichonephila_clavipes",
      matched_term: "Trichonephila clavipes",
      iconic_taxon_name: "Arachnida",
      preferred_common_name: "Aranha-de-teia-dourada",
      english_common_name: "Golden Silk Spider",
    },
    inatId: 904336,
    nome_cientifico: "Trichonephila clavipes",
    nomePopularPt: "Aranha-de-teia-dourada",
    foto: {
      identifier:
        "https://inaturalist-open-data.s3.amazonaws.com/photos/504064519/medium.jpg",
      type: "StillImage",
      license: "cc-by-nc",
      rightsHolder:
        "(c) Francisco Herrera, some rights reserved (CC BY-NC), uploaded by Francisco Herrera",
    },
    ancestor_ids: [
      48460, 1, 47120, 245097, 47119, 47118, 120474, 342614, 319384, 1492653,
      904332, 904336,
    ],
  });

  expect(resultado).toBeGreaterThan(0);
}, 5000);
