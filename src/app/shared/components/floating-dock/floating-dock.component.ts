import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-floating-dock',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="fixed bottom-10 left-1/2 z-40 flex -translate-x-1/2 items-center space-x-2 border border-neutral-800 bg-black px-3 py-2 text-xs select-none"
    >
      <!-- Edge Dock Brand Icon -->
      <div class="flex items-center space-x-2 border-r border-neutral-800 pr-3">
        <span class="h-2 w-2 rounded-full bg-white"></span>
        <span class="font-mono text-[11px] font-bold tracking-wider text-white uppercase"
          >BILET-X</span
        >
      </div>

      <!-- Quick Panel Trigger Button -->
      <button
        (click)="toggleQuickPanel.emit()"
        type="button"
        class="flex items-center space-x-2 border border-neutral-800 bg-neutral-950 px-3 py-1.5 font-medium text-neutral-200 transition hover:bg-neutral-800 hover:text-white"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-3.5 w-3.5 text-neutral-400"
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
        <span>Quick Panel</span>
        <kbd
          class="border border-neutral-700 bg-black px-1.5 py-0.5 font-mono text-[9px] text-neutral-400"
        >
          Ctrl+K
        </kbd>
      </button>

      <!-- Quick Action Shortcuts -->
      <div class="flex items-center space-x-1 pl-1">
        <button
          (click)="onQuickAction.emit('new_task')"
          type="button"
          title="New Task"
          class="flex h-7 w-7 items-center justify-center border border-neutral-800 bg-black text-neutral-400 hover:border-neutral-600 hover:text-white"
        >
          <svg
            class="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>

        <button
          (click)="onQuickAction.emit('toggle_logs')"
          type="button"
          title="Toggle Monitor"
          class="flex h-7 w-7 items-center justify-center border border-neutral-800 bg-black text-neutral-400 hover:border-neutral-600 hover:text-white"
        >
          <svg
            class="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        </button>
      </div>
    </div>
  `,
})
export class FloatingDockComponent {
  @Input() isPanelOpen = false;
  @Output() toggleQuickPanel = new EventEmitter<void>();
  @Output() onQuickAction = new EventEmitter<string>();
}
