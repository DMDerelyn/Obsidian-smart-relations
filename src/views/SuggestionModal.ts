import { App, FuzzySuggestModal } from 'obsidian';
import { ScoredResult } from '../scoring/types';

export class RelationSuggestionModal extends FuzzySuggestModal<ScoredResult> {
  private results: ScoredResult[];
  private onChooseResult: (result: ScoredResult) => void;

  constructor(app: App, results: ScoredResult[], onChoose: (result: ScoredResult) => void) {
    super(app);
    this.results = results;
    this.onChooseResult = onChoose;
    this.setPlaceholder('Select a note to add as related...');
  }

  getItems(): ScoredResult[] {
    return this.results;
  }

  getItemText(item: ScoredResult): string {
    return `${item.title} (${item.combinedScore.toFixed(3)})`;
  }

  onChooseItem(item: ScoredResult, _evt: MouseEvent | KeyboardEvent): void {
    this.onChooseResult(item);
  }
}
