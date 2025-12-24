import { extractionService } from '@/lib/extraction/ExtractionService';
import { entityRegistry } from '@/lib/entities/entity-registry';

// Define message types
export interface ScanWorkerMessage {
    type: 'scan' | 'init';
    noteId: string;
    content: string; // Plain text (serializable)
    registrySnapshot: any; // Serialized entity registry
}

export interface ScanWorkerResult {
    type: 'result' | 'ready';
    noteId?: string;
    matches?: any[];
}

// Worker context
self.onmessage = async (e: MessageEvent<ScanWorkerMessage>) => {
    const { type, noteId, content, registrySnapshot } = e.data;

    if (type === 'init') {
        // Load model in worker (one-time cost)
        // Note: extractionService.initialize might need to be adjusted for worker context
        // if it relies on DOM elements. Assuming it's pure JS/WASM for now.
        try {
            await extractionService.initialize('extraction');
            self.postMessage({ type: 'ready' } as ScanWorkerResult);
        } catch (err) {
            console.error("Worker initialization failed", err);
        }
        return;
    }

    if (type === 'scan') {
        // Reconstruct registry in worker context
        // The entityRegistry imported here is a fresh instance in the worker scope
        if (registrySnapshot) {
            // We need to implement hydrateFromSnapshot in EntityRegistry if it doesn't exist
            // or usage fromJSON.
            // The snippet assumes hydrateFromSnapshot exists.
            // If not, we'll use fromJSON or manual population.
            // Checking entity-registry.ts, it has fromJSON static method but we have a singleton instance.
            // We might need to add hydrateFromSnapshot to the singleton.

            // For now, let's assume we implement hydrateFromSnapshot or use a workaround.
            // Let's rely on `Object.assign` or `fromJSON` logic.
            // Since we can't easily change the class right here, I'll assume I add it later.
            // Or I can use:
            const tempRegistry = (entityRegistry.constructor as any).fromJSON(registrySnapshot);
            Object.assign(entityRegistry, tempRegistry);
        }

        // Run scan (CPU-intensive)
        const matches = findEntityMentions(content, entityRegistry.getAllEntities());

        // Return results (structured clone)
        self.postMessage({
            type: 'result',
            noteId,
            matches,
        } as ScanWorkerResult);
    }
};

function findEntityMentions(text: string, entities: any[]): any[] {
    const matches = [];
    // Optimization: Pre-compile regexes or use PrefixTrie if available in worker
    // Since we don't have PrefixTrie available in worker without importing it (and its deps),
    // we'll stick to the snippet's regex approach for now or the loop.
    // Actually, filtering by entities that appear in text is faster if we use Aho-Corasick or similar,
    // but regex loop is O(N*M).
    // The snippet provided uses a simple regex loop.

    for (const entity of entities) {
        // Escape regex special characters
        const escaped = entity.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
        let match;
        while ((match = regex.exec(text)) !== null) {
            matches.push({
                entityId: entity.id,
                position: match.index,
                text: match[0]
            });
        }
    }
    return matches;
}
