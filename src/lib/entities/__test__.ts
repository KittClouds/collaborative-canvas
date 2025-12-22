// Test all imports work
import {
    parseNoteConnectionsFromDocument,
    hasRawEntitySyntax
} from './documentScanner';

import { EntityRegistry, entityRegistry } from './entity-registry';
import { RegexEntityParser, regexEntityParser } from './regex-entity-parser';

import type {
    RegisteredEntity,
    ParsedEntity,
    ScanResult
} from './types/registry';

import { extractionService, runExtraction } from '@/lib/extraction';
import type { ExtractionSpan } from '@/lib/extraction/types';

console.log('✅ All imports work!');
console.log('Testing parseNoteConnectionsFromDocument:', typeof parseNoteConnectionsFromDocument);
console.log('Testing entityRegistry:', typeof entityRegistry);
console.log('Testing extractionService:', typeof extractionService);
