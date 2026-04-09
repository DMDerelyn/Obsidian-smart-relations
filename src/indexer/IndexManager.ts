import { App, TFile } from 'obsidian';
import { SmartRelationsSettings } from '../settings';
import { IndexCache } from '../utils/cache';
import { parseFrontmatter } from '../utils/frontmatter';
import { UuidIndexer } from './UuidIndexer';
import { TermIndexer } from './TermIndexer';
import { TagIndexer } from './TagIndexer';
import { NgramIndexer } from './NgramIndexer';
import { RelationGraphBuilder } from './RelationGraphBuilder';
import { DocumentStatsBuilder } from './DocumentStats';
import {
  UuidIndex, TermIndex, TagCooccurrence, NgramIndex,
  RelationGraph, DocumentStats, CorpusStats
} from './types';

// Index filenames
const INDEX_FILES = {
  uuid: '_uuid_index.json',
  term: '_term_index.json',
  tag: '_tag_cooccurrence.json',
  ngram: '_ngram_index.json',
  graph: '_relation_graph.json',
  docStats: '_document_stats.json',
  corpusStats: '_corpus_stats.json',
} as const;

export type IndexProgressCallback = (message: string, progress?: number) => void;

export class IndexManager {
  // Index data
  private uuidIndex: UuidIndex = {};
  private termIndex: TermIndex = {};
  private tagCooccurrence: TagCooccurrence = {};
  private ngramIndex: NgramIndex = {};
  private relationGraph: RelationGraph = {};
  private documentStats: DocumentStats = {};
  private corpusStats: CorpusStats = { totalDocuments: 0, avgDocumentLength: 0, totalTerms: 0 };

  // Indexers
  private uuidIndexer: UuidIndexer;
  private termIndexer: TermIndexer;
  private tagIndexer: TagIndexer;
  private ngramIndexer: NgramIndexer;
  private graphBuilder: RelationGraphBuilder;
  private statsBuilder: DocumentStatsBuilder;

  // Reverse map for O(1) path -> uuid lookups
  private pathToUuid: Map<string, string> = new Map();

  // Cached document term sets for scoring (avoids per-query rebuild)
  private documentTermSets: Map<string, Set<string>> = new Map();

  // Debounce
  private pendingChanges: Map<string, { file: TFile; type: 'create' | 'modify' | 'delete' }> = new Map();
  private debounceTimer: number | null = null;
  private readonly DEBOUNCE_MS = 500;

  // State
  private isIndexing = false;
  private lastIndexTime: number | null = null;
  private indexLoaded = false;

  // Dirty tracking for selective persistence
  private dirtyIndexes: Set<string> = new Set();

  // Track whether documentTermSets needs rebuilding (lazy computation)
  private documentTermSetsDirty = true;

  constructor(
    private app: App,
    private settings: SmartRelationsSettings,
    private cache: IndexCache
  ) {
    this.uuidIndexer = new UuidIndexer(app);
    this.termIndexer = new TermIndexer(app, settings.maxTokenizationLength, settings.storePositions, settings.indexBatchSize);
    this.tagIndexer = new TagIndexer();
    this.ngramIndexer = new NgramIndexer(settings.ngramSize);
    this.graphBuilder = new RelationGraphBuilder(app);
    this.statsBuilder = new DocumentStatsBuilder();
  }

  // ==================== Full Rebuild ====================

  /**
   * Rebuild all indexes from scratch.
   * Processes files in batches to avoid freezing the UI.
   */
  async rebuildAll(onProgress?: IndexProgressCallback): Promise<void> {
    if (this.isIndexing) {
      console.warn('Smart Relations: Already indexing, skipping rebuild');
      return;
    }

    this.isIndexing = true;
    const startTime = Date.now();

    try {
      onProgress?.('Starting full reindex...', 0);

      // Step 1: Build UUID index
      onProgress?.('Building UUID index...', 0.1);
      const { index: uuidIndex, warnings: uuidWarnings } = await this.uuidIndexer.buildIndex(this.settings.excludedFolders);
      this.uuidIndex = uuidIndex;
      for (const w of uuidWarnings) console.warn(`Smart Relations: ${w}`);

      const totalFiles = Object.keys(uuidIndex).length;
      onProgress?.(`UUID index: ${totalFiles} notes indexed`, 0.2);

      // Step 2: Build term index (most expensive -- reads file content)
      onProgress?.('Building term index...', 0.3);
      const { termIndex, corpusStats } = await this.termIndexer.buildIndex(uuidIndex);
      this.termIndex = termIndex;
      this.corpusStats = corpusStats;
      onProgress?.(`Term index: ${Object.keys(termIndex).length} unique terms`, 0.5);

      // Step 3: Build tag co-occurrence
      onProgress?.('Building tag co-occurrence...', 0.6);
      this.tagCooccurrence = this.tagIndexer.buildIndex(uuidIndex);

      // Step 4: Build n-gram index (optional — can be disabled for memory savings)
      if (this.settings.enableNgramIndex) {
        onProgress?.('Building n-gram index...', 0.7);
        const ngramDocuments = new Map<string, string>();
        for (const [uuid, entry] of Object.entries(uuidIndex)) {
          ngramDocuments.set(uuid, `${entry.title} ${entry.path}`);
        }
        this.ngramIndex = this.ngramIndexer.buildIndex(ngramDocuments);
      } else {
        this.ngramIndex = {};
      }

      // Step 5: Build relation graph
      onProgress?.('Building relation graph...', 0.8);
      const { graph, warnings: graphWarnings } = this.graphBuilder.buildGraph(uuidIndex);
      this.relationGraph = graph;
      for (const w of graphWarnings) console.warn(`Smart Relations: ${w}`);

      // Step 6: Build document stats
      onProgress?.('Computing document statistics...', 0.9);
      this.documentStats = this.statsBuilder.buildAllStats(
        termIndex,
        corpusStats,
        (uuid) => uuidIndex[uuid]?.lastModified ?? Date.now()
      );

      // Build reverse path map; mark term sets for lazy rebuild
      this.rebuildPathMap();
      this.documentTermSetsDirty = true;

      // Persist timestamp in corpus stats and save all indexes
      this.markAllDirty();
      this.corpusStats.lastIndexedAt = Date.now();
      await this.saveAllIndexes();

      this.lastIndexTime = this.corpusStats.lastIndexedAt;
      this.indexLoaded = true;

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      onProgress?.(`Indexing complete: ${totalFiles} notes in ${elapsed}s`, 1);
      console.log(`Smart Relations: Full reindex completed — ${totalFiles} notes, ${Object.keys(termIndex).length} terms in ${elapsed}s`);

    } catch (e) {
      console.error('Smart Relations: Reindex failed:', e);
      onProgress?.('Indexing failed — check console for details', 0);
    } finally {
      this.isIndexing = false;
    }
  }

  // ==================== Incremental Updates ====================

  /**
   * Handle a file change event. Debounces rapid changes.
   */
  handleFileChange(file: TFile, changeType: 'create' | 'modify' | 'delete'): void {
    if (!this.indexLoaded) return;
    if (file.extension !== 'md') return;

    // Skip excluded folders (append / to prevent prefix false positives like "arc" matching "archive/")
    if (this.settings.excludedFolders.some(f => {
      const normalized = f.endsWith('/') ? f : f + '/';
      return file.path.startsWith(normalized);
    })) return;

    this.pendingChanges.set(file.path, { file, type: changeType });
    this.scheduleFlush();
  }

  /**
   * Handle a file rename. Updates the path in UUID index.
   */
  handleFileRename(file: TFile, oldPath: string): void {
    if (!this.indexLoaded) return;
    if (file.extension !== 'md') return;

    // Queue as a modify to avoid race conditions with concurrent flushes
    this.pendingChanges.set(file.path, { file, type: 'modify' });

    // Also update the path in UUID index immediately for consistency
    // (safe since we only mutate a string property, not structural changes)
    if (!this.isIndexing) {
      for (const [, entry] of Object.entries(this.uuidIndex)) {
        if (entry.path === oldPath) {
          entry.path = file.path;
          entry.title = file.basename;
          break;
        }
      }
    }

    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      void this.flushPendingChanges();
    }, this.DEBOUNCE_MS);
  }

  private async flushPendingChanges(): Promise<void> {
    if (this.pendingChanges.size === 0) return;
    if (this.isIndexing) {
      // Retry after current indexing completes
      this.scheduleFlush();
      return;
    }

    const changes = new Map(this.pendingChanges);
    this.pendingChanges.clear();
    this.debounceTimer = null;

    this.isIndexing = true;
    try {
      for (const [path, { file, type }] of changes) {
        switch (type) {
          case 'delete':
            this.handleDelete(path);
            break;
          case 'create':
          case 'modify':
            await this.handleCreateOrModify(file);
            break;
        }
      }

      // Rebuild tag co-occurrence
      this.tagCooccurrence = this.tagIndexer.buildIndex(this.uuidIndex);

      // Recalculate corpus stats FIRST (document stats depend on IDF which needs totalDocuments)
      let totalWords = 0;
      const allTerms = new Set<string>();
      for (const [term, postings] of Object.entries(this.termIndex)) {
        allTerms.add(term);
        if (postings) {
          for (const p of postings) {
            totalWords += p.tf;
          }
        }
      }
      const totalDocs = Object.keys(this.uuidIndex).length;
      this.corpusStats = {
        totalDocuments: totalDocs,
        avgDocumentLength: totalDocs > 0 ? totalWords / totalDocs : 0,
        totalTerms: allTerms.size,
      };

      // Now rebuild document stats with fresh corpus stats
      this.documentStats = this.statsBuilder.buildAllStats(
        this.termIndex,
        this.corpusStats,
        (uuid) => this.uuidIndex[uuid]?.lastModified ?? Date.now()
      );

      this.corpusStats.lastIndexedAt = Date.now();
      this.documentTermSetsDirty = true;
      this.markDirty('uuid', 'term', 'tag', 'graph', 'docStats', 'corpusStats');
      if (this.settings.enableNgramIndex) this.markDirty('ngram');
      await this.saveAllIndexes();
      this.lastIndexTime = this.corpusStats.lastIndexedAt;
    } catch (e) {
      console.error('Smart Relations: Incremental update failed:', e);
    } finally {
      this.isIndexing = false;
    }
  }

  private handleDelete(path: string): void {
    // Use reverse map for O(1) lookup
    const deletedUuid = this.pathToUuid.get(path) ?? null;

    if (!deletedUuid) return;

    // Remove from all indexes and reverse map
    this.pathToUuid.delete(path);
    this.uuidIndexer.removeFile(this.uuidIndex, deletedUuid);
    this.termIndexer.removeDocument(this.termIndex, deletedUuid);
    this.ngramIndexer.removeDocument(this.ngramIndex, deletedUuid);
    this.graphBuilder.removeNode(this.relationGraph, deletedUuid);
    delete this.documentStats[deletedUuid];

    console.log(`Smart Relations: Removed deleted file from index (UUID: ${deletedUuid})`);
  }

  private async handleCreateOrModify(file: TFile): Promise<void> {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache) return;

    const result = this.uuidIndexer.indexSingleFile(file, cache);
    if (!result) {
      // Note has no valid UUID — clean up old entries if it was previously indexed
      const oldUuid = this.pathToUuid.get(file.path);
      if (oldUuid) {
        this.uuidIndexer.removeFile(this.uuidIndex, oldUuid);
        this.termIndexer.removeDocument(this.termIndex, oldUuid);
        this.ngramIndexer.removeDocument(this.ngramIndex, oldUuid);
        this.graphBuilder.removeNode(this.relationGraph, oldUuid);
        delete this.documentStats[oldUuid];
        this.documentTermSets.delete(oldUuid);
        this.pathToUuid.delete(file.path);
        console.warn(`Smart Relations: Note lost its UUID, removed from index: "${file.path}"`);
      }
      return;
    }

    const { uuid, entry } = result;

    // Remove old entries if this UUID was already indexed
    if (this.uuidIndex[uuid]) {
      this.termIndexer.removeDocument(this.termIndex, uuid);
      this.ngramIndexer.removeDocument(this.ngramIndex, uuid);
      this.graphBuilder.removeNode(this.relationGraph, uuid);
      delete this.documentStats[uuid];
      this.documentTermSets.delete(uuid);
    }

    // Update UUID index and reverse path map
    this.uuidIndexer.updateFile(this.uuidIndex, uuid, entry);
    this.pathToUuid.set(entry.path, uuid);

    // Re-index term postings
    const content = await this.app.vault.cachedRead(file);
    const { postings } = this.termIndexer.indexSingleDocument(uuid, content);
    for (const [term, posting] of postings) {
      const existing = this.termIndex[term];
      if (!existing) {
        this.termIndex[term] = [];
      }
      // After the above guard, we know the array exists
      this.termIndex[term]!.push(posting);
    }

    // Mark document term sets for lazy rebuild
    this.documentTermSetsDirty = true;

    // Re-index n-grams (if enabled)
    if (this.settings.enableNgramIndex) {
      const ngramText = `${entry.title} ${entry.path}`;
      const ngramDocs = new Map<string, string>();
      ngramDocs.set(uuid, ngramText);
      const newNgrams = this.ngramIndexer.buildIndex(ngramDocs);
      for (const [ngram, uuids] of Object.entries(newNgrams)) {
        if (!uuids) continue;
        const existingNgram = this.ngramIndex[ngram];
        if (!existingNgram) {
          this.ngramIndex[ngram] = [];
        }
        this.ngramIndex[ngram]!.push(...uuids);
      }
    }

    // Re-index relation graph edges for this file
    const fm = parseFrontmatter(cache);
    if (fm) {
      for (const rel of fm.related) {
        if (this.uuidIndex[rel.uuid]) {
          this.graphBuilder.addEdge(this.relationGraph, uuid, rel.uuid, rel.rel, 1.0);
          this.graphBuilder.addEdge(this.relationGraph, rel.uuid, uuid, rel.rel, 1.0);
        }
      }
    }

    console.log(`Smart Relations: Updated index for "${file.path}" (UUID: ${uuid})`);
  }

  // ==================== Persistence ====================

  async loadAllIndexes(): Promise<boolean> {
    try {
      const [uuid, term, tag, ngram, graph, docStats, corpus] = await Promise.all([
        this.cache.loadIndex<UuidIndex>(INDEX_FILES.uuid),
        this.cache.loadIndex<TermIndex>(INDEX_FILES.term),
        this.cache.loadIndex<TagCooccurrence>(INDEX_FILES.tag),
        this.cache.loadIndex<NgramIndex>(INDEX_FILES.ngram),
        this.cache.loadIndex<RelationGraph>(INDEX_FILES.graph),
        this.cache.loadIndex<DocumentStats>(INDEX_FILES.docStats),
        this.cache.loadIndex<CorpusStats>(INDEX_FILES.corpusStats),
      ]);

      if (uuid && term) {
        this.uuidIndex = uuid;
        this.termIndex = term;
        this.tagCooccurrence = tag ?? {};
        this.ngramIndex = ngram ?? {};
        this.relationGraph = graph ?? {};
        this.documentStats = docStats ?? {};
        this.corpusStats = corpus ?? { totalDocuments: 0, avgDocumentLength: 0, totalTerms: 0 };
        this.rebuildPathMap();
        this.documentTermSetsDirty = true;
        this.indexLoaded = true;
        this.lastIndexTime = this.corpusStats.lastIndexedAt ?? null;
        console.log(`Smart Relations: Loaded indexes from disk (${Object.keys(this.uuidIndex).length} notes)`);
        return true;
      }

      return false;
    } catch (e) {
      console.warn('Smart Relations: Failed to load indexes from disk:', e);
      return false;
    }
  }

  async saveAllIndexes(): Promise<void> {
    // Only write indexes that have been marked dirty
    const writes: Promise<void>[] = [];
    const indexMap: Record<string, unknown> = {
      uuid: this.uuidIndex,
      term: this.termIndex,
      tag: this.tagCooccurrence,
      ngram: this.ngramIndex,
      graph: this.relationGraph,
      docStats: this.documentStats,
      corpusStats: this.corpusStats,
    };

    for (const key of this.dirtyIndexes) {
      const filename = INDEX_FILES[key as keyof typeof INDEX_FILES];
      const data = indexMap[key];
      if (filename && data !== undefined) {
        writes.push(this.cache.saveIndex(filename, data));
      }
    }

    if (writes.length > 0) {
      await Promise.all(writes);
    }
    this.dirtyIndexes.clear();
  }

  private markDirty(...keys: string[]): void {
    for (const key of keys) {
      this.dirtyIndexes.add(key);
    }
  }

  private markAllDirty(): void {
    this.markDirty('uuid', 'term', 'tag', 'ngram', 'graph', 'docStats', 'corpusStats');
  }

  // ==================== Accessors ====================

  getUuidIndex(): UuidIndex { return this.uuidIndex; }
  getTermIndex(): TermIndex { return this.termIndex; }
  getTagCooccurrence(): TagCooccurrence { return this.tagCooccurrence; }
  getNgramIndex(): NgramIndex { return this.ngramIndex; }
  getRelationGraph(): RelationGraph { return this.relationGraph; }
  getDocumentStats(): DocumentStats { return this.documentStats; }
  getCorpusStats(): CorpusStats { return this.corpusStats; }
  getDocumentTermSets(): Map<string, Set<string>> {
    if (this.documentTermSetsDirty) {
      this.rebuildDocumentTermSets();
      this.documentTermSetsDirty = false;
    }
    return this.documentTermSets;
  }

  getUuidForFile(file: TFile): string | null {
    return this.pathToUuid.get(file.path) ?? null;
  }

  isLoaded(): boolean { return this.indexLoaded; }
  isCurrentlyIndexing(): boolean { return this.isIndexing; }

  getLastIndexTime(): number | null { return this.lastIndexTime; }
  getNoteCount(): number { return Object.keys(this.uuidIndex).length; }

  /**
   * Rebuild the reverse path -> uuid map from the UUID index.
   */
  private rebuildPathMap(): void {
    this.pathToUuid.clear();
    for (const [uuid, entry] of Object.entries(this.uuidIndex)) {
      this.pathToUuid.set(entry.path, uuid);
    }
  }

  /**
   * Rebuild cached document term sets from the term index.
   */
  private rebuildDocumentTermSets(): void {
    this.documentTermSets.clear();
    for (const [term, postings] of Object.entries(this.termIndex)) {
      if (!postings) continue;
      for (const posting of postings) {
        let termSet = this.documentTermSets.get(posting.uuid);
        if (!termSet) {
          termSet = new Set<string>();
          this.documentTermSets.set(posting.uuid, termSet);
        }
        termSet.add(term);
      }
    }
  }

  /**
   * Clean up timers. Call from plugin onunload().
   */
  destroy(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingChanges.clear();
  }

  /**
   * Get dirty files (modified since last index).
   */
  getDirtyFiles(): TFile[] {
    const files = this.app.vault.getMarkdownFiles();
    return files.filter(file => {
      const uuid = this.getUuidForFile(file);
      if (!uuid) return true; // New file, not indexed
      const entry = this.uuidIndex[uuid];
      if (!entry) return true;
      return file.stat.mtime > entry.lastModified;
    });
  }
}
