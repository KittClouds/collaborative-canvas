# SCANNER 3.0 AUDIT

## 1. Regex Usage Map

| File | Usage | Current Regex |
|------|-------|---------------|
| `documentScanner.ts` | Entity Extraction | `/\[([A-Z_]+)(?::([A-Z_]+))?\|([^\]]+)\]/g` |
| `documentScanner.ts` | Triple Extraction | `/\[([A-Z_]+)(?::([A-Z_]+))?\|(.+?)->([A-Z_]+)->(.+)\]/g` |
| `UnifiedSyntaxHighlighter.ts` | Entity Highlight | Uses `patternRegistry` (ID: `builtin:entity`) |
| `UnifiedSyntaxHighlighter.ts` | Implicit entities | `new RegExp(\`\\\\b\${escaped}\\\\b\`, 'gi')` |
| `RelationshipExtractor.ts` | Verb Patterns | `VERB_POS_TAGS = ['VERB', 'AUX']` (NLP based) |
| `RelationshipExtractor.ts` | Possession | `textAfter.startsWith("'s")` (String based) |
| `parser.ts` | Ref Parsing | Uses `patternRegistry` |

## 2. Current Flow Documentation

### Editor Highlighting
1. `UnifiedSyntaxHighlighter` (Tiptap Extension) triggers on doc updates.
2. It fetches active patterns from `patternRegistry`.
3. It iterates through text nodes and applies decorations (widgets or inline) for matches.
4. It also performs a secondary pass for NER suggestions and a third pass for "Implicit Entities" (already registered entities found as plain text).

### Document Scanning (Back-end/Sync)
1. `documentScanner.ts` is called (likely during sync or manual save).
2. It uses `extractText` to flatten the document content.
3. It uses a **hardcoded regex** to find `[KIND|Label]` entities and registers them.
4. It uses a **hardcoded regex** to find `[KIND|Label]->REL->Target` triples.
5. **Issue**: This completely bypasses `patternRegistry` and duplication leads to inconsistent behavior.

## 3. Pattern Types Needed

| Pattern Type | Status in `PatternRegistry` | ID |
|--------------|-----------------------------|----|
| Entity `[KIND|Label]` | Existing ✅ | `builtin:entity` |
| Triple `[A]->REL->[B]` | Existing ✅ | `builtin:triple` |
| Wikilink `[[Page]]` | Existing ✅ | `builtin:wikilink` |
| Tag `#tag` | Existing ✅ | `builtin:tag` |
| Mention `@user` | Existing ✅ | `builtin:mention` |
| Temporal | Existing ✅ | `builtin:temporal-*` |
| Implicit Relationship | Missing ❌ | (Needs logic in RelationshipExtractor) |

## 4. PatternRegistry Verification

- `TRIPLE_PATTERN`: Exists in `defaults.ts`. Matches `[KIND|Label] ->PREDICATE-> [KIND|Label]`.
- `TEMPORAL_PATTERNS`: Exists in `defaults.ts`. Includes relative, named, simple, and transitions.

## 5. Files to Modify

1. `src/lib/entities/documentScanner.ts`:
   - Replace manual regex with `patternRegistry.getCompiledPattern()`.
   - Align capture group usage with `PatternDefinition` captures.
2. `src/lib/extensions/UnifiedSyntaxHighlighter.ts`:
   - Refactor "implicit entity" highlighting to potentially use a specialized pattern or unify with registry logic.
3. `src/lib/refs/patterns/defaults.ts`:
   - Verify `TRIPLE_PATTERN` regex matches the one in `documentScanner.ts` (it currently doesn't support subtypes like the doc scanner does).
   - Update `TRIPLE_PATTERN` to support subtypes: `[KIND:SUBTYPE\|Label]`.
