import { Plugin } from 'obsidian';

export class IndexCache {
  private basePath: string;

  constructor(private plugin: Plugin) {
    // Store indexes in the plugin's data directory.
    // Obsidian's config folder is not always `.obsidian` — fall back via Vault#configDir.
    this.basePath = plugin.manifest.dir
      ?? `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}`;
  }

  /**
   * Load an index from a JSON file in the plugin data directory.
   * Returns null if file doesn't exist or parsing fails.
   */
  async loadIndex<T>(filename: string): Promise<T | null> {
    const path = `${this.basePath}/${filename}`;
    try {
      const exists = await this.plugin.app.vault.adapter.exists(path);
      if (!exists) return null;
      const raw = await this.plugin.app.vault.adapter.read(path);
      return JSON.parse(raw) as T;
    } catch (e) {
      console.warn(`Smart Relations: Failed to load index ${filename}:`, e);
      return null;
    }
  }

  /**
   * Save an index as a JSON file in the plugin data directory.
   * Creates the directory if it doesn't exist.
   */
  async saveIndex<T>(filename: string, data: T): Promise<void> {
    const path = `${this.basePath}/${filename}`;
    try {
      // Ensure directory exists
      const dirExists = await this.plugin.app.vault.adapter.exists(this.basePath);
      if (!dirExists) {
        await this.plugin.app.vault.adapter.mkdir(this.basePath);
      }
      const json = JSON.stringify(data);
      await this.plugin.app.vault.adapter.write(path, json);
    } catch (e) {
      console.error(`Smart Relations: Failed to save index ${filename}:`, e);
    }
  }

  /**
   * Check if an index file exists.
   */
  async exists(filename: string): Promise<boolean> {
    const path = `${this.basePath}/${filename}`;
    return this.plugin.app.vault.adapter.exists(path);
  }
}
