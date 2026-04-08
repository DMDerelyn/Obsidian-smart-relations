import { App, PluginSettingTab, Setting, Plugin } from 'obsidian';

export interface ScoringWeights {
  bm25: number;
  jaccard: number;
  termOverlap: number;
  graphProximity: number;
}

export interface SmartRelationsSettings {
  excludedFolders: string[];
  scoringWeights: ScoringWeights;
  minSimilarityThreshold: number;
  maxRelatedNotes: number;
  ngramSize: number;
  useRichRelatedFormat: boolean;  // true = object format {uuid, rel, auto}, false = simple UUID strings
  maxTokenizationLength: number;  // cap for very long notes
}

export const DEFAULT_SETTINGS: SmartRelationsSettings = {
  excludedFolders: [],
  scoringWeights: {
    bm25: 0.4,
    jaccard: 0.2,
    termOverlap: 0.2,
    graphProximity: 0.2,
  },
  minSimilarityThreshold: 0.1,
  maxRelatedNotes: 20,
  ngramSize: 3,
  useRichRelatedFormat: true,
  maxTokenizationLength: 50000,
};

export class SmartRelationsSettingTab extends PluginSettingTab {
  plugin: Plugin & { settings: SmartRelationsSettings; saveSettings(): Promise<void> };

  constructor(app: App, plugin: Plugin & { settings: SmartRelationsSettings; saveSettings(): Promise<void> }) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Smart Relations Settings' });

    // Excluded Folders
    new Setting(containerEl)
      .setName('Excluded folders')
      .setDesc('Comma-separated list of folders to exclude from indexing')
      .addText(text => text
        .setPlaceholder('templates, archive')
        .setValue(this.plugin.settings.excludedFolders.join(', '))
        .onChange(async (value) => {
          this.plugin.settings.excludedFolders = value
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);
          await this.plugin.saveSettings();
        }));

    // Related format toggle
    new Setting(containerEl)
      .setName('Rich related format')
      .setDesc('Use object format {uuid, rel, auto} instead of simple UUID strings in related field')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useRichRelatedFormat)
        .onChange(async (value) => {
          this.plugin.settings.useRichRelatedFormat = value;
          await this.plugin.saveSettings();
        }));

    // Scoring Weights
    containerEl.createEl('h3', { text: 'Scoring Weights' });
    containerEl.createEl('p', { text: 'Weights should sum to 1.0', cls: 'setting-item-description' });

    const weightKeys: Array<{ key: keyof ScoringWeights; name: string }> = [
      { key: 'bm25', name: 'BM25 weight' },
      { key: 'jaccard', name: 'Jaccard (tag) weight' },
      { key: 'termOverlap', name: 'Term overlap weight' },
      { key: 'graphProximity', name: 'Graph proximity weight' },
    ];

    for (const { key, name } of weightKeys) {
      new Setting(containerEl)
        .setName(name)
        .addSlider(slider => slider
          .setLimits(0, 1, 0.05)
          .setValue(this.plugin.settings.scoringWeights[key])
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.scoringWeights[key] = value;
            await this.plugin.saveSettings();
          }));
    }

    // Similarity threshold
    new Setting(containerEl)
      .setName('Minimum similarity threshold')
      .setDesc('Results below this score will be filtered out')
      .addSlider(slider => slider
        .setLimits(0, 1, 0.05)
        .setValue(this.plugin.settings.minSimilarityThreshold)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.minSimilarityThreshold = value;
          await this.plugin.saveSettings();
        }));

    // Max related notes
    new Setting(containerEl)
      .setName('Max related notes')
      .setDesc('Maximum number of related notes to display')
      .addSlider(slider => slider
        .setLimits(5, 50, 5)
        .setValue(this.plugin.settings.maxRelatedNotes)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.maxRelatedNotes = value;
          await this.plugin.saveSettings();
        }));

    // N-gram size
    new Setting(containerEl)
      .setName('N-gram size')
      .setDesc('Character n-gram size for fuzzy matching (2-5)')
      .addSlider(slider => slider
        .setLimits(2, 5, 1)
        .setValue(this.plugin.settings.ngramSize)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.ngramSize = value;
          await this.plugin.saveSettings();
        }));
  }
}
