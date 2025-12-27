import { CozoDbService } from '@/lib/cozo/db';
import { GraphProjection, ProjectionScope, ProjectionStats } from './types';
import { ProjectionCache } from './cache/ProjectionCache';

/**
 * Base Projection Class
 * Abstract foundation for all graph projections.
 * Handles caching, dependency injection, and common calculations.
 */
export abstract class BaseProjection<TScope extends ProjectionScope> {
    protected db: CozoDbService;
    protected scope: TScope;
    protected cache: ProjectionCache;

    constructor(db: CozoDbService, scope: TScope) {
        this.db = db;
        this.scope = scope;
        this.cache = new ProjectionCache();
    }

    /**
     * Primary method to generate the graph projection.
     * Must be implemented by specific projection sub-classes.
     */
    abstract project(): Promise<GraphProjection<TScope>>;

    /**
     * Generates a cached projection.
     * If valid cache exists, returns it. Otherwise, runs project() and caches result.
     * @param ttl Time to live in ms (default: 5 minutes)
     */
    async projectCached(ttl: number = 5 * 60 * 1000): Promise<GraphProjection<TScope>> {
        const key = this.getCacheKey();
        const cached = this.cache.get(key);

        if (cached) {
            return cached;
        }

        const projection = await this.project();
        this.cache.set(key, projection, ttl);

        return projection;
    }

    /**
     * Force cache invalidation for the current scope
     */
    invalidate(): void {
        const key = this.getCacheKey();
        this.cache.invalidate(key);
    }

    /**
     * Generate a deterministic cache key based on scope configuration.
     * Subclasses can override if they share caches across instances.
     */
    protected getCacheKey(): string {
        return JSON.stringify(this.scope);
    }

    /**
     * Calculate standard graph statistics
     */
    protected calculateStats(nodeCount: number, edgeCount: number): ProjectionStats {
        return {
            nodeCount,
            edgeCount,
            density: this.calculateDensity(nodeCount, edgeCount),
        };
    }

    /**
     * Calculate graph density
     * Density = 2 * |E| / (|V| * (|V| - 1)) for undirected graphs
     */
    protected calculateDensity(nodes: number, edges: number): number {
        if (nodes < 2) return 0;
        const maxEdges = (nodes * (nodes - 1)) / 2; // Undirected
        return Math.round((edges / maxEdges) * 100) / 100;
    }
}
