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
      class="titlebar-drag-region flex h-10 w-full items-center justify-between border-b border-slate-800/80 bg-slate-950/90 px-3 text-xs text-slate-300 backdrop-blur-md select-none"
    >
      <!-- Left: Logo & Window Title -->
      <div class="no-drag flex items-center space-x-2">
        <img
          src="bilet-x-dark-icon-v1.png"
          alt="Bilet-X Logo"
          class="h-5 w-5 rounded-md border border-slate-800 bg-slate-900 object-contain shadow-sm shadow-indigo-500/30"
        />
        <span class="font-semibold tracking-wide text-slate-200">{{ windowService.title() }}</span>

        <!-- Environment Indicator Badge -->
        <span
          class="ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium"
          [ngClass]="{
            'border-emerald-500/30 bg-emerald-500/10 text-emerald-400':
              tauriService.isTauriAvailable(),
            'border-amber-500/30 bg-amber-500/10 text-amber-400': !tauriService.isTauriAvailable(),
          }"
        >
          <span
            class="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full"
            [ngClass]="tauriService.isTauriAvailable() ? 'bg-emerald-400' : 'bg-amber-400'"
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
          class="flex h-7 w-8 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
        >
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
          </svg>
        </button>

        <!-- Maximize / Restore -->
        <button
          (click)="windowService.toggleMaximize()"
          type="button"
          title="Toggle Maximize"
          class="flex h-7 w-8 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
        >
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <rect
              x="4"
              y="4"
              width="16"
              height="16"
              rx="2"
              stroke-width="2"
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
          class="flex h-7 w-8 items-center justify-center rounded text-slate-400 transition-colors hover:bg-rose-600 hover:text-white"
        >
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
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
