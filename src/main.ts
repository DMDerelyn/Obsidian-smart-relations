import { Plugin, TFile, Notice, WorkspaceLeaf, WorkspaceSidedock } from 'obsidian';
import { SmartRelationsSettings, DEFAULT_SETTINGS, SmartRelationsSettingTab } from './settings';
import { IndexManager } from './indexer/IndexManager';
import { IndexCache } from './utils/cache';
import { CombinedScorer } from './scoring/CombinedScorer';
import { RelatedNotesView, VIEW_TYPE_RELATED } from './views/RelatedNotesView';
import { RelationSuggestionModal } from './views/SuggestionModal';
import { generateUuid, isValidUuid } from './utils/uuid';

export default class SmartRelationsPlugin extends Plugin {
  settings: SmartRelationsSettings = DEFAULT_SETTINGS;
  private indexManager!: IndexManager;
  private scorer!: CombinedScorer;
  private statusBarEl: HTMLElement | null = null;
  private leafChangeTimer: number | null = null;
  private leafChangeGeneration = 0;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Initialize index infrastructure
    const cache = new IndexCache(this);
    this.indexManager = new IndexManager(this.app, this.settings, cache);
    this.scorer = new CombinedScorer(this.app, this.settings, this.indexManager);

    // Register view
    this.registerView(VIEW_TYPE_RELATED, (leaf) => {
      const view = new RelatedNotesView(leaf);
      view.setRelatedCallback(async (file: TFile) => {
        const uuid = this.indexManager.getUuidForFile(file);
        if (!uuid) return [];
        return this.scorer.findRelated({ type: 'uuid', uuid });
      });
      return view;
    });

    // Try loading indexes from disk
    const loaded = await this.indexManager.loadAllIndexes();
    if (!loaded) {
      // Schedule rebuild after layout is ready
      this.app.workspace.onLayoutReady(() => {
        void (async () => {
          new Notice('Building index for the first time...');
          await this.indexManager.rebuildAll((msg) => {
            this.updateStatusBar(msg);
          });
          this.updateStatusBarDefault();
          this.refreshRelatedPanel();
        })();
      });
    } else {
      this.updateStatusBarDefault();
    }

    // Vault event handlers for incremental updates
    this.registerEvent(this.app.vault.on('create', (file) => {
      if (file instanceof TFile && file.extension === 'md') {
        this.indexManager.handleFileChange(file, 'create');
      }
    }));

    this.registerEvent(this.app.vault.on('modify', (file) => {
      if (file instanceof TFile && file.extension === 'md') {
        this.indexManager.handleFileChange(file, 'modify');
      }
    }));

    this.registerEvent(this.app.vault.on('delete', (file) => {
      if (file instanceof TFile && file.extension === 'md') {
        this.indexManager.handleFileChange(file, 'delete');
      }
    }));

    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      if (file instanceof TFile && file.extension === 'md') {
        this.indexManager.handleFileRename(file, oldPath);
      }
    }));

    // Auto-update related panel on active file change (debounced with cancellation)
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
      this.debouncedRefreshRelatedPanel();
    }));

    // Ribbon icon
    this.addRibbonIcon('network', 'Reindex vault', () => {
      void this.reindexVault();
    });

    // Commands
    this.addCommand({
      id: 'reindex-vault',
      name: 'Reindex vault',
      callback: () => {
        void this.reindexVault();
      },
    });

    this.addCommand({
      id: 'find-related-notes',
      name: 'Find related notes',
      callback: () => {
        void this.activateRelatedPanel();
      },
    });

    this.addCommand({
      id: 'show-relation-graph',
      name: 'Show relation graph',
      callback: () => {
        new Notice('Graph view coming in a future update');
      },
    });

    this.addCommand({
      id: 'suggest-relations',
      name: 'Suggest relations for current note',
      callback: () => {
        void this.suggestRelations();
      },
    });

    this.addCommand({
      id: 'add-uuid-to-current-note',
      name: 'Add UUID to current note',
      callback: () => {
        void this.addUuidToCurrentNote();
      },
    });

    // Settings tab
    this.addSettingTab(new SmartRelationsSettingTab(this.app, this));

    // Status bar
    this.statusBarEl = this.addStatusBarItem();
    this.updateStatusBarDefault();
  }

  onunload(): void {
    if (this.leafChangeTimer !== null) {
      window.clearTimeout(this.leafChangeTimer);
    }
    this.indexManager.destroy();
  }

  getIndexManager(): IndexManager {
    return this.indexManager;
  }

  getScorer(): CombinedScorer {
    return this.scorer;
  }

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as Partial<SmartRelationsSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, stored ?? {});
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  updateStatusBar(message: string): void {
    if (this.statusBarEl) {
      this.statusBarEl.setText(`SR: ${message}`);
    }
  }

  private updateStatusBarDefault(): void {
    if (!this.indexManager.isLoaded()) {
      this.updateStatusBar('Not indexed');
      return;
    }
    const count = this.indexManager.getNoteCount();
    const lastTime = this.indexManager.getLastIndexTime();
    const timeStr = lastTime ? this.formatRelativeTime(lastTime) : 'never';
    this.updateStatusBar(`${count} notes | ${timeStr}`);
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

  private async reindexVault(): Promise<void> {
    new Notice('Reindexing vault...');
    await this.indexManager.rebuildAll((msg) => {
      this.updateStatusBar(msg);
    });
    this.updateStatusBarDefault();
    this.refreshRelatedPanel();
    new Notice('Reindex complete');
  }

  private async activateRelatedPanel(): Promise<void> {
    const workspace = this.app.workspace;
    let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_RELATED)[0] ?? null;
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE_RELATED, active: true });
      }
    }
    if (leaf) {
      workspace.setActiveLeaf(leaf, { focus: true });
      const root = leaf.getRoot();
      if (root instanceof WorkspaceSidedock) {
        root.expand();
      }
    }
    this.refreshRelatedPanel();
  }

  private debouncedRefreshRelatedPanel(): void {
    if (this.leafChangeTimer !== null) {
      window.clearTimeout(this.leafChangeTimer);
    }
    this.leafChangeGeneration++;
    const gen = this.leafChangeGeneration;
    this.leafChangeTimer = window.setTimeout(() => {
      this.leafChangeTimer = null;
      // Only proceed if no newer generation has been triggered
      if (gen === this.leafChangeGeneration) {
        this.refreshRelatedPanel();
      }
    }, 300);
  }

  private refreshRelatedPanel(): void {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_RELATED);
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof RelatedNotesView) {
        void view.updateForActiveFile();
      }
    }
  }

  private async addUuidToCurrentNote(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== 'md') {
      new Notice('No active note');
      return;
    }
    const state: { wrote: boolean; existingUuid: string | null } = {
      wrote: false,
      existingUuid: null,
    };
    try {
      await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
        const existing = typeof fm.id === 'string' ? fm.id : typeof fm.uuid === 'string' ? fm.uuid : '';
        if (existing && isValidUuid(existing)) {
          state.existingUuid = existing;
          return;
        }
        fm.id = generateUuid();
        state.wrote = true;
      });
    } catch (e) {
      new Notice('Failed to add UUID \u2014 see console');
      console.error('Smart Relations: Failed to add UUID:', e);
      return;
    }
    if (state.wrote) {
      new Notice('UUID added to current note');
    } else if (state.existingUuid !== null) {
      const existingUuid: string = state.existingUuid;
      new Notice(`Note already has a UUID (${existingUuid})`);
    }
  }

  private async suggestRelations(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('No active file');
      return;
    }
    if (!this.indexManager.isLoaded()) {
      new Notice('Index not ready; please reindex the vault first');
      return;
    }
    const uuid = this.indexManager.getUuidForFile(file);
    if (!uuid) {
      new Notice('Current note has no UUID in frontmatter');
      return;
    }

    const results = await this.scorer.findRelated({ type: 'uuid', uuid });
    if (results.length === 0) {
      new Notice('No related notes found');
      return;
    }

    new RelationSuggestionModal(this.app, results, (selected) => {
      void this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
        if (!fm['related']) {
          fm['related'] = [];
        }
        const related = fm['related'] as unknown[];
        // Check if already exists (accept both id and legacy uuid sub-keys)
        const existing = related.some((entry: unknown) => {
          if (typeof entry === 'string') return entry === selected.uuid;
          if (typeof entry === 'object' && entry !== null) {
            const obj = entry as Record<string, unknown>;
            const entryId = typeof obj.id === 'string' ? obj.id : typeof obj.uuid === 'string' ? obj.uuid : '';
            return entryId === selected.uuid;
          }
          return false;
        });
        if (existing) {
          new Notice(`"${selected.title}" is already in related`);
          return;
        }
        if (this.settings.useRichRelatedFormat) {
          related.push({ id: selected.uuid, rel: 'related', auto: true });
        } else {
          related.push(selected.uuid);
        }
        new Notice(`Added "${selected.title}" to related`);
      });
    }).open();
  }
}
