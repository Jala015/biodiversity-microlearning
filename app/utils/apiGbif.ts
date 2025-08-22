// Importar a função do Redis
import { obterImagemCurada } from '~/utils/redis'

// Função para buscar o nome popular em português
interface GbifVernacularName { vernacularName: string; language: string; }

// Helper functions
async function nomePopularEmPortugues(speciesKey: string): Promise<string | undefined> {
    try {
        const url = `https://api.gbif.org/v1/species/${speciesKey}/vernacularNames`;
        const response = await $fetch<{ results: GbifVernacularName[] }>(url);
        const portugueseName = response.results.find(n => n.language === 'por');
        return portugueseName?.vernacularName;
    } catch (error) {
        console.error(`Erro ao buscar nome vernacular para speciesKey ${speciesKey}:`, error);
        return undefined;
    }
}

function turfToWkt(polygon: any): string {
    const coordinates = polygon.geometry.coordinates[0].map((p: any) => `${p[0]} ${p[1]}`).join(',');
    return `POLYGON((${coordinates}))`;
}

// funções para montar o deck

// obter espécies mais comuns na região
interface SearchOptions {
    geomCircle: any;      // Geometria do círculo (turf.js)
    maxSpecies: number;    // Número máximo de espécies (padrão: 10)
    taxonId?: number;      // ID do grupo taxonômico (padrão: 3 = Aves)
}
export async function obterEspeciesMaisComuns(opcoes: SearchOptions): Promise<{ speciesKeys: string[], speciesCounts: Map<string, number> }> {
    const geomWkt = turfToWkt(opcoes.geomCircle);
    const params = new URLSearchParams({
        geometry: geomWkt,
        facet: 'speciesKey',
        limit: '0', // Usar '0' para obter apenas os facetas
        datasetKey: '50c9509d-22c7-4a22-a47d-8c48425ef4a7', //iNat research grade
    });
    if (opcoes.taxonId) {
        params.append('taxon_key', opcoes.taxonId.toString());
    }

    const url = `https://api.gbif.org/v1/occurrence/search?${params.toString()}`;
    // realizar a requisição
    const response = await $fetch<{ facets: { counts: { name: string; count: number; }[] }[] }>(url, {
        headers: {
            'Cache-Control': 'max-age=3600'
        }
    });

    const speciesKeys = response.facets?.[0]?.counts
        .map(c => c.name)
        .slice(0, opcoes.maxSpecies * 2) // Buscar o dobro para filtrar depois (pode ser que algumas espécies só tenham registros com problemas)
        || [];

    //montar um map com os respectivos counts
    const speciesCounts = new Map<string, number>();
    response.facets?.[0]?.counts.forEach(count => {
        speciesCounts.set(count.name, count.count);
    });
    console.log(`📊 ${speciesKeys.length} espécies encontradas na região`);

    return { speciesKeys, speciesCounts };
}

// obtem mídia e nome popular das espécies, filtrando para fora as que não tem midia
interface GbifOccurrence {
    speciesKey?: number;
    scientificName: string;
    media?: { identifier: string, type: string, license: string, rightsHolder: string }[];
}
interface EspecieComDados {
    speciesKey: string;
    nome_cientifico: string;
    contagemOcorrencias?: number; // opcional, usado para contar ocorrências na região
    nome_popular?: string;
    media?: { identifier: string, type: string, license: string, rightsHolder: string }[];
}

export async function montarDetalhesDasEspecies(speciesKeys: string[], maxSpecies: number, counts: Map<string, number>): Promise<Map<string, EspecieComDados>> {
    console.log(`🔍 Processando ${speciesKeys.length} espécies...`);
    
    const speciesMap = new Map<string, EspecieComDados>();
    let especiesComImagem = 0;
    
    // Primeiro: tentar buscar imagens curadas para todas as espécies
    const especiesComImagemCurada = new Set<string>();
    
    console.log(`🎨 Verificando imagens curadas no Redis...`);
    for (const speciesKey of speciesKeys.slice(0, maxSpecies * 2)) {
        try {
            const imagemCurada = await obterImagemCurada(speciesKey);
            
            if (imagemCurada) {
                especiesComImagemCurada.add(speciesKey);
                
                // Buscar nome popular
                const nomePopular = await nomePopularEmPortugues(speciesKey);
                const count = counts.get(speciesKey) || 0;
                
                // Buscar nome científico via API do GBIF
                const speciesInfo = await $fetch<{ scientificName: string }>(`https://api.gbif.org/v1/species/${speciesKey}`);
                
                speciesMap.set(speciesKey, {
                    speciesKey,
                    nome_cientifico: speciesInfo.scientificName,
                    nome_popular: nomePopular,
                    media: [{
                        identifier: imagemCurada,
                        type: 'StillImage',
                        license: 'Curada',
                        rightsHolder: 'Curadoria'
                    }],
                    contagemOcorrencias: count
                });
                
                especiesComImagem++;
                console.log(`✓ Imagem curada encontrada para ${speciesInfo.scientificName}`);
                
                // Parar se já temos espécies suficientes
                if (especiesComImagem >= maxSpecies) {
                    console.log(`✓ ${especiesComImagem} espécies com imagens curadas coletadas`);
                    return speciesMap;
                }
            }
        } catch (error) {
            console.error(`❌ Erro ao processar imagem curada para ${speciesKey}:`, error);
            continue;
        }
    }
    
    console.log(`🎨 ${especiesComImagemCurada.size} espécies com imagens curadas encontradas`);
    
    // Se ainda precisamos de mais espécies, buscar no GBIF
    const especiesRestantes = maxSpecies - especiesComImagem;
    if (especiesRestantes > 0) {
        console.log(`📷 Buscando ${especiesRestantes} espécies adicionais no GBIF...`);
        
        // Filtrar espécies que ainda não temos
        const speciesKeysRestantes = speciesKeys.filter(key => !especiesComImagemCurada.has(key));
        
        const params = new URLSearchParams({
            mediaType: 'StillImage',
            limit: (especiesRestantes * 3).toString(), // Buscar mais para ter opções
        });

        // Processar em lotes para evitar URLs muito longas
        const batchSize = 10;
        const allOccurrences: GbifOccurrence[] = [];

        for (let i = 0; i < speciesKeysRestantes.length && especiesComImagem < maxSpecies; i += batchSize) {
            const batch = speciesKeysRestantes.slice(i, i + batchSize);
            const batchParams = new URLSearchParams(params);
            batch.forEach(key => batchParams.append('speciesKey', key));

            const url = `https://api.gbif.org/v1/occurrence/search?${batchParams.toString()}`;

            try {
                const response = await $fetch<{
                    results: GbifOccurrence[]
                }>(url);

                console.log(`📦 Lote GBIF ${Math.floor(i / batchSize) + 1}: ${response.results.length} ocorrências encontradas`);
                allOccurrences.push(...response.results);

                // Parar se já temos espécies suficientes com mídia
                const uniqueWithMedia = new Set(
                    allOccurrences
                        .filter(occ => occ.speciesKey && occ.media?.length)
                        .map(occ => occ.speciesKey!.toString())
                );

                if (especiesComImagem + uniqueWithMedia.size >= maxSpecies) {
                    console.log(`✓ Coletadas espécies suficientes, parando busca GBIF`);
                    break;
                }
            } catch (error) {
                console.error(`❌ Erro ao buscar lote GBIF ${Math.floor(i / batchSize) + 1}:`, error);
                continue;
            }
        }

        // Processar ocorrências do GBIF
        const groupedBySpecies = new Map<string, GbifOccurrence[]>();
        allOccurrences.forEach(occ => {
            if (!occ.speciesKey) return;
            const key = occ.speciesKey.toString();
            if (!groupedBySpecies.has(key)) {
                groupedBySpecies.set(key, []);
            }
            groupedBySpecies.get(key)!.push(occ);
        });

        // Filtrar apenas espécies que têm mídia e ainda precisamos
        const speciesWithMedia = Array.from(groupedBySpecies.entries())
            .filter(([key, occurrences]) => {
                return occurrences.some(occ => occ.media?.length && occ.media.length > 0);
            })
            .slice(0, especiesRestantes);

        console.log(`📷 ${speciesWithMedia.length} espécies do GBIF têm mídia disponível`);

        for (const [key, occurrences] of speciesWithMedia) {
            if (especiesComImagem >= maxSpecies) break;
            
            const occWithMedia = occurrences.find(occ => occ.media?.length && occ.media.length > 0);
            if (!occWithMedia) continue;

            try {
                const nomePopular = await nomePopularEmPortugues(key);
                const count = counts.get(key) || 0;

                speciesMap.set(key, {
                    speciesKey: key,
                    nome_cientifico: occWithMedia.scientificName,
                    nome_popular: nomePopular,
                    media: occWithMedia.media || [],
                    contagemOcorrencias: count
                });

                especiesComImagem++;
                console.log(`✓ Processada espécie GBIF: ${occWithMedia.scientificName} (${nomePopular || 'sem nome popular'})`);

            } catch (error) {
                console.error(`❌ Erro ao processar espécie GBIF ${key}:`, error);
                continue;
            }
        }
    }

    console.log(`✅ Total: ${especiesComImagem} espécies processadas (${especiesComImagemCurada.size} curadas + ${especiesComImagem - especiesComImagemCurada.size} GBIF)`);
    return speciesMap;
}