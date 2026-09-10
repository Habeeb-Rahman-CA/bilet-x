import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClipboardItem, ClipboardService } from './clipboard.service';

@Component({
  selector: 'app-clipboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex h-full flex-col space-y-2">
      <!-- Header row: capture status + search + actions -->
      <div class="flex shrink-0 items-center space-x-1.5">
        <button
          type="button"
          (click)="clipboard.toggleCapturing()"
          [title]="clipboard.isCapturing() ? 'Pause capture' : 'Resume capture'"
          class="flex h-7 items-center space-x-1.5 rounded-lg border border-transparent bg-neutral-800 px-2 font-mono text-[9px] font-semibold tracking-wider uppercase transition-all duration-200 ease-out hover:border-neutral-600 hover:text-white"
          [ngClass]="{
            'text-emerald-400': clipboard.isCapturing(),
            'text-neutral-500': !clipboard.isCapturing()
          }"
        >
          <span
            class="h-1.5 w-1.5 rounded-full"
            [ngClass]="{
              'animate-pulse bg-emerald-400': clipboard.isCapturing(),
              'bg-neutral-600': !clipboard.isCapturing()
            }"
          ></span>
          <span>{{ clipboard.isCapturing() ? 'Live' : 'Paused' }}</span>
        </button>

        <input
          type="text"
          [(ngModel)]="searchQuery"
          placeholder="Search"
          class="h-7 min-w-0 flex-1 rounded-lg border border-neutral-800 bg-neutral-900/90 px-2.5 font-sans text-[11px] text-neutral-100 placeholder-neutral-500 selection:bg-neutral-700 selection:text-white focus:border-neutral-600 focus:outline-none"
        />

        <button
          *ngIf="clipboard.history().length > 0"
          type="button"
          (click)="handleClearAll()"
          [title]="clearArmed() ? 'Confirm clear' : 'Clear all entries'"
          class="flex h-7 items-center rounded-lg border border-transparent px-2 font-mono text-[9px] font-semibold tracking-wider uppercase transition-all duration-200 ease-out"
          [ngClass]="{
            'bg-red-500 text-white hover:border-red-400': clearArmed(),
            'bg-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-white':
              !clearArmed()
          }"
        >
          {{ clearArmed() ? 'Confirm?' : 'Clear' }}
        </button>
      </div>

      <!-- List -->
      <div
        *ngIf="filteredHistory().length > 0; else emptyState"
        class="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1"
      >
        <div
          *ngFor="let item of filteredHistory(); trackBy: trackById"
          class="group relative rounded-lg border border-neutral-800 bg-neutral-900/70 transition hover:border-neutral-600"
        >
          <button
            type="button"
            (click)="clipboard.copyToClipboard(item)"
            [title]="'Copy to clipboard \\u2014 ' + item.content"
            class="block w-full cursor-pointer p-2.5 text-left"
          >
            <div
              class="line-clamp-2 font-sans text-[11px] leading-snug break-all text-neutral-100"
            >
              {{ item.content }}
            </div>
            <div
              class="mt-1 flex items-center justify-between font-mono text-[9px] tracking-wider text-neutral-500 uppercase"
            >
              <span>{{ relativeTime(item.created_at) }}</span>
              <span *ngIf="clipboard.lastCopiedId() === item.id" class="text-emerald-400">
                Copied
              </span>
              <span
                *ngIf="clipboard.lastCopiedId() !== item.id"
                class="text-neutral-600"
              >
                {{ contentMeta(item.content) }}
              </span>
            </div>
          </button>
          <button
            type="button"
            (click)="clipboard.deleteEntry(item.id); $event.stopPropagation()"
            title="Delete entry"
            class="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-md border border-transparent bg-neutral-800/80 text-neutral-500 opacity-0 transition group-hover:opacity-100 hover:border-neutral-600 hover:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>

      <ng-template #emptyState>
        <div class="flex min-h-0 flex-1 items-center justify-center">
          <div class="space-y-1 text-center">
            <div
              class="font-mono text-[10px] font-semibold tracking-wider text-neutral-500 uppercase"
            >
              {{ emptyHeadline() }}
            </div>
            <div class="font-mono text-[9px] text-neutral-600">
              {{ emptyBody() }}
            </div>
          </div>
        </div>
      </ng-template>

      <!-- Footer -->
      <div
        class="flex shrink-0 items-baseline justify-between border-t border-neutral-800/80 pt-2 font-mono text-[9px] tracking-wider text-neutral-500 uppercase"
      >
        <span>
          {{ clipboard.history().length }}
          {{ clipboard.history().length === 1 ? 'entry' : 'entries' }}
        </span>
        <span class="text-neutral-600">Stored locally</span>
      </div>
    </div>
  `,
})
export class ClipboardComponent {
  public searchQuery = '';
  public readonly clearArmed = signal<boolean>(false);
  private clearTimer: number | undefined;

  public readonly filteredHistory = computed<ClipboardItem[]>(() => {
    const q = this.searchQuery.trim().toLowerCase();
    const items = this.clipboard.history();
    if (!q) return items;
    return items.filter((i) => i.content.toLowerCase().includes(q));
  });

  public readonly emptyHeadline = computed(() =>
    this.searchQuery.trim() ? 'No matches' : 'Clipboard is empty'
  );

  public readonly emptyBody = computed(() => {
    if (this.searchQuery.trim()) return 'Try a different search term';
    return this.clipboard.isCapturing()
      ? 'Copy something to see it here'
      : 'Capture is paused';
  });

  constructor(public clipboard: ClipboardService) {}

  public handleClearAll(): void {
    if (this.clearArmed()) {
      void this.clipboard.clearAll();
      this.clearArmed.set(false);
      return;
    }
    this.clearArmed.set(true);
    if (this.clearTimer) window.clearTimeout(this.clearTimer);
    this.clearTimer = window.setTimeout(() => this.clearArmed.set(false), 2500);
  }

  public trackById(_: number, item: ClipboardItem): string {
    return item.id;
  }

  public relativeTime(iso: string): string {
    // The DB stamps timestamps with SQLite's `datetime('now')` which returns
    // UTC without a trailing Z — normalize it so Date parses in UTC not local.
    const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z';
    const then = new Date(normalized).getTime();
    if (!Number.isFinite(then)) return '';
    const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (sec < 60) return 'Just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    return `${days}d ago`;
  }

  public contentMeta(content: string): string {
    const chars = content.length;
    const lines = content.split('\n').length;
    if (lines > 1) return `${chars} chars · ${lines} lines`;
    return `${chars} chars`;
  }
}
