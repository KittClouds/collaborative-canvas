import { EmbeddingEngine } from './EmbeddingEngine';
import type { Note } from '@/types/noteTypes';

export type EmbeddingModel = 'small' | 'medium';

export interface EmbeddingConfig {
  defaultModel: string;
  maxBatchSize: number;
}

export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  defaultModel: 'mongodb-leaf',
  maxBatchSize: 32,
};

type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

export class EmbeddingService {
  /**
   * Initialize embedding engine
   */
  async initialize(): Promise<void> {
    await EmbeddingEngine.initialize();
  }

  /**
   * Generate embeddings for a note
   */
  async embedNote(note: Note): Promise<number[]> {
    const text = this.prepareText(note);
    const embeddings = await EmbeddingEngine.embed(text);
    return embeddings[0]; // Single embedding
  }

  /**
   * Batch embed multiple notes
   */
  async embedNotes(notes: Note[]): Promise<Map<string, number[]>> {
    if (notes.length === 0) return new Map();
    const texts = notes.map(n => this.prepareText(n));
    const embeddings = await EmbeddingEngine.embed(texts);

    const result = new Map<string, number[]>();
    notes.forEach((note, i) => {
      result.set(note.id, embeddings[i]);
    });

    return result;
  }

  /**
   * Prepare note text for embedding
   */
  private prepareText(note: Note): string {
    // Combine title + content (strip HTML/JSON if needed, but here we just trim)
    return `${note.title}\n\n${note.content}`.trim();
  }

  /**
   * COMPATIBILITY: Generate embedding for text
   */
  async embed(
    text: string,
    model?: string // Ignored in favour of engine's current model
  ): Promise<Float32Array> {
    const embeddings = await EmbeddingEngine.embed(text);
    return new Float32Array(embeddings[0]);
  }

  /**
   * COMPATIBILITY: Batch embed multiple texts
   */
  async embedBatch(
    texts: string[],
    model?: string
  ): Promise<Float32Array[]> {
    if (texts.length === 0) return [];
    const embeddings = await EmbeddingEngine.embed(texts);
    return embeddings.map(e => new Float32Array(e));
  }

  /**
   * Check if engine is ready
   */
  isReady(): boolean {
    return EmbeddingEngine.isReady();
  }

  /**
   * Get engine status
   */
  getStatus(): { status: ModelStatus; model: string } {
    return {
      status: this.isReady() ? 'ready' : 'idle',
      model: EmbeddingEngine.getCurrentModel(),
    };
  }

  /**
   * Cleanup
   */
  async dispose(): Promise<void> {
    await EmbeddingEngine.dispose();
  }
}

export const embeddingService = new EmbeddingService();
