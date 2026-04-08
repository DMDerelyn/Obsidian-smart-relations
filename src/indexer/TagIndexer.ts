import { TagCooccurrence, UuidIndex } from './types';

export class TagIndexer {
  /**
   * Build the tag co-occurrence matrix from the UUID index.
   * For each document, every pair of its tags increments the co-occurrence count.
   * The matrix is symmetric: cooccurrence[A][B] === cooccurrence[B][A].
   */
  buildIndex(uuidIndex: UuidIndex): TagCooccurrence {
    const cooccurrence: TagCooccurrence = {};

    for (const entry of Object.values(uuidIndex)) {
      const tags = entry.tags;
      if (tags.length < 2) continue;

      // For each pair of tags in this document
      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) {
          const tagA = tags[i]!;
          const tagB = tags[j]!;
          this.incrementCooccurrence(cooccurrence, tagA, tagB);
          this.incrementCooccurrence(cooccurrence, tagB, tagA);
        }
      }
    }

    return cooccurrence;
  }

  /**
   * Get the set of tags for a specific UUID.
   */
  getTagsForUuid(uuid: string, uuidIndex: UuidIndex): string[] {
    const entry = uuidIndex[uuid];
    return entry ? entry.tags : [];
  }

  /**
   * Get all tags that co-occur with a given tag, sorted by count descending.
   */
  getRelatedTags(tag: string, cooccurrence: TagCooccurrence): Array<{ tag: string; count: number }> {
    const entry = cooccurrence[tag];
    if (!entry) return [];

    return Object.entries(entry)
      .map(([t, count]) => ({ tag: t, count }))
      .sort((a, b) => b.count - a.count);
  }

  private incrementCooccurrence(cooccurrence: TagCooccurrence, tagA: string, tagB: string): void {
    let tagAEntry = cooccurrence[tagA];
    if (!tagAEntry) {
      tagAEntry = {};
      cooccurrence[tagA] = tagAEntry;
    }
    tagAEntry[tagB] = (tagAEntry[tagB] ?? 0) + 1;
  }
}
