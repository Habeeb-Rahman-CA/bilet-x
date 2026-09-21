import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WaterService } from './water.service';

@Component({
  selector: 'app-water',
  standalone: true,
  imports: [CommonModule],
  styles: [
    `
      input[type='number']::-webkit-outer-spin-button,
      input[type='number']::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      input[type='number'] {
        -moz-appearance: textfield;
        appearance: textfield;
      }
    `,
  ],
  template: `
    <div class="flex h-full flex-col space-y-2.5 font-sans select-none">
      <!-- 1. MAIN HYDRATION CARD -->
      <div
        class="relative shrink-0 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/90 p-3"
      >
        <!-- Ambient Subtle Droplet Glow -->
        <div
          class="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-cyan-500/10 blur-xl"
        ></div>

        <!-- Header: Droplet icon + Title + Countdown Status -->
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <div
              class="flex h-5 w-5 items-center justify-center rounded-md border border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"
                />
              </svg>
            </div>
            <span class="font-mono text-[12px] font-bold tracking-wider text-neutral-100 uppercase">
              Water
            </span>
          </div>

          <!-- Next Reminder Badge -->
          <div
            class="flex items-center space-x-1.5 rounded-full border border-neutral-800 bg-black/60 px-2 py-0.5 font-mono text-[9px] text-neutral-400"
            [title]="water.reminderStatus()"
          >
            <span
              class="h-1.5 w-1.5 rounded-full"
              [ngClass]="{
                'animate-pulse bg-cyan-400': water.reminderEnabled() && !water.snoozeUntil(),
                'bg-amber-400': !!water.snoozeUntil(),
                'bg-neutral-600': !water.reminderEnabled(),
              }"
            ></span>
            <span class="max-w-[130px] truncate">{{ water.reminderStatus() }}</span>
          </div>
        </div>

        <!-- Volume Readout: Consumed / Goal -->
        <div class="mt-2.5 flex items-baseline justify-between">
          <div class="flex items-baseline space-x-1.5">
            <span
              class="font-mono text-[26px] leading-none font-semibold text-neutral-100 tabular-nums"
            >
              {{ water.consumedLitersFormatted() }}
            </span>
            <span class="font-mono text-[12px] text-neutral-500">
              / {{ water.goalLitersFormatted() }}
            </span>
          </div>

          <!-- Percentage Indicator -->
          <div class="flex items-center space-x-1 font-mono text-[12px] font-semibold tabular-nums">
            <span
              [ngClass]="{
                'text-emerald-400': water.isGoalReached(),
                'text-cyan-400': !water.isGoalReached(),
              }"
            >
              {{ water.progressPercent() }}%
            </span>
            <span
              *ngIf="water.isGoalReached()"
              class="text-[11px] text-emerald-400"
              title="Daily Goal Met!"
            >
              ✓
            </span>
          </div>
        </div>

        <!-- Visual Hydration Progress Bar -->
        <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
          <div
            class="h-full transition-all duration-300 ease-out"
            [ngClass]="{
              'bg-gradient-to-r from-cyan-500 to-emerald-400': water.isGoalReached(),
              'bg-gradient-to-r from-cyan-600 to-cyan-400': !water.isGoalReached(),
            }"
            [style.width.%]="water.progressPercent()"
          ></div>
        </div>

        <!-- Quick Drink Action Button Row -->
        <div class="mt-3 flex items-center space-x-1.5">
          <!-- Main +Quick Drink Button -->
          <button
            type="button"
            (click)="water.addWater()"
            class="flex-1 cursor-pointer rounded-lg border border-transparent bg-white py-2 font-mono text-[12px] font-bold text-black uppercase transition-all duration-150 ease-out hover:bg-neutral-200 active:scale-[0.97]"
          >
            +{{ water.quickAddMl() }} ml
          </button>

          <!-- Undo Button (if today consumed > 0) -->
          <button
            *ngIf="water.todayConsumedMl() > 0"
            type="button"
            (click)="water.removeWater()"
            title="Undo last drink"
            class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-300 transition hover:border-neutral-500 hover:bg-neutral-700 hover:text-white active:scale-95"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M5 12h14" />
            </svg>
          </button>

          <!-- Snooze Button -->
          <button
            *ngIf="water.reminderEnabled()"
            type="button"
            (click)="water.snooze(30)"
            title="Snooze reminder for 30m"
            class="flex h-8 cursor-pointer items-center justify-center rounded-lg border border-neutral-700 bg-neutral-800 px-2 font-mono text-[10px] text-neutral-300 transition hover:border-neutral-500 hover:bg-neutral-700 hover:text-white active:scale-95"
          >
            Snooze 30m
          </button>
        </div>

        <!-- Portion Presets -->
        <div class="mt-2.5 flex items-center justify-between">
          <span class="font-mono text-[9px] tracking-wider text-neutral-500 uppercase"
            >Quick portions</span
          >
          <div class="flex items-center space-x-1 font-mono text-[10px]">
            <button
              *ngFor="let amount of drinkAmounts"
              type="button"
              (click)="water.addWater(amount)"
              class="cursor-pointer rounded border border-neutral-800 bg-black/60 px-2 py-0.5 text-neutral-400 transition hover:border-neutral-600 hover:bg-neutral-800 hover:text-white active:scale-95"
            >
              +{{ amount }}
            </button>
          </div>
        </div>
      </div>

      <!-- 2. STREAK & RECENT HISTORY CARD -->
      <div class="shrink-0 rounded-xl border border-neutral-800 bg-neutral-900/60 p-2.5">
        <div class="flex items-center justify-between border-b border-neutral-800/60 pb-1.5">
          <span
            class="font-mono text-[10px] font-semibold tracking-wider text-neutral-400 uppercase"
          >
            Hydration History
          </span>

          <!-- Streak Badge -->
          <div
            *ngIf="water.streak() > 0"
            class="flex items-center space-x-1 font-mono text-[10px] font-semibold text-amber-400"
          >
            <span>🔥</span>
            <span>{{ water.streak() }} day streak</span>
          </div>
          <div *ngIf="water.streak() === 0" class="font-mono text-[9px] text-neutral-500">
            Goal: {{ water.goalLitersFormatted() }}/day
          </div>
        </div>

        <!-- 5-Day Minimal Bar List -->
        <div class="mt-2 space-y-1.5 font-mono text-[10px]">
          <div *ngFor="let day of water.recentHistory()" class="flex items-center space-x-2">
            <!-- Day Name -->
            <span
              class="w-9 shrink-0 text-[10px] text-neutral-500"
              [class.text-neutral-200]="day.dayLabel === 'Today'"
              [class.font-bold]="day.dayLabel === 'Today'"
            >
              {{ day.dayLabel }}
            </span>

            <!-- Mini Progress Bar Track -->
            <div
              class="h-2 flex-1 overflow-hidden rounded border border-neutral-800/80 bg-neutral-950"
            >
              <div
                class="h-full transition-all duration-300"
                [ngClass]="{
                  'bg-emerald-400': day.isGoalMet,
                  'bg-cyan-500/80': !day.isGoalMet && day.percent > 0,
                  'bg-transparent': day.percent === 0,
                }"
                [style.width.%]="day.percent"
              ></div>
            </div>

            <!-- Volume Text -->
            <span
              class="w-10 shrink-0 text-right text-[10px] tabular-nums"
              [class.text-emerald-400]="day.isGoalMet"
              [class.text-neutral-400]="!day.isGoalMet"
            >
              {{ (day.consumedMl / 1000).toFixed(1) }}L
            </span>
          </div>
        </div>
      </div>

      <!-- 3. CONFIGURATION & CUSTOM LIMITS CARD -->
      <div class="space-y-2.5 rounded-xl border border-neutral-800 bg-neutral-900/40 p-2.5">
        <div class="flex items-center justify-between">
          <span
            class="font-mono text-[10px] font-semibold tracking-wider text-neutral-400 uppercase"
          >
            Daily Goal & Time Gap
          </span>
          <button
            type="button"
            (click)="water.toggleReminders()"
            class="cursor-pointer rounded border px-2 py-0.5 font-mono text-[9px] transition active:scale-95"
            [ngClass]="{
              'border-emerald-500/30 bg-emerald-500/10 text-emerald-400': water.reminderEnabled(),
              'border-neutral-800 bg-neutral-900 text-neutral-500 hover:text-neutral-300':
                !water.reminderEnabled(),
            }"
          >
            Reminders: {{ water.reminderEnabled() ? 'On' : 'Off' }}
          </button>
        </div>

        <!-- 3A. DAILY GOAL / TARGET (PRESETS + CUSTOM STEPPER & INPUT) -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between font-mono text-[9px] text-neutral-400">
            <span>Daily Limit / Target</span>
            <div class="flex items-center space-x-1">
              <span class="text-[11px] font-bold text-neutral-200">{{
                water.goalLitersFormatted()
              }}</span>
              <span class="text-neutral-500">({{ water.dailyGoalMl() }} ml)</span>
            </div>
          </div>

          <!-- Goal Preset Chips -->
          <div class="grid grid-cols-5 gap-1 font-mono text-[10px]">
            <button
              *ngFor="let g of goalOptions"
              type="button"
              (click)="water.setDailyGoal(g.ml)"
              class="cursor-pointer rounded border py-1 text-center transition active:scale-95"
              [ngClass]="{
                'border-transparent bg-white font-semibold text-black':
                  water.dailyGoalMl() === g.ml,
                'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-600 hover:text-white':
                  water.dailyGoalMl() !== g.ml,
              }"
            >
              {{ g.label }}
            </button>
          </div>

          <!-- Custom Goal Stepper & Any Value Input -->
          <div class="flex items-center space-x-1.5 pt-0.5">
            <button
              type="button"
              (click)="adjustGoal(-250)"
              title="Decrease goal 250ml"
              class="flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-neutral-800 bg-black/60 font-mono text-[12px] font-bold text-neutral-300 hover:border-neutral-600 hover:text-white active:scale-95"
            >
              -
            </button>
            <div class="relative flex-1">
              <input
                type="number"
                [value]="water.dailyGoalMl()"
                (change)="onGoalInputChange($event)"
                (keyup.enter)="onGoalInputChange($event)"
                min="250"
                max="20000"
                step="250"
                placeholder="Custom ml"
                class="w-full rounded border border-neutral-800 bg-black/70 px-2 py-0.5 text-center font-mono text-[10px] text-neutral-200 transition outline-none focus:border-cyan-500 focus:text-white"
              />
              <span
                class="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 font-mono text-[8px] text-neutral-500"
                >ml</span
              >
            </div>
            <button
              type="button"
              (click)="adjustGoal(250)"
              title="Increase goal 250ml"
              class="flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-neutral-800 bg-black/60 font-mono text-[12px] font-bold text-neutral-300 hover:border-neutral-600 hover:text-white active:scale-95"
            >
              +
            </button>
          </div>
        </div>

        <!-- 3B. REMINDER INTERVAL / TIME GAP (PRESETS + CUSTOM STEPPER & INPUT) -->
        <div class="space-y-1.5 border-t border-neutral-800/60 pt-2">
          <div class="flex items-center justify-between font-mono text-[9px] text-neutral-400">
            <span>Reminder Time Gap</span>
            <span class="text-[11px] font-bold text-neutral-200"
              >Every {{ water.reminderIntervalMinutes() }} mins</span
            >
          </div>

          <!-- Interval Preset Chips -->
          <div class="grid grid-cols-5 gap-1 font-mono text-[10px]">
            <button
              *ngFor="let inv of intervalOptions"
              type="button"
              (click)="water.setReminderInterval(inv.minutes)"
              class="cursor-pointer rounded border py-1 text-center transition active:scale-95"
              [ngClass]="{
                'border-transparent bg-white font-semibold text-black':
                  water.reminderIntervalMinutes() === inv.minutes,
                'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-600 hover:text-white':
                  water.reminderIntervalMinutes() !== inv.minutes,
              }"
            >
              {{ inv.label }}
            </button>
          </div>

          <!-- Custom Interval Stepper & Any Value Input -->
          <div class="flex items-center space-x-1.5 pt-0.5">
            <button
              type="button"
              (click)="adjustInterval(-15)"
              title="Decrease interval 15m"
              class="flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-neutral-800 bg-black/60 font-mono text-[12px] font-bold text-neutral-300 hover:border-neutral-600 hover:text-white active:scale-95"
            >
              -
            </button>
            <div class="relative flex-1">
              <input
                type="number"
                [value]="water.reminderIntervalMinutes()"
                (change)="onIntervalInputChange($event)"
                (keyup.enter)="onIntervalInputChange($event)"
                min="5"
                max="720"
                step="5"
                placeholder="Custom mins"
                class="w-full rounded border border-neutral-800 bg-black/70 px-2 py-0.5 text-center font-mono text-[10px] text-neutral-200 transition outline-none focus:border-cyan-500 focus:text-white"
              />
              <span
                class="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 font-mono text-[8px] text-neutral-500"
                >mins</span
              >
            </div>
            <button
              type="button"
              (click)="adjustInterval(15)"
              title="Increase interval 15m"
              class="flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-neutral-800 bg-black/60 font-mono text-[12px] font-bold text-neutral-300 hover:border-neutral-600 hover:text-white active:scale-95"
            >
              +
            </button>
          </div>
        </div>

        <!-- 3C. ACTIVE HOURS WINDOW -->
        <div
          class="flex items-center justify-between border-t border-neutral-800/60 pt-2 font-mono text-[9px] text-neutral-400"
        >
          <span>Active Window</span>
          <div class="flex items-center space-x-1">
            <input
              type="time"
              [value]="water.reminderStartTime()"
              (change)="onStartTimeChange($event)"
              class="rounded border border-neutral-800 bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-neutral-200 transition outline-none focus:border-cyan-500"
            />
            <span class="text-neutral-500">–</span>
            <input
              type="time"
              [value]="water.reminderEndTime()"
              (change)="onEndTimeChange($event)"
              class="rounded border border-neutral-800 bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-neutral-200 transition outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>
    </div>
  `,
})
export class WaterComponent {
  public drinkAmounts = [150, 250, 350, 500];

  public goalOptions = [
    { label: '1.5L', ml: 1500 },
    { label: '2.0L', ml: 2000 },
    { label: '2.5L', ml: 2500 },
    { label: '3.0L', ml: 3000 },
    { label: '4.0L', ml: 4000 },
  ];

  public intervalOptions = [
    { label: '15m', minutes: 15 },
    { label: '30m', minutes: 30 },
    { label: '45m', minutes: 45 },
    { label: '60m', minutes: 60 },
    { label: '90m', minutes: 90 },
  ];

  constructor(public water: WaterService) {}

  public adjustGoal(deltaMl: number): void {
    const current = this.water.dailyGoalMl();
    const next = Math.max(250, current + deltaMl);
    this.water.setDailyGoal(next);
  }

  public onGoalInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value) && value >= 250) {
      this.water.setDailyGoal(value);
    } else {
      input.value = this.water.dailyGoalMl().toString();
    }
  }

  public adjustInterval(deltaMinutes: number): void {
    const current = this.water.reminderIntervalMinutes();
    const next = Math.max(5, current + deltaMinutes);
    this.water.setReminderInterval(next);
  }

  public onIntervalInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value) && value >= 5) {
      this.water.setReminderInterval(value);
    } else {
      input.value = this.water.reminderIntervalMinutes().toString();
    }
  }

  public onStartTimeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.water.setReminderTimes(input.value, this.water.reminderEndTime());
    }
  }

  public onEndTimeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.water.setReminderTimes(this.water.reminderStartTime(), input.value);
    }
  }
}
