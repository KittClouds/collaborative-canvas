import { getGraph } from '@/lib/graph/graphInstance';
import {
  ResoRankScorer,
  createPrecisionScorer,
  ProximityStrategy,
  type CorpusStatistics,
  type DocumentMetadata,
  type TokenMetadata,
  type ResoRankExplanation,
  type FieldParams,
} from '@/lib/resorank';
import type { UnifiedGraph } from '@/lib/graph/UnifiedGraph';
import type { UnifiedNode, NodeId, NodeType } from '@/lib/graph/types';
import type { EntityKind } from '@/lib/entities/entityTypes';

const FIELD_LABEL = 0;
const FIELD_CONTENT = 1;
const FIELD_TAGS = 2;

export interface SearchOptions {
  types?: NodeType[];
  entityKinds?: EntityKind[];
  folderId?: NodeId;
  recursive?: boolean;
  limit?: number;
  boostRecent?: boolean;
  boostConnected?: boolean;
}

export interface SearchResult {
  node: UnifiedNode;
  score: number;
  graphBoost: number;
  finalScore: number;
  explanation?: ResoRankExplanation;
}

export interface SearchStats {
  queryTimeMs: number;
  candidateCount: number;
  resultCount: number;
  indexSize: number;
}

export class ResoRankSearchQueries {
  private graph: UnifiedGraph;
  private scorer: ResoRankScorer<NodeId> | null = null;
  private indexed = false;
  private corpusStats: CorpusStatistics;

  constructor() {
    this.graph = getGraph();
    this.corpusStats = {
      totalDocuments: 0,
      averageFieldLengths: new Map([
        [FIELD_LABEL, 5],
        [FIELD_CONTENT, 200],
        [FIELD_TAGS, 3],
      ]),
      averageDocumentLength: 100,
    };
  }

  private getScorer(): ResoRankScorer<NodeId> {
    if (!this.scorer) {
      this.scorer = createPrecisionScorer<NodeId>(this.corpusStats, {
        k1: 1.2,
        proximityAlpha: 0.5,
        maxSegments: 16,
        proximityDecayLambda: 0.5,
        fieldParams: new Map<number, FieldParams>([
          [FIELD_LABEL, { weight: 2.0, b: 0.75 }],
          [FIELD_CONTENT, { weight: 1.0, b: 0.75 }],
          [FIELD_TAGS, { weight: 1.5, b: 0.50 }],
        ]),
        idfProximityScale: 5.0,
        enablePhraseBoost: true,
        phraseBoostMultiplier: 1.5,
      });
    }
    return this.scorer;
  }

  buildIndex(): void {
    const startTime = performance.now();
    
    this.scorer = null;
    const scorer = this.getScorer();

    const nodes = this.graph.getInstance().nodes();
    let totalLength = 0;
    let totalLabelLength = 0;
    let totalContentLength = 0;
    let totalTagLength = 0;
    let docCount = 0;

    nodes.forEach((node: any) => {
      const data = node.data();
      const nodeId = data.id;

      const label = data.label || '';
      const content = this.extractPlainText(data.content || '');
      const tags = (data.tags || []).join(' ');

      const labelTokens = this.tokenize(label);
      const contentTokens = this.tokenize(content);
      const tagTokens = this.tokenize(tags);

      const totalTokens = labelTokens.length + contentTokens.length + tagTokens.length;
      if (totalTokens === 0) return;

      const docMeta: DocumentMetadata = {
        fieldLengths: new Map([
          [FIELD_LABEL, labelTokens.length],
          [FIELD_CONTENT, contentTokens.length],
          [FIELD_TAGS, tagTokens.length],
        ]),
        totalTokenCount: totalTokens,
      };

      const tokenMetaMap = this.buildTokenMetadata(
        labelTokens,
        contentTokens,
        tagTokens,
        totalTokens
      );

      scorer.indexDocument(nodeId, docMeta, tokenMetaMap);

      totalLength += totalTokens;
      totalLabelLength += labelTokens.length;
      totalContentLength += contentTokens.length;
      totalTagLength += tagTokens.length;
      docCount++;
    });

    if (docCount > 0) {
      this.corpusStats = {
        totalDocuments: docCount,
        averageFieldLengths: new Map([
          [FIELD_LABEL, totalLabelLength / docCount],
          [FIELD_CONTENT, totalContentLength / docCount],
          [FIELD_TAGS, totalTagLength / docCount],
        ]),
        averageDocumentLength: totalLength / docCount,
      };
    }

    scorer.warmIdfCache();
    this.indexed = true;

    const elapsed = performance.now() - startTime;
    console.log(`ResoRank index built: ${docCount} docs in ${elapsed.toFixed(2)}ms`);
  }

  indexNode(nodeId: NodeId): void {
    const scorer = this.getScorer();
    const node = this.graph.getNode(nodeId);
    if (!node) return;

    const data = node.data;
    const label = data.label || '';
    const content = this.extractPlainText(data.content || '');
    const tags = (data.tags || []).join(' ');

    const labelTokens = this.tokenize(label);
    const contentTokens = this.tokenize(content);
    const tagTokens = this.tokenize(tags);

    const totalTokens = labelTokens.length + contentTokens.length + tagTokens.length;
    if (totalTokens === 0) return;

    const docMeta: DocumentMetadata = {
      fieldLengths: new Map([
        [FIELD_LABEL, labelTokens.length],
        [FIELD_CONTENT, contentTokens.length],
        [FIELD_TAGS, tagTokens.length],
      ]),
      totalTokenCount: totalTokens,
    };

    const tokenMetaMap = this.buildTokenMetadata(
      labelTokens,
      contentTokens,
      tagTokens,
      totalTokens
    );

    scorer.indexDocument(nodeId, docMeta, tokenMetaMap);
    this.corpusStats.totalDocuments++;
  }

  reindexNode(nodeId: NodeId): void {
    this.removeNode(nodeId);
    this.indexNode(nodeId);
  }

  removeNode(nodeId: NodeId): void {
    const scorer = this.getScorer();
    if (scorer.removeDocument(nodeId)) {
      this.corpusStats.totalDocuments = Math.max(0, this.corpusStats.totalDocuments - 1);
    }
  }

  search(query: string, options: SearchOptions = {}): SearchResult[] {
    if (!this.indexed) {
      this.buildIndex();
    }

    const startTime = performance.now();
    const queryTokens = this.tokenize(query);
    
    if (queryTokens.length === 0) {
      return [];
    }

    const scorer = this.getScorer();
    const limit = options.limit || 20;

    const rawResults = scorer.search(queryTokens, limit * 3);

    let results: SearchResult[] = [];

    for (const { docId, score } of rawResults) {
      const node = this.graph.getNode(docId);
      if (!node) continue;

      if (!this.matchesFilters(node, options)) continue;

      const graphBoost = this.calculateGraphBoost(node, options);
      const finalScore = score * graphBoost;

      results.push({
        node,
        score,
        graphBoost,
        finalScore,
      });
    }

    results.sort((a, b) => b.finalScore - a.finalScore);
    results = results.slice(0, limit);

    const elapsed = performance.now() - startTime;
    console.log(`Search "${query}": ${results.length} results in ${elapsed.toFixed(2)}ms`);

    return results;
  }

  searchWithExplanations(query: string, options: SearchOptions = {}): SearchResult[] {
    if (!this.indexed) {
      this.buildIndex();
    }

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const scorer = this.getScorer();
    const limit = options.limit || 20;

    const rawResults = scorer.searchWithExplanations(queryTokens, limit * 3);

    let results: SearchResult[] = [];

    for (const { docId, explanation } of rawResults) {
      const node = this.graph.getNode(docId);
      if (!node) continue;

      if (!this.matchesFilters(node, options)) continue;

      const graphBoost = this.calculateGraphBoost(node, options);
      const finalScore = explanation.totalScore * graphBoost;

      results.push({
        node,
        score: explanation.totalScore,
        graphBoost,
        finalScore,
        explanation,
      });
    }

    results.sort((a, b) => b.finalScore - a.finalScore);
    return results.slice(0, limit);
  }

  searchNotes(query: string, folderId?: NodeId, recursive?: boolean): SearchResult[] {
    return this.search(query, {
      types: ['NOTE'],
      folderId,
      recursive,
    });
  }

  searchEntities(query: string, kind?: EntityKind): SearchResult[] {
    return this.search(query, {
      types: ['ENTITY'],
      entityKinds: kind ? [kind] : undefined,
    });
  }

  searchNear(query: string, nodeId: NodeId, hops: number = 2): SearchResult[] {
    const results = this.search(query, { limit: 50 });

    const cy = this.graph.getInstance();
    const centerNode = cy.getElementById(nodeId);
    
    if (!centerNode.length) return results;

    const nearbyIds = new Set<NodeId>();
    let current = centerNode;

    for (let i = 0; i < hops; i++) {
      const neighbors = current.neighborhood('node');
      neighbors.forEach((n: any) => nearbyIds.add(n.id()));
      current = neighbors;
    }

    return results.map(result => {
      if (nearbyIds.has(result.node.data.id)) {
        return {
          ...result,
          graphBoost: result.graphBoost * 1.5,
          finalScore: result.finalScore * 1.5,
        };
      }
      return result;
    }).sort((a, b) => b.finalScore - a.finalScore);
  }

  getStats(): SearchStats {
    const scorer = this.getScorer();
    const stats = scorer.getStats();

    return {
      queryTimeMs: 0,
      candidateCount: 0,
      resultCount: 0,
      indexSize: stats.documentCount,
    };
  }

  private matchesFilters(node: UnifiedNode, options: SearchOptions): boolean {
    if (options.types && options.types.length > 0) {
      if (!options.types.includes(node.data.type)) return false;
    }

    if (options.entityKinds && options.entityKinds.length > 0) {
      if (!node.data.entityKind || !options.entityKinds.includes(node.data.entityKind)) {
        return false;
      }
    }

    if (options.folderId) {
      if (options.recursive) {
        let currentId = node.data.parentId;
        let found = false;
        while (currentId) {
          if (currentId === options.folderId) {
            found = true;
            break;
          }
          const parent = this.graph.getNode(currentId);
          currentId = parent?.data.parentId;
        }
        if (!found && node.data.parentId !== options.folderId) return false;
      } else {
        if (node.data.parentId !== options.folderId) return false;
      }
    }

    return true;
  }

  private calculateGraphBoost(node: UnifiedNode, options: SearchOptions): number {
    let boost = 1.0;

    if (options.boostConnected !== false) {
      const cy = this.graph.getInstance();
      const cyNode = cy.getElementById(node.data.id);
      const degree = cyNode.degree();
      const normalizedDegree = Math.min(degree / 20, 1);
      boost += 0.2 * normalizedDegree;
    }

    if (options.boostRecent !== false && node.data.updatedAt) {
      const now = Date.now();
      const ageMs = now - node.data.updatedAt;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const recencyDecay = Math.exp(-ageDays / 30);
      boost += 0.15 * recencyDecay;
    }

    return boost;
  }

  private buildTokenMetadata(
    labelTokens: string[],
    contentTokens: string[],
    tagTokens: string[],
    totalTokens: number
  ): Map<string, TokenMetadata> {
    const tokenMap = new Map<string, TokenMetadata>();
    const segmentSize = Math.max(1, Math.ceil(totalTokens / 16));

    const processTokens = (tokens: string[], fieldId: number, offset: number) => {
      const fieldTf = new Map<string, number>();
      
      tokens.forEach((token, idx) => {
        fieldTf.set(token, (fieldTf.get(token) || 0) + 1);

        const globalPosition = offset + idx;
        const segment = Math.min(15, Math.floor(globalPosition / segmentSize));
        const segmentBit = 1 << segment;

        if (!tokenMap.has(token)) {
          tokenMap.set(token, {
            fieldOccurrences: new Map(),
            segmentMask: 0,
            corpusDocFrequency: 1,
          });
        }

        const meta = tokenMap.get(token)!;
        meta.segmentMask |= segmentBit;

        if (!meta.fieldOccurrences.has(fieldId)) {
          meta.fieldOccurrences.set(fieldId, {
            tf: 0,
            fieldLength: tokens.length,
          });
        }
      });

      for (const [token, tf] of fieldTf) {
        const meta = tokenMap.get(token)!;
        const fieldOcc = meta.fieldOccurrences.get(fieldId)!;
        fieldOcc.tf = tf;
      }
    };

    let offset = 0;
    processTokens(labelTokens, FIELD_LABEL, offset);
    offset += labelTokens.length;
    processTokens(contentTokens, FIELD_CONTENT, offset);
    offset += contentTokens.length;
    processTokens(tagTokens, FIELD_TAGS, offset);

    return tokenMap;
  }

  private tokenize(text: string): string[] {
    if (!text) return [];
    
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  private extractPlainText(content: string): string {
    if (!content) return '';
    
    try {
      const doc = JSON.parse(content);
      return this.extractTextFromNode(doc);
    } catch {
      return content;
    }
  }

  private extractTextFromNode(node: unknown): string {
    if (typeof node !== 'object' || node === null) return '';
    
    const obj = node as Record<string, unknown>;
    if (obj.type === 'text') {
      return (obj.text as string) || '';
    }
    if (Array.isArray(obj.content)) {
      return obj.content.map((n: unknown) => this.extractTextFromNode(n)).join(' ');
    }
    return '';
  }
}

let resoRankSearch: ResoRankSearchQueries | null = null;

export function getResoRankSearch(): ResoRankSearchQueries {
  if (!resoRankSearch) {
    resoRankSearch = new ResoRankSearchQueries();
  }
  return resoRankSearch;
}

export function resetResoRankSearch(): void {
  resoRankSearch = null;
}
