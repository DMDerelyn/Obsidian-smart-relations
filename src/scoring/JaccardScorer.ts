import { UuidIndex } from '../indexer/types';

export class JaccardScorer {
  constructor(private uuidIndex: UuidIndex) {}

  /**
   * Score all documents by tag overlap with source tags.
   * J(A,B) = |A intersection B| / |A union B|
   */
  scoreByTags(sourceTags: string[]): Map<string, number> {
    const scores = new Map<string, number>();
    if (sourceTags.length === 0) return scores;

    const sourceSet = new Set(sourceTags);

    for (const [uuid, entry] of Object.entries(this.uuidIndex)) {
      if (entry.tags.length === 0) continue;
      const targetSet = new Set(entry.tags);
      const score = this.jaccard(sourceSet, targetSet);
      if (score > 0) {
        scores.set(uuid, score);
      }
    }

    return scores;
  }

  /**
   * Score all documents by term set overlap (vocabulary overlap).
   * This ignores frequency -- just measures what % of unique terms are shared.
   */
  scoreByTermOverlap(sourceTerms: Set<string>, documentTerms: Map<string, Set<string>>): Map<string, number> {
    const scores = new Map<string, number>();
    if (sourceTerms.size === 0) return scores;

    for (const [uuid, targetTerms] of documentTerms) {
      const score = this.jaccard(sourceTerms, targetTerms);
      if (score > 0) {
        scores.set(uuid, score);
      }
    }

    return scores;
  }

  /**
   * Compute Jaccard similarity between two sets.
   */
  jaccard(setA: Set<string>, setB: Set<string>): number {
    let intersectionSize = 0;
    // Iterate over the smaller set for efficiency
    const [smaller, larger] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
    for (const item of smaller) {
      if (larger.has(item)) intersectionSize++;
    }

    const unionSize = setA.size + setB.size - intersectionSize;
    if (unionSize === 0) return 0;

    return intersectionSize / unionSize;
  }
}
