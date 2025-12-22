export {
  extractionService,
  runExtraction,
  // Backward compatibility
  glinerService,
  runNer
} from './ExtractionService';

export type {
  ExtractionSpan,
  ExtractionModelStatus,
  // Backward compatibility
  NERSpan,
  NEREntity,
  NERModelStatus
} from './types';

// LLM Extraction (from existing file)
export {
  getDefaultModel,
  getSupportedModels,
  estimateTokenCost,
  type LLMExtractionConfig,
} from './extractionConfig';
