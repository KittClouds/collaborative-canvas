import type { ExpandedResult } from './graphExpansion';

export interface RerankOptions {
  vectorWeight: number;
  graphWeight: number;
  k: number;
}

export interface RankedResult extends ExpandedResult {
  finalScore: number;
  vectorRank?: number;
  graphRank?: number;
}

const DEFAULT_RERANK_OPTIONS: RerankOptions = {
  vectorWeight: 0.6,
  graphWeight: 0.4,
  k: 60,
};

export function rerankResults(
  results: ExpandedResult[],
  options: Partial<RerankOptions> = {}
): RankedResult[] {
  const opts = { ...DEFAULT_RERANK_OPTIONS, ...options };

  if (results.length === 0) return [];

  const vectorRanked = [...results].sort((a, b) => b.score - a.score);

  const graphRanked = [...results].sort((a, b) => {
    const distA = a.graphDistance ?? 999;
    const distB = b.graphDistance ?? 999;
    return distA - distB;
  });

  const rankedResults: RankedResult[] = results.map(result => {
    const vectorRank = vectorRanked.findIndex(r => r.noteId === result.noteId) + 1;
    const graphRank = graphRanked.findIndex(r => r.noteId === result.noteId) + 1;

    const vectorScore = 1.0 / (vectorRank + opts.k);
    const graphScore = 1.0 / (graphRank + opts.k);

    const finalScore =
      (opts.vectorWeight * vectorScore) +
      (opts.graphWeight * graphScore);

    return {
      ...result,
      finalScore,
      vectorRank,
      graphRank,
    };
  });

  rankedResults.sort((a, b) => b.finalScore - a.finalScore);

  return rankedResults;
}

export function normalizeScores(results: RankedResult[]): RankedResult[] {
  if (results.length === 0) return [];

  const maxScore = Math.max(...results.map(r => r.finalScore));
  const minScore = Math.min(...results.map(r => r.finalScore));
  const range = maxScore - minScore;

  if (range === 0) {
    return results.map(r => ({ ...r, finalScore: 1 }));
  }

  return results.map(r => ({
    ...r,
    finalScore: (r.finalScore - minScore) / range,
  }));
}
