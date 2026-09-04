import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowService } from '../../../core/tauri/window.service';
import { TauriService } from '../../../core/tauri/tauri.service';

@Component({
  selector: 'app-titlebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header
      class="titlebar-drag-region flex h-10 w-full items-center justify-between border-b border-neutral-800 bg-black px-3 text-xs text-neutral-300 select-none"
    >
      <!-- Left: Logo & Window Title -->
      <div class="no-drag flex items-center space-x-2">
        <img
          src="bilet-x-dark-icon-v1.png"
          alt="Bilet-X Logo"
          class="h-5 w-5 rounded border border-neutral-800 bg-neutral-900 object-contain"
        />
        <span class="font-semibold tracking-wide text-neutral-100">{{ windowService.title() }}</span>

        <!-- Environment Indicator Badge -->
        <span
          class="ml-2 inline-flex items-center rounded border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-neutral-300"
        >
          <span
            class="mr-1.5 h-1.5 w-1.5 rounded-full"
            [ngClass]="tauriService.isTauriAvailable() ? 'bg-white' : 'bg-neutral-500'"
          ></span>
          {{ tauriService.isTauriAvailable() ? 'Tauri Desktop Native' : 'Browser Dev Simulator' }}
        </span>
      </div>

      <!-- Center: App Drag Region handle -->
      <div class="h-full flex-1 cursor-grab"></div>

      <!-- Right: Window Control Actions -->
      <div class="no-drag flex items-center space-x-1">
        <!-- Minimize -->
        <button
          (click)="windowService.minimize()"
          type="button"
          title="Minimize Window"
          class="flex h-7 w-8 items-center justify-center text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
        >
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 12H4" />
          </svg>
        </button>

        <!-- Maximize / Restore -->
        <button
          (click)="windowService.toggleMaximize()"
          type="button"
          title="Toggle Maximize"
          class="flex h-7 w-8 items-center justify-center text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
        >
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <rect
              x="4"
              y="4"
              width="16"
              height="16"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <!-- Close -->
        <button
          (click)="windowService.close()"
          type="button"
          title="Close Window"
          class="flex h-7 w-8 items-center justify-center text-neutral-400 transition-colors hover:bg-white hover:text-black"
        >
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </header>
  `,
})
export class TitlebarComponent {
  constructor(
    public windowService: WindowService,
    public tauriService: TauriService
  ) {}
}

