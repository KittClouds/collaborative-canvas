/**
 * FrequencyBooster - Personalized frequency-based ranking
 * 
 * Boosts entity confidence based on:
 * - Global mention frequency (EntityRegistry)
 * - User interaction patterns (local persistence)
 * - Domain context (Folder types)
 */

import { entityRegistry } from '@/lib/cozo/graph/adapters';

export class FrequencyBooster {
    private userInteractions: Map<string, number> = new Map(); // entityId -> interactionCount

    /**
     * Boost base confidence based on frequency signals
     */
    boostConfidence(entityId: string, baseConfidence: number): number {
        const entity = entityRegistry.getEntityById(entityId);
        if (!entity) return baseConfidence;

        let boost = 0;

        // 1. Global popularity boost (diminishing returns via Log)
        // Helps distinguish "Apple" (common) from "Apple Pie" (unique)
        const globalPopularity = Math.log10(entity.totalMentions + 1) / 10; // Max +0.3 boost for 1000 mentions
        boost += globalPopularity * 0.5; // Weight 50%

        // 2. User interaction boost
        const interactions = this.userInteractions.get(entityId) || 0;
        const userBoost = Math.min(interactions / 20, 0.2); // Max +0.2 boost for 20 clicks
        boost += userBoost;

        return Math.min(baseConfidence + boost, 1.0);
    }

    /**
     * Track user interaction (e.g. clicking an entity or confirming a suggestion)
     */
    recordInteraction(entityId: string): void {
        const current = this.userInteractions.get(entityId) || 0;
        this.userInteractions.set(entityId, current + 1);
    }

    /**
     * Clear booster state
     */
    clear(): void {
        this.userInteractions.clear();
    }

    toJSON(): any {
        return {
            userInteractions: Array.from(this.userInteractions.entries()),
            version: '1.0'
        };
    }

    static fromJSON(data: any): FrequencyBooster {
        const booster = new FrequencyBooster();
        if (data && data.userInteractions) {
            booster.userInteractions = new Map(data.userInteractions);
        }
        return booster;
    }
}

// Singleton for preference tracking
export const frequencyBooster = new FrequencyBooster();
