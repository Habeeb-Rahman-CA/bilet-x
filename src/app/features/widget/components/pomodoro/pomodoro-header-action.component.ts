import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PomodoroService } from './pomodoro.service';

@Component({
  selector: 'app-pomodoro-header-action',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="no-drag flex items-center gap-1.5">
      <!-- When in Settings view: Back Button on left side -->
      <button
        *ngIf="pomodoro.activeView() === 'settings'"
        (click)="pomodoro.activeView.set('timer')"
        type="button"
        title="Back to Timer"
        class="glass-btn flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-300 hover:text-white transition active:scale-95"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>

      <!-- When in Timer or History view: Timer and History Buttons on Left Side parallel to close icon -->
      <div
        *ngIf="pomodoro.activeView() !== 'settings'"
        class="flex items-center space-x-1 font-mono text-[10px] font-medium"
      >
        <button
          type="button"
          (click)="pomodoro.activeView.set('timer')"
          class="rounded-lg px-2.5 py-1 transition-all duration-150 active:scale-95"
          [ngClass]="{
            'bg-white font-semibold text-black shadow-sm': pomodoro.activeView() === 'timer',
            'glass-btn text-neutral-400 hover:text-white': pomodoro.activeView() !== 'timer'
          }"
        >
          Timer
        </button>
        <button
          type="button"
          (click)="pomodoro.activeView.set('history')"
          class="flex items-center space-x-1.5 rounded-lg px-2.5 py-1 transition-all duration-150 active:scale-95"
          [ngClass]="{
            'bg-white font-semibold text-black shadow-sm': pomodoro.activeView() === 'history',
            'glass-btn text-neutral-400 hover:text-white': pomodoro.activeView() !== 'history'
          }"
        >
          <span>History</span>
          <span
            *ngIf="pomodoro.workLogs().length > 0"
            class="rounded px-1 text-[8px] font-bold tabular-nums"
            [ngClass]="{
              'bg-black/20 text-black': pomodoro.activeView() === 'history',
              'bg-neutral-800 text-neutral-300': pomodoro.activeView() !== 'history'
            }"
          >
            {{ pomodoro.workLogs().length }}
          </span>
        </button>
      </div>
    </div>
  `,
})
export class PomodoroHeaderActionComponent {
  constructor(public pomodoro: PomodoroService) {}
}
