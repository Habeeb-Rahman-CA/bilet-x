import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PersistenceService } from '../../../../core/tauri/persistence.service';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex h-full flex-col space-y-3 text-xs">
      <!-- ACTIVITY LIST -->
      <div class="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        <div
          *ngFor="let item of persistence.activities()"
          class="rounded-lg border border-neutral-800 bg-neutral-900/90 p-2.5"
        >
          <div class="text-neutral-200">{{ item.summary }}</div>
          <div class="mt-1 flex items-center justify-between font-mono text-[9px] text-neutral-500">
            <span class="uppercase tracking-wider">{{ item.entity }} · {{ item.action }}</span>
            <span>{{ formatRelative(item.created_at) }}</span>
          </div>
        </div>

        <div
          *ngIf="persistence.activities().length === 0"
          class="py-6 text-center font-mono text-xs text-neutral-500"
        >
          No recent actions.
        </div>
      </div>

      <!-- CLEAR BUTTON -->
      <button
        (click)="handleClear()"
        type="button"
        [class.bg-red-500]="clearArmed()"
        [class.text-white]="clearArmed()"
        [class.bg-neutral-800]="!clearArmed()"
        [class.text-neutral-400]="!clearArmed()"
        class="shrink-0 rounded-lg border border-neutral-800 py-1.5 font-mono text-[10px] transition hover:text-white"
      >
        {{ clearArmed() ? 'Confirm clear?' : 'Clear activity log' }}
      </button>
    </div>
  `,
})
export class ActivityComponent implements OnInit, OnDestroy {
  public clearArmed = signal(false);
  private clearTimer: number | undefined;
  private readonly CONFIRM_WINDOW_MS = 3000;

  constructor(public persistence: PersistenceService) {}

  public ngOnInit(): void {
    // Refresh each time the tab opens so activities logged since the last
    // view are visible without needing a manual reload.
    this.persistence.loadActivities();
  }

  public ngOnDestroy(): void {
    if (this.clearTimer !== undefined) window.clearTimeout(this.clearTimer);
  }

  public async handleClear(): Promise<void> {
    if (this.clearArmed()) {
      this.clearArmed.set(false);
      if (this.clearTimer !== undefined) window.clearTimeout(this.clearTimer);
      await this.persistence.clearActivities();
      return;
    }
    this.clearArmed.set(true);
    if (this.clearTimer !== undefined) window.clearTimeout(this.clearTimer);
    this.clearTimer = window.setTimeout(
      () => this.clearArmed.set(false),
      this.CONFIRM_WINDOW_MS
    );
  }

  // SQLite datetime('now') returns "YYYY-MM-DD HH:MM:SS" in UTC.
  // Convert to a coarse "5m ago" / "2h ago" / "3d ago" so the list stays scannable.
  public formatRelative(sqliteTs: string): string {
    if (!sqliteTs) return '';
    const iso = sqliteTs.replace(' ', 'T') + 'Z';
    const then = new Date(iso).getTime();
    if (isNaN(then)) return sqliteTs;
    const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}
