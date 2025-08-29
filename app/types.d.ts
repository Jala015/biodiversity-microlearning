import type { Especie, MediaEspecie } from "./utils/api";

export interface Card {
  id: string;
  taxon: string;
  nomePopular?: string;
  nivel: "facil" | "medio" | "dificil" | "desafio";
  cooldown: number;
  lastSeenAt: number;
  alternativas_erradas: Especie[];
  imagem: MediaEspecie;
}

export interface DeckConfig {
  taxaAcerto: number;
  taxaErro: number;
  minCooldown: number;
  pesoRevisao: number;
  id: string;
  nome: string;
  descricao: string;
  source: string;
  favorite?: boolean;
}

export type NivelDificuldade = "facil" | "medio" | "dificil" | "desafio";
