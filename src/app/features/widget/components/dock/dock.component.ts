import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DockTab {
  id: 'notes' | 'tasks' | 'activity' | 'settings';
  label: string;
}

export type DockSize = 'compact' | 'normal' | 'large';
export type DockOrientation = 'vertical' | 'horizontal';

@Component({
  selector: 'app-dock',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="titlebar-drag-region flex items-center rounded-2xl border border-neutral-800 bg-neutral-950/90 shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out select-none"
      [ngClass]="{
        'flex-col': orientation === 'vertical',
        'flex-row': orientation === 'horizontal',
        'space-y-2': orientation === 'vertical' && size === 'compact',
        'space-y-2.5': orientation === 'vertical' && size === 'normal',
        'space-y-3': orientation === 'vertical' && size === 'large',
        'space-x-2': orientation === 'horizontal' && size === 'compact',
        'space-x-2.5': orientation === 'horizontal' && size === 'normal',
        'space-x-3': orientation === 'horizontal' && size === 'large',
        'p-1.5': size === 'compact',
        'p-2': size === 'normal',
        'p-2.5': size === 'large',
        'opacity-20': faded,
        'opacity-100': !faded
      }"
    >
      <button
        *ngFor="let tab of tabs"
        (click)="onTabClick(tab)"
        type="button"
        [title]="tab.label"
        [ngClass]="{
          'bg-white text-black hover:text-black': activeTabId === tab.id && isPanelExpanded,
          'text-neutral-400 hover:text-white': activeTabId !== tab.id || !isPanelExpanded,
          'h-7 w-7': size === 'compact',
          'h-9 w-9': size === 'normal',
          'h-11 w-11': size === 'large'
        }"
        class="no-drag group relative flex items-center justify-center rounded-xl border border-transparent transition-all duration-200 ease-out hover:border-neutral-700"
      >
        <!-- 1. Lucide FileText (Note) -->
        <svg
          *ngIf="tab.id === 'notes'"
          xmlns="http://www.w3.org/2000/svg"
          [attr.width]="iconSize"
          [attr.height]="iconSize"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-file-text"
        >
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="M10 9H8" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
        </svg>

        <!-- 2. Lucide CheckSquare (Task) -->
        <svg
          *ngIf="tab.id === 'tasks'"
          xmlns="http://www.w3.org/2000/svg"
          [attr.width]="iconSize"
          [attr.height]="iconSize"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-check-square"
        >
          <path d="m9 11 3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>

        <!-- 3. Lucide History (Activity) -->
        <svg
          *ngIf="tab.id === 'activity'"
          xmlns="http://www.w3.org/2000/svg"
          [attr.width]="iconSize"
          [attr.height]="iconSize"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-history"
        >
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7v5l4 2" />
        </svg>

        <!-- 4. Lucide Settings (Settings) -->
        <svg
          *ngIf="tab.id === 'settings'"
          xmlns="http://www.w3.org/2000/svg"
          [attr.width]="iconSize"
          [attr.height]="iconSize"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-settings"
        >
          <path
            d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
          />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </div>
  `,
})
export class DockComponent {
  @Input() tabs: DockTab[] = [];
  @Input() activeTabId: string = 'notes';
  @Input() isPanelExpanded: boolean = false;
  @Input() size: DockSize = 'normal';
  @Input() orientation: DockOrientation = 'vertical';
  @Input() faded: boolean = false;

  @Output() tabSelect = new EventEmitter<DockTab>();

  public get iconSize(): number {
    return this.size === 'compact' ? 12 : this.size === 'large' ? 20 : 16;
  }

  public onTabClick(tab: DockTab): void {
    this.tabSelect.emit(tab);
  }
}
