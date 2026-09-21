import { Injectable, computed, signal } from '@angular/core';
import { PersistenceService } from '../../../../core/tauri/persistence.service';
import { NotificationService } from '../../../../core/tauri/notification.service';

export interface HistoryDay {
  date: string;
  dayLabel: string;
  consumedMl: number;
  goalMl: number;
  percent: number;
  isGoalMet: boolean;
}

const DEFAULT_GOAL_ML = 2500;
const DEFAULT_QUICK_ADD_ML = 250;
const DEFAULT_INTERVAL_MINS = 60;
const DEFAULT_START_TIME = '09:00';
const DEFAULT_END_TIME = '21:00';

@Injectable({ providedIn: 'root' })
export class WaterService {
  public readonly todayConsumedMl = signal<number>(0);
  public readonly dailyGoalMl = signal<number>(DEFAULT_GOAL_ML);
  public readonly quickAddMl = signal<number>(DEFAULT_QUICK_ADD_ML);

  public readonly reminderEnabled = signal<boolean>(true);
  public readonly reminderIntervalMinutes = signal<number>(DEFAULT_INTERVAL_MINS);
  public readonly reminderStartTime = signal<string>(DEFAULT_START_TIME);
  public readonly reminderEndTime = signal<string>(DEFAULT_END_TIME);
  public readonly lastReminderTimestamp = signal<number | null>(null);
  public readonly snoozeUntil = signal<number | null>(null);

  public readonly history = signal<Record<string, number>>({});
  public readonly todayDate = signal<string>(this.getTodayDateString());

  // Ticks every 30s to update countdowns and trigger reminders
  public readonly currentTick = signal<number>(Date.now());

  // Consumed percentage clamped to 100 for standard bar
  public readonly progressPercent = computed(() => {
    const goal = this.dailyGoalMl();
    if (goal <= 0) return 0;
    return Math.min(100, Math.round((this.todayConsumedMl() / goal) * 100));
  });

  public readonly isGoalReached = computed(() => {
    return this.todayConsumedMl() >= this.dailyGoalMl() && this.dailyGoalMl() > 0;
  });

  public readonly consumedLitersFormatted = computed(() => {
    const liters = this.todayConsumedMl() / 1000;
    return liters % 1 === 0
      ? `${liters.toFixed(0)}L`
      : `${liters.toFixed(2).replace(/\.?0+$/, '')}L`;
  });

  public readonly goalLitersFormatted = computed(() => {
    const liters = this.dailyGoalMl() / 1000;
    return liters % 1 === 0
      ? `${liters.toFixed(0)}L`
      : `${liters.toFixed(2).replace(/\.?0+$/, '')}L`;
  });

  // Streak calculation: count consecutive days meeting the daily goal
  public readonly streak = computed(() => {
    const hist = this.history();
    const goal = this.dailyGoalMl();
    const todayMet = this.todayConsumedMl() >= goal;

    let count = todayMet ? 1 : 0;
    const date = new Date();

    // Check previous days consecutively
    for (let i = 1; i <= 365; i++) {
      const prevDate = new Date(date);
      prevDate.setDate(date.getDate() - i);
      const prevStr = this.formatDate(prevDate);
      const consumed = hist[prevStr] || 0;
      if (consumed >= goal) {
        count++;
      } else {
        if (i === 1 && !todayMet && consumed >= goal) {
          count = 1;
          continue;
        }
        break;
      }
    }
    return count;
  });

  // Recent 5 days history list
  public readonly recentHistory = computed<HistoryDay[]>(() => {
    const hist = this.history();
    const goal = this.dailyGoalMl();
    const days: HistoryDay[] = [];
    const date = new Date();

    for (let i = 4; i >= 0; i--) {
      const d = new Date(date);
      d.setDate(date.getDate() - i);
      const dateStr = this.formatDate(d);
      const isToday = i === 0;
      const consumed = isToday ? this.todayConsumedMl() : hist[dateStr] || 0;
      const dayLabel = isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });
      const percent = goal > 0 ? Math.min(100, Math.round((consumed / goal) * 100)) : 0;

      days.push({
        date: dateStr,
        dayLabel,
        consumedMl: consumed,
        goalMl: goal,
        percent,
        isGoalMet: consumed >= goal && goal > 0,
      });
    }
    return days;
  });

  // Next reminder countdown status label
  public readonly reminderStatus = computed(() => {
    this.currentTick();
    if (!this.reminderEnabled()) {
      return 'Off';
    }

    const now = new Date();
    const snooze = this.snoozeUntil();
    if (snooze && snooze > now.getTime()) {
      const remainingMins = Math.max(1, Math.ceil((snooze - now.getTime()) / 60000));
      return `Snooze · ${remainingMins}m`;
    }

    if (!this.isWithinActiveHours(now)) {
      return 'Quiet hours';
    }

    const last = this.lastReminderTimestamp();
    const intervalMs = this.reminderIntervalMinutes() * 60 * 1000;
    if (!last) {
      return `In ${this.reminderIntervalMinutes()}m`;
    }

    const nextTime = last + intervalMs;
    const diffMs = nextTime - now.getTime();

    if (diffMs <= 0) {
      return 'Due now';
    }

    const diffMins = Math.ceil(diffMs / 60000);
    if (diffMins < 60) {
      return `In ${diffMins}m`;
    }
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return mins > 0 ? `In ${hours}h ${mins}m` : `In ${hours}h`;
  });

  private intervalTimerId: number | null = null;
  private hasCongratulatedGoalToday = false;
  private isHydrated = false;

  constructor(
    private persistence: PersistenceService,
    private notification: NotificationService
  ) {
    this.hydrateFromPersistence();

    // Start 30s reminder & date-check engine
    this.intervalTimerId = window.setInterval(() => this.onTimerTick(), 30000);
  }

  public async addWater(amount?: number): Promise<void> {
    this.checkDateRollover();
    const add = typeof amount === 'number' && amount > 0 ? amount : this.quickAddMl();
    const newConsumed = this.todayConsumedMl() + add;
    this.todayConsumedMl.set(newConsumed);

    // Update history record
    const todayStr = this.todayDate();
    const nextHist = { ...this.history(), [todayStr]: newConsumed };
    this.history.set(nextHist);

    // Push back reminder on active drink so we don't nag right after drinking
    this.lastReminderTimestamp.set(Date.now());
    this.snoozeUntil.set(null);

    // Persist changes
    await this.persistState();

    // Check goal achievement celebration
    if (newConsumed >= this.dailyGoalMl() && !this.hasCongratulatedGoalToday) {
      this.hasCongratulatedGoalToday = true;
      await this.notification.sendNotification(
        '🎉 Daily Hydration Goal Met!',
        `Great job! You reached your ${this.goalLitersFormatted()} water goal today.`
      );
    }
  }

  public async removeWater(amount?: number): Promise<void> {
    this.checkDateRollover();
    const sub = typeof amount === 'number' && amount > 0 ? amount : this.quickAddMl();
    const newConsumed = Math.max(0, this.todayConsumedMl() - sub);
    this.todayConsumedMl.set(newConsumed);

    const todayStr = this.todayDate();
    const nextHist = { ...this.history(), [todayStr]: newConsumed };
    this.history.set(nextHist);

    await this.persistState();
  }

  public async setDailyGoal(ml: number): Promise<void> {
    if (ml <= 0) return;
    this.dailyGoalMl.set(ml);
    await this.persistence.setSetting('water_daily_goal', ml.toString());
  }

  public async setQuickAddAmount(ml: number): Promise<void> {
    if (ml <= 0) return;
    this.quickAddMl.set(ml);
    await this.persistence.setSetting('water_quick_add', ml.toString());
  }

  public async setReminderInterval(minutes: number): Promise<void> {
    if (minutes <= 0) return;
    this.reminderIntervalMinutes.set(minutes);
    await this.persistence.setSetting('water_reminder_interval', minutes.toString());
  }

  public async setReminderTimes(start: string, end: string): Promise<void> {
    this.reminderStartTime.set(start);
    this.reminderEndTime.set(end);
    await this.persistence.setSetting('water_reminder_start', start);
    await this.persistence.setSetting('water_reminder_end', end);
  }

  public async toggleReminders(enabled?: boolean): Promise<void> {
    const next = enabled !== undefined ? enabled : !this.reminderEnabled();
    this.reminderEnabled.set(next);
    await this.persistence.setSetting('water_reminder_enabled', next ? 'true' : 'false');
  }

  public snooze(minutes = 30): void {
    const until = Date.now() + minutes * 60 * 1000;
    this.snoozeUntil.set(until);
    this.currentTick.set(Date.now());
  }

  public async resetToday(): Promise<void> {
    this.todayConsumedMl.set(0);
    this.hasCongratulatedGoalToday = false;
    const todayStr = this.todayDate();
    const nextHist = { ...this.history(), [todayStr]: 0 };
    this.history.set(nextHist);
    await this.persistState();
  }

  private onTimerTick(): void {
    this.currentTick.set(Date.now());
    this.checkDateRollover();
    this.checkReminder();
  }

  private checkDateRollover(): void {
    const actualToday = this.getTodayDateString();
    if (this.todayDate() !== actualToday) {
      this.todayDate.set(actualToday);
      this.todayConsumedMl.set(0);
      this.hasCongratulatedGoalToday = false;
      this.lastReminderTimestamp.set(null);
      this.snoozeUntil.set(null);
      this.persistState();
    }
  }

  private async checkReminder(): Promise<void> {
    if (!this.reminderEnabled()) return;
    const now = new Date();

    if (!this.isWithinActiveHours(now)) return;

    const snooze = this.snoozeUntil();
    if (snooze && snooze > now.getTime()) return;

    const last = this.lastReminderTimestamp();
    const intervalMs = this.reminderIntervalMinutes() * 60 * 1000;

    if (!last || now.getTime() - last >= intervalMs) {
      this.lastReminderTimestamp.set(now.getTime());
      this.snoozeUntil.set(null);
      await this.persistence.setSetting('water_last_reminder', now.getTime().toString());

      await this.notification.sendNotification(
        '💧 Time for some water',
        `Stay hydrated! You have logged ${this.consumedLitersFormatted()} of your ${this.goalLitersFormatted()} goal.`
      );
    }
  }

  private isWithinActiveHours(now: Date): boolean {
    const [startH, startM] = this.reminderStartTime().split(':').map(Number);
    const [endH, endM] = this.reminderEndTime().split(':').map(Number);

    const currentMins = now.getHours() * 60 + now.getMinutes();
    const startMins = (startH || 9) * 60 + (startM || 0);
    const endMins = (endH || 21) * 60 + (endM || 0);

    if (startMins <= endMins) {
      return currentMins >= startMins && currentMins <= endMins;
    }
    return currentMins >= startMins || currentMins <= endMins;
  }

  public hydrateFromPersistence(): void {
    const goal = parseInt(
      this.persistence.getSettingValue('water_daily_goal', `${DEFAULT_GOAL_ML}`),
      10
    );
    if (!isNaN(goal) && goal > 0) this.dailyGoalMl.set(goal);

    const quick = parseInt(
      this.persistence.getSettingValue('water_quick_add', `${DEFAULT_QUICK_ADD_ML}`),
      10
    );
    if (!isNaN(quick) && quick > 0) this.quickAddMl.set(quick);

    const interval = parseInt(
      this.persistence.getSettingValue('water_reminder_interval', `${DEFAULT_INTERVAL_MINS}`),
      10
    );
    if (!isNaN(interval) && interval > 0) this.reminderIntervalMinutes.set(interval);

    this.reminderStartTime.set(
      this.persistence.getSettingValue('water_reminder_start', DEFAULT_START_TIME)
    );
    this.reminderEndTime.set(
      this.persistence.getSettingValue('water_reminder_end', DEFAULT_END_TIME)
    );
    this.reminderEnabled.set(
      this.persistence.getSettingValue('water_reminder_enabled', 'true') === 'true'
    );

    const lastReminder = parseInt(this.persistence.getSettingValue('water_last_reminder', '0'), 10);
    if (!isNaN(lastReminder) && lastReminder > 0) {
      this.lastReminderTimestamp.set(lastReminder);
    }

    const historyJson = this.persistence.getSettingValue('water_history', '{}');
    try {
      const parsed = JSON.parse(historyJson);
      if (parsed && typeof parsed === 'object') {
        this.history.set(parsed);
      }
    } catch {
      this.history.set({});
    }

    const savedDate = this.persistence.getSettingValue('water_today_date', '');
    const actualToday = this.getTodayDateString();

    if (savedDate === actualToday) {
      const savedConsumed = parseInt(
        this.persistence.getSettingValue('water_today_consumed', '0'),
        10
      );
      if (!isNaN(savedConsumed)) {
        this.todayConsumedMl.set(savedConsumed);
        if (savedConsumed >= this.dailyGoalMl()) {
          this.hasCongratulatedGoalToday = true;
        }
      }
    } else {
      this.todayDate.set(actualToday);
      this.todayConsumedMl.set(0);
      this.hasCongratulatedGoalToday = false;
    }
    this.isHydrated = true;
  }

  private async persistState(): Promise<void> {
    const todayStr = this.todayDate();
    await this.persistence.setSetting('water_today_date', todayStr);
    await this.persistence.setSetting('water_today_consumed', this.todayConsumedMl().toString());
    await this.persistence.setSetting('water_history', JSON.stringify(this.history()));
    if (this.lastReminderTimestamp()) {
      await this.persistence.setSetting(
        'water_last_reminder',
        this.lastReminderTimestamp()!.toString()
      );
    }
  }

  private getTodayDateString(): string {
    return this.formatDate(new Date());
  }

  private formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
