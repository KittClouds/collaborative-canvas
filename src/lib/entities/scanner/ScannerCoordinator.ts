import { JSONContent } from '@tiptap/react';
import { entityRegistry } from '../entity-registry';
import { extractPlainTextFromDocument } from '../documentScanner';
import { ScanResult } from '../types/registry';

// Define the interface for the worker
interface WorkerScanResult {
    type: 'result' | 'ready';
    noteId: string;
    matches: Array<{ entityId: string; position: number; text: string }>;
}

export class ScannerCoordinator {
    private worker: Worker | null = null;
    private pendingScans: Map<string, (matches: any[]) => void> = new Map();
    private isReady: boolean = false;
    private initPromise: Promise<void> | null = null; // Fix: Initialize as null

    async initialize(): Promise<void> {
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve) => {
            // Vite worker import syntax
            this.worker = new Worker(new URL('./ScannerWorker.ts', import.meta.url), {
                type: 'module',
            });

            this.worker.onmessage = (e: MessageEvent<WorkerScanResult>) => {
                if (e.data.type === 'result') {
                    const callback = this.pendingScans.get(e.data.noteId);
                    if (callback) {
                        callback(e.data.matches);
                        this.pendingScans.delete(e.data.noteId);
                    }
                } else if (e.data.type === 'ready') {
                    this.isReady = true;
                    resolve();
                }
            };

            this.worker.postMessage({ type: 'init' });
        });

        return this.initPromise;
    }

    async scanDocument(noteId: string, content: JSONContent): Promise<ScanResult['matchedEntities']> {
        if (!this.worker || !this.isReady) await this.initialize();

        const plainText = extractPlainTextFromDocument(content);
        const registrySnapshot = entityRegistry.toJSON(); // Serialize

        return new Promise((resolve) => {
            this.pendingScans.set(noteId, (matches) => {
                // Convert worker matches back to ScanResult format
                const formattedMatches = matches.map(m => {
                    const entity = entityRegistry.getEntityById(m.entityId);
                    if (!entity) return null;
                    return {
                        entity,
                        positions: [m.position] // Worker returns individual matches, we might need to aggregate
                    };
                }).filter(Boolean) as ScanResult['matchedEntities'];

                // Aggregate positions for same entity
                const aggregatedMatches: ScanResult['matchedEntities'] = [];
                const matchesByEntity = new Map<string, number[]>();

                for (const m of formattedMatches) {
                    const existing = matchesByEntity.get(m.entity.id) || [];
                    existing.push(...m.positions);
                    matchesByEntity.set(m.entity.id, existing);

                    if (!aggregatedMatches.find(am => am.entity.id === m.entity.id)) {
                        aggregatedMatches.push(m);
                    }
                }

                // Update positions in result
                for (const m of aggregatedMatches) {
                    m.positions = matchesByEntity.get(m.entity.id)?.sort((a, b) => a - b) || [];
                }

                resolve(aggregatedMatches);
            });

            this.worker!.postMessage({
                type: 'scan',
                noteId,
                content: plainText,
                registrySnapshot,
            });
        });
    }
}

export const scannerCoordinator = new ScannerCoordinator();
