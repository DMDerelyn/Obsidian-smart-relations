import { App, Notice, PluginSettingTab, Setting, Plugin, TFile } from 'obsidian';
import { IndexManager } from './indexer/IndexManager';
import { CombinedScorer } from './scoring/CombinedScorer';
import { ScoredResult } from './scoring/types';
import { CLAUDE_MD_CONTENT } from './claude-md-content';

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
  useRichRelatedFormat: boolean;
  maxTokenizationLength: number;
  enableNgramIndex: boolean;
  storePositions: boolean;
  indexBatchSize: number;
  claudeMdFolder: string;
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
  enableNgramIndex: true,
  storePositions: true,
  indexBatchSize: 50,
  claudeMdFolder: '',
};

interface SmartRelationsPluginInterface {
  settings: SmartRelationsSettings;
  manifest: { version: string; dir?: string };
  saveSettings(): Promise<void>;
  getIndexManager(): IndexManager;
  getScorer(): CombinedScorer;
}

export class SmartRelationsSettingTab extends PluginSettingTab {
  plugin: Plugin & SmartRelationsPluginInterface;
  private weightSumEl: HTMLElement | null = null;

  constructor(app: App, plugin: Plugin & SmartRelationsPluginInterface) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('sr-settings');

    this.renderAboutAndStatus(containerEl);
    this.renderClaudeIntegration(containerEl);
    this.renderIndexingSection(containerEl);
    this.renderScoringSection(containerEl);
    this.renderPerformanceSection(containerEl);
  }

  // ==================== Section 1: About & Status ====================

  private renderAboutAndStatus(containerEl: HTMLElement): void {
    const about = containerEl.createEl('div', { cls: 'sr-settings-about' });

    // Header with version
    const header = about.createEl('div', { cls: 'sr-settings-header' });
    header.createEl('h2', { text: 'Smart Relations' });
    header.createEl('span', {
      cls: 'sr-version-badge',
      text: `v${this.plugin.manifest.version}`,
    });

    about.createEl('p', {
      cls: 'sr-about-desc',
      text: 'Build local vectorization indexes for RAG-style retrieval and relation discovery. Entirely offline \u2014 no API calls, no cloud services. Scores notes using BM25, tag similarity, term overlap, and relation graph proximity.',
    });

    const links = about.createEl('div', { cls: 'sr-links' });
    const ghLink = links.createEl('a', { text: 'GitHub', href: '#' });
    ghLink.setAttribute('href', 'https://github.com/DMDerelyn/Obsidian-smart-relations');
    links.createEl('span', { text: ' \u00B7 ' });
    const docsLink = links.createEl('a', { text: 'Documentation', href: '#' });
    docsLink.setAttribute('href', 'https://github.com/DMDerelyn/Obsidian-smart-relations#readme');

    // Status panel
    this.renderStatusPanel(about);

    // Sample connections
    const sampleEl = about.createEl('div', { cls: 'sr-sample-connection' });
    sampleEl.createEl('div', { cls: 'sr-sample-title', text: 'Sample Connections' });
    sampleEl.createEl('div', { cls: 'sr-sample-loading', text: 'Loading...' });
    void this.renderSampleConnection(sampleEl);
  }

  private renderStatusPanel(container: HTMLElement): void {
    const im = this.plugin.getIndexManager();
    const panel = container.createEl('div', { cls: 'sr-status-panel' });
    const grid = panel.createEl('div', { cls: 'sr-status-grid' });

    // Index status
    const statusItem = grid.createEl('div', { cls: 'sr-stat-item' });
    statusItem.createEl('span', { cls: 'sr-stat-label', text: 'Index Status' });
    if (im.isCurrentlyIndexing()) {
      statusItem.createEl('span', { cls: 'sr-stat-value sr-status-indexing', text: 'Indexing...' });
    } else if (im.isLoaded()) {
      statusItem.createEl('span', { cls: 'sr-stat-value sr-status-ok', text: 'Indexed' });
    } else {
      statusItem.createEl('span', { cls: 'sr-stat-value sr-status-warn', text: 'Not indexed' });
    }

    // Notes count
    const corpus = im.getCorpusStats();
    this.addStatItem(grid, 'Notes', im.isLoaded() ? `${corpus.totalDocuments}` : '\u2014');
    this.addStatItem(grid, 'Unique Terms', im.isLoaded() ? `${corpus.totalTerms.toLocaleString()}` : '\u2014');
    this.addStatItem(grid, 'Avg Length', im.isLoaded() ? `${Math.round(corpus.avgDocumentLength)} words` : '\u2014');

    // Last indexed
    const lastTime = im.getLastIndexTime();
    const timeStr = lastTime ? this.formatRelativeTime(lastTime) : 'never';
    this.addStatItem(grid, 'Last Indexed', timeStr);

    // Dirty files
    if (im.isLoaded()) {
      const dirtyCount = im.getDirtyFiles().length;
      const dirtyText = dirtyCount > 0 ? `${dirtyCount} pending` : 'up to date';
      this.addStatItem(grid, 'Changes', dirtyText);
    } else {
      this.addStatItem(grid, 'Changes', '\u2014');
    }

    // Reindex button
    const actions = panel.createEl('div', { cls: 'sr-status-actions' });
    const reindexBtn = actions.createEl('button', { cls: 'mod-cta', text: 'Reindex vault' });
    reindexBtn.addEventListener('click', () => {
      new Notice('Smart Relations: Reindexing vault...');
      void im.rebuildAll((msg) => {
        reindexBtn.setText(msg);
      }).then(() => {
        new Notice('Smart Relations: Reindex complete!');
        this.display(); // Refresh the settings page
      });
    });
  }

  private addStatItem(grid: HTMLElement, label: string, value: string): void {
    const item = grid.createEl('div', { cls: 'sr-stat-item' });
    item.createEl('span', { cls: 'sr-stat-label', text: label });
    item.createEl('span', { cls: 'sr-stat-value', text: value });
  }

  private async renderSampleConnection(container: HTMLElement): Promise<void> {
    const im = this.plugin.getIndexManager();
    if (!im.isLoaded()) {
      if (container.isConnected) {
        container.empty();
        container.createEl('div', { cls: 'sr-sample-title', text: 'Sample Connections' });
        container.createEl('div', {
          cls: 'sr-sample-empty',
          text: 'No connections available \u2014 index the vault first',
        });
      }
      return;
    }

    try {
      // Find the most recently modified file with a UUID
      const files = this.app.vault.getMarkdownFiles()
        .sort((a, b) => b.stat.mtime - a.stat.mtime);

      let sourceFile: TFile | null = null;
      let sourceUuid: string | null = null;
      for (const f of files) {
        const uuid = im.getUuidForFile(f);
        if (uuid) {
          sourceFile = f;
          sourceUuid = uuid;
          break;
        }
      }

      if (!sourceFile || !sourceUuid) {
        if (container.isConnected) {
          container.empty();
          container.createEl('div', { cls: 'sr-sample-title', text: 'Sample Connections' });
          container.createEl('div', { cls: 'sr-sample-empty', text: 'No notes with UUIDs found' });
        }
        return;
      }

      const results = await this.plugin.getScorer().findRelated(
        { type: 'uuid', uuid: sourceUuid },
        3
      );

      if (!container.isConnected) return; // Settings tab was closed

      container.empty();
      container.createEl('div', { cls: 'sr-sample-title', text: 'Sample Connections' });

      if (results.length === 0) {
        container.createEl('div', { cls: 'sr-sample-empty', text: 'No connections found for recent notes' });
        return;
      }

      const sourceTitle = sourceFile.basename;
      for (const result of results) {
        const row = container.createEl('div', { cls: 'sr-sample-item' });
        row.createEl('span', { text: sourceTitle });
        row.createEl('span', { cls: 'sr-sample-arrow', text: '\u2192' });
        row.createEl('span', { text: result.title });
        row.createEl('span', {
          cls: 'sr-sample-score',
          text: result.combinedScore.toFixed(2),
        });
      }
    } catch {
      if (container.isConnected) {
        container.empty();
        container.createEl('div', { cls: 'sr-sample-title', text: 'Sample Connections' });
        container.createEl('div', { cls: 'sr-sample-empty', text: 'Could not load sample connections' });
      }
    }
  }

  // ==================== Section 2: Claude Code Integration ====================

  private renderClaudeIntegration(containerEl: HTMLElement): void {
    const content = this.createCollapsibleSection(containerEl, 'Claude Code Integration');

    const desc = content.createEl('p', { cls: 'sr-section-desc' });
    desc.setText(
      'CLAUDE.md is a special file that tells Claude Code how to use your vault\'s indexes for RAG-style queries. ' +
      'When placed in your vault, Claude Code automatically discovers it and can efficiently search your notes ' +
      'using the pre-built indexes instead of scanning every file.'
    );

    // Folder path setting
    new Setting(content)
      .setName('Deploy CLAUDE.md to folder')
      .setDesc('Choose a vault folder where CLAUDE.md will be placed. Leave empty to skip deployment.')
      .addText(text => text
        .setPlaceholder('e.g., Library/Knowledge')
        .setValue(this.plugin.settings.claudeMdFolder)
        .onChange(async (value) => {
          this.plugin.settings.claudeMdFolder = value.trim();
          await this.plugin.saveSettings();
          this.updateDeployStatus(statusEl);
        }));

    // Deploy status
    const statusEl = content.createEl('div', { cls: 'sr-deploy-status' });
    this.updateDeployStatus(statusEl);

    // Action buttons
    const actions = content.createEl('div', { cls: 'sr-deploy-actions' });

    const deployBtn = actions.createEl('button', { cls: 'mod-cta', text: 'Deploy / Update' });
    deployBtn.addEventListener('click', async () => {
      const folder = this.plugin.settings.claudeMdFolder.trim();
      if (!folder) {
        new Notice('Set a folder path first');
        return;
      }
      try {
        const folderExists = await this.app.vault.adapter.exists(folder);
        if (!folderExists) {
          await this.app.vault.adapter.mkdir(folder);
        }
        const targetPath = `${folder}/CLAUDE.md`;
        await this.app.vault.adapter.write(targetPath, CLAUDE_MD_CONTENT);
        new Notice(`CLAUDE.md deployed to ${targetPath}`);
        this.updateDeployStatus(statusEl);
      } catch (e) {
        new Notice('Failed to deploy CLAUDE.md \u2014 check the folder path');
        console.error('Smart Relations: CLAUDE.md deploy failed:', e);
      }
    });

    const removeBtn = actions.createEl('button', { text: 'Remove' });
    removeBtn.addEventListener('click', async () => {
      const folder = this.plugin.settings.claudeMdFolder.trim();
      if (!folder) return;
      const targetPath = `${folder}/CLAUDE.md`;
      try {
        const exists = await this.app.vault.adapter.exists(targetPath);
        if (exists) {
          await this.app.vault.adapter.remove(targetPath);
          new Notice('CLAUDE.md removed');
        } else {
          new Notice('CLAUDE.md not found at that location');
        }
        this.updateDeployStatus(statusEl);
      } catch (e) {
        new Notice('Failed to remove CLAUDE.md');
        console.error('Smart Relations: CLAUDE.md remove failed:', e);
      }
    });
  }

  private updateDeployStatus(statusEl: HTMLElement): void {
    const folder = this.plugin.settings.claudeMdFolder.trim();
    statusEl.empty();
    if (!folder) {
      statusEl.setText('Not deployed');
      statusEl.removeClass('is-deployed');
    } else {
      void this.app.vault.adapter.exists(`${folder}/CLAUDE.md`).then(exists => {
        if (!statusEl.isConnected) return;
        statusEl.empty();
        if (exists) {
          statusEl.addClass('is-deployed');
          statusEl.setText(`Deployed to ${folder}/CLAUDE.md`);
        } else {
          statusEl.removeClass('is-deployed');
          statusEl.setText(`Not yet deployed (folder: ${folder})`);
        }
      });
    }
  }

  // ==================== Section 3: Indexing ====================

  private renderIndexingSection(containerEl: HTMLElement): void {
    const content = this.createCollapsibleSection(containerEl, 'Indexing', true);

    new Setting(content)
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

    new Setting(content)
      .setName('Rich related format')
      .setDesc('Use object format {uuid, rel, auto} instead of simple UUID strings when writing to the related field')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useRichRelatedFormat)
        .onChange(async (value) => {
          this.plugin.settings.useRichRelatedFormat = value;
          await this.plugin.saveSettings();
        }));

    new Setting(content)
      .setName('Max tokenization length')
      .setDesc('Maximum characters to process per note. Very long notes are truncated during indexing.')
      .addSlider(slider => slider
        .setLimits(10000, 100000, 5000)
        .setValue(this.plugin.settings.maxTokenizationLength)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.maxTokenizationLength = value;
          await this.plugin.saveSettings();
        }));
  }

  // ==================== Section 4: Scoring ====================

  private renderScoringSection(containerEl: HTMLElement): void {
    const content = this.createCollapsibleSection(containerEl, 'Scoring');

    const descRow = content.createEl('div', { cls: 'sr-scoring-desc' });
    descRow.createEl('span', {
      text: 'Adjust how each scoring signal contributes to the final similarity score. ',
    });
    this.weightSumEl = descRow.createEl('span', { cls: 'sr-weight-sum' });
    this.updateWeightSum();

    const weightKeys: Array<{ key: keyof ScoringWeights; name: string; desc: string }> = [
      { key: 'bm25', name: 'BM25 weight', desc: 'Text relevance based on term frequency and document length' },
      { key: 'jaccard', name: 'Jaccard (tag) weight', desc: 'Similarity based on shared tags between notes' },
      { key: 'termOverlap', name: 'Term overlap weight', desc: 'Shared vocabulary between documents (ignores frequency)' },
      { key: 'graphProximity', name: 'Graph proximity weight', desc: 'Closeness in the relation graph (related: field connections)' },
    ];

    for (const { key, name, desc } of weightKeys) {
      new Setting(content)
        .setName(name)
        .setDesc(desc)
        .addSlider(slider => slider
          .setLimits(0, 1, 0.05)
          .setValue(this.plugin.settings.scoringWeights[key])
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.scoringWeights[key] = value;
            this.updateWeightSum();
            await this.plugin.saveSettings();
          }));
    }

    new Setting(content)
      .setName('Minimum similarity threshold')
      .setDesc('Results below this combined score will be filtered out')
      .addSlider(slider => slider
        .setLimits(0, 1, 0.05)
        .setValue(this.plugin.settings.minSimilarityThreshold)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.minSimilarityThreshold = value;
          await this.plugin.saveSettings();
        }));

    new Setting(content)
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

    new Setting(content)
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

  private updateWeightSum(): void {
    if (!this.weightSumEl) return;
    const w = this.plugin.settings.scoringWeights;
    const sum = w.bm25 + w.jaccard + w.termOverlap + w.graphProximity;
    const sumText = `Sum: ${sum.toFixed(2)}`;

    this.weightSumEl.setText(sumText);
    this.weightSumEl.removeClass('is-balanced', 'is-close', 'is-off');
    if (Math.abs(sum - 1.0) < 0.001) {
      this.weightSumEl.addClass('is-balanced');
    } else if (Math.abs(sum - 1.0) < 0.1) {
      this.weightSumEl.addClass('is-close');
    } else {
      this.weightSumEl.addClass('is-off');
    }
  }

  // ==================== Section 5: Performance ====================

  private renderPerformanceSection(containerEl: HTMLElement): void {
    const content = this.createCollapsibleSection(containerEl, 'Performance & Memory');

    content.createEl('p', {
      cls: 'sr-section-desc',
      text: 'These settings control memory usage and UI responsiveness. Disabling optional indexes saves memory on mobile devices.',
    });

    new Setting(content)
      .setName('Enable n-gram index')
      .setDesc('Character n-gram index for fuzzy matching. Not used in scoring \u2014 disable to save 15-25 MB of memory.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableNgramIndex)
        .onChange(async (value) => {
          this.plugin.settings.enableNgramIndex = value;
          await this.plugin.saveSettings();
        }));

    new Setting(content)
      .setName('Store term positions')
      .setDesc('Store character positions for each term occurrence. Not needed for scoring \u2014 disable to save 50-60% of term index memory.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.storePositions)
        .onChange(async (value) => {
          this.plugin.settings.storePositions = value;
          await this.plugin.saveSettings();
        }));

    new Setting(content)
      .setName('Index batch size')
      .setDesc('Files processed per batch during reindex. Lower values reduce UI freezing on mobile (10-100).')
      .addSlider(slider => slider
        .setLimits(10, 100, 10)
        .setValue(this.plugin.settings.indexBatchSize)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.indexBatchSize = value;
          await this.plugin.saveSettings();
        }));
  }

  // ==================== Helpers ====================

  private createCollapsibleSection(
    containerEl: HTMLElement,
    title: string,
    defaultOpen = false
  ): HTMLElement {
    const details = containerEl.createEl('details', { cls: 'sr-settings-section' });
    if (defaultOpen) details.setAttribute('open', '');
    details.createEl('summary', { text: title });
    return details.createEl('div', { cls: 'sr-settings-section-content' });
  }

  private formatRelativeTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }
}
