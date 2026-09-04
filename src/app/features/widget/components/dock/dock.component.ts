import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DockTab {
  id: 'notes' | 'tasks' | 'settings';
  label: string;
}

@Component({
  selector: 'app-dock',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="titlebar-drag-region flex flex-col items-center space-y-2.5 rounded-2xl border border-neutral-800 bg-neutral-950/90 p-2 backdrop-blur-xl shadow-2xl select-none"
    >
      <button
        *ngFor="let tab of tabs"
        (click)="onTabClick(tab)"
        type="button"
        [title]="tab.label"
        [class.bg-white]="activeTabId === tab.id && isPanelExpanded"
        [class.text-black]="activeTabId === tab.id && isPanelExpanded"
        [class.text-neutral-400]="activeTabId !== tab.id || !isPanelExpanded"
        class="no-drag group relative flex h-9 w-9 items-center justify-center rounded-xl border border-transparent transition hover:border-neutral-700 hover:text-white"
      >
        <!-- 1. Lucide FileText (Note) -->
        <svg *ngIf="tab.id === 'notes'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>

        <!-- 2. Lucide CheckSquare (Task) -->
        <svg *ngIf="tab.id === 'tasks'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-square"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>

        <!-- 3. Lucide Settings (Settings) -->
        <svg *ngIf="tab.id === 'settings'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
    </div>
  `,
})
export class DockComponent {
  @Input() tabs: DockTab[] = [];
  @Input() activeTabId: string = 'notes';
  @Input() isPanelExpanded: boolean = false;
  @Output() tabSelect = new EventEmitter<DockTab>();

  public onTabClick(tab: DockTab): void {
    this.tabSelect.emit(tab);
  }
}
