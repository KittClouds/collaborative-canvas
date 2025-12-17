import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

export type EmbeddingModel = 'small' | 'medium';

export interface EmbeddingConfig {
  defaultModel: EmbeddingModel;
  maxBatchSize: number;
}

export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  defaultModel: 'small',
  maxBatchSize: 32,
};

type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

class EmbeddingService {
  private smallModel: FeatureExtractionPipeline | null = null;
  private mediumModel: FeatureExtractionPipeline | null = null;
  private smallModelStatus: ModelStatus = 'idle';
  private mediumModelStatus: ModelStatus = 'idle';
  private initPromise: Promise<void> | null = null;
  private mediumInitPromise: Promise<void> | null = null;
  private listeners: Set<() => void> = new Set();

  async initialize(): Promise<void> {
    if (this.smallModel || this.smallModelStatus === 'loading') {
      return this.initPromise || Promise.resolve();
    }

    this.smallModelStatus = 'loading';
    this.notifyListeners();

    this.initPromise = (async () => {
      try {
        console.log('Loading mdbr-leaf-ir embedding model...');
        const startTime = Date.now();

        this.smallModel = await pipeline(
          'feature-extraction',
          'MongoDB/mdbr-leaf-ir',
          {
            dtype: 'fp32',
          }
        );

        this.smallModelStatus = 'ready';
        console.log(`Small model loaded in ${Date.now() - startTime}ms`);
      } catch (error) {
        this.smallModelStatus = 'error';
        console.error('Failed to load small model:', error);
        throw error;
      } finally {
        this.notifyListeners();
      }
    })();

    return this.initPromise;
  }

  private async loadMediumModel(): Promise<void> {
    if (this.mediumModel || this.mediumModelStatus === 'loading') {
      return this.mediumInitPromise || Promise.resolve();
    }

    this.mediumModelStatus = 'loading';
    this.notifyListeners();

    this.mediumInitPromise = (async () => {
      try {
        console.log('Loading modernbert embedding model...');
        const startTime = Date.now();

        this.mediumModel = await pipeline(
          'feature-extraction',
          'nomic-ai/modernbert-embed-base',
          {
            dtype: 'q8',
          }
        );

        this.mediumModelStatus = 'ready';
        console.log(`Medium model loaded in ${Date.now() - startTime}ms`);
      } catch (error) {
        this.mediumModelStatus = 'error';
        console.error('Failed to load medium model:', error);
        throw error;
      } finally {
        this.notifyListeners();
      }
    })();

    return this.mediumInitPromise;
  }

  async embedSmall(text: string): Promise<Float32Array> {
    await this.initialize();

    if (!this.smallModel) {
      throw new Error('Small model not initialized');
    }

    const result = await this.smallModel(text, {
      pooling: 'mean',
      normalize: true,
    });

    return new Float32Array(result.data as Float32Array);
  }

  async embedMedium(text: string): Promise<Float32Array> {
    await this.loadMediumModel();

    if (!this.mediumModel) {
      throw new Error('Medium model not initialized');
    }

    const result = await this.mediumModel(text, {
      pooling: 'mean',
      normalize: true,
    });

    return new Float32Array(result.data as Float32Array);
  }

  async embedBatch(
    texts: string[],
    model: EmbeddingModel = 'small'
  ): Promise<Float32Array[]> {
    if (texts.length === 0) return [];

    const dim = model === 'small' ? 256 : 768;

    if (model === 'small') {
      await this.initialize();
      if (!this.smallModel) throw new Error('Small model not initialized');

      const embeddings: Float32Array[] = [];
      for (const text of texts) {
        const result = await this.smallModel(text, {
          pooling: 'mean',
          normalize: true,
        });
        embeddings.push(new Float32Array(result.data as Float32Array));
      }
      return embeddings;
    } else {
      await this.loadMediumModel();
      if (!this.mediumModel) throw new Error('Medium model not initialized');

      const embeddings: Float32Array[] = [];
      for (const text of texts) {
        const result = await this.mediumModel(text, {
          pooling: 'mean',
          normalize: true,
        });
        embeddings.push(new Float32Array(result.data as Float32Array));
      }
      return embeddings;
    }
  }

  async embed(
    text: string,
    model: EmbeddingModel = 'small'
  ): Promise<Float32Array> {
    if (model === 'small') {
      return this.embedSmall(text);
    } else {
      return this.embedMedium(text);
    }
  }

  isReady(): boolean {
    return this.smallModelStatus === 'ready';
  }

  getStatus(): { small: ModelStatus; medium: ModelStatus } {
    return {
      small: this.smallModelStatus,
      medium: this.mediumModelStatus,
    };
  }

  onStatusChange(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => cb());
  }

  async preloadAll(): Promise<void> {
    await this.initialize();
    await this.loadMediumModel();
  }
}

export const embeddingService = new EmbeddingService();
