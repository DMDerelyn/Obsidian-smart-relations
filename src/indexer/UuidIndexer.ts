import { App, TFile, CachedMetadata } from 'obsidian';
import { parseFrontmatter, extractTags } from '../utils/frontmatter';
import { isValidUuid } from '../utils/uuid';
import { UuidIndex, UuidEntry } from './types';

export class UuidIndexer {
  constructor(private app: App) {}

  /**
   * Build a complete UUID index from all markdown files.
   * Skips files without valid UUIDs. Warns on duplicates.
   * @param excludedFolders - folder paths to skip
   */
  async buildIndex(excludedFolders: string[] = []): Promise<{ index: UuidIndex; warnings: string[] }> {
    const index: UuidIndex = {};
    const warnings: string[] = [];
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      // Skip excluded folders
      if (this.isExcluded(file, excludedFolders)) continue;

      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache) continue;

      const result = this.indexSingleFile(file, cache);
      if (!result) {
        warnings.push(`No valid UUID in: ${file.path}`);
        continue;
      }

      const { uuid, entry } = result;

      // Check for duplicate UUID
      if (index[uuid]) {
        warnings.push(
          `Duplicate UUID ${uuid} found in "${file.path}" and "${index[uuid].path}". Keeping first occurrence.`
        );
        continue;
      }

      index[uuid] = entry;
    }

    return { index, warnings };
  }

  /**
   * Index a single file. Returns null if no valid UUID.
   */
  indexSingleFile(file: TFile, cache: CachedMetadata): { uuid: string; entry: UuidEntry } | null {
    const fm = parseFrontmatter(cache);
    if (!fm) return null;

    const tags = extractTags(cache);

    // Extract title: first heading, or filename without .md
    let title = file.basename;
    const firstHeading = cache.headings?.[0];
    if (firstHeading) {
      title = firstHeading.heading;
    }

    const entry: UuidEntry = {
      path: file.path,
      title,
      type: fm.type,
      tags,
      relationCount: fm.related.length,
      lastModified: file.stat.mtime,
    };

    return { uuid: fm.uuid, entry };
  }

  /**
   * Remove a UUID from the index.
   */
  removeFile(index: UuidIndex, uuid: string): void {
    delete index[uuid];
  }

  /**
   * Update a UUID entry in the index.
   */
  updateFile(index: UuidIndex, uuid: string, entry: UuidEntry): void {
    index[uuid] = entry;
  }

  private isExcluded(file: TFile, excludedFolders: string[]): boolean {
    return excludedFolders.some(folder => {
      const normalized = folder.endsWith('/') ? folder : folder + '/';
      return file.path.startsWith(normalized);
    });
  }
}
