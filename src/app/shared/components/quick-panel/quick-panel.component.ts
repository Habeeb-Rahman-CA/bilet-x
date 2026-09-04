import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface QuickPanelItem {
  id: string;
  title: string;
  category: string;
  shortcut?: string;
  iconSvg?: string;
}

@Component({
  selector: 'app-quick-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      *ngIf="isOpen"
      class="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/80 backdrop-blur-xs select-none"
      (click)="onBackdropClick($event)"
    >
      <div
        class="w-full max-w-lg border border-neutral-800 bg-black p-4 text-neutral-100"
        (click)="$event.stopPropagation()"
      >
        <!-- Search Input Bar -->
        <div class="relative flex items-center border-b border-neutral-800 pb-3">
          <svg
            class="h-4 w-4 text-neutral-400 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            #searchInput
            [(ngModel)]="searchQuery"
            type="text"
            placeholder="Type a command or search workspace..."
            class="w-full bg-black text-xs text-white placeholder-neutral-500 focus:outline-none"
          />
          <kbd class="border border-neutral-800 bg-neutral-950 px-1.5 py-0.5 font-mono text-[9px] text-neutral-400">
            ESC
          </kbd>
        </div>

        <!-- Quick Items List -->
        <div class="mt-3 max-h-64 overflow-y-auto space-y-1">
          <div
            *ngFor="let item of filteredItems(); let idx = index"
            (click)="selectItem(item)"
            class="flex items-center justify-between border border-transparent px-3 py-2 text-xs transition cursor-pointer hover:border-neutral-800 hover:bg-neutral-900"
            [ngClass]="{ 'border-neutral-700 bg-neutral-900': selectedIndex === idx }"
          >
            <div class="flex items-center space-x-3">
              <span class="font-mono text-[10px] text-neutral-400 uppercase tracking-wider">
                [{{ item.category }}]
              </span>
              <span class="font-medium text-neutral-200">{{ item.title }}</span>
            </div>
            <span *ngIf="item.shortcut" class="border border-neutral-800 bg-black px-1.5 py-0.5 font-mono text-[9px] text-neutral-400">
              {{ item.shortcut }}
            </span>
          </div>

          <div *ngIf="filteredItems().length === 0" class="py-6 text-center text-xs text-neutral-500">
            No matching commands found.
          </div>
        </div>

        <!-- Panel Footer -->
        <div class="mt-3 flex items-center justify-between border-t border-neutral-800 pt-2 text-[10px] text-neutral-500">
          <span>Bilet-X Quick Panel</span>
          <div class="flex items-center space-x-2">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class QuickPanelComponent {
  @Input() isOpen = false;
  @Output() closePanel = new EventEmitter<void>();
  @Output() itemSelected = new EventEmitter<QuickPanelItem>();

  @ViewChild('searchInput') searchInputRef!: ElementRef<HTMLInputElement>;

  public searchQuery = '';
  public selectedIndex = 0;

  public items: QuickPanelItem[] = [
    { id: 'create_ticket', title: 'Create New Ticket / Item', category: 'Actions', shortcut: 'Ctrl+N' },
    { id: 'toggle_logs', title: 'Toggle IPC Inspector', category: 'Developer', shortcut: 'Ctrl+L' },
    { id: 'system_info', title: 'View System Diagnostics', category: 'System', shortcut: 'Ctrl+I' },
    { id: 'clear_workspace', title: 'Reset Dashboard Canvas', category: 'Workspace' },
  ];

  public ngOnChanges(): void {
    if (this.isOpen) {
      setTimeout(() => this.searchInputRef?.nativeElement?.focus(), 50);
    }
  }

  public filteredItems(): QuickPanelItem[] {
    if (!this.searchQuery.trim()) return this.items;
    const q = this.searchQuery.toLowerCase();
    return this.items.filter(
      (item) => item.title.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    );
  }

  public selectItem(item: QuickPanelItem): void {
    this.itemSelected.emit(item);
    this.closePanel.emit();
    this.searchQuery = '';
  }

  public onBackdropClick(event: MouseEvent): void {
    this.closePanel.emit();
  }

  @HostListener('window:keydown', ['$event'])
  public handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isOpen) {
      this.closePanel.emit();
    }
  }
}
