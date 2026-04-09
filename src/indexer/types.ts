// === UUID Index ===
export interface UuidEntry {
  path: string;
  title: string;
  type: string;
  tags: string[];
  relationCount: number;
  lastModified: number; // epoch ms for dirty tracking
}
export type UuidIndex = Record<string, UuidEntry>;

// === Term Index ===
export interface TermPosting {
  uuid: string;
  tf: number;          // raw term frequency
  positions?: number[]; // character offsets — optional, disabled on mobile for memory savings
}
export type TermIndex = Record<string, TermPosting[]>;

// === Tag Co-occurrence ===
export type TagCooccurrence = Record<string, Record<string, number>>;

// === N-gram Index ===
export type NgramIndex = Record<string, string[]>; // ngram -> [uuid]

// === Relation Graph ===
export interface RelationEdge {
  target: string;   // target UUID
  type: string;     // e.g., "related", "references", "supports"
  weight: number;   // default 1.0
}
export type RelationGraph = Record<string, RelationEdge[]>;

// === Document Stats ===
export interface DocumentStat {
  wordCount: number;
  uniqueTerms: number;
  avgTermFrequency: number;
  vectorNorm: number;       // L2 norm of TF-IDF vector
  lastModified: number;     // epoch ms
}
export type DocumentStats = Record<string, DocumentStat>;

// === Corpus Stats ===
export interface CorpusStats {
  totalDocuments: number;
  avgDocumentLength: number;  // average word count (avgdl for BM25)
  totalTerms: number;
  lastIndexedAt?: number;     // epoch ms of last index build
}
