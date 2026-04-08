import { CachedMetadata, FrontMatterCache } from 'obsidian';
import { isValidUuid } from './uuid';

export interface RelatedEntry {
  uuid: string;
  rel: string;
  auto: boolean;
}

export interface NoteFrontmatter {
  uuid: string;
  type: string;
  status: string;
  created: string;
  modified: string;
  tags: string[];
  related: RelatedEntry[];
  summary: string;
}

/**
 * Parse frontmatter from Obsidian's CachedMetadata.
 * Returns null if no valid UUID is present.
 */
export function parseFrontmatter(cache: CachedMetadata): NoteFrontmatter | null {
  const fm = cache.frontmatter;
  if (!fm) return null;

  const uuid = fm.uuid;
  if (!uuid || typeof uuid !== 'string' || !isValidUuid(uuid)) {
    return null;
  }

  return {
    uuid: uuid.toLowerCase(),
    type: typeof fm.type === 'string' ? fm.type : 'note',
    status: typeof fm.status === 'string' ? fm.status : 'raw',
    created: typeof fm.created === 'string' ? fm.created : '',
    modified: typeof fm.modified === 'string' ? fm.modified : '',
    tags: extractFrontmatterTags(fm),
    related: parseRelatedField(fm.related),
    summary: typeof fm.summary === 'string' ? fm.summary : '',
  };
}

/**
 * Extract tags from frontmatter and inline tags in the cache.
 * Deduplicates and normalizes to lowercase, strips leading #.
 */
export function extractTags(cache: CachedMetadata): string[] {
  const tagSet = new Set<string>();

  // Tags from frontmatter YAML
  const fm = cache.frontmatter;
  if (fm && Array.isArray(fm.tags)) {
    for (const tag of fm.tags) {
      if (typeof tag === 'string') {
        tagSet.add(normalizeTag(tag));
      }
    }
  }

  // Tags from inline #tags in body
  if (cache.tags) {
    for (const tagRef of cache.tags) {
      tagSet.add(normalizeTag(tagRef.tag));
    }
  }

  return Array.from(tagSet);
}

function normalizeTag(tag: string): string {
  return tag.replace(/^#/, '').toLowerCase().trim();
}

function extractFrontmatterTags(fm: FrontMatterCache): string[] {
  if (!fm.tags) return [];
  if (Array.isArray(fm.tags)) {
    return fm.tags
      .filter((t): t is string => typeof t === 'string')
      .map(t => normalizeTag(t));
  }
  if (typeof fm.tags === 'string') {
    return [normalizeTag(fm.tags)];
  }
  return [];
}

/**
 * Parse the `related` field which can be:
 * - Simple format: string[] of UUIDs
 * - Rich format: Array<{uuid: string, rel: string, auto: boolean}>
 * - Empty/missing: returns []
 */
function parseRelatedField(related: unknown): RelatedEntry[] {
  if (!related || !Array.isArray(related)) return [];

  return related
    .map((entry): RelatedEntry | null => {
      // Simple format: just a UUID string
      if (typeof entry === 'string') {
        if (isValidUuid(entry)) {
          return { uuid: entry.toLowerCase(), rel: 'related', auto: false };
        }
        return null;
      }
      // Rich format: object with uuid, rel, auto
      if (typeof entry === 'object' && entry !== null) {
        const obj = entry as Record<string, unknown>;
        const uuid = typeof obj.uuid === 'string' ? obj.uuid : '';
        if (!isValidUuid(uuid)) return null;
        return {
          uuid: uuid.toLowerCase(),
          rel: typeof obj.rel === 'string' ? obj.rel : 'related',
          auto: typeof obj.auto === 'boolean' ? obj.auto : false,
        };
      }
      return null;
    })
    .filter((e): e is RelatedEntry => e !== null);
}
