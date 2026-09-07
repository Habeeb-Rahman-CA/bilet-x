import { Component, OnDestroy, Signal, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowService } from '../../../../core/tauri/window.service';
import { PersistenceService } from '../../../../core/tauri/persistence.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-3 text-xs">
      <!-- 1. WIDGET POSITION SETTING -->
      <div class="rounded-xl border border-neutral-800 bg-neutral-900/90 p-3 space-y-2">
        <div class="text-[11px] font-semibold text-neutral-300">Widget Position</div>
        <div class="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
          <button
            *ngFor="let pos of positions"
            (click)="selectPosition(pos.id)"
            type="button"
            [class.bg-white]="currentPosition() === pos.id"
            [class.text-black]="currentPosition() === pos.id"
            [class.bg-neutral-800]="currentPosition() !== pos.id"
            [class.text-neutral-400]="currentPosition() !== pos.id"
            class="rounded-lg py-1.5 px-2 text-center transition hover:text-white"
          >
            {{ pos.label }}
          </button>
        </div>
      </div>

      <!-- 2. THEME SETTING -->
      <div class="rounded-xl border border-neutral-800 bg-neutral-900/90 p-3 space-y-2">
        <div class="text-[11px] font-semibold text-neutral-300">Theme</div>
        <div class="flex items-center space-x-2 font-mono text-[10px]">
          <button
            (click)="selectTheme('dark')"
            type="button"
            [class.bg-white]="currentTheme() === 'dark'"
            [class.text-black]="currentTheme() === 'dark'"
            [class.bg-neutral-800]="currentTheme() !== 'dark'"
            [class.text-neutral-400]="currentTheme() !== 'dark'"
            class="flex-1 rounded-lg py-1.5 text-center transition hover:text-white"
          >
            Dark Mode
          </button>
          <button
            (click)="selectTheme('light')"
            type="button"
            [class.bg-white]="currentTheme() === 'light'"
            [class.text-black]="currentTheme() === 'light'"
            [class.bg-neutral-800]="currentTheme() !== 'light'"
            [class.text-neutral-400]="currentTheme() !== 'light'"
            class="flex-1 rounded-lg py-1.5 text-center transition hover:text-white"
          >
            Light Mode
          </button>
        </div>
      </div>

      <!-- 3. DATA / PERSISTENCE MANAGEMENT -->
      <div class="rounded-xl border border-neutral-800 bg-neutral-900/90 p-3 space-y-2">
        <div class="text-[11px] font-semibold text-neutral-300">Data</div>

        <div class="flex items-center justify-between font-mono text-[10px]">
          <span class="text-neutral-400">
            Notes:
            <span class="text-neutral-200">{{ noteCount() }}</span>
          </span>
          <button
            (click)="handleClearNotes()"
            type="button"
            [class.bg-red-500]="clearNotesArmed()"
            [class.text-white]="clearNotesArmed()"
            [class.bg-neutral-800]="!clearNotesArmed()"
            [class.text-neutral-400]="!clearNotesArmed()"
            class="rounded-lg px-2 py-1 transition hover:text-white"
          >
            {{ clearNotesArmed() ? 'Confirm?' : 'Clear' }}
          </button>
        </div>

        <div class="flex items-center justify-between font-mono text-[10px]">
          <span class="text-neutral-400">
            Tasks:
            <span class="text-neutral-200">{{ taskCount() }}</span>
          </span>
          <button
            (click)="handleClearTasks()"
            type="button"
            [class.bg-red-500]="clearTasksArmed()"
            [class.text-white]="clearTasksArmed()"
            [class.bg-neutral-800]="!clearTasksArmed()"
            [class.text-neutral-400]="!clearTasksArmed()"
            class="rounded-lg px-2 py-1 transition hover:text-white"
          >
            {{ clearTasksArmed() ? 'Confirm?' : 'Clear' }}
          </button>
        </div>
      </div>

      <!-- 4. SHORTCUT HINTS & UTILITY INFO -->
      <div class="rounded-xl border border-neutral-800 bg-neutral-900/90 p-3 space-y-2">
        <div class="flex items-center justify-between text-neutral-400 text-[10px]">
          <span>Toggle Shortcut</span>
          <kbd class="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 font-mono">Ctrl + K</kbd>
        </div>
        <div class="flex items-center justify-between border-t border-neutral-800/80 pt-2 text-neutral-400 text-[10px]">
          <span>System Tray</span>
          <span class="text-emerald-400 font-medium">Active (Minimize/Restore)</span>
        </div>
      </div>

      <!-- 5. ABOUT & VERSION SCREEN -->
      <div class="rounded-xl border border-neutral-800 bg-neutral-900/90 p-3 space-y-1 text-[10px]">
        <div class="flex items-center justify-between">
          <span class="font-bold text-white uppercase font-mono">Bilet-X Utility</span>
          <span class="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-300 font-mono">v0.1.0</span>
        </div>
        <p class="text-neutral-400 leading-relaxed pt-1">
          A minimalist desktop floating widget for notes, tasks, and settings.
        </p>
      </div>
    </div>
  `,
})
export class SettingsComponent implements OnDestroy {
  public positions = [
    { id: 'right', label: 'Right' },
    { id: 'left', label: 'Left' },
    { id: 'top-right', label: 'Top Right' },
    { id: 'top-left', label: 'Top Left' },
    { id: 'bottom-right', label: 'Bottom Right' },
    { id: 'bottom-left', label: 'Bottom Left' },
  ];

  public currentPosition: Signal<string>;
  public currentTheme: Signal<string>;

  public noteCount: Signal<number>;
  public taskCount: Signal<number>;

  // Two-click confirm: first click arms the button for CONFIRM_WINDOW_MS,
  // second click actually clears. The armed state auto-resets on timeout.
  public clearNotesArmed = signal(false);
  public clearTasksArmed = signal(false);
  private clearNotesTimer: number | undefined;
  private clearTasksTimer: number | undefined;
  private readonly CONFIRM_WINDOW_MS = 3000;

  constructor(
    private windowService: WindowService,
    private persistence: PersistenceService,
  ) {
    this.currentPosition = computed(() =>
      this.persistence.getSettingValue('widget_position', 'right'),
    );
    this.currentTheme = computed(() =>
      this.persistence.getSettingValue('theme', 'dark'),
    );
    this.noteCount = computed(() => this.persistence.notes().length);
    this.taskCount = computed(() => this.persistence.tasks().length);
  }

  public ngOnDestroy(): void {
    if (this.clearNotesTimer !== undefined) window.clearTimeout(this.clearNotesTimer);
    if (this.clearTasksTimer !== undefined) window.clearTimeout(this.clearTasksTimer);
  }

  public async selectPosition(pos: string): Promise<void> {
    await this.windowService.setPosition(pos);
    await this.persistence.setSetting('widget_position', pos);
  }

  public async selectTheme(theme: string): Promise<void> {
    this.persistence.applyTheme(theme);
    await this.persistence.setSetting('theme', theme);
  }

  public async handleClearNotes(): Promise<void> {
    if (this.clearNotesArmed()) {
      this.clearNotesArmed.set(false);
      if (this.clearNotesTimer !== undefined) window.clearTimeout(this.clearNotesTimer);
      await this.persistence.clearAllNotes();
      return;
    }
    this.clearNotesArmed.set(true);
    if (this.clearNotesTimer !== undefined) window.clearTimeout(this.clearNotesTimer);
    this.clearNotesTimer = window.setTimeout(
      () => this.clearNotesArmed.set(false),
      this.CONFIRM_WINDOW_MS,
    );
  }

  public async handleClearTasks(): Promise<void> {
    if (this.clearTasksArmed()) {
      this.clearTasksArmed.set(false);
      if (this.clearTasksTimer !== undefined) window.clearTimeout(this.clearTasksTimer);
      await this.persistence.clearAllTasks();
      return;
    }
    this.clearTasksArmed.set(true);
    if (this.clearTasksTimer !== undefined) window.clearTimeout(this.clearTasksTimer);
    this.clearTasksTimer = window.setTimeout(
      () => this.clearTasksArmed.set(false),
      this.CONFIRM_WINDOW_MS,
    );
  }
}
