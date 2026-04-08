export interface ScoredResult {
  uuid: string;
  scores: {
    bm25: number;
    jaccard: number;
    termOverlap: number;
    graphProximity: number;
  };
  combinedScore: number;
  path: string;
  title: string;
}

export type QuerySource =
  | { type: 'text'; query: string }
  | { type: 'uuid'; uuid: string };
