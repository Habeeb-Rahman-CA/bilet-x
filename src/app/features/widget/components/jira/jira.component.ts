import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IntegrationManagerService } from '../../../../integrations/core/integration-manager.service';
import { UnifiedTask } from '../../../../integrations/core/models/unified-task.model';
import { WindowService } from '../../../../core/tauri/window.service';

@Component({
  selector: 'app-jira',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex h-full flex-col">

      <!-- ==========================================
           NOT CONNECTED — SIGN IN WITH ATLASSIAN CARD
           ========================================== -->
      <ng-container *ngIf="!isConnected()">
        <div class="flex flex-1 flex-col items-center justify-center space-y-5 px-3 py-8">

          <div class="flex flex-col items-center space-y-1 text-center">
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/80 text-[#2684ff]">
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.762a1.005 1.005 0 0 0-1.001-1.005zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.056A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z"/>
              </svg>
            </div>
            <div class="text-sm font-semibold text-white pt-1">Connect Jira</div>
            <div class="text-[10px] leading-relaxed text-neutral-400 max-w-[220px]">
              Sign in once with Atlassian — Bilet-X keeps you signed in and lists everything assigned to you.
            </div>
          </div>

          <!-- Error banner -->
          <div
            *ngIf="connectError()"
            class="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[10px] leading-relaxed text-red-300"
          >
            <span class="mr-1">⚠️</span>{{ connectError() }}
          </div>

          <!-- Sign in with Atlassian button (idle) -->
          <button
            *ngIf="!isConnecting()"
            (click)="onSignInWithAtlassian()"
            type="button"
            class="flex w-full items-center justify-center space-x-2 rounded-lg bg-white py-2.5 px-4 font-semibold text-[12px] text-neutral-900 transition hover:bg-neutral-100 active:scale-[0.99]"
          >
            <!-- Atlassian mark -->
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" aria-hidden="true">
              <defs>
                <linearGradient id="jira-grad" x1="98.03" y1="41.58" x2="57.55" y2="82.06" gradientTransform="matrix(0.3125 0 0 -0.3125 -12.03 30.9)" gradientUnits="userSpaceOnUse">
                  <stop offset="0.18" stop-color="#0052cc"/>
                  <stop offset="1" stop-color="#2684ff"/>
                </linearGradient>
              </defs>
              <path fill="#2684ff" d="M30.02 15.6L17.4 2.98 16.17 1.76 6.67 11.26l4.32 4.32L16.17 10.4l10.6 10.6z"/>
              <path fill="url(#jira-grad)" d="M16.17 10.4l4.32 4.32-9.5 9.5 4.32 4.32 9.5-9.5.03-.02.03.02L30.03 15.6l-3.26-3.26z"/>
            </svg>
            <span>Sign in with Atlassian</span>
          </button>

          <!-- Waiting state (with Cancel) -->
          <div *ngIf="isConnecting()" class="w-full space-y-2">
            <div class="flex w-full items-center justify-center space-x-2 rounded-lg bg-neutral-800 py-2.5 px-4 font-medium text-[12px] text-neutral-300">
              <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
              </svg>
              <span>Waiting for Atlassian...</span>
            </div>
            <button
              (click)="cancelSignIn()"
              type="button"
              class="w-full rounded-lg border border-neutral-800 bg-neutral-900 py-1.5 px-4 font-mono text-[10px] text-neutral-400 transition hover:border-neutral-700 hover:text-white"
            >
              Cancel
            </button>
          </div>

          <p *ngIf="!isConnecting()" class="text-center text-[9px] leading-relaxed text-neutral-500 max-w-[220px]">
            A browser tab will open for consent. Your refresh token is stored securely and never leaves this device.
          </p>
          <p *ngIf="isConnecting()" class="text-center text-[9px] leading-relaxed text-neutral-500 max-w-[220px]">
            Complete the sign-in in your browser. If you see an error page, tap Cancel here and try again.
          </p>
        </div>
      </ng-container>

      <!-- ==========================================
           CONNECTED — ASSIGNED ISSUES LIST
           ========================================== -->
      <ng-container *ngIf="isConnected()">
        <div class="flex h-full flex-col space-y-2.5 text-xs">

          <!-- HEADER -->
          <div class="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/90 p-2 text-xs">
            <div class="flex items-center space-x-1.5 font-mono text-[10px] text-neutral-400">
              <span class="flex h-2 w-2 rounded-full bg-emerald-400"></span>
              <span class="font-medium text-neutral-200">Jira</span>
              <span *ngIf="siteName()" class="truncate text-neutral-500">· {{ siteName() }}</span>
              <span *ngIf="openCount() > 0" class="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-blue-300 border border-blue-500/30">
                {{ openCount() }} Open
              </span>
            </div>

            <button
              (click)="refreshTasks()"
              type="button"
              [disabled]="isLoading()"
              title="Sync Jira"
              class="flex h-6 w-6 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-800 text-neutral-300 transition hover:bg-neutral-700 hover:text-white disabled:opacity-50"
            >
              <svg
                [class.animate-spin]="isLoading()"
                xmlns="http://www.w3.org/2000/svg" width="12" height="12"
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
            </button>
          </div>

          <!-- ERROR BANNER -->
          <div
            *ngIf="errorMessage()"
            class="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-[10px] text-red-300 space-y-1"
          >
            <div class="flex items-center space-x-1.5 font-semibold text-red-400">
              <span>⚠️</span>
              <span>Jira Sync Notice</span>
            </div>
            <div class="leading-relaxed">{{ errorMessage() }}</div>
          </div>

          <!-- SEARCH -->
          <div class="flex items-center rounded-xl border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5 text-xs">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              class="mr-2 shrink-0 text-neutral-500"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              [(ngModel)]="searchQuery"
              placeholder="Search issues by title, key, project..."
              class="w-full bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none"
            />
            <button
              *ngIf="searchQuery"
              (click)="searchQuery = ''"
              type="button"
              class="text-[10px] text-neutral-500 hover:text-white"
            >
              ✕
            </button>
          </div>

          <!-- ISSUE LIST -->
          <div class="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            <div
              *ngFor="let task of filteredTasks()"
              (click)="openIssue(task)"
              role="button"
              tabindex="0"
              (keydown.enter)="openIssue(task)"
              class="group cursor-pointer rounded-xl border border-neutral-800/90 bg-neutral-900/80 p-2.5 text-xs transition hover:border-neutral-600 hover:bg-neutral-800/90 active:scale-[0.99]"
            >
              <div class="flex items-start justify-between space-x-2">
                <div class="flex-1 space-y-1 overflow-hidden">
                  <div class="flex items-center space-x-1.5">
                    <span
                      class="h-1.5 w-1.5 shrink-0 rounded-full"
                      [class.bg-emerald-400]="task.status === 'done'"
                      [class.bg-blue-400]="task.status === 'in_progress'"
                      [class.bg-purple-400]="task.status === 'in_review'"
                      [class.bg-neutral-400]="task.status === 'todo'"
                    ></span>
                    <span class="truncate font-medium text-neutral-100" [title]="task.title">
                      {{ task.title }}
                    </span>
                  </div>

                  <div class="flex flex-wrap items-center gap-1 font-mono text-[9px] text-neutral-400">
                    <span *ngIf="task.sourceId" class="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-300">
                      {{ task.sourceId }}
                    </span>
                    <span *ngIf="task.project" class="rounded bg-neutral-800/70 px-1.5 py-0.5 text-neutral-400">
                      {{ task.project.key || task.project.name }}
                    </span>
                    <span class="rounded bg-neutral-800/90 px-1.5 py-0.5 uppercase text-neutral-400">
                      {{ task.statusRaw || task.status }}
                    </span>
                    <span
                      *ngIf="task.priority === 'urgent' || task.priority === 'high'"
                      class="rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-red-400"
                    >
                      {{ task.priorityRaw || task.priority }}
                    </span>
                  </div>
                </div>

                <button
                  *ngIf="task.webUrl"
                  (click)="$event.stopPropagation(); openIssue(task)"
                  type="button"
                  class="shrink-0 rounded p-1 text-neutral-500 transition hover:bg-neutral-700 hover:text-white"
                  title="Open in browser"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </button>
              </div>
            </div>

            <div
              *ngIf="filteredTasks().length === 0 && !isLoading()"
              class="py-8 text-center font-mono text-xs text-neutral-500"
            >
              <div class="mb-1 text-sm">📋</div>
              No issues assigned to you.
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
})
export class JiraComponent implements OnInit {
  public searchQuery = '';
  public isLoading = signal<boolean>(false);
  private localError = signal<string | null>(null);

  public errorMessage = computed(
    () => this.localError() || this.integrationManager.tasksError()
  );

  public isConnected = computed(
    () => this.integrationManager.getConnectionsForProvider('jira').length > 0
  );

  public siteName = computed(() => {
    const conn = this.integrationManager.getConnectionsForProvider('jira')[0];
    return conn?.config?.['siteName'] || '';
  });

  public jiraTasks = computed(() =>
    this.integrationManager.unifiedTasks().filter((t) => t.providerId === 'jira')
  );

  public openCount = computed(
    () => this.jiraTasks().filter((t) => t.status !== 'done' && t.status !== 'cancelled').length
  );

  public filteredTasks = computed(() => {
    const list = this.jiraTasks();
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.sourceId || '').toLowerCase().includes(q) ||
        (t.project?.name || '').toLowerCase().includes(q) ||
        (t.project?.key || '').toLowerCase().includes(q)
    );
  });

  public isConnecting = signal<boolean>(false);
  public connectError = signal<string | null>(null);

  /**
   * Bumped each time a sign-in attempt starts or is cancelled. Late-arriving
   * responses from stale attempts (Rust listener finally times out after the
   * user hit Cancel) check this and no-op instead of clobbering fresh UI state.
   */
  private signInSeq = 0;

  constructor(
    public integrationManager: IntegrationManagerService,
    private windowService: WindowService
  ) {}

  public ngOnInit(): void {
    if (this.isConnected()) {
      this.refreshTasks();
    }
  }

  public async onSignInWithAtlassian(): Promise<void> {
    if (this.isConnecting()) return;
    const mySeq = ++this.signInSeq;
    this.isConnecting.set(true);
    this.connectError.set(null);
    this.localError.set(null);

    try {
      const conn = await this.integrationManager.connectProvider('jira', {});

      if (mySeq !== this.signInSeq) return; // cancelled — ignore stale result

      if (conn.status === 'error') {
        this.connectError.set(
          conn.errorMessage || 'Sign-in failed. Please try again.'
        );
        return;
      }

      await this.refreshTasks();
    } catch (err: any) {
      if (mySeq !== this.signInSeq) return;
      this.connectError.set(err?.message || 'Sign-in failed. Please try again.');
    } finally {
      if (mySeq === this.signInSeq) {
        this.isConnecting.set(false);
      }
    }
  }

  public cancelSignIn(): void {
    this.signInSeq++;
    this.isConnecting.set(false);
    this.connectError.set('Sign-in cancelled. You can try again.');
  }

  public async refreshTasks(): Promise<void> {
    if (this.isLoading()) return;
    this.isLoading.set(true);
    this.localError.set(null);
    try {
      await this.integrationManager.fetchTasks();
    } catch (err: any) {
      this.localError.set(err?.message || 'Failed to fetch Jira issues.');
    } finally {
      this.isLoading.set(false);
    }
  }

  public openIssue(task: UnifiedTask): void {
    if (task.webUrl) {
      this.windowService.openExternalUrl(task.webUrl);
    }
  }
}
