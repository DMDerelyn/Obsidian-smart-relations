import { DocumentStats, DocumentStat, TermIndex, CorpusStats } from './types';

export class DocumentStatsBuilder {
  /**
   * Compute stats for a single document given its term postings and word count.
   */
  computeStats(
    _uuid: string,
    termPostings: Map<string, { tf: number }>,
    wordCount: number,
    lastModified: number,
    idfLookup: (term: string) => number
  ): DocumentStat {
    const uniqueTerms = termPostings.size;
    const avgTermFrequency = uniqueTerms > 0 ? wordCount / uniqueTerms : 0;

    // Compute L2 norm of TF-IDF vector: sqrt(sum((tf * idf)^2))
    let sumSquared = 0;
    for (const [term, { tf }] of termPostings) {
      const idf = idfLookup(term);
      const tfidf = tf * idf;
      sumSquared += tfidf * tfidf;
    }
    const vectorNorm = Math.sqrt(sumSquared);

    return {
      wordCount: Math.max(wordCount, 1), // Guard against division by zero in BM25
      uniqueTerms,
      avgTermFrequency,
      vectorNorm,
      lastModified,
    };
  }

  /**
   * Build document stats for all documents using the term index.
   */
  buildAllStats(
    termIndex: TermIndex,
    corpusStats: CorpusStats,
    lastModifiedLookup: (uuid: string) => number
  ): DocumentStats {
    const stats: DocumentStats = {};

    // Collect per-document data from term index
    const docTerms = new Map<string, Map<string, number>>();
    const docWordCounts = new Map<string, number>();

    for (const [term, postings] of Object.entries(termIndex)) {
      if (!postings) continue;
      for (const posting of postings) {
        let termMap = docTerms.get(posting.uuid);
        if (!termMap) {
          termMap = new Map();
          docTerms.set(posting.uuid, termMap);
          docWordCounts.set(posting.uuid, 0);
        }
        termMap.set(term, posting.tf);
        docWordCounts.set(
          posting.uuid,
          (docWordCounts.get(posting.uuid) ?? 0) + posting.tf
        );
      }
    }

    // IDF lookup function
    const idfLookup = (term: string): number => {
      const postings = termIndex[term];
      const df = postings ? postings.length : 0;
      return Math.log(
        (corpusStats.totalDocuments - df + 0.5) / (df + 0.5) + 1
      );
    };

    // Compute stats for each document
    for (const [uuid, terms] of docTerms) {
      const wordCount = docWordCounts.get(uuid) ?? 0;
      const termPostings = new Map<string, { tf: number }>();
      for (const [term, tf] of terms) {
        termPostings.set(term, { tf });
      }

      stats[uuid] = this.computeStats(
        uuid,
        termPostings,
        wordCount,
        lastModifiedLookup(uuid),
        idfLookup
      );
    }

    return stats;
  }
}
