import { Plugin, WorkspaceLeaf } from 'obsidian';
import { SmartRelationsSettings, DEFAULT_SETTINGS, SmartRelationsSettingTab } from './settings';

export default class SmartRelationsPlugin extends Plugin {
  settings: SmartRelationsSettings = DEFAULT_SETTINGS;
  private statusBarEl: HTMLElement | null = null;

  async onload(): Promise<void> {
    console.log('Smart Relations: loading plugin');

    await this.loadSettings();

    // Ribbon icon
    this.addRibbonIcon('network', 'Reindex vault', async () => {
      console.log('Smart Relations: manual reindex triggered');
      // TODO: Wire to IndexManager.rebuildAll() in Phase 4
    });

    // Commands
    this.addCommand({
      id: 'reindex-vault',
      name: 'Reindex vault',
      callback: async () => {
        console.log('Smart Relations: reindex command');
        // TODO: Wire to IndexManager.rebuildAll() in Phase 4
      },
    });

    this.addCommand({
      id: 'find-related-notes',
      name: 'Find related notes',
      callback: async () => {
        console.log('Smart Relations: find related notes');
        // TODO: Wire to RelatedNotesView in Phase 6
      },
    });

    this.addCommand({
      id: 'show-relation-graph',
      name: 'Show relation graph',
      callback: async () => {
        console.log('Smart Relations: show relation graph');
        // TODO: Wire to GraphView in Phase 6
      },
    });

    this.addCommand({
      id: 'suggest-relations',
      name: 'Suggest relations for current note',
      callback: async () => {
        console.log('Smart Relations: suggest relations');
        // TODO: Wire to SuggestionModal in Phase 6
      },
    });

    // Settings tab
    this.addSettingTab(new SmartRelationsSettingTab(this.app, this));

    // Status bar
    this.statusBarEl = this.addStatusBarItem();
    this.updateStatusBar('Ready');

    console.log('Smart Relations: plugin loaded');
  }

  onunload(): void {
    console.log('Smart Relations: unloading plugin');
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  updateStatusBar(message: string): void {
    if (this.statusBarEl) {
      this.statusBarEl.setText(`SR: ${message}`);
    }
  }
}
