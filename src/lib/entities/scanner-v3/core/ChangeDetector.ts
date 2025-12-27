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

export class ChangeDetector {
    private pendingChanges: Map<string, DocumentChange[]> = new Map();

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
}
