import { App, TFile } from 'obsidian';
import { parseFrontmatter } from '../utils/frontmatter';
import { RelationGraph, UuidIndex } from './types';

export class RelationGraphBuilder {
  constructor(private app: App) {}

  /**
   * Build the relation graph from all files' frontmatter.
   * Creates bidirectional edges for each related entry.
   * Validates that target UUIDs exist in the UUID index.
   */
  buildGraph(uuidIndex: UuidIndex): { graph: RelationGraph; warnings: string[] } {
    const graph: RelationGraph = {};
    const warnings: string[] = [];

    for (const [sourceUuid, entry] of Object.entries(uuidIndex)) {
      const file = this.app.vault.getAbstractFileByPath(entry.path);
      if (!file || !(file instanceof TFile)) continue;

      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache) continue;

      const fm = parseFrontmatter(cache);
      if (!fm) continue;

      for (const rel of fm.related) {
        // Validate target exists
        if (!uuidIndex[rel.uuid]) {
          warnings.push(
            `Dangling reference: "${entry.path}" references UUID ${rel.uuid} which does not exist in the index`
          );
          continue;
        }

        // Add forward edge: source -> target
        this.addEdge(graph, sourceUuid, rel.uuid, rel.rel, 1.0);

        // Add reverse edge: target -> source (bidirectional)
        this.addEdge(graph, rel.uuid, sourceUuid, rel.rel, 1.0);
      }
    }

    return { graph, warnings };
  }

  /**
   * Add an edge to the graph. Avoids duplicates.
   */
  addEdge(
    graph: RelationGraph,
    source: string,
    target: string,
    type: string,
    weight: number = 1.0
  ): void {
    let edges = graph[source];
    if (!edges) {
      edges = [];
      graph[source] = edges;
    }

    // Check if edge already exists
    const existing = edges.find(e => e.target === target && e.type === type);
    if (existing) {
      // Update weight if higher
      existing.weight = Math.max(existing.weight, weight);
      return;
    }

    edges.push({ target, type, weight });
  }

  /**
   * Get all neighbors within `depth` hops using BFS.
   * Returns a Map of UUID -> distance (excluding the source).
   */
  getNeighbors(graph: RelationGraph, uuid: string, depth: number = 2): Map<string, number> {
    const distances = new Map<string, number>();
    const queue: Array<{ uuid: string; dist: number }> = [{ uuid, dist: 0 }];
    const visited = new Set<string>();
    visited.add(uuid);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.dist >= depth) continue;

      const edges = graph[current.uuid] ?? [];
      for (const edge of edges) {
        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          const newDist = current.dist + 1;
          distances.set(edge.target, newDist);
          queue.push({ uuid: edge.target, dist: newDist });
        }
      }
    }

    return distances;
  }

  /**
   * Find shortest path between two UUIDs using BFS.
   * Returns the path as an array of UUIDs, or empty array if no path exists.
   */
  findPath(
    graph: RelationGraph,
    from: string,
    to: string,
    maxDepth: number = 5
  ): string[] {
    if (from === to) return [from];

    const queue: Array<{ uuid: string; path: string[] }> = [{ uuid: from, path: [from] }];
    const visited = new Set<string>();
    visited.add(from);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.path.length > maxDepth) continue;

      const edges = graph[current.uuid] ?? [];
      for (const edge of edges) {
        if (edge.target === to) {
          return [...current.path, to];
        }
        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          queue.push({ uuid: edge.target, path: [...current.path, edge.target] });
        }
      }
    }

    return []; // No path found
  }

  /**
   * Remove all edges involving a UUID (both as source and target).
   */
  removeNode(graph: RelationGraph, uuid: string): void {
    // Remove outgoing edges
    delete graph[uuid];

    // Remove incoming edges
    for (const sourceUuid of Object.keys(graph)) {
      const edges = graph[sourceUuid];
      if (!edges) continue;
      const filtered = edges.filter(e => e.target !== uuid);
      if (filtered.length === 0) {
        delete graph[sourceUuid];
      } else {
        graph[sourceUuid] = filtered;
      }
    }
  }
}
