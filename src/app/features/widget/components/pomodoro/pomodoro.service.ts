import { Injectable, computed, effect, signal } from '@angular/core';
import { PersistenceService } from '../../../../core/tauri/persistence.service';
import { NotificationService } from '../../../../core/tauri/notification.service';

export type PomodoroMode = 'focus' | 'break';

export interface WorkLogEntry {
  id: string;
  title: string;
  project: string;
  description?: string;
  durationSeconds: number;
  startedAt: string;
  completedAt: string;
}

export interface ActiveWorkTask {
  title: string;
  project: string;
  description: string;
  elapsedSeconds: number;
}

const DEFAULT_FOCUS_MINUTES = 30;
const DEFAULT_BREAK_MINUTES = 5;

export const FOCUS_MIN = 1;
export const FOCUS_MAX = 120;
export const BREAK_MIN = 1;
export const BREAK_MAX = 60;

@Injectable({ providedIn: 'root' })
export class PomodoroService {
  // Configurable session limits
  public readonly focusMinutes = signal<number>(DEFAULT_FOCUS_MINUTES);
  public readonly breakMinutes = signal<number>(DEFAULT_BREAK_MINUTES);
  public readonly soundEnabled = signal<boolean>(true);

  // Active Timer state
  public readonly mode = signal<PomodoroMode>('focus');
  public readonly isRunning = signal<boolean>(false);

  // Current active task details (Counting UP)
  public readonly taskTitle = signal<string>('');
  public readonly taskProject = signal<string>('General');
  public readonly taskDescription = signal<string>('');
  public readonly taskElapsedSeconds = signal<number>(0);
  public readonly taskStartedAt = signal<string | null>(null);

  // Continuous focus tracker (cumulative work time across tasks in current focus block)
  public readonly focusSessionElapsedSeconds = signal<number>(0);

  // Break countdown timer
  public readonly breakRemainingSeconds = signal<number>(DEFAULT_BREAK_MINUTES * 60);

  // Completed work history
  public readonly workLogs = signal<WorkLogEntry[]>([]);

  // Focus budget calculations
  public readonly focusTargetSeconds = computed(() => this.focusMinutes() * 60);
  public readonly breakTargetSeconds = computed(() => this.breakMinutes() * 60);

  public readonly focusSessionProgress = computed(() => {
    const target = this.focusTargetSeconds();
    if (target === 0) return 0;
    return Math.min(1, this.focusSessionElapsedSeconds() / target);
  });

  public readonly focusSessionRemainingSeconds = computed(() => {
    return Math.max(0, this.focusTargetSeconds() - this.focusSessionElapsedSeconds());
  });

  public readonly breakProgress = computed(() => {
    const target = this.breakTargetSeconds();
    if (target === 0) return 0;
    return Math.max(0, Math.min(1, 1 - this.breakRemainingSeconds() / target));
  });

  // Recent unique projects for quick selection/chips
  public readonly recentProjects = computed(() => {
    const projects = new Set<string>();
    const current = this.taskProject().trim();
    if (current) projects.add(current);
    for (const log of this.workLogs()) {
      if (log.project?.trim()) {
        projects.add(log.project.trim());
      }
    }
    if (projects.size === 0) {
      projects.add('General');
      projects.add('Development');
      projects.add('Design');
    }
    return Array.from(projects).slice(0, 8);
  });

  // Today stats
  public readonly todayLogs = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.workLogs().filter((l) => l.completedAt.slice(0, 10) === today);
  });

  public readonly todayTotalSeconds = computed(() => {
    return this.todayLogs().reduce((acc, curr) => acc + curr.durationSeconds, 0);
  });

  public readonly totalCompletedFocus = computed(() => this.todayLogs().length);

  private intervalId: number | null = null;
  private audioContext: AudioContext | null = null;
  private isHydrated = false;

  constructor(
    private persistence: PersistenceService,
    private notification: NotificationService
  ) {
    effect(() => {
      this.persistence.settings();
      this.hydrateFromPersistence();
    });
  }

  // --- TIMER CONTROLS ---

  public start(): void {
    if (this.isRunning()) return;

    if (this.mode() === 'focus') {
      if (!this.taskStartedAt()) {
        this.taskStartedAt.set(new Date().toISOString());
      }
    } else if (this.mode() === 'break') {
      if (this.breakRemainingSeconds() <= 0) {
        this.breakRemainingSeconds.set(this.breakTargetSeconds());
      }
    }

    this.isRunning.set(true);
    this.intervalId = window.setInterval(() => this.tick(), 1000);
    this.persistActiveTaskState();
  }

  public pause(): void {
    if (!this.isRunning()) return;
    this.isRunning.set(false);
    this.clearInterval();
    this.persistActiveTaskState();
  }

  public toggle(): void {
    this.isRunning() ? this.pause() : this.start();
  }

  public resetTaskTimer(): void {
    this.pause();
    this.taskElapsedSeconds.set(0);
    this.taskStartedAt.set(null);
    this.persistActiveTaskState();
  }

  public resetFocusBlock(): void {
    this.focusSessionElapsedSeconds.set(0);
    void this.persistence.setSetting('pomodoro_focus_session_elapsed', '0');
  }

  public switchMode(mode: PomodoroMode): void {
    if (this.mode() === mode) return;
    this.pause();
    this.mode.set(mode);
    if (mode === 'break') {
      this.breakRemainingSeconds.set(this.breakTargetSeconds());
    }
  }

  public skipBreak(): void {
    this.pause();
    this.focusSessionElapsedSeconds.set(0);
    void this.persistence.setSetting('pomodoro_focus_session_elapsed', '0');
    this.mode.set('focus');
    this.breakRemainingSeconds.set(this.breakTargetSeconds());
  }

  public resumeTaskAfterBreak(): void {
    this.skipBreak();
    this.start();
  }

  // --- WORK COMPLETION ---

  public finishCurrentWork(): WorkLogEntry | null {
    const elapsed = this.taskElapsedSeconds();
    if (elapsed <= 0 && !this.taskTitle().trim()) {
      return null;
    }

    const now = new Date().toISOString();
    const entry: WorkLogEntry = {
      id: `work_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: this.taskTitle().trim() || 'Untitled Work',
      project: this.taskProject().trim() || 'General',
      description: this.taskDescription().trim() || undefined,
      durationSeconds: Math.max(elapsed, 1),
      startedAt: this.taskStartedAt() || now,
      completedAt: now,
    };

    const updatedLogs = [entry, ...this.workLogs()];
    this.workLogs.set(updatedLogs);
    void this.saveLogsToPersistence(updatedLogs);

    this.playSuccessChime();

    // Reset active task
    this.taskTitle.set('');
    this.taskDescription.set('');
    this.taskElapsedSeconds.set(0);
    this.taskStartedAt.set(null);
    this.pause();

    this.persistActiveTaskState();
    return entry;
  }

  public deleteWorkLog(id: string): void {
    const updated = this.workLogs().filter((l) => l.id !== id);
    this.workLogs.set(updated);
    void this.saveLogsToPersistence(updated);
  }

  public clearAllWorkLogs(): void {
    this.workLogs.set([]);
    void this.saveLogsToPersistence([]);
  }

  // --- TASK METADATA SETTERS ---

  public setTaskTitle(title: string): void {
    this.taskTitle.set(title);
    this.persistActiveTaskState();
  }

  public setTaskProject(project: string): void {
    this.taskProject.set(project);
    this.persistActiveTaskState();
  }

  public setTaskDescription(description: string): void {
    this.taskDescription.set(description);
    this.persistActiveTaskState();
  }

  // --- CONFIGURATION SETTERS ---

  public setFocusMinutes(minutes: number): Promise<boolean> {
    const clamped = this.clamp(minutes, FOCUS_MIN, FOCUS_MAX);
    this.focusMinutes.set(clamped);
    return this.persistence.setSetting('pomodoro_focus_minutes', clamped.toString());
  }

  public setBreakMinutes(minutes: number): Promise<boolean> {
    const clamped = this.clamp(minutes, BREAK_MIN, BREAK_MAX);
    this.breakMinutes.set(clamped);
    if (this.mode() === 'break' && !this.isRunning()) {
      this.breakRemainingSeconds.set(clamped * 60);
    }
    return this.persistence.setSetting('pomodoro_break_minutes', clamped.toString());
  }

  public toggleSound(): void {
    const next = !this.soundEnabled();
    this.soundEnabled.set(next);
    void this.persistence.setSetting('pomodoro_sound_enabled', next ? 'true' : 'false');
  }

  // --- INTERNAL TICK & NOTIFICATION LOGIC ---

  private tick(): void {
    if (this.mode() === 'focus') {
      // 1. Task elapsed timer counts UP
      const currentTaskElapsed = this.taskElapsedSeconds() + 1;
      this.taskElapsedSeconds.set(currentTaskElapsed);

      // 2. Cumulative focus session elapsed counts UP
      const currentFocusSession = this.focusSessionElapsedSeconds() + 1;
      this.focusSessionElapsedSeconds.set(currentFocusSession);

      // Check if continuous focus session reached the target (e.g., 30m)
      const target = this.focusTargetSeconds();
      if (currentFocusSession >= target) {
        this.onFocusSessionReachedTarget();
      }

      // Periodically persist state every 10 seconds
      if (currentTaskElapsed % 10 === 0) {
        this.persistActiveTaskState();
      }
    } else {
      // Break countdown timer counts DOWN
      const nextBreak = this.breakRemainingSeconds() - 1;
      if (nextBreak <= 0) {
        this.breakRemainingSeconds.set(0);
        this.onBreakComplete();
      } else {
        this.breakRemainingSeconds.set(nextBreak);
      }
    }
  }

  private onFocusSessionReachedTarget(): void {
    // 1. Pause active task timer automatically
    this.pause();

    // 2. Play alert chime
    this.playFocusCompleteChime();

    // 3. Trigger desktop notification
    const taskName = this.taskTitle().trim() || 'your current task';
    void this.notification.sendNotification(
      'Focus session complete!',
      `You've reached your ${this.focusMinutes()}m focus limit while working on "${taskName}". Task timer paused — take a ${this.breakMinutes()}m break!`
    );

    // 4. Switch to break mode
    this.mode.set('break');
    this.breakRemainingSeconds.set(this.breakTargetSeconds());
    this.focusSessionElapsedSeconds.set(0);
    void this.persistence.setSetting('pomodoro_focus_session_elapsed', '0');
    this.persistActiveTaskState();
  }

  private onBreakComplete(): void {
    this.pause();
    this.playBreakCompleteChime();

    void this.notification.sendNotification(
      "Break is over!",
      `Ready to resume work? Your task "${this.taskTitle().trim() || 'Work'}" is waiting.`
    );

    // Reset continuous focus counter and switch back to focus mode
    this.focusSessionElapsedSeconds.set(0);
    void this.persistence.setSetting('pomodoro_focus_session_elapsed', '0');
    this.mode.set('focus');
    this.breakRemainingSeconds.set(this.breakTargetSeconds());
  }

  // --- PERSISTENCE HYDRATION & SAVING ---

  private hydrateFromPersistence(): void {
    if (this.isHydrated) return;

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
    this.focusMinutes.set(f);
    this.breakMinutes.set(b);
    this.breakRemainingSeconds.set(b * 60);

    const soundVal = this.persistence.getSettingValue('pomodoro_sound_enabled');
    if (soundVal) {
      this.soundEnabled.set(soundVal === 'true');
    }

    // Hydrate focus session elapsed
    const focusElapsedRaw = this.persistence.getSettingValue('pomodoro_focus_session_elapsed');
    if (focusElapsedRaw) {
      const parsed = parseInt(focusElapsedRaw, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        this.focusSessionElapsedSeconds.set(parsed);
      }
    }

    // Hydrate active task
    const activeTaskRaw = this.persistence.getSettingValue('pomodoro_active_task');
    if (activeTaskRaw) {
      try {
        const parsed = JSON.parse(activeTaskRaw) as Partial<ActiveWorkTask>;
        if (parsed.title !== undefined) this.taskTitle.set(parsed.title);
        if (parsed.project !== undefined) this.taskProject.set(parsed.project);
        if (parsed.description !== undefined) this.taskDescription.set(parsed.description);
        if (parsed.elapsedSeconds !== undefined) this.taskElapsedSeconds.set(parsed.elapsedSeconds);
      } catch (e) {
        console.warn('Failed to parse active task from persistence', e);
      }
    }

    // Hydrate work logs
    const logsRaw = this.persistence.getSettingValue('pomodoro_work_logs');
    if (logsRaw) {
      try {
        const parsed = JSON.parse(logsRaw) as WorkLogEntry[];
        if (Array.isArray(parsed)) {
          this.workLogs.set(parsed);
        }
      } catch (e) {
        console.warn('Failed to parse work logs from persistence', e);
      }
    }

    this.isHydrated = true;
  }

  private persistActiveTaskState(): void {
    const taskData: ActiveWorkTask = {
      title: this.taskTitle(),
      project: this.taskProject(),
      description: this.taskDescription(),
      elapsedSeconds: this.taskElapsedSeconds(),
    };
    void this.persistence.setSetting('pomodoro_active_task', JSON.stringify(taskData));
    void this.persistence.setSetting(
      'pomodoro_focus_session_elapsed',
      this.focusSessionElapsedSeconds().toString()
    );
  }

  private saveLogsToPersistence(logs: WorkLogEntry[]): Promise<boolean> {
    return this.persistence.setSetting('pomodoro_work_logs', JSON.stringify(logs));
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

  private clearInterval(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // --- AUDIO SYNTHESIS CHIMES ---

  private getAudioContext(): AudioContext | null {
    if (!this.soundEnabled()) return null;
    try {
      if (!this.audioContext) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioCtx();
      }
      const ctx = this.audioContext;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      return ctx;
    } catch {
      return null;
    }
  }

  private playFocusCompleteChime(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      // Ascending alert chime (A5, C#6, E6, A6)
      this.playTone(ctx, 880, ctx.currentTime, 0.4);
      this.playTone(ctx, 1108.73, ctx.currentTime + 0.12, 0.4);
      this.playTone(ctx, 1318.51, ctx.currentTime + 0.24, 0.4);
      this.playTone(ctx, 1760, ctx.currentTime + 0.36, 0.8);
    } catch {}
  }

  private playBreakCompleteChime(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      // Soft gentle two-tone chime (G5 -> C6)
      this.playTone(ctx, 783.99, ctx.currentTime, 0.35);
      this.playTone(ctx, 1046.5, ctx.currentTime + 0.18, 0.6);
    } catch {}
  }

  private playSuccessChime(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      // Crisp completion chime (D5, F#5, A5)
      this.playTone(ctx, 587.33, ctx.currentTime, 0.2);
      this.playTone(ctx, 739.99, ctx.currentTime + 0.1, 0.25);
      this.playTone(ctx, 880, ctx.currentTime + 0.2, 0.5);
    } catch {}
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
    gain.gain.exponentialRampToValueAtTime(0.2, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }
}

