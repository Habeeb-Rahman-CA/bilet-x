import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface CalendarCell {
  date: Date;
  day: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isWeekend: boolean;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex h-full flex-col">
      <!-- Header: month / year + nav -->
      <div class="flex shrink-0 items-center justify-between pb-2">
        <div class="flex items-baseline space-x-1.5">
          <span
            class="font-mono text-[12px] font-bold tracking-wider text-neutral-100 uppercase"
          >
            {{ monthLabel() }}
          </span>
          <span class="font-mono text-[10px] text-neutral-500">{{ yearLabel() }}</span>
        </div>
        <div class="flex items-center space-x-0.5">
          <button
            type="button"
            (click)="prevMonth()"
            title="Previous month"
            class="flex h-6 w-6 items-center justify-center rounded-md text-neutral-500 transition hover:bg-neutral-800 hover:text-white"
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
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            (click)="goToToday()"
            title="Jump to today"
            [disabled]="isViewingCurrentMonth()"
            class="flex h-6 items-center justify-center rounded-md px-2 font-mono text-[9px] font-semibold tracking-wider text-neutral-400 uppercase transition hover:bg-neutral-800 hover:text-white disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
          >
            Today
          </button>
          <button
            type="button"
            (click)="nextMonth()"
            title="Next month"
            class="flex h-6 w-6 items-center justify-center rounded-md text-neutral-500 transition hover:bg-neutral-800 hover:text-white"
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
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Weekday labels -->
      <div class="grid shrink-0 grid-cols-7 pb-1">
        <div
          *ngFor="let d of weekdayLabels; let i = index"
          class="text-center font-mono text-[9px] font-semibold tracking-wider uppercase"
          [ngClass]="{
            'text-neutral-600': i === 0 || i === 6,
            'text-neutral-500': i > 0 && i < 6
          }"
        >
          {{ d }}
        </div>
      </div>

      <!-- Month grid: 5 or 6 rows, adaptive -->
      <div
        class="grid shrink-0 grid-cols-7 gap-0.5"
        [style.grid-template-rows]="'repeat(' + weekRows() + ', minmax(0, 1fr))'"
      >
        <button
          *ngFor="let cell of cells(); trackBy: trackByDate"
          type="button"
          (click)="selectDate(cell.date)"
          [title]="cell.date.toDateString()"
          class="group relative flex h-8 items-center justify-center rounded-full font-mono text-[11px] transition"
          [ngClass]="{
            'text-neutral-100': cell.inCurrentMonth && !cell.isSelected,
            'text-neutral-600': !cell.inCurrentMonth && !cell.isSelected,
            'text-neutral-400':
              cell.inCurrentMonth && cell.isWeekend && !cell.isSelected,
            'bg-white text-black hover:bg-white': cell.isSelected,
            'hover:bg-neutral-800': !cell.isSelected
          }"
        >
          <span>{{ cell.day }}</span>
          <!-- Today indicator: small dot under the number when not selected -->
          <span
            *ngIf="cell.isToday && !cell.isSelected"
            class="absolute bottom-1 h-1 w-1 rounded-full bg-emerald-400"
          ></span>
        </button>
      </div>

      <!-- Selected day footer -->
      <div class="mt-auto flex shrink-0 items-baseline justify-between border-t border-neutral-800/80 pt-2">
        <div class="flex items-baseline space-x-1.5">
          <span class="font-mono text-[11px] font-semibold text-neutral-100">
            {{ selectedDayLabel() }}
          </span>
          <span
            class="font-mono text-[9px] font-semibold tracking-wider text-neutral-500 uppercase"
          >
            {{ selectedWeekdayLabel() }}
          </span>
        </div>
        <span class="font-mono text-[9px] text-neutral-600 italic">no events</span>
      </div>
    </div>
  `,
})
export class CalendarComponent {
  public readonly weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  private readonly today = this.stripTime(new Date());

  private readonly viewMonth = signal<{ year: number; month: number }>({
    year: this.today.getFullYear(),
    month: this.today.getMonth(),
  });

  public readonly selectedDate = signal<Date>(this.today);

  public readonly monthLabel = computed(() => {
    const { year, month } = this.viewMonth();
    return new Date(year, month, 1).toLocaleString(undefined, { month: 'short' });
  });

  public readonly yearLabel = computed(() => this.viewMonth().year.toString());

  public readonly weekRows = computed<number>(() => {
    const { year, month } = this.viewMonth();
    const startWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Math.ceil((startWeekday + daysInMonth) / 7);
  });

  public readonly cells = computed<CalendarCell[]>(() => {
    const { year, month } = this.viewMonth();
    const rows = this.weekRows();
    const selected = this.stripTime(this.selectedDate());
    const startWeekday = new Date(year, month, 1).getDay();
    const gridStart = new Date(year, month, 1 - startWeekday);

    const cells: CalendarCell[] = [];
    for (let i = 0; i < rows * 7; i++) {
      const date = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + i
      );
      const stripped = this.stripTime(date);
      const weekday = stripped.getDay();
      cells.push({
        date: stripped,
        day: stripped.getDate(),
        inCurrentMonth: stripped.getMonth() === month,
        isToday: stripped.getTime() === this.today.getTime(),
        isSelected: stripped.getTime() === selected.getTime(),
        isWeekend: weekday === 0 || weekday === 6,
      });
    }
    return cells;
  });

  public readonly selectedDayLabel = computed(() =>
    this.selectedDate().toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    })
  );

  public readonly selectedWeekdayLabel = computed(() =>
    this.selectedDate().toLocaleDateString(undefined, { weekday: 'short' })
  );

  public readonly isViewingCurrentMonth = computed(() => {
    const { year, month } = this.viewMonth();
    return year === this.today.getFullYear() && month === this.today.getMonth();
  });

  public prevMonth(): void {
    const { year, month } = this.viewMonth();
    const d = new Date(year, month - 1, 1);
    this.viewMonth.set({ year: d.getFullYear(), month: d.getMonth() });
  }

  public nextMonth(): void {
    const { year, month } = this.viewMonth();
    const d = new Date(year, month + 1, 1);
    this.viewMonth.set({ year: d.getFullYear(), month: d.getMonth() });
  }

  public goToToday(): void {
    this.viewMonth.set({
      year: this.today.getFullYear(),
      month: this.today.getMonth(),
    });
    this.selectedDate.set(this.today);
  }

  public selectDate(date: Date): void {
    this.selectedDate.set(date);
    if (
      date.getMonth() !== this.viewMonth().month ||
      date.getFullYear() !== this.viewMonth().year
    ) {
      this.viewMonth.set({ year: date.getFullYear(), month: date.getMonth() });
    }
  }

  public trackByDate(_: number, cell: CalendarCell): number {
    return cell.date.getTime();
  }

  private stripTime(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
}
