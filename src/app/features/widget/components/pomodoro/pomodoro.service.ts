import { Injectable, computed, effect, signal } from '@angular/core';
import { PersistenceService } from '../../../../core/tauri/persistence.service';
import { NotificationService } from '../../../../core/tauri/notification.service';

export type PomodoroMode = 'focus' | 'break';

const DEFAULT_FOCUS_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;

// Bounds must mirror src-tauri/src/commands.rs validation.
export const FOCUS_MIN = 1;
export const FOCUS_MAX = 120;
export const BREAK_MIN = 1;
export const BREAK_MAX = 60;

@Injectable({ providedIn: 'root' })
export class PomodoroService {
  public readonly focusMinutes = signal<number>(DEFAULT_FOCUS_MINUTES);
  public readonly breakMinutes = signal<number>(DEFAULT_BREAK_MINUTES);

  public readonly mode = signal<PomodoroMode>('focus');
  public readonly remainingSeconds = signal<number>(DEFAULT_FOCUS_MINUTES * 60);
  public readonly isRunning = signal<boolean>(false);
  public readonly totalCompletedFocus = signal<number>(0);
  public readonly soundEnabled = signal<boolean>(true);

  private readonly durationSeconds = computed(() => ({
    focus: this.focusMinutes() * 60,
    break: this.breakMinutes() * 60,
  }));

  public readonly totalSecondsForMode = computed(
    () => this.durationSeconds()[this.mode()]
  );

  public readonly progress = computed(() => {
    const total = this.totalSecondsForMode();
    if (total === 0) return 0;
    return 1 - this.remainingSeconds() / total;
  });

  private intervalId: number | null = null;
  private audioContext: AudioContext | null = null;

  constructor(
    private persistence: PersistenceService,
    private notification: NotificationService
  ) {
    effect(() => {
      this.persistence.settings();
      this.hydrateFromPersistence();
    });
  }

  public start(): void {
    if (this.isRunning()) return;
    if (this.remainingSeconds() <= 0) {
      this.remainingSeconds.set(this.totalSecondsForMode());
    }
    this.isRunning.set(true);
    this.intervalId = window.setInterval(() => this.tick(), 1000);
  }

  public pause(): void {
    if (!this.isRunning()) return;
    this.isRunning.set(false);
    this.clearInterval();
  }

  public toggle(): void {
    this.isRunning() ? this.pause() : this.start();
  }

  public reset(): void {
    this.clearInterval();
    this.isRunning.set(false);
    this.remainingSeconds.set(this.totalSecondsForMode());
  }

  public skip(): void {
    this.clearInterval();
    this.isRunning.set(false);
    this.advanceMode();
  }

  public setMode(mode: PomodoroMode): void {
    if (
      this.mode() === mode &&
      !this.isRunning() &&
      this.remainingSeconds() === this.totalSecondsForMode()
    ) {
      return;
    }
    this.clearInterval();
    this.isRunning.set(false);
    this.mode.set(mode);
    this.remainingSeconds.set(this.durationSeconds()[mode]);
  }

  public toggleSound(): void {
    this.soundEnabled.set(!this.soundEnabled());
  }

  public setFocusMinutes(minutes: number): Promise<boolean> {
    const clamped = this.clamp(minutes, FOCUS_MIN, FOCUS_MAX);
    return this.persistence.setSetting('pomodoro_focus_minutes', clamped.toString());
  }

  public setBreakMinutes(minutes: number): Promise<boolean> {
    const clamped = this.clamp(minutes, BREAK_MIN, BREAK_MAX);
    return this.persistence.setSetting('pomodoro_break_minutes', clamped.toString());
  }

  private hydrateFromPersistence(): void {
    const f = this.parseMinutes(
      this.persistence.getSettingValue('pomodoro_focus_minutes'),
      DEFAULT_FOCUS_MINUTES,
      FOCUS_MIN,
      FOCUS_MAX
    );
    const b = this.parseMinutes(
      this.persistence.getSettingValue('pomodoro_break_minutes'),
      DEFAULT_BREAK_MINUTES,
      BREAK_MIN,
      BREAK_MAX
    );

    this.applyDurationChange('focus', f, this.focusMinutes, (v) =>
      this.focusMinutes.set(v)
    );
    this.applyDurationChange('break', b, this.breakMinutes, (v) =>
      this.breakMinutes.set(v)
    );
  }

  private applyDurationChange(
    modeKey: PomodoroMode,
    newMinutes: number,
    current: { (): number },
    setter: (v: number) => void
  ): void {
    const oldSeconds = current() * 60;
    if (current() === newMinutes) return;
    setter(newMinutes);
    if (
      this.mode() === modeKey &&
      !this.isRunning() &&
      this.remainingSeconds() === oldSeconds
    ) {
      this.remainingSeconds.set(newMinutes * 60);
    }
  }

  private parseMinutes(raw: string, fallback: number, min: number, max: number): number {
    if (!raw) return fallback;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return fallback;
    return this.clamp(n, min, max);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Math.round(value)));
  }

  private tick(): void {
    const next = this.remainingSeconds() - 1;
    if (next <= 0) {
      this.remainingSeconds.set(0);
      this.clearInterval();
      this.isRunning.set(false);
      this.playChime();
      this.onSessionComplete();
    } else {
      this.remainingSeconds.set(next);
    }
  }

  private onSessionComplete(): void {
    const finishedMode = this.mode();
    if (finishedMode === 'focus') {
      this.totalCompletedFocus.set(this.totalCompletedFocus() + 1);
    }
    void this.emitCompletionNotification(finishedMode);
    this.advanceMode();
  }

  private async emitCompletionNotification(finishedMode: PomodoroMode): Promise<void> {
    if (finishedMode === 'focus') {
      await this.notification.sendNotification(
        'Focus session complete',
        `Nice work. Time for a ${this.breakMinutes()}-minute break.`
      );
    } else {
      await this.notification.sendNotification(
        "Break's over",
        `Ready to focus for ${this.focusMinutes()} minutes?`
      );
    }
  }

  private advanceMode(): void {
    const nextMode: PomodoroMode = this.mode() === 'focus' ? 'break' : 'focus';
    this.mode.set(nextMode);
    this.remainingSeconds.set(this.durationSeconds()[nextMode]);
  }

  private clearInterval(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private playChime(): void {
    if (!this.soundEnabled()) return;
    try {
      if (!this.audioContext) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        this.audioContext = new AudioCtx();
      }
      const ctx = this.audioContext;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      // Ascending A-major arpeggio (A5, C#6, E6) — a pleasant "done" chime.
      this.playTone(ctx, 880, ctx.currentTime, 0.6);
      this.playTone(ctx, 1108.73, ctx.currentTime + 0.15, 0.6);
      this.playTone(ctx, 1318.51, ctx.currentTime + 0.3, 0.9);
    } catch {
      // Sound is best-effort; never let audio failures crash the timer.
    }
  }

  private playTone(
    ctx: AudioContext,
    frequency: number,
    startTime: number,
    duration: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    osc.connect(gain).connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }
}
