# Architecture: Entity System

## Phase 0: Foundation (COMPLETE)

### File Structure

```
src/lib/
├── entities/
│   ├── types/
│   │   └── registry.ts          ← NEW (type definitions)
│   ├── EntityRegistry.ts        ← NEW (stub)
│   ├── RegexEntityParser.ts     ← NEW (stub)
│   ├── documentScanner.ts       ← RENAMED (was documentParser.ts)
│   └── entityTypes.ts           ← EXISTING
├── extraction/                  ← NEW (was ner/ + existing extractionConfig)
│   ├── ExtractionService.ts     ← RENAMED (was gliner-service.ts)
│   ├── types.ts                 ← MOVED (from ner/types.ts)
│   ├── extractionConfig.ts      ← EXISTING
│   └── index.ts                 ← UPDATED
```

### Migration Status

✅ Phase 0: Reorganization complete, no breaking changes
⏳ Phase 1: Registry implementation (next)
⏳ Phase 2: Extraction LLM integration
⏳ Phase 3: Pattern learning
