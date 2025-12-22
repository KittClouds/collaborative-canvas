# Migration Guide: NER → Extraction

## For Developers

### Import Changes (Backward Compatible)

**Old (still works via aliases in ExtractionService):**
```typescript
import { glinerService, runNer } from '@/lib/extraction';
```

**New (preferred):**
```typescript
import { extractionService, runExtraction } from '@/lib/extraction';
```

### API Changes

All old functions still work via aliases/wrappers:
- `glinerService` → alias for `extractionService`
- `runNer()` → wrapper for `runExtraction()`
- `NERSpan` → alias for `ExtractionSpan`
- `NEREntity` → kept for compatibility

**No immediate action required for existing code.**
