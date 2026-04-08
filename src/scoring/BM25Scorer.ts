import { TermIndex, DocumentStats, CorpusStats } from '../indexer/types';

export class BM25Scorer {
  private k1 = 1.5;   // term frequency saturation
  private b = 0.75;    // document length normalization

  constructor(
    private termIndex: TermIndex,
    private documentStats: DocumentStats,
    private corpusStats: CorpusStats
  ) {}

  /**
   * Score all documents against a set of query terms.
   * Only scores documents that contain at least one query term.
   * Returns a map of uuid -> BM25 score.
   */
  score(queryTerms: string[]): Map<string, number> {
    const scores = new Map<string, number>();
    const avgdl = this.corpusStats.avgDocumentLength || 1;

    for (const term of queryTerms) {
      const postings = this.termIndex[term];
      if (!postings) continue;

      const idf = this.computeIdf(postings.length);

      for (const posting of postings) {
        const docStat = this.documentStats[posting.uuid];
        const dl = docStat ? docStat.wordCount : avgdl;

        const termScore = this.computeTermScore(posting.tf, idf, dl, avgdl);
        scores.set(posting.uuid, (scores.get(posting.uuid) ?? 0) + termScore);
      }
    }

    return scores;
  }

  /**
   * Score a specific document against query terms.
   */
  scoreDocument(queryTerms: string[], uuid: string): number {
    let total = 0;
    const avgdl = this.corpusStats.avgDocumentLength || 1;
    const docStat = this.documentStats[uuid];
    const dl = docStat ? docStat.wordCount : avgdl;

    for (const term of queryTerms) {
      const postings = this.termIndex[term];
      if (!postings) continue;

      const posting = postings.find(p => p.uuid === uuid);
      if (!posting) continue;

      const idf = this.computeIdf(postings.length);
      total += this.computeTermScore(posting.tf, idf, dl, avgdl);
    }

    return total;
  }

  /**
   * IDF using the BM25 variant that avoids negative values.
   * IDF(t) = log((N - n(t) + 0.5) / (n(t) + 0.5) + 1)
   */
  private computeIdf(df: number): number {
    const N = this.corpusStats.totalDocuments || 1;
    return Math.log((N - df + 0.5) / (df + 0.5) + 1);
  }

  /**
   * BM25 term score:
   * IDF(t) * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / avgdl))
   */
  private computeTermScore(tf: number, idf: number, dl: number, avgdl: number): number {
    const numerator = tf * (this.k1 + 1);
    const denominator = tf + this.k1 * (1 - this.b + this.b * dl / avgdl);
    return idf * (numerator / denominator);
  }
}
