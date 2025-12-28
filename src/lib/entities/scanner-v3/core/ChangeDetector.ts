/**
 * Tracks changed regions in document for incremental scanning
 */
export interface DocumentChange {
    from: number;
    to: number;
    text: string;
    noteId: string;
    timestamp: number;
    context?: string; // Full sentence/paragraph context
}

/**
 * Simple djb2 hash for fast content comparison
 */
function djb2Hash(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash >>> 0; // Convert to unsigned 32-bit
    }
    return hash;
}

/**
 * Compute a lightweight content hash for change detection
 * Uses length + hash of first/last 500 chars for speed
 */
export function computeContentHash(text: string): string {
    if (!text) return '0:0';
    const len = text.length;
    // Sample start and end for large documents
    const sampleSize = Math.min(500, len);
    const start = text.slice(0, sampleSize);
    const end = len > sampleSize ? text.slice(-sampleSize) : '';
    return `${len}:${djb2Hash(start + end)}`;
}

export class ChangeDetector {
    private pendingChanges: Map<string, DocumentChange[]> = new Map();
    private lastProcessedHash: Map<string, string> = new Map();

    /**
     * Record a change
     */
    recordChange(change: DocumentChange): void {
        if (!this.pendingChanges.has(change.noteId)) {
            this.pendingChanges.set(change.noteId, []);
        }
        this.pendingChanges.get(change.noteId)!.push(change);
    }

    /**
     * Get all pending changes for a note
     */
    getPendingChanges(noteId: string): DocumentChange[] {
        return this.pendingChanges.get(noteId) || [];
    }

    /**
     * Clear pending changes after processing
     */
    clearChanges(noteId: string): void {
        this.pendingChanges.delete(noteId);
    }

    /**
     * Get combined change range (for batch processing)
     */
    getCombinedRange(noteId: string): { from: number; to: number } | null {
        const changes = this.getPendingChanges(noteId);
        if (changes.length === 0) return null;

        const from = Math.min(...changes.map(c => c.from));
        const to = Math.max(...changes.map(c => c.to));
        return { from, to };
    }

    /**
     * Check if content has changed since last processing
     * Returns true if content is new/different, false if unchanged
     */
    hasContentChanged(noteId: string, contentHash: string): boolean {
        const lastHash = this.lastProcessedHash.get(noteId);
        return lastHash !== contentHash;
    }

    /**
     * Mark content as processed
     */
    markContentProcessed(noteId: string, contentHash: string): void {
        this.lastProcessedHash.set(noteId, contentHash);
    }

    /**
     * Get the last processed hash for a note
     */
    getLastProcessedHash(noteId: string): string | undefined {
        return this.lastProcessedHash.get(noteId);
    }
}
