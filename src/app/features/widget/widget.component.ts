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
    ActivityComponent,
    SettingsComponent,
  ],
  template: `
    <div
      class="relative flex h-screen w-screen overflow-hidden bg-transparent text-neutral-100 select-none"
      [class.justify-start]="isLeftSide()"
      [class.justify-center]="isHorizontallyCentered()"
      [class.justify-end]="!isLeftSide() && !isHorizontallyCentered()"
      [class.items-start]="isTopSide()"
      [class.items-end]="isBottomSide()"
      [class.items-center]="!isTopSide() && !isBottomSide()"
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
          (tabSelect)="selectTab($event)"
          (mouseenter)="onDockMouseEnter()"
          (mouseleave)="onDockMouseLeave()"
        ></app-dock>
      </div>
    </div>
  `,
})
export class WidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  public isPanelExpanded = signal<boolean>(false);

  public unreadMessagesCount = computed(
    () => this.integrationManager.unifiedMessages().filter((m) => !m.isRead).length
  );

  // Jira is "Coming Soon" for this release — no live badge count.
  // Restore alongside the full JiraComponent implementation.
  // public openJiraCount = computed(
  //   () =>
  //     this.integrationManager
  //       .unifiedTasks()
  //       .filter(
  //         (t) => t.providerId === 'jira' && t.status !== 'done' && t.status !== 'cancelled'
  //       ).length
  // );

  public allAvailableTabs = computed<DockTab[]>(() => [
    { id: 'notes', label: 'Notes' },
    { id: 'tasks', label: 'Tasks' },
    {
      id: 'messages',
      label: 'Gmail',
      icon: 'gmail',
      badgeCount: this.integrationManager.hasCapability('messages')
        ? this.unreadMessagesCount()
        : 0,
    },
    {
      id: 'jira',
      label: 'Jira',
      icon: 'jira',
      // Coming Soon — no badge until the full integration is re-enabled.
      // badgeCount: this.integrationManager.hasCapability('tasks')
      //   ? this.openJiraCount()
      //   : 0,
    },
    { id: 'activity', label: 'Activity' },
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

  // Filter tabs by per-tab visibility settings. Falls back to full list if the
  // user ever hides every tab (never leave the dock unusable).
  public visibleTabs = computed<DockTab[]>(() => {
    const all = this.allAvailableTabs();
    const visible = all.filter(
      (t) => this.persistence.getSettingValue(`tab_${t.id}_visible`, 'true') === 'true'
    );
    return visible.length > 0 ? visible : all;
  });

  @ViewChild('dockEl', { read: ElementRef }) private dockRef?: ElementRef<HTMLElement>;
  @ViewChild('panelEl', { read: ElementRef }) private panelRef?: ElementRef<HTMLElement>;

  private postAnimationTimer: number | undefined;
  private hoverLeaveTimer: number | undefined;
  private unlistenToggleWidget?: () => void;
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
  }

  public async selectTab(tab: DockTab): Promise<void> {
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
    } else if (event.key === 'Escape' && this.isPanelExpanded()) {
      event.preventDefault();
      this.collapseToWidget();
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
