/**
 * EntityPromoter - Automatic entity promotion pipeline
 * 
 * Lifecycle:
 * 1. Cold: Unknown entity → regex match
 * 2. Warm: 5+ mentions → pending promotion
 * 3. Hot: 10+ mentions OR high confidence → auto-promote
 * 4. Indexed: matched via PrefixTrie
 */

import { entityRegistry } from '@/lib/cozo/graph/adapters';
import { EntityKind } from '../entityTypes';
import { rebuildPrefixTrie } from './PrefixTrie';

export interface PromotionCandidate {
    label: string;
    kind: EntityKind;
    frequency: number;              // Total mentions across docs
    firstSeen: Date;
    lastSeen: Date;
    noteAppearances: Set<string>;   // Which documents
    contexts: string[];             // Example contexts
    confidence: number;             // 0-1 promotion confidence
    source: 'regex' | 'ml' | 'user';
    status: 'candidate' | 'pending' | 'promoted' | 'rejected';
}

export class EntityPromoter {
    private candidates: Map<string, PromotionCandidate>;
    private promotionThreshold: number = 10;
    private pendingThreshold: number = 5;
    private confidenceThreshold: number = 0.7;

    constructor() {
        this.candidates = new Map();
    }

    /**
     * Track entity mention from regex parser
     */
    trackMention(
        label: string,
        kind: EntityKind,
        noteId: string,
        context: string,
        source: 'regex' | 'ml' | 'user' = 'regex'
    ): void {
        const normalized = label.toLowerCase().trim();

        // Skip if already in registry
        if (entityRegistry.isRegisteredEntity(label)) return;

        let candidate = this.candidates.get(normalized);

        if (!candidate) {
            candidate = {
                label,
                kind,
                frequency: 0,
                firstSeen: new Date(),
                lastSeen: new Date(),
                noteAppearances: new Set(),
                contexts: [],
                confidence: this.calculateInitialConfidence(kind, source),
                source,
                status: 'candidate',
            };
            this.candidates.set(normalized, candidate);
        }

        candidate.frequency++;
        candidate.lastSeen = new Date();
        candidate.noteAppearances.add(noteId);

        if (candidate.contexts.length < 5) {
            candidate.contexts.push(context);
        }

        candidate.confidence = this.recalculateConfidence(candidate);
        this.updateCandidateStatus(candidate);
    }

    private updateCandidateStatus(candidate: PromotionCandidate): void {
        if (candidate.status === 'promoted' || candidate.status === 'rejected') return;

        if (candidate.frequency >= this.promotionThreshold && candidate.confidence >= this.confidenceThreshold) {
            this.promoteToRegistry(candidate);
            return;
        }

        if (candidate.frequency >= this.pendingThreshold) {
            candidate.status = 'pending';
        }
    }

    private promoteToRegistry(candidate: PromotionCandidate): void {
        const entity = entityRegistry.registerEntity(
            candidate.label,
            candidate.kind,
            Array.from(candidate.noteAppearances)[0],
            {
                metadata: {
                    promotedFrom: candidate.source,
                    promotedAt: new Date().toISOString(),
                    originalFrequency: candidate.frequency,
                }
            }
        );

        for (const noteId of candidate.noteAppearances) {
            entityRegistry.updateNoteMentions(entity.id, noteId, 1);
        }

        candidate.status = 'promoted';
        rebuildPrefixTrie();
        console.log(`[EntityPromoter] Promoted: ${candidate.label} (${candidate.kind})`);
    }

    private calculateInitialConfidence(kind: EntityKind, source: string): number {
        if (source === 'user') return 0.9;
        if (source === 'ml') return 0.6;

        const confidenceByKind: Partial<Record<EntityKind, number>> = {
            CHARACTER: 0.3,
            LOCATION: 0.4,
            NPC: 0.3,
            ITEM: 0.3,
            FACTION: 0.4,
            CHAPTER: 0.5,
        };

        return confidenceByKind[kind] || 0.5;
    }

    private recalculateConfidence(candidate: PromotionCandidate): number {
        let confidence = candidate.confidence;
        const docBoost = Math.min(candidate.noteAppearances.size / 5, 0.2);
        const freqBoost = Math.min(candidate.frequency / 20, 0.1);
        confidence += docBoost + freqBoost;
        return Math.min(confidence, 1.0);
    }

    getPendingPromotions(): PromotionCandidate[] {
        return Array.from(this.candidates.values())
            .filter(c => c.status === 'pending')
            .sort((a, b) => b.confidence - a.confidence);
    }

    confirmPromotion(label: string): boolean {
        const normalized = label.toLowerCase().trim();
        const candidate = this.candidates.get(normalized);
        if (!candidate) return false;
        this.promoteToRegistry(candidate);
        return true;
    }

    toJSON(): any {
        return {
            candidates: Array.from(this.candidates.entries()).map(([key, c]) => ({
                ...c,
                noteAppearances: Array.from(c.noteAppearances),
                firstSeen: c.firstSeen.toISOString(),
                lastSeen: c.lastSeen.toISOString(),
            })),
            version: '1.0',
        };
    }
}

export const entityPromoter = new EntityPromoter();
