import { NgramIndex } from './types';

export class NgramIndexer {
  private ngramSize: number;

  constructor(ngramSize: number = 3) {
    this.ngramSize = ngramSize;
  }

  /**
   * Build the n-gram index from documents.
   * @param documents - Map of uuid -> text content (title + summary, first 500 chars)
   */
  buildIndex(documents: Map<string, string>): NgramIndex {
    const ngramIndex: NgramIndex = {};

    for (const [uuid, text] of documents) {
      const ngrams = this.extractNgrams(text, this.ngramSize);
      const uniqueNgrams = new Set(ngrams);

      for (const ngram of uniqueNgrams) {
        let uuids = ngramIndex[ngram];
        if (!uuids) {
          uuids = [];
          ngramIndex[ngram] = uuids;
        }
        uuids.push(uuid);
      }
    }

    return ngramIndex;
  }

  /**
   * Extract character-level n-grams from text.
   */
  extractNgrams(text: string, n: number): string[] {
    const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (normalized.length < n) return [];

    const ngrams: string[] = [];
    for (let i = 0; i <= normalized.length - n; i++) {
      ngrams.push(normalized.slice(i, i + n));
    }
    return ngrams;
  }

  /**
   * Find documents similar to a query string using n-gram overlap.
   * Returns UUIDs sorted by overlap count descending.
   */
  findSimilar(
    query: string,
    ngramIndex: NgramIndex,
    threshold: number = 0.1
  ): Array<{ uuid: string; overlapCount: number; overlapRatio: number }> {
    const queryNgrams = new Set(this.extractNgrams(query, this.ngramSize));
    if (queryNgrams.size === 0) return [];

    const uuidCounts = new Map<string, number>();

    for (const ngram of queryNgrams) {
      const uuids = ngramIndex[ngram];
      if (!uuids) continue;
      for (const uuid of uuids) {
        uuidCounts.set(uuid, (uuidCounts.get(uuid) || 0) + 1);
      }
    }

    const results: Array<{ uuid: string; overlapCount: number; overlapRatio: number }> = [];
    for (const [uuid, count] of uuidCounts) {
      const ratio = count / queryNgrams.size;
      if (ratio >= threshold) {
        results.push({ uuid, overlapCount: count, overlapRatio: ratio });
      }
    }

    return results.sort((a, b) => b.overlapCount - a.overlapCount);
  }

  /**
   * Remove all n-gram entries for a given UUID.
   */
  removeDocument(ngramIndex: NgramIndex, uuid: string): void {
    for (const ngram of Object.keys(ngramIndex)) {
      const uuids = ngramIndex[ngram];
      if (!uuids) continue;
      const filtered = uuids.filter(id => id !== uuid);
      if (filtered.length === 0) {
        delete ngramIndex[ngram];
      } else {
        ngramIndex[ngram] = filtered;
      }
    }
  }
}
