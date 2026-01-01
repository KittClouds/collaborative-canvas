/**
 * AhoCorasickMatcher - Fast discriminator matching using Aho-Corasick algorithm
 * 
 * Finds opening delimiters ([, [[, #, @, <<) in O(n) time.
 * Based on allprofanity's approach but adapted for our pattern discriminators.
 */

export interface DiscriminatorHit {
    discriminator: string;  // '[', '[[', '#', '@', '<<'
    position: number;       // Character index in text
    patternIds: string[];   // Patterns that use this discriminator
}

/**
 * Aho-Corasick automaton node
 */
interface ACNode {
    children: Map<string, ACNode>;
    fail: ACNode | null;
    output: string[];  // Discriminators that end at this node
    depth: number;
}

/**
 * Discriminator to pattern ID mapping
 */
const DISCRIMINATOR_PATTERNS: Record<string, string[]> = {
    '[[': ['builtin:wikilink'],
    '<<': ['builtin:backlink'],
    '[': ['builtin:entity', 'builtin:triple', 'builtin:inline-relationship'],
    '#': ['builtin:tag'],
    '@': ['builtin:mention'],
};

/**
 * Aho-Corasick based discriminator matcher
 */
export class AhoCorasickMatcher {
    private root: ACNode;
    private built: boolean = false;

    // Ordered by length (longest first) for greedy matching
    private static readonly DISCRIMINATORS = ['[[', '<<', '[', '#', '@'];

    constructor() {
        this.root = this.createNode(0);
        this.build();
    }

    private createNode(depth: number): ACNode {
        return {
            children: new Map(),
            fail: null,
            output: [],
            depth,
        };
    }

    /**
     * Build the Aho-Corasick automaton from discriminator set
     */
    build(): void {
        if (this.built) return;

        // Phase 1: Build trie from discriminators
        for (const discriminator of AhoCorasickMatcher.DISCRIMINATORS) {
            let node = this.root;

            for (let i = 0; i < discriminator.length; i++) {
                const char = discriminator[i];

                if (!node.children.has(char)) {
                    node.children.set(char, this.createNode(node.depth + 1));
                }
                node = node.children.get(char)!;
            }

            // Mark this node as end of a discriminator
            node.output.push(discriminator);
        }

        // Phase 2: Build failure links using BFS
        const queue: ACNode[] = [];

        // Initialize failure links for depth-1 nodes
        for (const child of this.root.children.values()) {
            child.fail = this.root;
            queue.push(child);
        }

        // BFS to set failure links
        while (queue.length > 0) {
            const current = queue.shift()!;

            for (const [char, child] of current.children) {
                queue.push(child);

                // Follow failure links to find longest proper suffix
                let fail = current.fail;
                while (fail !== null && !fail.children.has(char)) {
                    fail = fail.fail;
                }

                child.fail = fail ? fail.children.get(char)! : this.root;

                // Merge outputs from failure chain
                if (child.fail.output.length > 0) {
                    child.output = [...child.output, ...child.fail.output];
                }
            }
        }

        this.built = true;
    }

    /**
     * Find all discriminator positions in O(n) time
     */
    findAll(text: string): DiscriminatorHit[] {
        const hits: DiscriminatorHit[] = [];
        let node = this.root;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            // Follow failure links until we find a match or reach root
            while (node !== this.root && !node.children.has(char)) {
                node = node.fail!;
            }

            if (node.children.has(char)) {
                node = node.children.get(char)!;
            }

            // Collect all outputs at this position
            if (node.output.length > 0) {
                // Sort by length descending to prefer longer matches
                const sortedOutputs = [...node.output].sort((a, b) => b.length - a.length);

                for (const discriminator of sortedOutputs) {
                    const startPos = i - discriminator.length + 1;

                    hits.push({
                        discriminator,
                        position: startPos,
                        patternIds: DISCRIMINATOR_PATTERNS[discriminator] || [],
                    });
                }
            }
        }

        // Sort by position, then by discriminator length (longer first)
        hits.sort((a, b) => {
            if (a.position !== b.position) return a.position - b.position;
            return b.discriminator.length - a.discriminator.length;
        });

        // Deduplicate: keep only the longest discriminator at each position
        const deduped: DiscriminatorHit[] = [];
        let lastPos = -1;

        for (const hit of hits) {
            if (hit.position !== lastPos) {
                deduped.push(hit);
                lastPos = hit.position;
            }
        }

        return deduped;
    }

    /**
     * Filter hits to only those for a specific discriminator
     */
    findByDiscriminator(text: string, discriminator: string): DiscriminatorHit[] {
        return this.findAll(text).filter(h => h.discriminator === discriminator);
    }
}

// Singleton instance
export const ahoCorasickMatcher = new AhoCorasickMatcher();
