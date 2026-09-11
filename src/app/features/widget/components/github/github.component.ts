import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IntegrationManagerService } from '../../../../integrations/core/integration-manager.service';
import { UnifiedTask } from '../../../../integrations/core/models/unified-task.model';
import { WindowService } from '../../../../core/tauri/window.service';

@Component({
  selector: 'app-github',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex h-full flex-col">

      <!-- ==========================================
           NOT CONNECTED — SIGN IN WITH GITHUB CARD
           ========================================== -->
      <ng-container *ngIf="!isConnected()">
        <div class="flex flex-1 flex-col items-center justify-center space-y-5 px-3 py-8">

          <div class="flex flex-col items-center space-y-1 text-center">
            <div class="text-sm font-semibold text-white">Connect GitHub</div>
            <div class="text-[10px] leading-relaxed text-neutral-400 max-w-[220px]">
              Sign in once with GitHub — Bilet-X shows every open issue and PR assigned to you across all your repos.
            </div>
          </div>

          <!-- Error banner -->
          <div
            *ngIf="connectError()"
            class="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[10px] leading-relaxed text-red-300"
          >
            <span class="mr-1">⚠️</span>{{ connectError() }}
          </div>

          <!-- Sign in with GitHub button (idle) -->
          <button
            *ngIf="!isConnecting()"
            (click)="onSignInWithGitHub()"
            type="button"
            class="flex w-full items-center justify-center space-x-2 rounded-lg bg-neutral-900 border border-neutral-700 py-2.5 px-4 font-semibold text-[12px] text-white transition hover:bg-neutral-800 active:scale-[0.99]"
          >
            <!-- GitHub Octocat mark -->
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .296C5.373.296 0 5.67 0 12.297c0 5.302 3.438 9.8 8.207 11.387.6.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.386-1.333-1.756-1.333-1.756-1.09-.744.083-.729.083-.729 1.205.084 1.84 1.236 1.84 1.236 1.07 1.834 2.807 1.304 3.492.997.108-.774.42-1.305.762-1.605-2.665-.303-5.467-1.332-5.467-5.93 0-1.31.467-2.381 1.235-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.51 11.51 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.654 1.653.243 2.874.12 3.176.77.84 1.233 1.911 1.233 3.221 0 4.61-2.807 5.624-5.479 5.921.43.371.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.565 22.092 24 17.598 24 12.297 24 5.67 18.627.296 12 .296z"/>
            </svg>
            <span>Sign in with GitHub</span>
          </button>

          <!-- Waiting state (with Cancel) -->
          <div *ngIf="isConnecting()" class="w-full space-y-2">
            <div class="flex w-full items-center justify-center space-x-2 rounded-lg bg-neutral-800 py-2.5 px-4 font-medium text-[12px] text-neutral-300">
              <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
              </svg>
              <span>Waiting for GitHub...</span>
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
            A browser tab will open for consent. Your access token is stored securely and never leaves this device.
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
              <span class="font-medium text-neutral-200">GitHub</span>
              <span *ngIf="accountLogin()" class="truncate text-neutral-500">· {{ accountLogin() }}</span>
              <span *ngIf="openCount() > 0" class="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-blue-300 border border-blue-500/30">
                {{ openCount() }} Open
              </span>
            </div>

            <button
              (click)="refreshTasks()"
              type="button"
              [disabled]="isLoading()"
              title="Sync GitHub"
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
              <span>GitHub Sync Notice</span>
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
              placeholder="Search issues by title, repo, number..."
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
                      [class.bg-neutral-400]="task.status !== 'done'"
                    ></span>
                    <span class="truncate font-medium text-neutral-100" [title]="task.title">
                      {{ task.title }}
                    </span>
                  </div>

                  <div class="flex flex-wrap items-center gap-1 font-mono text-[9px] text-neutral-400">
                    <span *ngIf="task.project" class="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-300">
                      {{ task.project.name }}
                    </span>
                    <span *ngIf="issueNumber(task)" class="rounded bg-neutral-800/70 px-1.5 py-0.5 text-neutral-400">
                      #{{ issueNumber(task) }}
                    </span>
                    <span *ngIf="isPR(task)" class="rounded border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-purple-300">
                      PR
                    </span>
                    <span
                      *ngIf="task.priority === 'urgent' || task.priority === 'high'"
                      class="rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-red-400"
                    >
                      {{ task.priority }}
                    </span>
                  </div>
                </div>

                <button
                  *ngIf="task.webUrl"
                  (click)="$event.stopPropagation(); openIssue(task)"
                  type="button"
                  class="shrink-0 rounded p-1 text-neutral-500 transition hover:bg-neutral-700 hover:text-white"
                  title="Open on GitHub"
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
              <div class="mb-1 text-sm">🐙</div>
              No issues assigned to you.
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
})
export class GitHubComponent implements OnInit {
  public searchQuery = '';
  public isLoading = signal<boolean>(false);
  private localError = signal<string | null>(null);

  public errorMessage = computed(
    () => this.localError() || this.integrationManager.tasksError()
  );

  public isConnected = computed(
    () => this.integrationManager.getConnectionsForProvider('github').length > 0
  );

  public accountLogin = computed(() => {
    const conn = this.integrationManager.getConnectionsForProvider('github')[0];
    return conn?.config?.['login'] || '';
  });

  public githubTasks = computed(() =>
    this.integrationManager.unifiedTasks().filter((t) => t.providerId === 'github')
  );

  public openCount = computed(
    () => this.githubTasks().filter((t) => t.status !== 'done' && t.status !== 'cancelled').length
  );

  public filteredTasks = computed(() => {
    const list = this.githubTasks();
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

  public async onSignInWithGitHub(): Promise<void> {
    if (this.isConnecting()) return;
    const mySeq = ++this.signInSeq;
    this.isConnecting.set(true);
    this.connectError.set(null);
    this.localError.set(null);

    try {
      const conn = await this.integrationManager.connectProvider('github', {});

      if (mySeq !== this.signInSeq) return;

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
      this.localError.set(err?.message || 'Failed to fetch GitHub issues.');
    } finally {
      this.isLoading.set(false);
    }
  }

  public openIssue(task: UnifiedTask): void {
    if (task.webUrl) {
      this.windowService.openExternalUrl(task.webUrl);
    }
  }

  public issueNumber(task: UnifiedTask): string {
    return (task.metadata?.['githubNumber'] as string) || '';
  }

  public isPR(task: UnifiedTask): boolean {
    return task.metadata?.['isPR'] === 'true';
  }
}
