/**
 * PrefixTrie - Deterministic entity vocabulary index
 * 
 * Provides:
 * - Exact token lookup (O(k))
 * - Prefix search ("Micr" → ["Microsoft", "Microchip"])
 * - Entity metadata at leaf nodes
 * - Memory-efficient compressed nodes
 */

import { entityRegistry } from '@/lib/cozo/graph/adapters';

interface TrieNode {
    char: string;                          // Character at this node
    isTerminal: boolean;                   // End of entity token
    entityIds: Set<string>;                // Entities containing this token
    children: Map<string, TrieNode>;       // Child nodes
    depth: number;                         // Distance from root
}

export class PrefixTrie {
    private root: TrieNode;
    private tokenCount: number;
    private entityCount: number;

    constructor() {
        this.root = {
            char: '',
            isTerminal: false,
            entityIds: new Set(),
            children: new Map(),
            depth: 0,
        };
        this.tokenCount = 0;
        this.entityCount = 0;
    }

    /**
     * Build trie from entity registry
     */
    buildFromRegistry(registry: EntityRegistry): void {
        this.clear();

        const entities = registry.getAllEntities();
        for (const entity of entities) {
            // Add canonical label tokens
            this.addEntityTokens(entity.id, entity.label);

            // Add alias tokens
            if (entity.aliases) {
                for (const alias of entity.aliases) {
                    this.addEntityTokens(entity.id, alias);
                }
            }
        }

        this.entityCount = entities.length;
    }

    /**
     * Add all tokens from entity label to trie
     */
    private addEntityTokens(entityId: string, label: string): void {
        const tokens = this.tokenize(label);
        for (const token of tokens) {
            this.insert(token.toLowerCase(), entityId);
        }
    }

    /**
     * Insert token into trie
     */
    private insert(token: string, entityId: string): void {
        let node = this.root;

        for (let i = 0; i < token.length; i++) {
            const char = token[i];

            if (!node.children.has(char)) {
                node.children.set(char, {
                    char,
                    isTerminal: false,
                    entityIds: new Set(),
                    children: new Map(),
                    depth: node.depth + 1,
                });
            }

            node = node.children.get(char)!;
            node.entityIds.add(entityId); // Track which entities contain this prefix
        }

        node.isTerminal = true;
        this.tokenCount++;
    }

    /**
     * Exact token lookup - O(k)
     */
    hasToken(token: string): boolean {
        const node = this.findNode(token.toLowerCase());
        return node !== null && node.isTerminal;
    }

    /**
     * Get entities containing this token
     */
    getEntitiesForToken(token: string): Set<string> {
        const node = this.findNode(token.toLowerCase());
        return node ? node.entityIds : new Set();
    }

    /**
     * Prefix search - returns all matching tokens
     * Example: "micr" → ["microsoft", "microchip", "micro"]
     */
    searchPrefix(prefix: string): string[] {
        const node = this.findNode(prefix.toLowerCase());
        if (!node) return [];

        const results: string[] = [];
        this.collectTerminals(node, prefix.toLowerCase(), results);
        return results;
    }

    /**
     * Filter document tokens through trie
     * Returns only tokens that exist in entity vocabulary
     */
    filterTokens(text: string): Array<{ token: string; position: number; entityIds: Set<string> }> {
        const tokens = this.tokenizeWithPositions(text);
        const candidates: Array<{ token: string; position: number; entityIds: Set<string> }> = [];

        for (const { token, position } of tokens) {
            const normalized = token.toLowerCase();
            const node = this.findNode(normalized);

            if (node && node.isTerminal) {
                candidates.push({
                    token,
                    position,
                    entityIds: new Set(node.entityIds), // Clone set
                });
            }
        }

        return candidates;
    }

    /**
     * Find node at end of path
     */
    private findNode(path: string): TrieNode | null {
        let node = this.root;

        for (const char of path) {
            if (!node.children.has(char)) {
                return null;
            }
            node = node.children.get(char)!;
        }

        return node;
    }

    /**
     * Collect all terminal nodes under a prefix
     */
    private collectTerminals(node: TrieNode, prefix: string, results: string[]): void {
        if (node.isTerminal) {
            results.push(prefix);
        }

        for (const [char, child] of node.children) {
            this.collectTerminals(child, prefix + char, results);
        }
    }

    /**
     * Tokenize text with positions
     */
    private tokenizeWithPositions(text: string): Array<{ token: string; position: number }> {
        const tokens: Array<{ token: string; position: number }> = [];
        let match;
        const regex = /\S+/g;
        while ((match = regex.exec(text)) !== null) {
            tokens.push({
                token: match[0],
                position: match.index
            });
        }
        return tokens;
    }

    /**
     * Simple whitespace split
     */
    private tokenize(text: string): string[] {
        return text.split(/\s+/).filter(t => t.length > 0);
    }

    /**
     * Clear trie
     */
    clear(): void {
        this.root.children.clear();
        this.tokenCount = 0;
        this.entityCount = 0;
    }

    /**
     * Get trie statistics
     */
    getStats(): {
        tokenCount: number;
        entityCount: number;
        nodeCount: number;
        averageDepth: number;
        memoryEstimateMB: number;
    } {
        let nodeCount = 0;
        let totalDepth = 0;

        const traverse = (node: TrieNode) => {
            nodeCount++;
            totalDepth += node.depth;
            for (const child of node.children.values()) {
                traverse(child);
            }
        };

        traverse(this.root);

        // Memory estimate: ~40 bytes per node (object + Set + Map overhead)
        const memoryEstimateMB = (nodeCount * 40) / (1024 * 1024);

        return {
            tokenCount: this.tokenCount,
            entityCount: this.entityCount,
            nodeCount,
            averageDepth: nodeCount > 0 ? totalDepth / nodeCount : 0,
            memoryEstimateMB,
        };
    }
}

// Singleton instance
let prefixTrieInstance: PrefixTrie | null = null;

export function getOrCreatePrefixTrie(): PrefixTrie {
    if (!prefixTrieInstance) {
        prefixTrieInstance = new PrefixTrie();
        prefixTrieInstance.buildFromRegistry(entityRegistry);
    }
    return prefixTrieInstance;
}

export function rebuildPrefixTrie(): void {
    if (prefixTrieInstance) {
        prefixTrieInstance.buildFromRegistry(entityRegistry);
    }
}
