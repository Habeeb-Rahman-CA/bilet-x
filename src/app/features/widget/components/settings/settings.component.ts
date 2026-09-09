import { Component, OnDestroy, Signal, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowService } from '../../../../core/tauri/window.service';
import { PersistenceService } from '../../../../core/tauri/persistence.service';
import { NotificationService } from '../../../../core/tauri/notification.service';
import { DockFlipService } from '../../../../core/services/dock-flip.service';
import { IntegrationRegistryService } from '../../../../integrations/core/integration-registry.service';
import { IntegrationManagerService } from '../../../../integrations/core/integration-manager.service';
import { Integration } from '../../../../integrations/core/integration.interface';
import { UserConnection } from '../../../../integrations/core/models/connection.model';
import { IntegrationCategory } from '../../../../integrations/core/capabilities/capability.types';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
              *ngFor="let tab of allTabs()"
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

      <!-- 6. PLUGGABLE INTEGRATIONS MANAGEMENT -->
      <div class="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/90 p-3">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-[11px] font-semibold text-neutral-200">Connected Services</div>
            <div class="text-[9px] text-neutral-400">Sync external tasks, messages & calendar</div>
          </div>
          <button
            *ngIf="integrationManager.activeConnections().length > 0"
            (click)="syncAllIntegrations()"
            type="button"
            [disabled]="integrationManager.isSyncing()"
            class="flex items-center space-x-1 rounded-md border border-neutral-800 bg-neutral-800/80 px-2 py-1 font-mono text-[9px] text-neutral-300 transition hover:bg-neutral-700 hover:text-white disabled:opacity-50"
          >
            <span [class.animate-spin]="integrationManager.isSyncing()">↻</span>
            <span>{{ integrationManager.isSyncing() ? 'Syncing...' : 'Sync All' }}</span>
          </button>
        </div>

        <!-- CATEGORIES LIST -->
        <div *ngFor="let cat of integrationCategories()" class="space-y-1.5">
          <div class="font-mono text-[9px] font-bold uppercase tracking-wider text-neutral-400">
            {{ cat.label }}
          </div>

          <!-- PROVIDERS IN CATEGORY -->
          <div class="space-y-1.5">
            <div
              *ngFor="let provider of cat.providers"
              class="rounded-lg border border-neutral-800/80 bg-neutral-950/60 p-2.5 transition hover:border-neutral-700"
            >
              <div class="flex items-start justify-between">
                <div class="space-y-1">
                  <div class="flex items-center space-x-1.5">
                    <span class="font-semibold text-neutral-200">{{ provider.displayName }}</span>
                    <!-- Capability badges -->
                    <span
                      *ngFor="let cap of provider.supportedCapabilities"
                      class="rounded bg-neutral-800 px-1.5 py-0.2 font-mono text-[8px] text-neutral-400"
                    >
                      {{ cap }}
                    </span>
                  </div>
                  <div class="text-[10px] text-neutral-400">{{ provider.description }}</div>
                </div>

                <!-- Action button: providers with inline tab UI show a hint; others show Connect -->
                <div>
                  <!-- All other providers: show Connect button -->
                  <button
                    *ngIf="!provider.hasInlineConnectUI && getConnectionsForProvider(provider.id).length === 0"
                    (click)="openConnectForm(provider)"
                    type="button"
                    class="rounded-md bg-white px-2 py-1 font-mono text-[9px] font-medium text-black transition hover:bg-neutral-200"
                  >
                    Connect
                  </button>
                </div>
              </div>

              <!-- ACTIVE CONNECTIONS FOR THIS PROVIDER -->
              <div *ngIf="getConnectionsForProvider(provider.id).length > 0" class="mt-2 space-y-1.5 border-t border-neutral-800/60 pt-2">
                <div
                  *ngFor="let conn of getConnectionsForProvider(provider.id)"
                  class="flex items-center justify-between rounded-md bg-neutral-900 p-1.5 text-[10px]"
                >
                  <div class="flex items-center space-x-1.5 overflow-hidden">
                    <span
                      class="h-1.5 w-1.5 shrink-0 rounded-full"
                      [class.bg-emerald-400]="conn.status === 'connected'"
                      [class.bg-yellow-400]="conn.status === 'connecting' || conn.status === 'syncing'"
                      [class.bg-red-400]="conn.status === 'error'"
                    ></span>
                    <span class="truncate font-mono text-neutral-300">{{ conn.accountName }}</span>
                    <span *ngIf="conn.accountEmail" class="truncate text-[9px] text-neutral-500">({{ conn.accountEmail }})</span>
                  </div>

                  <div class="flex items-center space-x-1 shrink-0">
                    <button
                      (click)="testConnection(conn.connectionId)"
                      type="button"
                      [title]="'Test connection'"
                      class="rounded px-1.5 py-0.5 font-mono text-[9px] text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
                    >
                      {{ getTestStatusLabel(conn.connectionId) }}
                    </button>
                    <button
                      (click)="disconnect(conn.connectionId)"
                      type="button"
                      class="rounded px-1.5 py-0.5 font-mono text-[9px] text-red-400 transition hover:bg-red-500/20 hover:text-red-300"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              </div>

              <!-- EXPANDABLE CONNECTION CONFIG FORM (not shown for providers with inline tab setup) -->
              <div
                *ngIf="!provider.hasInlineConnectUI && activeForm() && activeForm()?.providerId === provider.id"
                class="mt-2.5 rounded-lg border border-neutral-700 bg-neutral-900 p-2.5 space-y-2 text-xs"
              >
                <div class="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                  <span class="font-semibold text-white">Configure {{ provider.displayName }}</span>
                  <button
                    (click)="closeConnectForm()"
                    type="button"
                    class="text-neutral-500 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div *ngIf="activeForm()?.error" class="rounded bg-red-500/10 border border-red-500/20 p-1.5 text-[9px] text-red-400">
                  {{ activeForm()?.error }}
                </div>

                <!-- DYNAMIC CONFIG FIELDS -->
                <div *ngFor="let field of provider.configFields" class="space-y-0.5">
                  <label class="flex items-center justify-between text-[9px] text-neutral-300">
                    <span>{{ field.label }} <span *ngIf="field.required" class="text-red-400">*</span></span>
                    <span *ngIf="field.isSecret" class="font-mono text-[8px] text-emerald-400">Encrypted</span>
                  </label>
                  <input
                    [type]="field.type"
                    [placeholder]="field.placeholder || ''"
                    [(ngModel)]="activeForm()!.formData[field.key]"
                    class="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-[10px] text-white placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
                  />
                  <div *ngIf="field.description" class="text-[8px] text-neutral-500">
                    {{ field.description }}
                  </div>
                </div>

                <!-- FORM ACTIONS -->
                <div class="flex items-center justify-end space-x-1.5 pt-1">
                  <button
                    (click)="closeConnectForm()"
                    type="button"
                    class="rounded px-2 py-1 font-mono text-[9px] text-neutral-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    (click)="saveConnection(provider)"
                    type="button"
                    [disabled]="activeForm()?.isSaving"
                    class="rounded bg-white px-2.5 py-1 font-mono text-[9px] font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
                  >
                    {{ activeForm()?.isSaving ? 'Connecting...' : 'Save & Connect' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 7. ABOUT & VERSION SCREEN -->
      <div class="space-y-1 rounded-xl border border-neutral-800 bg-neutral-900/90 p-3 text-[10px]">
        <div class="flex items-center justify-between">
          <span class="font-mono font-bold text-white uppercase">Bilet-X Utility</span>
          <span class="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-neutral-300"
            >v1.0.2</span
          >
        </div>
        <p class="pt-1 leading-relaxed text-neutral-400">
          Always-on-top desktop widget for notes, tasks, and quick actions. Runs
          locally, follows you across workspaces via a global hotkey.
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

  public allTabs = computed(() => [
    { id: 'notes', label: 'Notes' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'messages', label: 'Gmail' },
    { id: 'jira', label: 'Jira' },
    { id: 'activity', label: 'Activity' },
    { id: 'settings', label: 'Settings' },
  ]);

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

  // Integrations state
  public activeForm = signal<{
    providerId: string;
    connectionId?: string;
    formData: Record<string, string>;
    isSaving: boolean;
    error: string | null;
  } | null>(null);

  public testStatusMap = signal<Map<string, 'testing' | 'success' | 'failed'>>(new Map());

  public integrationCategories = computed(() => {
    const providers = this.registry.registeredProviders();
    const categories: { id: IntegrationCategory; label: string; providers: Integration[] }[] = [
      { id: 'communication', label: 'Communication & Messages', providers: [] },
      { id: 'tasks', label: 'Tasks & Issue Trackers', providers: [] },
      { id: 'calendar', label: 'Calendar & Schedule', providers: [] },
      { id: 'developer', label: 'Developer Tools', providers: [] },
    ];

    for (const p of providers) {
      const match = categories.find((c) => c.id === p.category);
      if (match) {
        match.providers.push(p);
      } else {
        categories.push({ id: p.category, label: p.category, providers: [p] });
      }
    }

    return categories.filter((c) => c.providers.length > 0);
  });

  constructor(
    private windowService: WindowService,
    private persistence: PersistenceService,
    private notificationService: NotificationService,
    private dockFlip: DockFlipService,
    public registry: IntegrationRegistryService,
    public integrationManager: IntegrationManagerService
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
      () => this.allTabs().filter((t) => this.isTabVisible(t.id)).length
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

  // Integrations helper methods
  public getConnectionsForProvider(providerId: string): UserConnection[] {
    return this.integrationManager.getConnectionsForProvider(providerId);
  }

  public openConnectForm(provider: Integration, existing?: UserConnection): void {
    const formData: Record<string, string> = {};
    for (const field of provider.configFields) {
      formData[field.key] = existing?.config?.[field.key] || field.defaultValue || '';
    }
    this.activeForm.set({
      providerId: provider.id,
      connectionId: existing?.connectionId,
      formData,
      isSaving: false,
      error: null,
    });
  }

  public closeConnectForm(): void {
    this.activeForm.set(null);
  }

  public async saveConnection(provider: Integration): Promise<void> {
    const form = this.activeForm();
    if (!form) return;

    // Validate required fields
    for (const field of provider.configFields) {
      if (field.required && !form.formData[field.key]?.trim()) {
        this.activeForm.update((f) => f ? { ...f, error: `${field.label} is required.` } : null);
        return;
      }
    }

    this.activeForm.update((f) => f ? { ...f, isSaving: true, error: null } : null);

    try {
      const conn = await this.integrationManager.connectProvider(
        provider.id,
        form.formData,
        form.connectionId
      );

      if (conn.status === 'error') {
        this.activeForm.update((f) => f ? { ...f, isSaving: false, error: conn.errorMessage || 'Connection failed' } : null);
      } else {
        this.closeConnectForm();
      }
    } catch (err: any) {
      this.activeForm.update((f) => f ? { ...f, isSaving: false, error: err?.message || 'Failed to connect' } : null);
    }
  }

  public async disconnect(connectionId: string): Promise<void> {
    await this.integrationManager.disconnectConnection(connectionId);
  }

  public async testConnection(connectionId: string): Promise<void> {
    this.testStatusMap.update((m) => new Map(m).set(connectionId, 'testing'));
    const success = await this.integrationManager.testConnection(connectionId);
    this.testStatusMap.update((m) => new Map(m).set(connectionId, success ? 'success' : 'failed'));

    setTimeout(() => {
      this.testStatusMap.update((m) => {
        const next = new Map(m);
        next.delete(connectionId);
        return next;
      });
    }, 3000);
  }

  public getTestStatusLabel(connectionId: string): string {
    const status = this.testStatusMap().get(connectionId);
    if (status === 'testing') return 'Testing...';
    if (status === 'success') return '✓ Valid';
    if (status === 'failed') return '✕ Failed';
    return 'Test';
  }

  public async syncAllIntegrations(): Promise<void> {
    await this.integrationManager.syncAll();
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
