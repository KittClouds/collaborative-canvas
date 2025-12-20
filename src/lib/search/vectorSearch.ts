import { getEmbeddingStore } from '@/lib/storage/index';
import type { EmbeddingRecord } from '@/lib/storage/interfaces';

export interface VectorSearchOptions {
  queryEmbedding: Float32Array | number[];
  model: 'small' | 'medium';
  k: number;
  minScore?: number;
  noteIds?: string[];
}

export interface VectorSearchResult {
  noteId: string;
  score: number;
}

function cosineSimilarity(a: number[] | Float32Array, b: number[] | Float32Array): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function searchNotesByVector(
  options: VectorSearchOptions
): Promise<VectorSearchResult[]> {
  const { queryEmbedding, model, k, minScore = 0, noteIds } = options;

  const embeddingStore = getEmbeddingStore();
  const allEmbeddings = await embeddingStore.getAllEmbeddings();

  const queryArray = Array.from(queryEmbedding);

  const results: VectorSearchResult[] = [];

  for (const embedding of allEmbeddings) {
    if (noteIds && !noteIds.includes(embedding.noteId)) {
      continue;
    }

    const noteEmbedding = model === 'small'
      ? embedding.embeddingSmall
      : embedding.embeddingMedium;

    if (!noteEmbedding) continue;

    const score = cosineSimilarity(queryArray, noteEmbedding);

    if (score >= minScore) {
      results.push({
        noteId: embedding.noteId,
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);

  return results.slice(0, k);
}

export async function findSimilarNotes(
  noteId: string,
  options: {
    model?: 'small' | 'medium';
    k?: number;
    minScore?: number;
  } = {}
): Promise<VectorSearchResult[]> {
  const embeddingStore = getEmbeddingStore();
  const allEmbeddings = await embeddingStore.getAllEmbeddings();
  const model = options.model || 'small';
  const k = options.k || 10;
  const minScore = options.minScore || 0.3;

  const targetEmbedding = allEmbeddings.find(e => e.noteId === noteId);
  if (!targetEmbedding) return [];

  const embedding = model === 'small'
    ? targetEmbedding.embeddingSmall
    : targetEmbedding.embeddingMedium;

  if (!embedding) return [];

  const results: VectorSearchResult[] = [];

  for (const other of allEmbeddings) {
    if (other.noteId === noteId) continue;

    const otherEmbedding = model === 'small'
      ? other.embeddingSmall
      : other.embeddingMedium;

    if (!otherEmbedding) continue;

    const score = cosineSimilarity(embedding, otherEmbedding);

    if (score >= minScore) {
      results.push({
        noteId: other.noteId,
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, k);
}
