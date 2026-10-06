import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BREAK_MAX,
  BREAK_MIN,
  FOCUS_MAX,
  FOCUS_MIN,
  PomodoroMode,
  PomodoroService,
  WorkLogEntry,
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
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex h-full flex-col space-y-2 text-neutral-100 select-none">
      <!-- 1. VIEW: SETTINGS / TIMER PREFERENCES -->
      <div
        *ngIf="pomodoro.activeView() === 'settings'"
        class="space-y-2.5 rounded-xl border border-neutral-800 bg-neutral-900 p-3 shadow-xl"
      >
        <div class="flex items-center justify-between border-b border-neutral-800 pb-2">
          <span class="font-mono text-[11px] font-bold tracking-wider text-neutral-200 uppercase">
            Timer Preferences
          </span>
          <div class="flex items-center space-x-1.5">
            <!-- Sound Toggle Button -->
            <button
              type="button"
              (click)="pomodoro.toggleSound()"
              [title]="pomodoro.soundEnabled() ? 'Reminder sound enabled' : 'Reminder sound muted'"
              class="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-800 text-neutral-400 transition hover:bg-neutral-700 hover:text-white"
              [ngClass]="{ 'text-emerald-400': pomodoro.soundEnabled() }"
            >
              <svg
                *ngIf="pomodoro.soundEnabled()"
                xmlns="http://www.w3.org/2000/svg"
                width="11"
                height="11"
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
                width="11"
                height="11"
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

            <!-- Reset Cycle Button -->
            <button
              type="button"
              (click)="pomodoro.resetFocusBlock()"
              title="Reset current focus block counter"
              class="flex items-center space-x-1 rounded border border-neutral-800 bg-neutral-950 px-1.5 py-0.5 font-mono text-[9px] text-neutral-400 hover:border-neutral-700 hover:text-white active:scale-95"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <span>Reset Cycle</span>
            </button>
          </div>
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
              class="flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-neutral-800 bg-neutral-950 text-neutral-300 transition hover:border-neutral-600 hover:text-white disabled:opacity-30 active:scale-95"
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
              class="flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-neutral-800 bg-neutral-950 text-neutral-300 transition hover:border-neutral-600 hover:text-white disabled:opacity-30 active:scale-95"
              aria-label="Increase"
            >
              +
            </button>
            <span class="ml-0.5 text-[9px] text-neutral-500">m</span>
          </div>
        </div>
      </div>

      <!-- 2. VIEW: TIMER (Active Work Session) -->
      <div
        *ngIf="pomodoro.activeView() === 'timer'"
        class="flex flex-1 flex-col justify-between space-y-2"
      >
        <!-- A. FOCUS / BREAK CONTINUOUS CYCLE PROGRESS -->
        <div class="rounded-xl border border-neutral-800 bg-neutral-900 p-2.5">
          <div class="flex items-center justify-between font-mono text-[9px]">
            <div class="flex items-center space-x-1.5">
              <span
                class="h-1.5 w-1.5 rounded-full"
                [ngClass]="{
                  'animate-pulse bg-emerald-400':
                    pomodoro.mode() === 'focus' && pomodoro.isRunning(),
                  'bg-emerald-500/80':
                    pomodoro.mode() === 'focus' && !pomodoro.isRunning(),
                  'animate-pulse bg-sky-400':
                    pomodoro.mode() === 'break' && pomodoro.isRunning(),
                  'bg-sky-400/80': pomodoro.mode() === 'break' && !pomodoro.isRunning()
                }"
              ></span>
              <span class="font-semibold text-neutral-300 uppercase">
                {{ pomodoro.mode() === 'focus' ? 'Focus Cycle' : 'Break Time' }}
              </span>
            </div>

            <span class="text-neutral-400 tabular-nums">
              <span class="font-medium text-neutral-200">{{ focusProgressText() }}</span>
              <span class="text-neutral-500"> ({{ focusTimeUntilBreakText() }})</span>
            </span>
          </div>

          <!-- Progress Bar -->
          <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
            <div
              class="h-full transition-all duration-300 ease-linear"
              [ngClass]="{
                'bg-emerald-400 shadow-sm shadow-emerald-400/50': pomodoro.mode() === 'focus',
                'bg-sky-400 shadow-sm shadow-sky-400/50': pomodoro.mode() === 'break'
              }"
              [style.width.%]="
                pomodoro.mode() === 'focus'
                  ? pomodoro.focusSessionProgress() * 100
                  : pomodoro.breakProgress() * 100
              "
            ></div>
          </div>
        </div>

        <!-- B. BREAK MODE SCREEN (if in break mode) -->
        <div
          *ngIf="pomodoro.mode() === 'break'"
          class="flex flex-1 flex-col items-center justify-center space-y-3 rounded-xl border border-sky-600/40 bg-neutral-900 p-4 text-center"
        >
          <div class="flex items-center space-x-1.5 text-xs font-semibold text-sky-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
              <line x1="6" y1="1" x2="6" y2="4" />
              <line x1="10" y1="1" x2="10" y2="4" />
              <line x1="14" y1="1" x2="14" y2="4" />
            </svg>
            <span>Time to Recharge!</span>
          </div>

          <div
            class="font-mono text-3xl font-bold tracking-wider text-sky-100 tabular-nums"
          >
            {{ breakTimeLabel() }}
          </div>

          <p class="text-[10px] text-neutral-400">
            You completed a {{ pomodoro.focusMinutes() }}m continuous focus block.
          </p>

          <div class="flex w-full space-x-2 pt-1 font-mono text-[10px]">
            <button
              type="button"
              (click)="pomodoro.resumeTaskAfterBreak()"
              class="flex-1 rounded-xl bg-white py-2 font-semibold text-black transition hover:bg-neutral-200 active:scale-98"
            >
              Resume Task Now
            </button>
            <button
              type="button"
              (click)="pomodoro.toggle()"
              class="rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-300 transition hover:bg-neutral-700 hover:text-white"
            >
              {{ pomodoro.isRunning() ? 'Pause' : 'Start' }}
            </button>
          </div>
        </div>

        <!-- C. FOCUS MODE: TASK & TIMER CARD -->
        <div
          *ngIf="pomodoro.mode() === 'focus'"
          class="flex flex-1 flex-col justify-between space-y-2 rounded-xl border border-neutral-800 bg-neutral-900 p-3"
        >
          <!-- Task & Project Input Row -->
          <div class="flex items-center space-x-2">
            <input
              type="text"
              [ngModel]="pomodoro.taskTitle()"
              (ngModelChange)="pomodoro.setTaskTitle($event)"
              placeholder="What are you working on?"
              class="h-8 min-w-0 flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 font-sans text-xs text-neutral-100 placeholder-neutral-500 transition focus:border-neutral-500 focus:outline-none"
            />
            <div class="relative w-28 shrink-0">
              <span class="pointer-events-none absolute left-2.5 top-2 font-mono text-[11px] text-neutral-500">#</span>
              <input
                type="text"
                [ngModel]="pomodoro.taskProject()"
                (ngModelChange)="pomodoro.setTaskProject($event)"
                placeholder="Project"
                class="h-8 w-full rounded-lg border border-neutral-800 bg-neutral-950 pl-5 pr-2 font-mono text-[11px] text-neutral-200 placeholder-neutral-500 transition focus:border-neutral-500 focus:outline-none"
              />
            </div>
          </div>

          <!-- Quick Project Tags -->
          <div
            *ngIf="pomodoro.recentProjects().length > 0 && !showDescription()"
            class="flex items-center space-x-1.5 overflow-hidden"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="shrink-0 text-neutral-500"
            >
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
            <div class="flex items-center space-x-1 overflow-x-auto no-scrollbar">
              <button
                *ngFor="let p of pomodoro.recentProjects()"
                type="button"
                (click)="pomodoro.setTaskProject(p)"
                class="shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[9px] transition"
                [ngClass]="{
                  'border-emerald-500/40 bg-emerald-500/10 text-emerald-300':
                    pomodoro.taskProject() === p,
                  'border-neutral-800 bg-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200':
                    pomodoro.taskProject() !== p
                }"
              >
                #{{ p }}
              </button>
            </div>
          </div>

          <!-- Optional Notes Field (Expandable) -->
          <div *ngIf="showDescription()">
            <input
              type="text"
              [ngModel]="pomodoro.taskDescription()"
              (ngModelChange)="pomodoro.setTaskDescription($event)"
              placeholder="Add short note or context..."
              class="h-7 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 font-sans text-[11px] text-neutral-200 placeholder-neutral-500 transition focus:border-neutral-500 focus:outline-none"
            />
          </div>

          <!-- Center Digital Stopwatch Timer Display -->
          <div class="flex items-center justify-between rounded-xl bg-neutral-950 px-3.5 py-2">
            <div class="flex items-baseline space-x-2">
              <span
                class="h-2 w-2 self-center rounded-full"
                [ngClass]="{
                  'animate-pulse bg-emerald-400': pomodoro.isRunning(),
                  'bg-neutral-600': !pomodoro.isRunning()
                }"
              ></span>
              <div class="font-mono text-3xl font-bold tracking-tight text-neutral-100 tabular-nums">
                {{ taskTimeLabel() }}
              </div>
            </div>

            <div class="text-right font-mono text-[9px] text-neutral-400">
              <span *ngIf="pomodoro.taskStartedAt()">
                Started {{ formatTime(pomodoro.taskStartedAt()!) }}
              </span>
              <span *ngIf="!pomodoro.taskStartedAt()" class="text-neutral-500">
                Elapsed Time
              </span>
            </div>
          </div>

          <!-- PRIMARY CONTROLS ROW -->
          <div class="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <!-- Start / Pause Button -->
            <button
              type="button"
              (click)="pomodoro.toggle()"
              class="flex h-8.5 items-center justify-center space-x-1.5 rounded-xl border border-transparent font-semibold uppercase transition active:scale-98"
              [ngClass]="{
                'bg-white text-black hover:bg-neutral-200': !pomodoro.isRunning(),
                'bg-neutral-800 text-amber-300 hover:bg-neutral-700': pomodoro.isRunning()
              }"
            >
              <svg
                *ngIf="!pomodoro.isRunning()"
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <svg
                *ngIf="pomodoro.isRunning()"
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
              <span>{{ pomodoro.isRunning() ? 'Pause' : 'Start Work' }}</span>
            </button>

            <!-- Finish Work Button -->
            <button
              type="button"
              (click)="handleFinishWork()"
              [disabled]="pomodoro.taskElapsedSeconds() <= 0 && !pomodoro.taskTitle().trim()"
              class="flex h-8.5 items-center justify-center space-x-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/20 font-semibold text-emerald-300 transition hover:bg-emerald-500/30 active:scale-98 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Finish Work</span>
            </button>
          </div>

          <!-- CLEAN SVG MICRO ACTIONS ROW (NO EMOJIS) -->
          <div class="flex items-center justify-between font-mono text-[9px] text-neutral-400">
            <!-- Reset Button -->
            <button
              type="button"
              (click)="pomodoro.resetTaskTimer()"
              [disabled]="pomodoro.taskElapsedSeconds() === 0"
              class="flex items-center space-x-1 rounded-md px-1.5 py-0.5 transition hover:bg-neutral-800 hover:text-white disabled:opacity-25"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <span>Reset</span>
            </button>

            <!-- Note Button -->
            <button
              type="button"
              (click)="showDescription.set(!showDescription())"
              class="flex items-center space-x-1 rounded-md px-1.5 py-0.5 transition hover:bg-neutral-800 hover:text-neutral-200"
              [ngClass]="{ 'text-emerald-400': showDescription() || pomodoro.taskDescription().trim() }"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>{{ showDescription() ? 'Hide Note' : 'Note' }}</span>
            </button>

            <!-- Break Early Button -->
            <button
              type="button"
              (click)="pomodoro.switchMode('break')"
              class="flex items-center space-x-1 rounded-md px-1.5 py-0.5 text-sky-400 transition hover:bg-neutral-800 hover:text-sky-300"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                <line x1="6" y1="1" x2="6" y2="4" />
                <line x1="10" y1="1" x2="10" y2="4" />
                <line x1="14" y1="1" x2="14" y2="4" />
              </svg>
              <span>Break Early</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 3. VIEW: COMPLETED WORK LOGS (History) -->
      <div
        *ngIf="pomodoro.activeView() === 'history'"
        class="flex min-h-0 flex-1 flex-col justify-between overflow-hidden"
      >
        <!-- TODAY SUMMARY STATS -->
        <div
          class="flex shrink-0 items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 font-mono"
        >
          <div>
            <span class="text-[9px] text-neutral-500 uppercase">Today's Focus: </span>
            <span class="text-xs font-bold text-neutral-100 tabular-nums">
              {{ formatTotalTime(pomodoro.todayTotalSeconds()) }}
            </span>
          </div>
          <div>
            <span class="text-[9px] text-neutral-500 uppercase">Tasks: </span>
            <span class="text-xs font-bold text-emerald-400 tabular-nums">
              {{ pomodoro.todayLogs().length }}
            </span>
          </div>
        </div>

        <!-- LOGS LIST -->
        <div class="my-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          <!-- Empty State -->
          <div
            *ngIf="pomodoro.workLogs().length === 0"
            class="flex h-full flex-col items-center justify-center space-y-2 rounded-xl border border-dashed border-neutral-800 p-4 text-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-neutral-600"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 14 14" />
            </svg>
            <div class="font-mono text-xs text-neutral-400">No completed tasks yet</div>
            <div class="text-[10px] text-neutral-500">
              Start a task in the Timer tab and click "Finish Work".
            </div>
          </div>

          <!-- Log Card -->
          <div
            *ngFor="let item of pomodoro.workLogs()"
            class="group flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-2.5 transition hover:border-neutral-700 hover:bg-neutral-850"
          >
            <div class="min-w-0 flex-1 pr-2">
              <div class="flex items-center space-x-1.5">
                <span
                  class="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[9px] font-medium text-neutral-300"
                >
                  #{{ item.project || 'General' }}
                </span>
                <span class="truncate text-xs font-semibold text-neutral-100">
                  {{ item.title }}
                </span>
              </div>

              <div class="mt-1 flex items-center space-x-1.5 font-mono text-[9px] text-neutral-500">
                <span>{{ formatTimeAgo(item.completedAt) }}</span>
                <span>•</span>
                <span>{{ formatTime(item.startedAt) }}</span>
                <span *ngIf="item.description" class="truncate text-neutral-400">
                  ({{ item.description }})
                </span>
              </div>
            </div>

            <!-- Right: Duration badge & Delete action -->
            <div class="flex shrink-0 items-center space-x-2">
              <span
                class="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400 tabular-nums"
              >
                {{ formatDuration(item.durationSeconds) }}
              </span>

              <button
                type="button"
                (click)="pomodoro.deleteWorkLog(item.id)"
                title="Delete log"
                class="text-neutral-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- History Footer Actions -->
        <div
          *ngIf="pomodoro.workLogs().length > 0"
          class="flex shrink-0 items-center justify-between border-t border-neutral-800 pt-1.5 font-mono text-[9px]"
        >
          <span class="text-neutral-500">Total: {{ pomodoro.workLogs().length }}</span>
          <button
            type="button"
            (click)="handleClearHistory()"
            [class.text-red-400]="clearArmed()"
            [class.text-neutral-500]="!clearArmed()"
            class="transition hover:text-red-300"
          >
            {{ clearArmed() ? 'Confirm Clear All?' : 'Clear History' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class PomodoroComponent {
  public readonly showDescription = signal<boolean>(false);
  public readonly clearArmed = signal<boolean>(false);
  private clearTimer: number | undefined;

  public readonly rows: DurationRow[] = [
    {
      label: 'Focus Target',
      value: () => this.pomodoro.focusMinutes(),
      min: FOCUS_MIN,
      max: FOCUS_MAX,
      step: 5,
      onChange: (v) => void this.pomodoro.setFocusMinutes(v),
    },
    {
      label: 'Break Duration',
      value: () => this.pomodoro.breakMinutes(),
      min: BREAK_MIN,
      max: BREAK_MAX,
      step: 1,
      onChange: (v) => void this.pomodoro.setBreakMinutes(v),
    },
  ];

  // Task timer string formatted as MM:SS or HH:MM:SS
  public readonly taskTimeLabel = computed(() => {
    return this.formatDuration(this.pomodoro.taskElapsedSeconds());
  });

  // Break timer string formatted as MM:SS
  public readonly breakTimeLabel = computed(() => {
    const total = this.pomodoro.breakRemainingSeconds();
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  });

  // Continuous Focus Session progress text
  public readonly focusProgressText = computed(() => {
    const elapsedMinutes = Math.floor(this.pomodoro.focusSessionElapsedSeconds() / 60);
    return `${elapsedMinutes}m / ${this.pomodoro.focusMinutes()}m`;
  });

  public readonly focusTimeUntilBreakText = computed(() => {
    const remainingSeconds = this.pomodoro.focusSessionRemainingSeconds();
    const minutes = Math.ceil(remainingSeconds / 60);
    return minutes > 0 ? `${minutes}m left` : 'Break ready';
  });

  constructor(public pomodoro: PomodoroService) {}

  public step(row: DurationRow, delta: number): void {
    const next = Math.max(row.min, Math.min(row.max, row.value() + delta));
    if (next !== row.value()) row.onChange(next);
  }

  public handleFinishWork(): void {
    const entry = this.pomodoro.finishCurrentWork();
    if (entry) {
      this.pomodoro.activeView.set('history');
    }
  }

  public handleClearHistory(): void {
    if (this.clearArmed()) {
      this.pomodoro.clearAllWorkLogs();
      this.clearArmed.set(false);
      if (this.clearTimer !== undefined) clearTimeout(this.clearTimer);
    } else {
      this.clearArmed.set(true);
      this.clearTimer = window.setTimeout(() => {
        this.clearArmed.set(false);
      }, 3000);
    }
  }

  public formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  public formatTotalTime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  public formatTime(isoString: string): string {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  public formatTimeAgo(isoString: string): string {
    try {
      if (!isoString) return '';
      let normalized = isoString.trim();
      if (normalized.includes(' ') && !normalized.includes('T')) {
        normalized = normalized.replace(' ', 'T');
      }
      if (!normalized.endsWith('Z') && !/[+-]\d{2}(:?\d{2})?$/.test(normalized)) {
        normalized += 'Z';
      }
      const date = new Date(normalized);
      const now = new Date();
      const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (isNaN(diffSecs) || diffSecs < 60) return 'Just now';
      if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
      if (diffSecs < 86400) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }
}


