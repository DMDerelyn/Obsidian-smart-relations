import { App, TFile } from 'obsidian';
import { tokenizeWithPositions, extractBodyText } from '../nlp/tokenizer';
import { TermIndex, TermPosting, UuidIndex, CorpusStats } from './types';

export class TermIndexer {
  constructor(
    private app: App,
    private maxTokenizationLength: number = 50000,
    private storePositions: boolean = true,
    private batchSize: number = 50
  ) {}

  /**
   * Build the complete term index from all files.
   * Processes files in batches, yielding to the UI thread between batches.
   */
  async buildIndex(
    uuidIndex: UuidIndex
  ): Promise<{ termIndex: TermIndex; corpusStats: CorpusStats }> {
    const termIndex: TermIndex = {};
    let totalWordCount = 0;
    let totalDocs = 0;
    const allTerms = new Set<string>();

    const entries = Object.entries(uuidIndex);

    for (let i = 0; i < entries.length; i += this.batchSize) {
      const batch = entries.slice(i, i + this.batchSize);

      for (const [uuid, entry] of batch) {
        const file = this.app.vault.getAbstractFileByPath(entry.path);
        if (!file || !(file instanceof TFile)) continue;

        const content = await this.app.vault.cachedRead(file);
        const body = extractBodyText(content);
        const truncated = body.length > this.maxTokenizationLength
          ? body.slice(0, this.maxTokenizationLength)
          : body;

        const tokens = tokenizeWithPositions(truncated);

        // Build per-document term frequency map
        const termFreqs = new Map<string, { count: number; positions: number[] }>();
        for (const { term, position } of tokens) {
          const existing = termFreqs.get(term);
          if (existing) {
            existing.count++;
            if (this.storePositions) existing.positions.push(position);
          } else {
            termFreqs.set(term, { count: 1, positions: this.storePositions ? [position] : [] });
          }
        }

        // Add to global term index
        for (const [term, { count, positions }] of termFreqs) {
          allTerms.add(term);
          let postings = termIndex[term];
          if (!postings) {
            postings = [];
            termIndex[term] = postings;
          }
          const posting: TermPosting = { uuid, tf: count };
          if (this.storePositions && positions.length > 0) {
            posting.positions = positions;
          }
          postings.push(posting);
        }

        totalWordCount += tokens.length;
        totalDocs++;
      }

      // Yield to UI thread between batches
      if (i + this.batchSize < entries.length) {
        await new Promise<void>(resolve => activeWindow.setTimeout(resolve, 0));
      }
    }

    const corpusStats: CorpusStats = {
      totalDocuments: totalDocs,
      avgDocumentLength: totalDocs > 0 ? totalWordCount / totalDocs : 0,
      totalTerms: allTerms.size,
    };

    return { termIndex, corpusStats };
  }

  /**
   * Index a single document. Returns its postings and word count.
   */
  indexSingleDocument(
    uuid: string,
    content: string
  ): { postings: Map<string, TermPosting>; wordCount: number } {
    const body = extractBodyText(content);
    const truncated = body.length > this.maxTokenizationLength
      ? body.slice(0, this.maxTokenizationLength)
      : body;

    const tokens = tokenizeWithPositions(truncated);
    const postings = new Map<string, TermPosting>();

    const termFreqs = new Map<string, { count: number; positions: number[] }>();
    for (const { term, position } of tokens) {
      const existing = termFreqs.get(term);
      if (existing) {
        existing.count++;
        if (this.storePositions) existing.positions.push(position);
      } else {
        termFreqs.set(term, { count: 1, positions: this.storePositions ? [position] : [] });
      }
    }

    for (const [term, { count, positions }] of termFreqs) {
      const posting: TermPosting = { uuid, tf: count };
      if (this.storePositions && positions.length > 0) {
        posting.positions = positions;
      }
      postings.set(term, posting);
    }

    return { postings, wordCount: tokens.length };
  }

  /**
   * Compute IDF for a term using the BM25 variant.
   */
  computeIdf(term: string, termIndex: TermIndex, totalDocs: number): number {
    const postings = termIndex[term];
    const df = postings ? postings.length : 0;
    return Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1);
  }

  /**
   * Remove all postings for a given UUID from the term index.
   */
  removeDocument(termIndex: TermIndex, uuid: string): void {
    for (const term of Object.keys(termIndex)) {
      const postings = termIndex[term];
      if (!postings) continue;
      const filtered = postings.filter(p => p.uuid !== uuid);
      if (filtered.length === 0) {
        delete termIndex[term];
      } else {
        termIndex[term] = filtered;
      }
    }
  }
}
