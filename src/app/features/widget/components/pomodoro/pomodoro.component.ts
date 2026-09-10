import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  BREAK_MAX,
  BREAK_MIN,
  FOCUS_MAX,
  FOCUS_MIN,
  PomodoroMode,
  PomodoroService,
} from './pomodoro.service';

interface DurationRow {
  label: string;
  value: () => number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

@Component({
  selector: 'app-pomodoro',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex h-full flex-col space-y-2">
      <!-- Timer card -->
      <div
        class="flex shrink-0 flex-col items-center rounded-xl border border-neutral-800 bg-neutral-900/90 px-3 py-3"
      >
        <!-- Mode selector (segmented) -->
        <div class="grid w-full grid-cols-2 gap-1 font-mono text-[9px] font-semibold tracking-wider uppercase">
          <button
            *ngFor="let m of modes"
            type="button"
            (click)="pomodoro.setMode(m.id)"
            [title]="m.label"
            class="rounded-md border border-transparent py-1 transition-all duration-200 ease-out"
            [ngClass]="{
              'bg-white text-black hover:border-neutral-300':
                pomodoro.mode() === m.id,
              'bg-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white':
                pomodoro.mode() !== m.id
            }"
          >
            {{ m.label }}
          </button>
        </div>

        <!-- Time + status dot -->
        <div class="mt-3 flex items-center space-x-2">
          <span
            class="h-1.5 w-1.5 rounded-full"
            [ngClass]="{
              'animate-pulse bg-emerald-400':
                pomodoro.isRunning() && pomodoro.mode() === 'focus',
              'animate-pulse bg-sky-400':
                pomodoro.isRunning() && pomodoro.mode() === 'break',
              'bg-neutral-600': !pomodoro.isRunning()
            }"
          ></span>
          <div
            class="font-mono text-[44px] leading-none font-semibold tabular-nums text-neutral-100"
          >
            {{ timeLabel() }}
          </div>
        </div>

        <!-- Progress bar -->
        <div class="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-neutral-800">
          <div
            class="h-full transition-all duration-500 ease-linear"
            [ngClass]="{
              'bg-emerald-400': pomodoro.mode() === 'focus',
              'bg-sky-400': pomodoro.mode() === 'break'
            }"
            [style.width.%]="progressPercent()"
          ></div>
        </div>
      </div>

      <!-- Primary action: Start / Pause -->
      <button
        type="button"
        (click)="pomodoro.toggle()"
        class="shrink-0 rounded-lg border border-transparent bg-white py-2 font-mono text-[11px] font-semibold tracking-wider text-black uppercase transition-all duration-200 ease-out hover:border-neutral-300"
      >
        {{ pomodoro.isRunning() ? 'Pause' : 'Start' }}
      </button>

      <!-- Secondary actions -->
      <div class="grid shrink-0 grid-cols-4 gap-1.5 font-mono text-[10px]">
        <button
          type="button"
          (click)="pomodoro.reset()"
          class="rounded-lg border border-transparent bg-neutral-800 py-1.5 text-neutral-400 transition-all duration-200 ease-out hover:border-neutral-600 hover:text-white"
        >
          Reset
        </button>
        <button
          type="button"
          (click)="pomodoro.skip()"
          class="rounded-lg border border-transparent bg-neutral-800 py-1.5 text-neutral-400 transition-all duration-200 ease-out hover:border-neutral-600 hover:text-white"
        >
          Skip
        </button>
        <button
          type="button"
          (click)="pomodoro.toggleSound()"
          [title]="pomodoro.soundEnabled() ? 'Mute chime' : 'Unmute chime'"
          class="flex items-center justify-center rounded-lg border border-transparent bg-neutral-800 py-1.5 transition-all duration-200 ease-out hover:border-neutral-600 hover:text-white"
          [ngClass]="{
            'text-neutral-400': pomodoro.soundEnabled(),
            'text-neutral-600': !pomodoro.soundEnabled()
          }"
        >
          <svg
            *ngIf="pomodoro.soundEnabled()"
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"
            />
            <path d="M16 9a5 5 0 0 1 0 6" />
          </svg>
          <svg
            *ngIf="!pomodoro.soundEnabled()"
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M16 9a5 5 0 0 1 .95 2.293M19.364 5.636a9 9 0 0 1 1.889 9.96M2 2l20 20M7 7l-.587.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298V11"
            />
          </svg>
        </button>
        <button
          type="button"
          (click)="showConfig.set(!showConfig())"
          [title]="showConfig() ? 'Hide durations' : 'Configure durations'"
          class="flex items-center justify-center rounded-lg border border-transparent py-1.5 transition-all duration-200 ease-out hover:border-neutral-600 hover:text-white"
          [ngClass]="{
            'bg-white text-black hover:border-neutral-300 hover:text-black':
              showConfig(),
            'bg-neutral-800 text-neutral-400': !showConfig()
          }"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
            />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>

      <!-- Durations config panel -->
      <div
        *ngIf="showConfig()"
        class="shrink-0 space-y-1.5 rounded-xl border border-neutral-800 bg-neutral-900/90 p-3"
      >
        <div class="pb-1 font-mono text-[9px] font-semibold tracking-wider text-neutral-500 uppercase">
          Durations
        </div>
        <div
          *ngFor="let row of rows"
          class="flex items-center justify-between font-mono text-[10px]"
        >
          <span class="text-neutral-400">{{ row.label }}</span>
          <div class="flex items-center space-x-1">
            <button
              type="button"
              (click)="step(row, -row.step)"
              [disabled]="row.value() <= row.min"
              class="flex h-5 w-5 items-center justify-center rounded-md border border-transparent bg-neutral-800 text-neutral-400 transition-all duration-200 ease-out hover:border-neutral-600 hover:text-white disabled:cursor-default disabled:opacity-30 disabled:hover:border-transparent disabled:hover:text-neutral-400"
              aria-label="Decrease"
            >
              −
            </button>
            <span class="w-8 text-center font-semibold text-neutral-100 tabular-nums">
              {{ row.value() }}
            </span>
            <button
              type="button"
              (click)="step(row, row.step)"
              [disabled]="row.value() >= row.max"
              class="flex h-5 w-5 items-center justify-center rounded-md border border-transparent bg-neutral-800 text-neutral-400 transition-all duration-200 ease-out hover:border-neutral-600 hover:text-white disabled:cursor-default disabled:opacity-30 disabled:hover:border-transparent disabled:hover:text-neutral-400"
              aria-label="Increase"
            >
              +
            </button>
            <span class="ml-1 w-6 text-[9px] text-neutral-500">min</span>
          </div>
        </div>
      </div>

      <!-- Footer stats -->
      <div
        class="mt-auto flex shrink-0 items-baseline justify-between border-t border-neutral-800/80 pt-2 font-mono text-[9px] tracking-wider uppercase"
      >
        <span class="text-neutral-500">
          Today:
          <span class="text-neutral-200">{{ pomodoro.totalCompletedFocus() }}</span>
          <span class="text-neutral-500">
            {{ pomodoro.totalCompletedFocus() === 1 ? ' session' : ' sessions' }}
          </span>
        </span>
      </div>
    </div>
  `,
})
export class PomodoroComponent {
  public readonly showConfig = signal<boolean>(false);

  public readonly modes: { id: PomodoroMode; label: string }[] = [
    { id: 'focus', label: 'Focus' },
    { id: 'break', label: 'Break' },
  ];

  public readonly timeLabel = computed(() => {
    const total = this.pomodoro.remainingSeconds();
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  });

  public readonly progressPercent = computed(() => this.pomodoro.progress() * 100);

  public readonly rows: DurationRow[] = [
    {
      label: 'Focus',
      value: () => this.pomodoro.focusMinutes(),
      min: FOCUS_MIN,
      max: FOCUS_MAX,
      step: 1,
      onChange: (v) => void this.pomodoro.setFocusMinutes(v),
    },
    {
      label: 'Break',
      value: () => this.pomodoro.breakMinutes(),
      min: BREAK_MIN,
      max: BREAK_MAX,
      step: 1,
      onChange: (v) => void this.pomodoro.setBreakMinutes(v),
    },
  ];

  constructor(public pomodoro: PomodoroService) {}

  public step(row: DurationRow, delta: number): void {
    const next = Math.max(row.min, Math.min(row.max, row.value() + delta));
    if (next !== row.value()) row.onChange(next);
  }
}
