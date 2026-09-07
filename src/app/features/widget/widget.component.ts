import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowService } from '../../core/tauri/window.service';
import { PersistenceService } from '../../core/tauri/persistence.service';
import { DockComponent, DockTab } from './components/dock/dock.component';
import { NoteComponent } from './components/note/note.component';
import { TaskComponent } from './components/task/task.component';
import { SettingsComponent } from './components/settings/settings.component';

@Component({
  selector: 'app-widget',
  standalone: true,
  imports: [CommonModule, DockComponent, NoteComponent, TaskComponent, SettingsComponent],
  template: `
    <div
      class="relative flex h-screen w-screen overflow-hidden bg-transparent text-neutral-100 select-none"
      [class.justify-start]="isLeftSide()"
      [class.justify-end]="!isLeftSide()"
      [class.items-start]="isTopSide()"
      [class.items-end]="isBottomSide()"
      [class.items-center]="!isTopSide() && !isBottomSide()"
    >
      <!-- Row containing panel + dock. flex-row-reverse for left-side positions
           puts the dock at the screen edge and the panel toward the center. -->
      <div
        class="relative flex gap-3"
        [class.flex-row]="!isLeftSide()"
        [class.flex-row-reverse]="isLeftSide()"
        [class.items-start]="isTopSide()"
        [class.items-end]="isBottomSide()"
        [class.items-center]="!isTopSide() && !isBottomSide()"
        (click)="$event.stopPropagation()"
      >
        <!-- FLYOUT QUICK PANEL -->
        <div
          #panelEl
          *ngIf="isPanelExpanded()"
          class="animate-panel-expand flex w-[380px] max-h-[calc(100vh-1rem)] flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/95 p-4 text-neutral-100 backdrop-blur-xl shadow-2xl"
        >
          <!-- PANEL TOP HEADER ACTION CONTROLS -->
          <div class="titlebar-drag-region flex items-center justify-between border-b border-neutral-800/80 pb-3">
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
                class="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-400 hover:bg-white hover:text-black transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          </div>

          <!-- PANEL MAIN CONTENT BODY -->
          <div class="mt-3 flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
            <!-- VIEW 1: NOTE COMPONENT -->
            <app-note *ngIf="activeTab().id === 'notes'"></app-note>

            <!-- VIEW 2: TASK COMPONENT -->
            <app-task *ngIf="activeTab().id === 'tasks'"></app-task>

            <!-- VIEW 3: SETTINGS COMPONENT -->
            <app-settings *ngIf="activeTab().id === 'settings'"></app-settings>
          </div>
        </div>

        <!-- VERTICAL DOCK COMPONENT (NOTE, TASK, SETTINGS) -->
        <app-dock
          #dockEl
          [tabs]="tabs"
          [activeTabId]="activeTab().id"
          [isPanelExpanded]="isPanelExpanded()"
          (tabSelect)="selectTab($event)"
        ></app-dock>
      </div>
    </div>
  `,
})
export class WidgetComponent implements AfterViewInit, OnDestroy {
  public isPanelExpanded = signal<boolean>(false);

  // EXACT ORDER: 1. note, 2. task, 3. settings
  public tabs: DockTab[] = [
    { id: 'notes', label: 'Notes' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'settings', label: 'Settings' },
  ];

  public activeTab = signal<DockTab>(this.tabs[0]);

  // Derived from the saved widget_position setting. Drives dock alignment
  // inside the transparent 640x440 window and the side the panel flies out to.
  public currentPosition = computed(() =>
    this.persistence.getSettingValue('widget_position', 'right'),
  );
  public isLeftSide = computed(() => this.currentPosition().includes('left'));
  public isTopSide = computed(() => this.currentPosition().startsWith('top'));
  public isBottomSide = computed(() => this.currentPosition().startsWith('bottom'));

  @ViewChild('dockEl', { read: ElementRef }) private dockRef?: ElementRef<HTMLElement>;
  @ViewChild('panelEl', { read: ElementRef }) private panelRef?: ElementRef<HTMLElement>;

  private postAnimationTimer: number | undefined;

  constructor(
    private windowService: WindowService,
    private persistence: PersistenceService,
  ) {
    // Re-measure whenever the panel expands/collapses. Effects run outside the
    // render lifecycle, so we defer to rAF and also re-measure after the 180ms
    // panel-expand animation settles at its final scale.
    effect(() => {
      this.isPanelExpanded();
      // Re-measure when the widget's screen position changes too — the dock
      // and panel move within the window, so the interactive rect shifts.
      this.currentPosition();
      this.scheduleInteractiveAreaUpdate();
    });

    // Restore the saved widget position once settings finish loading from
    // SQLite. Runs once (guarded) so subsequent settings mutations don't
    // yank the window back.
    let positionRestored = false;
    effect(() => {
      const map = this.persistence.settings();
      if (positionRestored || map.size === 0) return;
      positionRestored = true;
      const saved = map.get('widget_position');
      if (saved) {
        this.windowService.setPosition(saved);
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
  }

  public selectTab(tab: DockTab): void {
    if (this.activeTab().id === tab.id && this.isPanelExpanded()) {
      this.isPanelExpanded.set(false);
    } else {
      this.activeTab.set(tab);
      this.isPanelExpanded.set(true);
      this.windowService.focusWindow();
    }
  }

  public collapseToWidget(): void {
    this.isPanelExpanded.set(false);
  }

  @HostListener('window:keydown', ['$event'])
  public handleGlobalShortcuts(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.isPanelExpanded.set(!this.isPanelExpanded());
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
      bottom - top + pad * 2,
    );
  }
}
