import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IntegrationManagerService } from '../../../../integrations/core/integration-manager.service';
import { UnifiedTask } from '../../../../integrations/core/models/unified-task.model';
import { WindowService } from '../../../../core/tauri/window.service';

// ============================================================================
// TEMPORARY STUB — Jira integration is not shipping in this release.
// The full connect form + issue list + sync/refresh logic is preserved
// verbatim in the /* ... */ block at the bottom of this file. To re-enable,
// delete this stub component and uncomment the block.
// ============================================================================

@Component({
  selector: 'app-jira',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex h-full flex-col items-center justify-center space-y-4 px-4 py-16 text-center">
      <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/80">
        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-neutral-400">
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M8 7v7" />
          <path d="M12 7v4" />
          <path d="M16 7v10" />
        </svg>
      </div>

      <div class="space-y-1">
        <div class="text-sm font-semibold text-white">Jira — Coming Soon</div>
        <div class="text-[10px] leading-relaxed text-neutral-400 max-w-[240px]">
          Atlassian Jira sync isn't shipping in this release. It'll land in a future update with issue browsing, JQL filters, and status updates.
        </div>
      </div>

      <span class="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
        In development
      </span>
    </div>
  `,
})
export class JiraComponent {}

/* ============================================================================
 * FULL JIRA IMPLEMENTATION — DISABLED FOR THIS RELEASE.
 * Restore by deleting the stub above and unwrapping this block.
 * ============================================================================

@Component({
  selector: 'app-jira',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex h-full flex-col">

      <!-- ==========================================
           NOT CONNECTED — CONNECT FORM
           ========================================== -->
      <ng-container *ngIf="!isConnected()">
        <div class="flex flex-1 flex-col space-y-4 overflow-y-auto px-1 py-4">

          <div class="flex flex-col items-center space-y-1 text-center">
            <div class="text-sm font-semibold text-white">Connect Jira</div>
            <div class="text-[10px] leading-relaxed text-neutral-400 max-w-[240px]">
              Sync your Atlassian Cloud issues with an email + API token. The token is stored securely on this device.
            </div>
          </div>

          <!-- Error banner -->
          <div
            *ngIf="connectError()"
            class="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[10px] leading-relaxed text-red-300"
          >
            <span class="mr-1">⚠️</span>{{ connectError() }}
          </div>

          <form (submit)="onConnect($event)" class="w-full space-y-2.5">
            <!-- Domain -->
            <div class="space-y-1">
              <label class="block text-[9px] font-medium uppercase tracking-wider text-neutral-400">
                Atlassian Domain
              </label>
              <input
                type="text"
                [(ngModel)]="domain"
                name="domain"
                placeholder="your-company.atlassian.net"
                autocomplete="off"
                class="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-[11px] text-white placeholder-neutral-600 transition focus:border-neutral-500 focus:outline-none"
              />
            </div>

            <!-- Email -->
            <div class="space-y-1">
              <label class="block text-[9px] font-medium uppercase tracking-wider text-neutral-400">
                Account Email
              </label>
              <input
                type="email"
                [(ngModel)]="email"
                name="email"
                placeholder="you@company.com"
                autocomplete="email"
                class="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-[11px] text-white placeholder-neutral-600 transition focus:border-neutral-500 focus:outline-none"
              />
            </div>

            <!-- API Token -->
            <div class="space-y-1">
              <label class="flex items-center justify-between text-[9px] font-medium uppercase tracking-wider text-neutral-400">
                <span>API Token</span>
                <span class="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[8px] text-emerald-400 border border-emerald-500/20">Encrypted</span>
              </label>
              <div class="relative">
                <input
                  [type]="showToken() ? 'text' : 'password'"
                  [(ngModel)]="apiToken"
                  name="apiToken"
                  placeholder="ATATT3xFfGF0..."
                  class="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 pr-9 text-[11px] text-white placeholder-neutral-600 transition focus:border-neutral-500 focus:outline-none"
                />
                <button
                  type="button"
                  (click)="showToken.set(!showToken())"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition"
                  [title]="showToken() ? 'Hide token' : 'Show token'"
                >
                  <svg *ngIf="!showToken()" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  <svg *ngIf="showToken()" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                </button>
              </div>
              <p class="text-[9px] leading-relaxed text-neutral-500">
                Generate at
                <button type="button" (click)="openTokenPage()" class="underline text-neutral-400 hover:text-white transition">
                  id.atlassian.com/manage-profile/security/api-tokens
                </button>
              </p>
            </div>

            <!-- Optional JQL -->
            <div class="space-y-1">
              <label class="block text-[9px] font-medium uppercase tracking-wider text-neutral-400">
                Custom JQL <span class="text-neutral-600 normal-case tracking-normal">(optional)</span>
              </label>
              <input
                type="text"
                [(ngModel)]="jqlFilter"
                name="jqlFilter"
                placeholder="assignee = currentUser() AND resolution = Unresolved"
                class="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-[11px] text-white placeholder-neutral-600 transition focus:border-neutral-500 focus:outline-none"
              />
            </div>

            <!-- Submit -->
            <button
              type="submit"
              [disabled]="isConnecting()"
              class="w-full rounded-lg bg-white py-2 font-mono text-[11px] font-semibold text-black transition hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span *ngIf="!isConnecting()">Connect Jira</span>
              <span *ngIf="isConnecting()" class="flex items-center justify-center space-x-1.5">
                <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                  <path d="M21 3v5h-5"/>
                </svg>
                <span>Connecting...</span>
              </span>
            </button>
          </form>

          <p class="text-center text-[9px] text-neutral-600">
            Manage or disconnect from Settings → Connected Services
          </p>
        </div>
      </ng-container>

      <!-- ==========================================
           CONNECTED — TASK LIST
           ========================================== -->
      <ng-container *ngIf="isConnected()">
        <div class="flex h-full flex-col space-y-2.5 text-xs">

          <!-- HEADER -->
          <div class="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/90 p-2 text-xs">
            <div class="flex items-center space-x-1.5 font-mono text-[10px] text-neutral-400">
              <span class="flex h-2 w-2 rounded-full bg-emerald-400"></span>
              <span class="font-medium text-neutral-200">Jira</span>
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
              No issues found.
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

  // Form state
  public domain = '';
  public email = '';
  public apiToken = '';
  public jqlFilter = '';
  public showToken = signal<boolean>(false);
  public isConnecting = signal<boolean>(false);
  public connectError = signal<string | null>(null);

  constructor(
    public integrationManager: IntegrationManagerService,
    private windowService: WindowService
  ) {}

  public ngOnInit(): void {
    if (this.isConnected()) {
      this.refreshTasks();
    }
  }

  public async onConnect(event: Event): Promise<void> {
    event.preventDefault();

    const domain = this.domain.trim();
    const email = this.email.trim();
    const apiToken = this.apiToken.trim();

    if (!domain) {
      this.connectError.set('Atlassian domain is required.');
      return;
    }
    if (!email) {
      this.connectError.set('Account email is required.');
      return;
    }
    if (!apiToken) {
      this.connectError.set('API token is required.');
      return;
    }

    this.isConnecting.set(true);
    this.connectError.set(null);
    this.localError.set(null);

    try {
      const conn = await this.integrationManager.connectProvider('jira', {
        domain,
        email,
        apiToken,
        jqlFilter: this.jqlFilter.trim(),
      });

      if (conn.status === 'error') {
        this.connectError.set(conn.errorMessage || 'Failed to connect. Check credentials and try again.');
        return;
      }

      this.domain = '';
      this.email = '';
      this.apiToken = '';
      this.jqlFilter = '';
      await this.refreshTasks();
    } catch (err: any) {
      this.connectError.set(err?.message || 'Connection failed. Please try again.');
    } finally {
      this.isConnecting.set(false);
    }
  }

  public openTokenPage(): void {
    this.windowService.openExternalUrl(
      'https://id.atlassian.com/manage-profile/security/api-tokens'
    );
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

 * ============================================================================
 */
