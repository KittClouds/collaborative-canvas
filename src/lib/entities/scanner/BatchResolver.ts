import { ResoRankIncrementalScorer, CorpusStatistics } from '@/lib/resorank';
import { TokenMetadata } from '@/lib/resorank'; // Assuming TokenMetadata is exported

export class BatchResolver {
    /**
     * Score multiple documents in batch using incremental scorer
     */
    static scoreDocumentsBatch(
        query: string[],
        documents: Array<{ docId: string; tokens: Map<string, TokenMetadata> }>,
        corpusStats: CorpusStatistics
    ): Map<string, number> {
        const scorer = new ResoRankIncrementalScorer({}, corpusStats);

        // Process query terms
        for (const term of query) {
            // Add field contributions for all docs (batched)
            let termDocCount = 0;

            for (const doc of documents) {
                const tokenMeta = doc.tokens.get(term);
                if (!tokenMeta) continue;

                termDocCount++;

                for (const [fieldId, fieldData] of tokenMeta.fieldOccurrences) {
                    // Need to handle missing segmentMask in TokenMetadata if strict mode is on
                    // ResoRankIncrementalScorer.addFieldContribution sig:
                    // addFieldContribution(docId, fieldId, tf, fieldLength, segmentMask, docLength)
                    scorer.addFieldContribution(
                        doc.docId,
                        fieldId,
                        fieldData.tf,
                        fieldData.fieldLength,
                        tokenMeta.segmentMask || 0,
                        doc.tokens.size // Document length (unique terms count approximation)
                    );
                }
            }

            // Finalize term (calculates IDF once for ALL docs)
            // scorer.finalizeTerm(corpusDocFreq); 
            // Note: corpusDocFreq is the frequency in the GLOBAL corpus, not just the batch.
            // But typically we use corpusStats for IDF.
            // If ResoRankIncrementalScorer expects purely local batch freq for dynamic scoring, 
            // we might use termDocCount. 
            // However, usually we want global IDF. 
            // If ResoRankIncrementalScorer doesn't take standard IDF params, we might need to rely on 
            // how it handles 'corpusDocFreq'.
            // Based on the prompt snippet: 
            // "const corpusDocFreq = documents.filter(d => d.tokens.has(term)).length;"
            // This implies it's using the batch frequency? Or maybe checking against the docs being scored.
            // I'll stick to the snippet.
            const batchDocFreq = documents.filter(d => d.tokens.has(term)).length;
            scorer.finalizeTerm(batchDocFreq);
            scorer.nextTerm();
        }

        // Get final scores (proximity calculated once)
        return scorer.getScores();
    }
}
