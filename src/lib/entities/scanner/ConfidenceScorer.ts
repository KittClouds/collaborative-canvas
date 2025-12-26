/**
 * ConfidenceScorer - Multi-signal entity validation
 * 
 * Combines ResoRank lexical score with:
 * - Graph proximity (if entity appears with known related entities)
 * - Entity frequency (popular entities rank higher)
 * - Context similarity
 */

import { entityRegistry } from '@/lib/cozo/graph/adapters';
import type { RegisteredEntity } from '@/lib/cozo/graph/adapters';
import type { EntityCandidate } from './AdaptiveWindowGenerator';
import type { ScanResult } from '../types/registry';
import { frequencyBooster } from './FrequencyBooster';

export interface ScoredCandidate {
    entity: RegisteredEntity;
    candidate: EntityCandidate;
    resoRankScore: number;
    confidence: number;  // 0-1 normalized
    positions: number[];
}

export class ConfidenceScorer {
    private registry: EntityRegistry;
    private confidenceThreshold: number = 0.6; // Minimum confidence for auto-extraction

    constructor(registry: EntityRegistry) {
        this.registry = registry;
    }

    /**
     * Filter scored candidates by confidence threshold
     */
    filterByConfidence(
        scored: ScoredCandidate[]
    ): ScanResult['matchedEntities'] {
        const matches: ScanResult['matchedEntities'] = [];
        const processedEntities = new Set<string>();

        // First pass: Filter by threshold
        const confidentCandidates = scored.filter(c => c.confidence >= this.confidenceThreshold);

        // Group by entity to consolidate positions
        for (const candidate of confidentCandidates) {
            // Check if we already processed this entity in the result? 
            // ScanResult['matchedEntities'] usually combines all positions for a single entity entry.
            // { entity, positions: [10, 50, ...] }

            const existingMatch = matches.find(m => m.entity.id === candidate.entity.id);
            if (existingMatch) {
                // Merge positions
                existingMatch.positions.push(...candidate.positions);
                // Clean up duplicates if any
                existingMatch.positions = [...new Set(existingMatch.positions)].sort((a, b) => a - b);
            } else {
                matches.push({
                    entity: candidate.entity,
                    positions: [...candidate.positions],
                    representativeContext: candidate.candidate.context
                });
            }
        }

        // Sort by confidence descending (using highest confidence occurrence as representative?)
        // This sorting logic is a bit tricky if we grouped candidates.
        // I'll sort by the confidence of the first finding or max confidence?
        // The prompt snippet was simpler because it assumed 1:1 candidate-match.
        // I will sort based on the average confidence or max confidence.

        // Sort logic from prompt:
        return matches.sort((a, b) => {
            // Find max confidence for entity A
            const aMax = Math.max(...scored
                .filter(s => s.entity.id === a.entity.id)
                .map(s => s.confidence), 0);

            const bMax = Math.max(...scored
                .filter(s => s.entity.id === b.entity.id)
                .map(s => s.confidence), 0);

            return bMax - aMax;
        });
    }

    /**
     * Calculate confidence from multiple signals
     */
    calculateConfidence(
        entity: RegisteredEntity,
        resoRankScore: number,
        context: string
    ): number {
        // Signal 1: ResoRank lexical score (70% weight)
        const normalizedScore = Math.min(resoRankScore / 10, 1.0); // Assuming max score ~10
        let confidence = normalizedScore * 0.7;

        // Signal 2: Entity popularity & User personalization (15% weight)
        const boostedConfidence = frequencyBooster.boostConfidence(entity.id, normalizedScore);
        const popularityBoost = boostedConfidence - normalizedScore; // Extract the frequency signal
        confidence += Math.min(Math.max(0, popularityBoost), 0.15); // Cap at 15%

        // Signal 3: Graph proximity (15% weight) - Phase 1: simplified
        // Check if context contains other known entities
        const relatedEntities = this.registry.getCoOccurringEntities(entity.id);
        let proximityBoost = 0;
        for (const related of relatedEntities.slice(0, 5)) { // Top 5
            if (context.toLowerCase().includes(related.label.toLowerCase())) {
                proximityBoost = 0.15;
                break;
            }
        }
        confidence += proximityBoost;

        return Math.min(confidence, 1.0);
    }
}
