import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import { ScoredResult } from '../scoring/types';

export const VIEW_TYPE_RELATED = 'smart-relations-related';

export class RelatedNotesView extends ItemView {
  private results: ScoredResult[] = [];
  private getRelatedForFile: ((file: TFile) => Promise<ScoredResult[]>) | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE_RELATED; }
  getDisplayText(): string { return 'Related Notes'; }
  getIcon(): string { return 'network'; }

  /**
   * Set the callback function that retrieves related notes.
   * Called by the plugin after view creation.
   */
  setRelatedCallback(fn: (file: TFile) => Promise<ScoredResult[]>): void {
    this.getRelatedForFile = fn;
  }

  async onOpen(): Promise<void> {
    this.renderEmptyState('Open a note to see related notes');
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  /**
   * Update the panel for the currently active file.
   */
  async updateForActiveFile(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== 'md') {
      this.renderEmptyState('Open a markdown note to see related notes');
      return;
    }

    if (!this.getRelatedForFile) {
      this.renderEmptyState('Index not ready \u2014 run "Reindex vault" first');
      return;
    }

    // Show loading state
    this.contentEl.empty();
    const loading = this.contentEl.createEl('div', { cls: 'sr-loading' });
    loading.setText('Finding related notes...');

    try {
      this.results = await this.getRelatedForFile(file);
      this.renderResults();
    } catch (e) {
      console.error('Smart Relations: Error finding related notes:', e);
      this.renderEmptyState('Error finding related notes');
    }
  }

  private renderResults(): void {
    this.contentEl.empty();

    const container = this.contentEl.createEl('div', { cls: 'smart-relations-container' });

    // Header
    const header = container.createEl('div', { cls: 'sr-header' });
    header.createEl('h4', { text: 'Related Notes' });
    const refreshBtn = header.createEl('button', { cls: 'sr-refresh-btn', attr: { 'aria-label': 'Refresh' } });
    refreshBtn.setText('\u21BB');
    this.registerDomEvent(refreshBtn, 'click', () => { void this.updateForActiveFile(); });

    if (this.results.length === 0) {
      container.createEl('div', { cls: 'sr-empty-state', text: 'No related notes found' });
      return;
    }

    // Results list
    const list = container.createEl('div', { cls: 'sr-results-list' });

    for (const result of this.results) {
      const item = list.createEl('div', { cls: 'sr-result-item' });

      // Title (clickable)
      const titleRow = item.createEl('div', { cls: 'sr-result-title-row' });
      const titleEl = titleRow.createEl('a', {
        cls: 'sr-result-title',
        text: result.title,
      });
      this.registerDomEvent(titleEl, 'click', (e) => {
        e.preventDefault();
        void this.app.workspace.openLinkText(result.path, '');
      });

      // Score badge
      const scoreClass = result.combinedScore >= 0.7 ? 'sr-score-high'
        : result.combinedScore >= 0.4 ? 'sr-score-mid'
        : 'sr-score-low';
      titleRow.createEl('span', {
        cls: `sr-result-score ${scoreClass}`,
        text: result.combinedScore.toFixed(2),
      });

      // Score breakdown (collapsible)
      const details = item.createEl('details', { cls: 'sr-result-breakdown' });
      details.createEl('summary', { text: 'Score breakdown' });
      const breakdownList = details.createEl('div', { cls: 'sr-breakdown-list' });

      const scoreLabels: Array<{ key: keyof typeof result.scores; label: string }> = [
        { key: 'bm25', label: 'BM25' },
        { key: 'jaccard', label: 'Tag similarity' },
        { key: 'termOverlap', label: 'Term overlap' },
        { key: 'graphProximity', label: 'Graph proximity' },
      ];

      for (const { key, label } of scoreLabels) {
        const row = breakdownList.createEl('div', { cls: 'sr-score-row' });
        row.createEl('span', { cls: 'sr-score-label', text: label });
        row.createEl('span', { cls: 'sr-score-value', text: result.scores[key].toFixed(3) });
      }
    }
  }

  private renderEmptyState(message: string): void {
    this.contentEl.empty();
    const container = this.contentEl.createEl('div', { cls: 'smart-relations-container' });
    container.createEl('div', { cls: 'sr-empty-state', text: message });
  }
}
