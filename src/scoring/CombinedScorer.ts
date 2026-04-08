import { App, TFile } from 'obsidian';
import { SmartRelationsSettings } from '../settings';
import { tokenize } from '../nlp/tokenizer';
import { extractBodyText } from '../nlp/tokenizer';
import { BM25Scorer } from './BM25Scorer';
import { JaccardScorer } from './JaccardScorer';
import { ScoredResult, QuerySource } from './types';
import {
  UuidIndex, TermIndex, TagCooccurrence, NgramIndex,
  RelationGraph, DocumentStats, CorpusStats
} from '../indexer/types';

/**
 * Interface for accessing index data.
 * This decouples the scorer from the IndexManager implementation.
 */
export interface IndexAccessor {
  getUuidIndex(): UuidIndex;
  getTermIndex(): TermIndex;
  getTagCooccurrence(): TagCooccurrence;
  getNgramIndex(): NgramIndex;
  getRelationGraph(): RelationGraph;
  getDocumentStats(): DocumentStats;
  getCorpusStats(): CorpusStats;
}

export class CombinedScorer {
  constructor(
    private app: App,
    private settings: SmartRelationsSettings,
    private indexes: IndexAccessor
  ) {}

  /**
   * Find related notes for a given source (text query or UUID).
   * Returns scored results sorted by combined score descending.
   */
  async findRelated(source: QuerySource, limit?: number): Promise<ScoredResult[]> {
    const maxResults = limit ?? this.settings.maxRelatedNotes;
    const weights = this.settings.scoringWeights;
    const uuidIndex = this.indexes.getUuidIndex();
    const termIndex = this.indexes.getTermIndex();
    const documentStats = this.indexes.getDocumentStats();
    const corpusStats = this.indexes.getCorpusStats();
    const relationGraph = this.indexes.getRelationGraph();

    // Resolve query terms and source metadata
    let queryTerms: string[];
    let sourceTags: string[] = [];
    let sourceUuid: string | null = null;

    if (source.type === 'text') {
      queryTerms = tokenize(source.query);
    } else {
      sourceUuid = source.uuid;
      const entry = uuidIndex[sourceUuid];
      if (!entry) return [];

      // Read the source document's content to get its terms
      const file = this.app.vault.getAbstractFileByPath(entry.path);
      if (!file || !(file instanceof TFile)) return [];
      const content = await this.app.vault.cachedRead(file);
      const body = extractBodyText(content);
      queryTerms = tokenize(body);
      sourceTags = entry.tags;
    }

    if (queryTerms.length === 0 && sourceTags.length === 0 && !sourceUuid) {
      return [];
    }

    // === Score with each method ===

    // 1. BM25
    const bm25Scorer = new BM25Scorer(termIndex, documentStats, corpusStats);
    const bm25Scores = queryTerms.length > 0 ? bm25Scorer.score(queryTerms) : new Map<string, number>();

    // 2. Jaccard (tag similarity)
    const jaccardScorer = new JaccardScorer(uuidIndex);
    const jaccardScores = sourceTags.length > 0 ? jaccardScorer.scoreByTags(sourceTags) : new Map<string, number>();

    // 3. Term overlap (Jaccard on term sets)
    const sourceTermSet = new Set(queryTerms);
    const documentTermSets = this.buildDocumentTermSets(termIndex);
    const termOverlapScores = sourceTermSet.size > 0
      ? jaccardScorer.scoreByTermOverlap(sourceTermSet, documentTermSets)
      : new Map<string, number>();

    // 4. Graph proximity (BFS from source UUID)
    const graphScores = new Map<string, number>();
    if (sourceUuid && relationGraph) {
      // BFS to find neighbors within 3 hops
      const visited = new Set<string>();
      visited.add(sourceUuid);
      const queue: Array<{ uuid: string; dist: number }> = [{ uuid: sourceUuid, dist: 0 }];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.dist >= 3) continue;

        const edges = relationGraph[current.uuid];
        if (!edges) continue;

        for (const edge of edges) {
          if (!visited.has(edge.target)) {
            visited.add(edge.target);
            const dist = current.dist + 1;
            // Score: 1 / (distance + 1). Direct neighbor = 0.5, 2-hop = 0.33, 3-hop = 0.25
            graphScores.set(edge.target, 1 / (dist + 1));
            queue.push({ uuid: edge.target, dist });
          }
        }
      }
    }

    // === Normalize each score set to [0, 1] ===
    const normBm25 = this.normalizeScores(bm25Scores);
    const normJaccard = this.normalizeScores(jaccardScores);
    const normTermOverlap = this.normalizeScores(termOverlapScores);
    const normGraph = this.normalizeScores(graphScores);

    // === Combine scores ===
    const allUuids = new Set<string>();
    for (const uuid of normBm25.keys()) allUuids.add(uuid);
    for (const uuid of normJaccard.keys()) allUuids.add(uuid);
    for (const uuid of normTermOverlap.keys()) allUuids.add(uuid);
    for (const uuid of normGraph.keys()) allUuids.add(uuid);

    // Remove source UUID from results
    if (sourceUuid) allUuids.delete(sourceUuid);

    const results: ScoredResult[] = [];

    for (const uuid of allUuids) {
      const entry = uuidIndex[uuid];
      if (!entry) continue;

      const scores = {
        bm25: normBm25.get(uuid) ?? 0,
        jaccard: normJaccard.get(uuid) ?? 0,
        termOverlap: normTermOverlap.get(uuid) ?? 0,
        graphProximity: normGraph.get(uuid) ?? 0,
      };

      const combinedScore =
        weights.bm25 * scores.bm25 +
        weights.jaccard * scores.jaccard +
        weights.termOverlap * scores.termOverlap +
        weights.graphProximity * scores.graphProximity;

      // Filter below threshold
      if (combinedScore < this.settings.minSimilarityThreshold) continue;

      results.push({
        uuid,
        scores,
        combinedScore,
        path: entry.path,
        title: entry.title,
      });
    }

    // Sort by combined score descending
    results.sort((a, b) => b.combinedScore - a.combinedScore);

    return results.slice(0, maxResults);
  }

  /**
   * Min-max normalize a set of scores to [0, 1].
   * If all scores are equal (or empty), returns 0 for all.
   */
  private normalizeScores(scores: Map<string, number>): Map<string, number> {
    if (scores.size === 0) return scores;

    let min = Infinity;
    let max = -Infinity;
    for (const score of scores.values()) {
      if (score < min) min = score;
      if (score > max) max = score;
    }

    const range = max - min;
    if (range === 0) {
      // All scores are equal -- normalize to 0.5 if non-zero, 0 if zero
      const normalized = new Map<string, number>();
      for (const [uuid, score] of scores) {
        normalized.set(uuid, score > 0 ? 0.5 : 0);
      }
      return normalized;
    }

    const normalized = new Map<string, number>();
    for (const [uuid, score] of scores) {
      normalized.set(uuid, (score - min) / range);
    }
    return normalized;
  }

  /**
   * Build per-document term sets from the term index.
   * Used for term overlap (Jaccard on vocabulary).
   */
  private buildDocumentTermSets(termIndex: TermIndex): Map<string, Set<string>> {
    const docTerms = new Map<string, Set<string>>();

    for (const [term, postings] of Object.entries(termIndex)) {
      if (!postings) continue;
      for (const posting of postings) {
        let termSet = docTerms.get(posting.uuid);
        if (!termSet) {
          termSet = new Set<string>();
          docTerms.set(posting.uuid, termSet);
        }
        termSet.add(term);
      }
    }

    return docTerms;
  }
}
