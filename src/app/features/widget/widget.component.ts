import { Component, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowService } from '../../core/tauri/window.service';
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
      (click)="onBackdropClick()"
      class="relative flex h-screen w-screen items-center justify-end overflow-hidden bg-transparent p-4 text-neutral-100 select-none"
    >
      <!-- STATIONARY CONTAINER FOR VERTICAL DOCK & ABSOLUTE PANEL -->
      <div
        class="relative flex items-center"
        (click)="$event.stopPropagation()"
      >
        <!-- FLYOUT QUICK PANEL (POSITIONED ABSOLUTELY TO THE LEFT OF DOCK) -->
        <div
          *ngIf="isPanelExpanded()"
          class="animate-panel-expand absolute right-full mr-3 flex w-[380px] flex-col space-y-3 rounded-2xl border border-neutral-800 bg-neutral-950/95 p-4 text-neutral-100 backdrop-blur-xl shadow-2xl"
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
          <div class="space-y-3 pr-1">
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
          [tabs]="tabs"
          [activeTabId]="activeTab().id"
          [isPanelExpanded]="isPanelExpanded()"
          (tabSelect)="selectTab($event)"
        ></app-dock>
      </div>
    </div>
  `,
})
export class WidgetComponent {
  public isPanelExpanded = signal<boolean>(false);

  // EXACT ORDER: 1. note, 2. task, 3. settings
  public tabs: DockTab[] = [
    { id: 'notes', label: 'Notes' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'settings', label: 'Settings' },
  ];

  public activeTab = signal<DockTab>(this.tabs[0]);

  constructor(private windowService: WindowService) {}

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

  public onBackdropClick(): void {
    if (this.isPanelExpanded()) {
      this.collapseToWidget();
    }
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
}
