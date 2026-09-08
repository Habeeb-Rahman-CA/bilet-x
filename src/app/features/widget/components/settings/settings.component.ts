import { Component, OnDestroy, Signal, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowService } from '../../../../core/tauri/window.service';
import { PersistenceService } from '../../../../core/tauri/persistence.service';
import { NotificationService } from '../../../../core/tauri/notification.service';
import { DockFlipService } from '../../../../core/services/dock-flip.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-3 text-xs">
      <!-- 1. WIDGET POSITION SETTING -->
      <div class="space-y-2 rounded-xl border border-neutral-800 bg-neutral-900/90 p-3">
        <div class="text-[11px] font-semibold text-neutral-300">Widget Position</div>
        <div class="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
          <button
            *ngFor="let pos of activePositions()"
            (click)="selectPosition(pos.id)"
            type="button"
            [ngClass]="toggleClasses(currentPosition() === pos.id)"
            class="rounded-lg px-2 py-1.5 text-center transition-all duration-200 ease-out"
          >
            {{ pos.label }}
          </button>
        </div>
      </div>

      <!-- 1b. DOCK CUSTOMIZATION -->
      <div class="space-y-2.5 rounded-xl border border-neutral-800 bg-neutral-900/90 p-3">
        <div class="text-[11px] font-semibold text-neutral-300">Dock</div>

        <!-- Size picker -->
        <div class="space-y-1">
          <div class="text-[10px] text-neutral-400">Size</div>
          <div class="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
            <button
              *ngFor="let opt of dockSizes"
              (click)="selectDockSize(opt.id)"
              type="button"
              [ngClass]="toggleClasses(currentDockSize() === opt.id)"
              class="rounded-lg px-2 py-1.5 text-center transition-all duration-200 ease-out"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Orientation picker -->
        <div class="space-y-1">
          <div class="text-[10px] text-neutral-400">Orientation</div>
          <div class="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
            <button
              *ngFor="let opt of dockOrientations"
              (click)="selectDockOrientation(opt.id)"
              type="button"
              [ngClass]="toggleClasses(currentDockOrientation() === opt.id)"
              class="rounded-lg px-2 py-1.5 text-center transition-all duration-200 ease-out"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Auto-hide toggle -->
        <div class="space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-neutral-400">Auto-hide on idle</span>
            <span
              [class.text-emerald-400]="isAutoHideEnabled()"
              [class.text-neutral-500]="!isAutoHideEnabled()"
              class="rounded border border-neutral-800 px-1.5 py-0.5 font-mono text-[9px]"
            >
              {{ isAutoHideEnabled() ? 'On' : 'Off' }}
            </span>
          </div>
          <div class="flex items-center space-x-2 font-mono text-[10px]">
            <button
              (click)="toggleAutoHide(true)"
              type="button"
              [ngClass]="toggleClasses(isAutoHideEnabled())"
              class="flex-1 rounded-lg py-1.5 text-center transition-all duration-200 ease-out"
            >
              On
            </button>
            <button
              (click)="toggleAutoHide(false)"
              type="button"
              [ngClass]="toggleClasses(!isAutoHideEnabled())"
              class="flex-1 rounded-lg py-1.5 text-center transition-all duration-200 ease-out"
            >
              Off
            </button>
          </div>
        </div>

        <!-- Tab visibility toggles -->
        <div class="space-y-1">
          <div class="text-[10px] text-neutral-400">Visible tabs</div>
          <div class="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
            <button
              *ngFor="let tab of allTabs"
              (click)="toggleTabVisibility(tab.id)"
              type="button"
              [ngClass]="toggleClasses(isTabVisible(tab.id), true)"
              class="rounded-lg px-2 py-1.5 text-center transition-all duration-200 ease-out"
            >
              {{ tab.label }}
            </button>
          </div>
          <p *ngIf="visibleTabCount() <= 1" class="pt-0.5 text-[9px] text-neutral-500">
            At least one tab stays visible.
          </p>
        </div>
      </div>

      <!-- 2. THEME SETTING -->
      <div class="space-y-2 rounded-xl border border-neutral-800 bg-neutral-900/90 p-3">
        <div class="text-[11px] font-semibold text-neutral-300">Theme</div>
        <div class="flex items-center space-x-2 font-mono text-[10px]">
          <button
            (click)="selectTheme('dark')"
            type="button"
            [ngClass]="toggleClasses(currentTheme() === 'dark')"
            class="flex-1 rounded-lg py-1.5 text-center transition-all duration-200 ease-out"
          >
            Dark Mode
          </button>
          <button
            (click)="selectTheme('light')"
            type="button"
            [ngClass]="toggleClasses(currentTheme() === 'light')"
            class="flex-1 rounded-lg py-1.5 text-center transition-all duration-200 ease-out"
          >
            Light Mode
          </button>
        </div>
      </div>

      <!-- 3. DATA / PERSISTENCE MANAGEMENT -->
      <div class="space-y-2 rounded-xl border border-neutral-800 bg-neutral-900/90 p-3">
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

      <!-- 4. GLOBAL SHORTCUT CONFIGURATION -->
      <div class="space-y-2.5 rounded-xl border border-neutral-800 bg-neutral-900/90 p-3">
        <div class="flex items-center justify-between">
          <div class="text-[11px] font-semibold text-neutral-300">Global Shortcut</div>
          <span
            class="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] text-emerald-400"
          >
            OS-Wide
          </span>
        </div>
        <p class="text-[10px] leading-normal text-neutral-400">
          Bring Bilet-X to the front and toggle the widget from any app.
        </p>
        <div class="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
          <button
            *ngFor="let sc of shortcuts"
            (click)="selectShortcut(sc.id)"
            type="button"
            [ngClass]="toggleClasses(currentShortcut() === sc.id)"
            class="truncate rounded-lg px-2 py-1.5 text-center transition-all duration-200 ease-out"
            [title]="sc.label"
          >
            {{ sc.label }}
          </button>
        </div>
        <div
          class="flex items-center justify-between border-t border-neutral-800/80 pt-2 text-[10px] text-neutral-400"
        >
          <span>In-App Toggle</span>
          <kbd class="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 font-mono"
            >Ctrl + K / Esc</kbd
          >
        </div>
        <div class="flex items-center justify-between text-[10px] text-neutral-400">
          <span>System Tray</span>
          <span class="font-medium text-emerald-400">Active (Minimize/Restore)</span>
        </div>
      </div>

      <!-- 5. DESKTOP NOTIFICATIONS SETTING -->
      <div class="space-y-2.5 rounded-xl border border-neutral-800 bg-neutral-900/90 p-3">
        <div class="flex items-center justify-between">
          <div class="text-[11px] font-semibold text-neutral-300">Desktop Notifications</div>
          <span
            [class.text-emerald-400]="isNotificationsEnabled()"
            [class.bg-emerald-500_10]="isNotificationsEnabled()"
            [class.border-emerald-500_20]="isNotificationsEnabled()"
            [class.text-neutral-500]="!isNotificationsEnabled()"
            [class.bg-neutral-800]="!isNotificationsEnabled()"
            [class.border-neutral-700]="!isNotificationsEnabled()"
            class="rounded border px-1.5 py-0.5 font-mono text-[9px]"
          >
            {{ isNotificationsEnabled() ? 'Enabled' : 'Disabled' }}
          </span>
        </div>
        <div class="flex items-center space-x-2 font-mono text-[10px]">
          <button
            (click)="toggleNotifications(true)"
            type="button"
            [ngClass]="toggleClasses(isNotificationsEnabled())"
            class="flex-1 rounded-lg py-1.5 text-center transition-all duration-200 ease-out"
          >
            On
          </button>
          <button
            (click)="toggleNotifications(false)"
            type="button"
            [ngClass]="toggleClasses(!isNotificationsEnabled())"
            class="flex-1 rounded-lg py-1.5 text-center transition-all duration-200 ease-out"
          >
            Off
          </button>
        </div>
        <button
          (click)="sendTestNotification()"
          type="button"
          [disabled]="!isNotificationsEnabled()"
          class="w-full rounded-lg border border-neutral-800 bg-neutral-800/80 py-1.5 font-mono text-[10px] text-neutral-300 transition hover:bg-neutral-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {{ testNotificationSent() ? '✓ Notification Dispatched!' : 'Send Test Notification' }}
        </button>
      </div>

      <!-- 6. ABOUT & VERSION SCREEN -->
      <div class="space-y-1 rounded-xl border border-neutral-800 bg-neutral-900/90 p-3 text-[10px]">
        <div class="flex items-center justify-between">
          <span class="font-mono font-bold text-white uppercase">Bilet-X Utility</span>
          <span class="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-neutral-300"
            >v0.1.0</span
          >
        </div>
        <p class="pt-1 leading-relaxed text-neutral-400">
          A minimalist desktop floating widget for notes, tasks, and settings.
        </p>
      </div>
    </div>
  `,
})
export class SettingsComponent implements OnDestroy {
  public verticalPositions = [
    { id: 'top-left', label: 'Top Left' },
    { id: 'top-right', label: 'Top Right' },
    { id: 'left', label: 'Left' },
    { id: 'right', label: 'Right' },
    { id: 'bottom-left', label: 'Bottom Left' },
    { id: 'bottom-right', label: 'Bottom Right' },
  ];

  public horizontalPositions = [
    { id: 'top-left', label: 'Top Left' },
    { id: 'top-right', label: 'Top Right' },
    { id: 'top', label: 'Top' },
    { id: 'bottom', label: 'Bottom' },
    { id: 'bottom-left', label: 'Bottom Left' },
    { id: 'bottom-right', label: 'Bottom Right' },
  ];

  public shortcuts = [
    { id: 'CommandOrControl+Shift+K', label: 'Ctrl+Shift+K' },
    { id: 'Alt+Space', label: 'Alt+Space' },
    { id: 'CommandOrControl+Alt+B', label: 'Ctrl+Alt+B' },
    { id: 'CommandOrControl+Shift+Space', label: 'Ctrl+Shift+Space' },
    { id: '', label: 'Disabled' },
  ];

  public dockSizes = [
    { id: 'compact', label: 'Compact' },
    { id: 'normal', label: 'Normal' },
    { id: 'large', label: 'Large' },
  ];

  public dockOrientations = [
    { id: 'vertical', label: 'Vertical' },
    { id: 'horizontal', label: 'Horizontal' },
  ];

  public allTabs = [
    { id: 'notes', label: 'Notes' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'activity', label: 'Activity' },
    { id: 'settings', label: 'Settings' },
  ];

  public currentPosition: Signal<string>;
  public currentTheme: Signal<string>;
  public currentShortcut: Signal<string>;
  public currentDockSize: Signal<string>;
  public currentDockOrientation: Signal<string>;
  public isAutoHideEnabled: Signal<boolean>;
  public visibleTabCount: Signal<number>;
  public activePositions: Signal<{ id: string; label: string }[]>;
  public isNotificationsEnabled: Signal<boolean>;
  public testNotificationSent = signal<boolean>(false);
  private testNotificationTimer: number | undefined;

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
    private notificationService: NotificationService,
    private dockFlip: DockFlipService
  ) {
    this.currentPosition = computed(() =>
      this.persistence.getSettingValue('widget_position', 'right')
    );
    this.currentTheme = computed(() => this.persistence.getSettingValue('theme', 'dark'));
    this.currentShortcut = computed(() =>
      this.persistence.getSettingValue('global_shortcut', 'CommandOrControl+Shift+K')
    );
    this.currentDockSize = computed(() =>
      this.persistence.getSettingValue('dock_size', 'normal')
    );
    this.currentDockOrientation = computed(() =>
      this.persistence.getSettingValue('dock_orientation', 'vertical')
    );
    this.isAutoHideEnabled = computed(
      () => this.persistence.getSettingValue('dock_auto_hide', 'false') === 'true'
    );
    this.visibleTabCount = computed(
      () => this.allTabs.filter((t) => this.isTabVisible(t.id)).length
    );
    this.activePositions = computed(() =>
      this.currentDockOrientation() === 'horizontal'
        ? this.horizontalPositions
        : this.verticalPositions
    );
    this.isNotificationsEnabled = this.notificationService.isNotificationsEnabled;
    this.noteCount = computed(() => this.persistence.notes().length);
    this.taskCount = computed(() => this.persistence.tasks().length);
  }

  public ngOnDestroy(): void {
    if (this.clearNotesTimer !== undefined) window.clearTimeout(this.clearNotesTimer);
    if (this.clearTasksTimer !== undefined) window.clearTimeout(this.clearTasksTimer);
    if (this.testNotificationTimer !== undefined) window.clearTimeout(this.testNotificationTimer);
  }

  // Shared toggle-pill classes. Active pills have inverted colors (white bg +
  // black text) and must keep text black on hover; inactive pills use neutral
  // colors and brighten on hover. `dimInactive` picks a slightly dimmer text
  // for the tab visibility toggles so hidden tabs read distinctly.
  public toggleClasses(active: boolean, dimInactive = false): string {
    if (active) return 'bg-white text-black hover:text-black';
    const inactiveText = dimInactive ? 'text-neutral-500' : 'text-neutral-400';
    return `bg-neutral-800 ${inactiveText} hover:text-white`;
  }

  public async selectShortcut(shortcut: string): Promise<void> {
    const success = await this.windowService.setGlobalShortcut(shortcut);
    if (success) {
      await this.persistence.setSetting('global_shortcut', shortcut);
    }
  }

  public async selectPosition(pos: string): Promise<void> {
    await this.windowService.setPosition(pos);
    await this.persistence.setSetting('widget_position', pos);
  }

  public async selectTheme(theme: string): Promise<void> {
    this.persistence.applyTheme(theme);
    await this.persistence.setSetting('theme', theme);
  }

  public async selectDockSize(size: string): Promise<void> {
    await this.persistence.setSetting('dock_size', size);
  }

  public async selectDockOrientation(orientation: string): Promise<void> {
    // FLIP: capture dock button positions BEFORE the layout change so the
    // dock items smoothly slide from old to new positions.
    this.dockFlip.capture();
    // setSetting updates the local signal synchronously, so Angular flips
    // the dock layout on the next tick; play() then animates each button
    // back to its captured position and releases.
    this.persistence.setSetting('dock_orientation', orientation);
    this.dockFlip.play();

    // Auto-migrate widget_position if the current one isn't valid for the
    // new orientation. selectPosition triggers the animated Rust window
    // move, which runs concurrently with the FLIP transition.
    const currentPos = this.currentPosition();
    const target =
      orientation === 'horizontal'
        ? this.mapToHorizontal(currentPos)
        : this.mapToVertical(currentPos);
    if (target && target !== currentPos) {
      await this.selectPosition(target);
    }
  }

  private mapToHorizontal(pos: string): string | null {
    // Corners and top/bottom (centered) are valid in horizontal;
    // only left/right (middle side) need migration.
    if (pos === 'left' || pos === 'right') return 'bottom';
    return null;
  }

  private mapToVertical(pos: string): string | null {
    // Corners and left/right are valid in vertical;
    // only top/bottom (centered) need migration.
    if (pos === 'top') return 'top-right';
    if (pos === 'bottom') return 'bottom-right';
    return null;
  }

  public async toggleAutoHide(enabled: boolean): Promise<void> {
    await this.persistence.setSetting('dock_auto_hide', enabled ? 'true' : 'false');
  }

  public isTabVisible(tabId: string): boolean {
    return this.persistence.getSettingValue(`tab_${tabId}_visible`, 'true') === 'true';
  }

  public async toggleTabVisibility(tabId: string): Promise<void> {
    const currentlyVisible = this.isTabVisible(tabId);
    // Guard: never let the user hide the last visible tab.
    if (currentlyVisible && this.visibleTabCount() <= 1) return;
    await this.persistence.setSetting(
      `tab_${tabId}_visible`,
      currentlyVisible ? 'false' : 'true'
    );
  }

  public async toggleNotifications(enabled: boolean): Promise<void> {
    await this.notificationService.toggleNotifications(enabled);
  }

  public async sendTestNotification(): Promise<void> {
    const sent = await this.notificationService.sendTestNotification();
    if (sent) {
      this.testNotificationSent.set(true);
      if (this.testNotificationTimer !== undefined) {
        window.clearTimeout(this.testNotificationTimer);
      }
      this.testNotificationTimer = window.setTimeout(() => {
        this.testNotificationSent.set(false);
      }, 2500);
    }
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
      this.CONFIRM_WINDOW_MS
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
      this.CONFIRM_WINDOW_MS
    );
  }
}
