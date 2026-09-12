import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowService } from '../../core/tauri/window.service';
import { PersistenceService } from '../../core/tauri/persistence.service';
import { LayoutService } from '../../core/services/layout.service';
import {
  DockComponent,
  DockTab,
  DockSize,
  DockOrientation,
} from './components/dock/dock.component';
import { NoteComponent } from './components/note/note.component';
import { TaskComponent } from './components/task/task.component';
import { MessagesComponent } from './components/messages/messages.component';
import { JiraComponent } from './components/jira/jira.component';
import { GitHubComponent } from './components/github/github.component';
import { OutlookComponent } from './components/outlook/outlook.component';
import { WhatsAppComponent } from './components/whatsapp/whatsapp.component';
import { SlackComponent } from './components/slack/slack.component';
import { CalendarComponent } from './components/calendar/calendar.component';
import { CalculatorComponent } from './components/calculator/calculator.component';
import { PomodoroComponent } from './components/pomodoro/pomodoro.component';
import { ClipboardComponent } from './components/clipboard/clipboard.component';
import { ActivityComponent } from './components/activity/activity.component';
import { SettingsComponent } from './components/settings/settings.component';
import { IntegrationManagerService } from '../../integrations/core/integration-manager.service';

@Component({
  selector: 'app-widget',
  standalone: true,
  imports: [
    CommonModule,
    DockComponent,
    NoteComponent,
    TaskComponent,
    MessagesComponent,
    JiraComponent,
    GitHubComponent,
    OutlookComponent,
    WhatsAppComponent,
    SlackComponent,
    CalendarComponent,
    CalculatorComponent,
    PomodoroComponent,
    ClipboardComponent,
    ActivityComponent,
    SettingsComponent,
  ],
  template: `
    <div
      class="relative flex h-screen w-screen overflow-hidden bg-transparent text-neutral-100 select-none transition-opacity duration-100 ease-out"
      [class.justify-start]="isLeftSide()"
      [class.justify-center]="isHorizontallyCentered()"
      [class.justify-end]="!isLeftSide() && !isHorizontallyCentered()"
      [class.items-start]="isTopSide()"
      [class.items-end]="isBottomSide()"
      [class.items-center]="!isTopSide() && !isBottomSide()"
      [class.opacity-20]="isOrientationChanging()"
    >

      <!-- Inner container: flex-row for vertical dock (panel + dock side by side),
           flex-col for horizontal dock (panel + dock stacked). -->
      <div
        class="relative flex gap-3"
        [class.flex-row]="dockOrientation() === 'vertical' && !isLeftSide()"
        [class.flex-row-reverse]="dockOrientation() === 'vertical' && isLeftSide()"
        [class.flex-col]="dockOrientation() === 'horizontal' && !isTopSide()"
        [class.flex-col-reverse]="dockOrientation() === 'horizontal' && isTopSide()"
        [class.items-start]="dockOrientation() === 'vertical' && isTopSide()"
        [class.items-end]="dockOrientation() === 'vertical' && isBottomSide()"
        [class.items-center]="
          dockOrientation() === 'horizontal' || (!isTopSide() && !isBottomSide())
        "
        (click)="$event.stopPropagation()"
      >
        <!-- FLYOUT QUICK PANEL -->
        <div
          #panelEl
          *ngIf="isPanelExpanded()"
          class="animate-panel-expand flex w-[380px] flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/95 p-4 text-neutral-100 shadow-2xl backdrop-blur-xl transition-[height] duration-300 ease-out"
          [style.height]="
            dockOrientation() === 'horizontal' ? '340px' : 'calc(100vh - 1rem)'
          "
        >
          <!-- PANEL TOP HEADER ACTION CONTROLS -->
          <div
            class="titlebar-drag-region flex items-center justify-between border-b border-neutral-800/80 pb-3"
          >
            <!-- Left Header Title -->
            <div class="no-drag flex items-center space-x-1.5">
              <span class="font-mono text-xs font-bold tracking-wider text-neutral-200 uppercase">
                {{ activeTab().label }}
              </span>
            </div>

            <!-- Right Header Close Button -->
            <div class="no-drag flex items-center space-x-1.5">
              <button
                (click)="collapseToWidget()"
                type="button"
                title="Close (ESC)"
                class="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-400 transition hover:bg-white hover:text-black"
              >
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
                  class="lucide lucide-x"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- PANEL MAIN CONTENT BODY -->
          <div class="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <!-- VIEW 1: NOTE COMPONENT -->
            <app-note *ngIf="activeTab().id === 'notes'"></app-note>

            <!-- VIEW 2: TASK COMPONENT -->
            <app-task *ngIf="activeTab().id === 'tasks'"></app-task>

            <!-- VIEW 2b: MESSAGES / GMAIL COMPONENT -->
            <app-messages *ngIf="activeTab().id === 'messages'"></app-messages>

            <!-- VIEW 2c: JIRA COMPONENT -->
            <app-jira *ngIf="activeTab().id === 'jira'"></app-jira>

            <!-- VIEW 2c2: GITHUB COMPONENT -->
            <app-github *ngIf="activeTab().id === 'github'"></app-github>

            <!-- VIEW 2c3: OUTLOOK COMPONENT -->
            <app-outlook *ngIf="activeTab().id === 'outlook'"></app-outlook>

            <!-- VIEW 2c4: WHATSAPP DEEP-LINK -->
            <app-whatsapp *ngIf="activeTab().id === 'whatsapp'"></app-whatsapp>

            <!-- VIEW 2c5: SLACK COMPONENT -->
            <app-slack *ngIf="activeTab().id === 'slack'"></app-slack>

            <!-- VIEW 2d: CALENDAR COMPONENT -->
            <app-calendar *ngIf="activeTab().id === 'calendar'"></app-calendar>

            <!-- VIEW 2e: CALCULATOR COMPONENT -->
            <app-calculator *ngIf="activeTab().id === 'calculator'"></app-calculator>

            <!-- VIEW 2f: POMODORO COMPONENT -->
            <app-pomodoro *ngIf="activeTab().id === 'pomodoro'"></app-pomodoro>

            <!-- VIEW 2g: CLIPBOARD COMPONENT -->
            <app-clipboard *ngIf="activeTab().id === 'clipboard'"></app-clipboard>

            <!-- VIEW 3: ACTIVITY COMPONENT -->
            <app-activity *ngIf="activeTab().id === 'activity'"></app-activity>

            <!-- VIEW 4: SETTINGS COMPONENT -->
            <app-settings *ngIf="activeTab().id === 'settings'"></app-settings>
          </div>
        </div>

        <!-- DOCK COMPONENT (Notes, Tasks, Gmail, Activity, Settings) -->
        <app-dock
          #dockEl
          [tabs]="visibleTabs()"
          [activeTabId]="activeTab().id"
          [isPanelExpanded]="isPanelExpanded()"
          [size]="dockSize()"
          [orientation]="dockOrientation()"
          [faded]="dockFaded()"
          [isEditMode]="isEditMode()"
          [hiddenTabs]="hiddenTabs()"
          [popoverDirection]="popoverDirection()"
          (tabSelect)="selectTab($event)"
          (tabReorder)="onTabReorder($event)"
          (enterEditMode)="isEditMode.set(true)"
          (addTab)="onAddTab($event)"
          (removeTab)="onRemoveTab($event)"
          (cycleDockSize)="onCycleDockSize()"
          (toggleDockOrientation)="onToggleDockOrientation()"
          (mouseenter)="onDockMouseEnter()"
          (mouseleave)="onDockMouseLeave()"
        ></app-dock>
      </div>
    </div>
  `,
})
export class WidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  public isPanelExpanded = signal<boolean>(false);

  /**
   * Global "edit mode" — entered by a long-press on any dock tab. In this
   * mode tabs jiggle, drag-to-reorder is enabled without any timing
   * gesture, a + button appears to add hidden tabs, and top/bottom resize
   * handles show on the panel. Exit by selecting a tab, pressing ESC, or
   * clicking outside the dock.
   */
  public isEditMode = signal<boolean>(false);

  /**
   * True during the ~450ms V↔H orientation transition. Fades the widget
   * out and back in so the internal flex-direction snap (which CSS can't
   * interpolate) is invisible; the OS window slide happens concurrently.
   */
  public isOrientationChanging = signal<boolean>(false);

  /**
   * True while a programmatic set_widget_position is animating. The
   * animation itself fires WindowEvent::Moved on the Rust side, which
   * writes back to widget_x/widget_y — the snap-detect effect must
   * ignore those or we get a feedback loop.
   */
  private isProgrammaticMove = false;

  /**
   * Debounce timer for drag-end detection. Reset every time widget_x/y
   * changes; when it fires quietly, we know the user released the drag.
   */
  private dragEndTimer: number | undefined;

  /**
   * Last window position reported by Rust's WindowEvent::Moved. Physical
   * pixels — divide by devicePixelRatio to compare with CSS-pixel screen
   * dimensions. window.screenX/Y is unreliable in Tauri webviews on
   * Windows (often returns 0), so we take the value straight from the
   * event payload instead.
   */
  private lastMovedX = 0;
  private lastMovedY = 0;

  // Per-provider unread counts — otherwise the Gmail badge would double-
  // count Outlook mail (and vice versa) once both are connected.
  public unreadGmailCount = computed(
    () =>
      this.integrationManager
        .unifiedMessages()
        .filter((m) => m.providerId === 'gmail' && !m.isRead).length
  );

  public unreadOutlookCount = computed(
    () =>
      this.integrationManager
        .unifiedMessages()
        .filter((m) => m.providerId === 'outlook' && !m.isRead).length
  );

  public unreadSlackCount = computed(
    () =>
      this.integrationManager
        .unifiedMessages()
        .filter((m) => m.providerId === 'slack' && !m.isRead).length
  );

  public openJiraCount = computed(
    () =>
      this.integrationManager
        .unifiedTasks()
        .filter(
          (t) => t.providerId === 'jira' && t.status !== 'done' && t.status !== 'cancelled'
        ).length
  );

  public openGitHubCount = computed(
    () =>
      this.integrationManager
        .unifiedTasks()
        .filter(
          (t) => t.providerId === 'github' && t.status !== 'done' && t.status !== 'cancelled'
        ).length
  );

  // Release-visible tabs. Tasks / Calculator / Pomodoro / Clipboard / Activity
  // are intentionally hidden until their features are production-ready — the
  // component code, service wiring, Rust commands, and template views all stay
  // in place, so re-enabling is just uncommenting the matching line here (and
  // in settings.component.ts allTabs).
  public allAvailableTabs = computed<DockTab[]>(() => [
    { id: 'notes', label: 'Notes' },
    // { id: 'tasks', label: 'Tasks' },
    {
      id: 'messages',
      label: 'Gmail',
      icon: 'gmail',
      badgeCount: this.integrationManager.hasCapability('messages')
        ? this.unreadGmailCount()
        : 0,
    },
    {
      id: 'jira',
      label: 'Jira',
      icon: 'jira',
      badgeCount: this.integrationManager.hasCapability('tasks')
        ? this.openJiraCount()
        : 0,
    },
    {
      id: 'github',
      label: 'GitHub',
      icon: 'github',
      badgeCount: this.integrationManager.hasCapability('tasks')
        ? this.openGitHubCount()
        : 0,
    },
    {
      id: 'outlook',
      label: 'Outlook',
      icon: 'outlook',
      badgeCount: this.integrationManager.hasCapability('messages')
        ? this.unreadOutlookCount()
        : 0,
    },
    { id: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp' },
    {
      id: 'slack',
      label: 'Slack',
      icon: 'slack',
      badgeCount: this.integrationManager.hasCapability('messages')
        ? this.unreadSlackCount()
        : 0,
    },
    { id: 'calendar', label: 'Calendar' },
    // { id: 'calculator', label: 'Calculator' },
    // { id: 'pomodoro', label: 'Pomodoro' },
    // { id: 'clipboard', label: 'Clipboard' },
    // { id: 'activity', label: 'Activity' },
    { id: 'settings', label: 'Settings' },
  ]);

  public activeTab = signal<DockTab>({ id: 'notes', label: 'Notes' });

  // Derived from the saved widget_position setting. Drives dock alignment
  // inside the transparent 640x440 window and the side the panel flies out to.
  public currentPosition = computed(() =>
    this.persistence.getSettingValue('widget_position', 'right')
  );
  public isLeftSide = computed(() => this.currentPosition().includes('left'));
  public isTopSide = computed(() => this.currentPosition().startsWith('top'));
  public isBottomSide = computed(() => this.currentPosition().startsWith('bottom'));
  // Only the exact "top" and "bottom" presets are centered on their axis;
  // "top-left", "bottom-right" etc. carry an explicit horizontal side.
  public isHorizontallyCentered = computed(() => {
    const p = this.currentPosition();
    return p === 'top' || p === 'bottom';
  });

  /**
   * Where the add-tab popover should open, relative to the + button in
   * the dock. Popover has to open toward the interior of the widget
   * window — opening toward the screen edge would render it outside the
   * 640-wide transparent window and get clipped.
   */
  public popoverDirection = computed<'left' | 'right' | 'up' | 'down'>(() => {
    const p = this.currentPosition();
    if (p === 'top') return 'down';
    if (p === 'bottom') return 'up';
    if (p.includes('left')) return 'right';
    // Everything else ('right', 'top-right', 'bottom-right', fallback) puts
    // the dock on the right side of the window; popover has to open left.
    return 'left';
  });

  // Dock customization signals (Task 5)
  public dockSize = computed<DockSize>(
    () => (this.persistence.getSettingValue('dock_size', 'normal') as DockSize)
  );
  public dockOrientation = computed<DockOrientation>(
    () =>
      (this.persistence.getSettingValue('dock_orientation', 'vertical') as DockOrientation)
  );
  private dockAutoHideEnabled = computed(
    () => this.persistence.getSettingValue('dock_auto_hide', 'false') === 'true'
  );
  private isHoveringDock = signal<boolean>(false);
  public dockFaded = computed(
    () =>
      this.dockAutoHideEnabled() && !this.isPanelExpanded() && !this.isHoveringDock()
  );

  // Apply the user's persisted drag-reorder before filtering by visibility.
  // Tabs added in later releases that aren't yet in the saved order simply
  // appear at the end (preserving their declaration order relative to each
  // other), so upgrades don't silently hide new features.
  public sortedTabs = computed<DockTab[]>(() => {
    const all = this.allAvailableTabs();
    const orderStr = this.persistence.getSettingValue('dock_tab_order', '');
    if (!orderStr) return all;

    const savedIds = orderStr.split(',').map((s) => s.trim()).filter(Boolean);
    const remaining = new Map(all.map((t) => [t.id, t]));
    const ordered: DockTab[] = [];
    for (const id of savedIds) {
      const t = remaining.get(id);
      if (t) {
        ordered.push(t);
        remaining.delete(id);
      }
    }
    return [...ordered, ...remaining.values()];
  });

  // Filter tabs by per-tab visibility settings.
  //
  // Settings defaults to HIDDEN — users get to it via edit mode's + button.
  // Every other tab defaults to visible, so upgrades don't hide anything a
  // user was already using.
  public visibleTabs = computed<DockTab[]>(() => {
    const sorted = this.sortedTabs();
    return sorted.filter((t) => this.isTabVisible(t));
  });

  /** Tabs that exist in allAvailableTabs but aren't currently visible. */
  public hiddenTabs = computed<DockTab[]>(() => {
    const sorted = this.sortedTabs();
    return sorted.filter((t) => !this.isTabVisible(t));
  });

  private isTabVisible(t: DockTab): boolean {
    const defaultVisible = t.id === 'settings' ? 'false' : 'true';
    return this.persistence.getSettingValue(`tab_${t.id}_visible`, defaultVisible) === 'true';
  }

  @ViewChild('dockEl', { read: ElementRef }) private dockRef?: ElementRef<HTMLElement>;
  @ViewChild('panelEl', { read: ElementRef }) private panelRef?: ElementRef<HTMLElement>;

  private postAnimationTimer: number | undefined;
  private hoverLeaveTimer: number | undefined;
  private unlistenToggleWidget?: () => void;
  private positionPollTimer: number | undefined;
  private lastPolledX = 0;
  private lastPolledY = 0;
  private stationarySince = 0;
  private hasPolledOnce = false;
  private readonly HOVER_LEAVE_MS = 600;

  constructor(
    private windowService: WindowService,
    private persistence: PersistenceService,
    private layoutService: LayoutService,
    public integrationManager: IntegrationManagerService
  ) {
    // Re-measure whenever the panel expands/collapses. Effects run outside the
    // render lifecycle, so we defer to rAF and also re-measure after the 180ms
    // panel-expand animation settles at its final scale.
    effect(() => {
      this.isPanelExpanded();
      // Re-measure when the widget's screen position, orientation, or size
      // changes too — dock/panel move within the window, so the click-through
      // rect shifts.
      this.currentPosition();
      this.dockOrientation();
      this.dockSize();
      this.visibleTabs();
      // Edit mode expands the interactive rect to the whole window so the
      // + popover and resize handles (which sit outside the dock/panel
      // bounds) still receive clicks instead of falling into a click-
      // through region.
      this.isEditMode();
      this.scheduleInteractiveAreaUpdate();
    });

    // If the user hides the currently-active tab, switch to the first visible
    // tab so the panel doesn't render a stale/empty view.
    effect(() => {
      const tabs = this.visibleTabs();
      const active = this.activeTab();
      if (!tabs.some((t) => t.id === active.id)) {
        this.activeTab.set(tabs[0]);
      }
    });

  }

  public async ngOnInit(): Promise<void> {
    this.unlistenToggleWidget = await this.windowService.onToggleWidget(async () => {
      const nextState = !this.isPanelExpanded();
      if (nextState) {
        await this.layoutService.ensureVisible();
      }
      this.isPanelExpanded.set(nextState);
      if (nextState) {
        this.windowService.focusWindow();
      }
    });

    // Drag-end detection via polling. Rust events from WindowEvent::Moved
    // don't consistently reach the webview in this Tauri build, so we
    // poll the window position instead — same command that Rust uses
    // internally, called through Tauri IPC every 100ms. Once the position
    // has been unchanged for 400ms, the user has released the drag →
    // snap to the nearest configured preset.
    this.positionPollTimer = window.setInterval(() => this.pollWidgetPosition(), 100);
  }


  public ngAfterViewInit(): void {
    this.scheduleInteractiveAreaUpdate();
  }

  public ngOnDestroy(): void {
    if (this.postAnimationTimer !== undefined) {
      window.clearTimeout(this.postAnimationTimer);
    }
    if (this.hoverLeaveTimer !== undefined) {
      window.clearTimeout(this.hoverLeaveTimer);
    }
    if (this.unlistenToggleWidget) {
      this.unlistenToggleWidget();
    }
    if (this.positionPollTimer !== undefined) {
      window.clearInterval(this.positionPollTimer);
    }
  }

  /**
   * Persist a drag-reorder emitted by the dock. `fromIndex` and `toIndex`
   * are indices into visibleTabs; we translate them into a new full-list
   * order (preserving hidden tabs at their pre-existing positions) and
   * write the flat comma-separated ID string to settings.
   */
  public async onTabReorder(evt: { fromIndex: number; toIndex: number }): Promise<void> {
    const visible = this.visibleTabs();
    if (
      evt.fromIndex < 0 ||
      evt.toIndex < 0 ||
      evt.fromIndex >= visible.length ||
      evt.toIndex >= visible.length ||
      evt.fromIndex === evt.toIndex
    ) {
      return;
    }

    // Move within the visible list.
    const movedVisible = [...visible];
    const [item] = movedVisible.splice(evt.fromIndex, 1);
    movedVisible.splice(evt.toIndex, 0, item);

    // Merge back into the full sorted list: hidden tabs stay put, visible
    // tabs are pulled in the new order.
    const sorted = this.sortedTabs();
    const visibleIdSet = new Set(visible.map((t) => t.id));
    const nextVisibleIter = movedVisible[Symbol.iterator]();
    const newFullOrder: DockTab[] = [];
    for (const t of sorted) {
      if (visibleIdSet.has(t.id)) {
        const nxt = nextVisibleIter.next();
        if (!nxt.done) newFullOrder.push(nxt.value);
      } else {
        newFullOrder.push(t);
      }
    }

    await this.persistence.setSetting(
      'dock_tab_order',
      newFullOrder.map((t) => t.id).join(',')
    );
  }

  /**
   * Called from the dock's + popover: flip a hidden tab's visibility to
   * true. Persisted through the same setting the settings screen uses,
   * so the two paths stay in sync.
   */
  public async onAddTab(tab: DockTab): Promise<void> {
    await this.persistence.setSetting(`tab_${tab.id}_visible`, 'true');
  }

  /**
   * Called when a tab is dragged onto the X (was +) inside the dock while
   * in edit mode. Hides the tab (visible=false) — the tab moves into the
   * hidden-tabs popover, from which it can be re-added.
   */
  public async onRemoveTab(tab: DockTab): Promise<void> {
    await this.persistence.setSetting(`tab_${tab.id}_visible`, 'false');
    // If the currently active tab just got hidden, switch to the first
    // remaining visible tab so the panel doesn't show a stale view.
    if (this.activeTab().id === tab.id) {
      const first = this.visibleTabs()[0];
      if (first) this.activeTab.set(first);
    }
  }

  /** Cycle dock size: compact → normal → large → compact. */
  public async onCycleDockSize(): Promise<void> {
    const cycle: DockSize[] = ['compact', 'normal', 'large'];
    const current = this.dockSize();
    const idx = cycle.indexOf(current);
    const next = cycle[(idx === -1 ? 0 : idx + 1) % cycle.length];
    await this.persistence.setSetting('dock_size', next);
  }

  /**
   * Move the widget to a preset position with the same fade+slide timeline
   * the orientation toggle uses. isProgrammaticMove is flipped for the
   * duration of the Rust animation so the drag-end effect doesn't try to
   * snap while our own slide is midway.
   */
  public async onSetWidgetPosition(pos: string): Promise<void> {
    if (pos === this.currentPosition()) return;

    this.isProgrammaticMove = true;
    void this.windowService.setPosition(pos);

    this.isOrientationChanging.set(true);
    await new Promise((r) => setTimeout(r, 100));
    await this.persistence.setSetting('widget_position', pos);
    this.isOrientationChanging.set(false);

    // Give the Rust slide time to settle before releasing the guard.
    // set_widget_position runs for 180ms; add margin.
    await new Promise((r) => setTimeout(r, 250));
    this.isProgrammaticMove = false;
  }

  /**
   * Polled every 100ms — asks Rust for the window's current position and
   * compares to the previous poll. If the position has been unchanged for
   * 400ms, the user has released a drag and we snap to the nearest preset.
   * Short-circuited during our own animated slides via isProgrammaticMove.
   */
  private async pollWidgetPosition(): Promise<void> {
    if (this.isProgrammaticMove) return;

    const [x, y] = await this.windowService.getWidgetPosition();

    if (!this.hasPolledOnce) {
      // First poll — just capture baseline. Position is where the widget
      // started this session; not a drag.
      this.lastPolledX = x;
      this.lastPolledY = y;
      this.lastMovedX = x;
      this.lastMovedY = y;
      this.hasPolledOnce = true;
      return;
    }

    if (x === this.lastPolledX && y === this.lastPolledY) {
      if (this.stationarySince > 0 && Date.now() - this.stationarySince >= 400) {
        // Been still long enough — snap. Zero out stationarySince so we
        // don't re-fire until the position changes again.
        this.stationarySince = 0;
        await this.snapToNearestPreset();
      }
    } else {
      // Position changed — user is dragging. Reset the stationary counter.
      this.lastPolledX = x;
      this.lastPolledY = y;
      this.lastMovedX = x;
      this.lastMovedY = y;
      this.stationarySince = Date.now();
    }
  }

  /**
   * On drag-end (400ms of quiet after the last poll saw movement), work
   * out which preset position the widget's center is closest to and slide
   * there. Rust reports positions in physical pixels; we convert to CSS
   * pixels so the comparison against screen dimensions is apples-to-apples.
   */
  private async snapToNearestPreset(): Promise<void> {
    if (this.isProgrammaticMove) return;

    const scale = window.devicePixelRatio || 1;
    // Widget top-left in CSS pixels (Rust reports physical).
    const posX = this.lastMovedX / scale;
    const posY = this.lastMovedY / scale;
    const centerX = posX + window.innerWidth / 2;
    const centerY = posY + window.innerHeight / 2;

    const valid: string[] =
      this.dockOrientation() === 'horizontal'
        ? ['top-left', 'top', 'top-right', 'bottom-left', 'bottom', 'bottom-right']
        : ['top-left', 'top-right', 'left', 'right', 'bottom-left', 'bottom-right'];

    let nearest = valid[0];
    let minDist = Infinity;
    for (const pos of valid) {
      const c = this.presetCenter(pos);
      if (!c) continue;
      const dx = c.x - centerX;
      const dy = c.y - centerY;
      const d = dx * dx + dy * dy;
      if (d < minDist) {
        minDist = d;
        nearest = pos;
      }
    }

    console.debug('[Widget] snap', {
      cursorPos: { x: posX, y: posY },
      center: { x: centerX, y: centerY },
      current: this.currentPosition(),
      nearest,
      distances: valid.map((p) => {
        const c = this.presetCenter(p);
        return c
          ? { p, d: Math.round(Math.hypot(c.x - centerX, c.y - centerY)) }
          : null;
      }),
    });

    if (nearest !== this.currentPosition()) {
      await this.onSetWidgetPosition(nearest);
    }
  }

  /**
   * CSS-pixel center of the widget window if it were sitting at the given
   * preset. Mirrors set_widget_position in Rust: 10px inset from edges,
   * side centers on the perpendicular axis.
   */
  private presetCenter(pos: string): { x: number; y: number } | null {
    const sw = window.screen.availWidth;
    const sh = window.screen.availHeight;
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    const hx = ww / 2;
    const hy = wh / 2;
    switch (pos) {
      case 'left':         return { x: 10 + hx,      y: sh / 2 };
      case 'right':        return { x: sw - 10 - hx, y: sh / 2 };
      case 'top':          return { x: sw / 2,       y: 10 + hy };
      case 'bottom':       return { x: sw / 2,       y: sh - 10 - hy };
      case 'top-left':     return { x: 10 + hx,      y: 10 + hy };
      case 'top-right':    return { x: sw - 10 - hx, y: 10 + hy };
      case 'bottom-left':  return { x: 10 + hx,      y: sh - 10 - hy };
      case 'bottom-right': return { x: sw - 10 - hx, y: sh - 10 - hy };
    }
    return null;
  }

  /**
   * Flip dock orientation: vertical ↔ horizontal. Also snap the widget to
   * a sensible screen edge for the new orientation — a horizontal dock on
   * the left/right sides of the screen looks broken, so pushing it to the
   * bottom (and vice versa: sides-in-vertical) restores a coherent layout.
   * Corner positions ("top-right", "bottom-left", etc.) work in both modes
   * and are left alone.
   *
   * Timeline (everything runs in parallel — no dead pauses = no perceived
   * lag). The 100ms fade is short enough to read as a wink, and it overlaps
   * the OS window slide so *something* is always moving:
   *
   *   t=0    click:  start OS window slide (Rust animates ~250ms)
   *                  start fade out (100ms → opacity-20)
   *   t=100  fade at trough → apply layout changes invisibly
   *                            → start fade-in (100ms)
   *   t=200  fade done; window still gliding
   *   t=250  window slide complete
   */
  public async onToggleDockOrientation(): Promise<void> {
    const nextOrientation: DockOrientation =
      this.dockOrientation() === 'vertical' ? 'horizontal' : 'vertical';

    let nextPosition: string | null = null;
    const cur = this.currentPosition();
    if (nextOrientation === 'horizontal' && (cur === 'left' || cur === 'right')) {
      nextPosition = 'bottom';
    } else if (nextOrientation === 'vertical' && (cur === 'top' || cur === 'bottom')) {
      nextPosition = 'right';
    }

    // Kick off the OS window slide IMMEDIATELY (concurrent with fade) —
    // visible motion from t=0 kills the "did anything happen?" feeling.
    if (nextPosition) {
      this.isProgrammaticMove = true;
      void this.windowService.setPosition(nextPosition);
    }

    // Start fade out. transition-opacity duration-100 on the root.
    this.isOrientationChanging.set(true);
    await new Promise((r) => setTimeout(r, 100));

    // At the trough of the fade, apply the layout changes. The flex
    // reflow is invisible while the widget is at opacity 0.2.
    await this.persistence.setSetting('dock_orientation', nextOrientation);
    if (nextPosition) {
      await this.persistence.setSetting('widget_position', nextPosition);
    }

    // Release opacity — new layout emerges as the OS window is still
    // finishing its slide. The eye reads the whole thing as one motion.
    this.isOrientationChanging.set(false);

    if (nextPosition) {
      await new Promise((r) => setTimeout(r, 250));
      this.isProgrammaticMove = false;
    }
  }


  public async selectTab(tab: DockTab): Promise<void> {
    // Selecting a tab always exits edit mode — the user's clearly moved
    // on from configuring the dock to using it.
    if (this.isEditMode()) {
      this.isEditMode.set(false);
    }
    if (this.activeTab().id === tab.id && this.isPanelExpanded()) {
      this.isPanelExpanded.set(false);
    } else {
      await this.layoutService.ensureVisible();
      this.activeTab.set(tab);
      this.isPanelExpanded.set(true);
      this.windowService.focusWindow();
    }
  }

  public collapseToWidget(): void {
    this.isPanelExpanded.set(false);
  }

  public onDockMouseEnter(): void {
    if (this.hoverLeaveTimer !== undefined) {
      window.clearTimeout(this.hoverLeaveTimer);
      this.hoverLeaveTimer = undefined;
    }
    this.isHoveringDock.set(true);
  }

  public onDockMouseLeave(): void {
    if (this.hoverLeaveTimer !== undefined) window.clearTimeout(this.hoverLeaveTimer);
    this.hoverLeaveTimer = window.setTimeout(() => {
      this.isHoveringDock.set(false);
    }, this.HOVER_LEAVE_MS);
  }

  @HostListener('window:keydown', ['$event'])
  public async handleGlobalShortcuts(event: KeyboardEvent): Promise<void> {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      const opening = !this.isPanelExpanded();
      if (opening) {
        await this.layoutService.ensureVisible();
      }
      this.isPanelExpanded.set(opening);
    } else if (event.key === 'Escape') {
      // ESC unwinds the widget state one level at a time: first exit edit
      // mode (if active), then collapse the expanded panel (if open).
      if (this.isEditMode()) {
        event.preventDefault();
        this.isEditMode.set(false);
      } else if (this.isPanelExpanded()) {
        event.preventDefault();
        this.collapseToWidget();
      }
    }
  }

  @HostListener('window:resize')
  public onWindowResize(): void {
    this.scheduleInteractiveAreaUpdate();
  }

  // Click-through means outside clicks never reach the DOM, so we can't close
  // the panel via a backdrop click. Instead, close whenever the OS window
  // loses focus — clicking through to any window underneath (or the desktop)
  // will always transfer focus away from us.
  @HostListener('window:blur')
  public onWindowBlur(): void {
    // Focus loss also exits edit mode — any interaction outside the
    // widget counts as "moved on".
    if (this.isEditMode()) {
      this.isEditMode.set(false);
    }
    if (this.isPanelExpanded()) {
      this.collapseToWidget();
    }
  }

  private scheduleInteractiveAreaUpdate(): void {
    requestAnimationFrame(() => this.reportInteractiveArea());
    // Re-measure after the panel-expand animation completes so we capture the
    // final (scale=1) bounds rather than the initial 0.96-scaled rect.
    if (this.postAnimationTimer !== undefined) {
      window.clearTimeout(this.postAnimationTimer);
    }
    this.postAnimationTimer = window.setTimeout(() => this.reportInteractiveArea(), 220);
  }

  private reportInteractiveArea(): void {
    // Edit mode: make the whole window interactive. The + popover extends
    // outside the dock's own rect (into the transparent area to the left of
    // the dock), and the resize handles live at the panel edges — both would
    // fall into the click-through zone under the normal rules, so clicks on
    // them would pass through to the desktop underneath.
    if (this.isEditMode()) {
      this.windowService.setInteractiveArea(0, 0, window.innerWidth, window.innerHeight);
      return;
    }

    const dock = this.dockRef?.nativeElement?.getBoundingClientRect();
    if (!dock) return;

    let left = dock.left;
    let top = dock.top;
    let right = dock.right;
    let bottom = dock.bottom;

    const panelEl = this.panelRef?.nativeElement;
    if (this.isPanelExpanded() && panelEl) {
      const panel = panelEl.getBoundingClientRect();
      left = Math.min(left, panel.left);
      top = Math.min(top, panel.top);
      right = Math.max(right, panel.right);
      bottom = Math.max(bottom, panel.bottom);
    }

    // Small buffer so edges and mid-animation frames still hit-test.
    const pad = 8;
    this.windowService.setInteractiveArea(
      left - pad,
      top - pad,
      right - left + pad * 2,
      bottom - top + pad * 2
    );
  }
}
