import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IntegrationManagerService } from '../../../../integrations/core/integration-manager.service';
import { MessageProvider } from '../../../../integrations/core/capabilities/message-provider.interface';
import { UnifiedMessage } from '../../../../integrations/core/models/unified-message.model';
import { WindowService } from '../../../../core/tauri/window.service';

@Component({
  selector: 'app-slack',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex h-full flex-col">

      <!-- ==========================================
           NOT CONNECTED — SIGN IN WITH SLACK CARD
           ========================================== -->
      <ng-container *ngIf="!isConnected()">
        <div class="flex flex-1 flex-col items-center justify-center space-y-5 px-3 py-8">

          <div class="flex flex-col items-center space-y-1 text-center">
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/80 text-[#ECB22E]">
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
              </svg>
            </div>
            <div class="text-sm font-semibold text-white pt-1">Connect Slack</div>
            <div class="text-[10px] leading-relaxed text-neutral-400 max-w-[220px]">
              Sign in once with Slack — Bilet-X shows your latest DMs and group DMs. Personal messages stay on your workspace.
            </div>
          </div>

          <!-- Error banner -->
          <div
            *ngIf="connectError()"
            class="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[10px] leading-relaxed text-red-300"
          >
            <span class="mr-1">⚠️</span>{{ connectError() }}
          </div>

          <!-- Sign in with Slack button (idle) -->
          <button
            *ngIf="!isConnecting()"
            (click)="onSignInWithSlack()"
            type="button"
            class="flex w-full items-center justify-center space-x-2 rounded-lg bg-[#4A154B] py-2.5 px-4 font-semibold text-[12px] text-white transition hover:bg-[#611f62] active:scale-[0.99]"
          >
            <!-- Slack brand mark -->
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
              <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"/>
              <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"/>
              <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
            </svg>
            <span>Sign in with Slack</span>
          </button>

          <!-- Waiting state (with Cancel) -->
          <div *ngIf="isConnecting()" class="w-full space-y-2">
            <div class="flex w-full items-center justify-center space-x-2 rounded-lg bg-neutral-800 py-2.5 px-4 font-medium text-[12px] text-neutral-300">
              <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
              </svg>
              <span>Waiting for Slack...</span>
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
            A browser tab will open for consent. Slack asks you to pick a workspace and confirm the requested scopes.
          </p>
        </div>
      </ng-container>

      <!-- ==========================================
           CONNECTED — DM FEED
           ========================================== -->
      <ng-container *ngIf="isConnected()">
        <div class="flex h-full flex-col space-y-2.5 text-xs">

          <!-- HEADER -->
          <div class="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/90 p-2 text-xs">
            <div class="flex items-center space-x-1.5 font-mono text-[10px] text-neutral-400 overflow-hidden">
              <span class="flex h-2 w-2 shrink-0 rounded-full bg-emerald-400"></span>
              <span class="font-medium text-neutral-200">Slack</span>
              <span *ngIf="teamName()" class="truncate text-neutral-500">· {{ teamName() }}</span>
            </div>

            <div class="flex items-center space-x-1">
              <button
                (click)="openSlackApp()"
                type="button"
                title="Open Slack"
                class="flex h-6 items-center space-x-1 rounded-lg border border-neutral-800 bg-neutral-800 px-2 font-mono text-[9px] text-neutral-300 transition hover:bg-neutral-700 hover:text-white"
              >
                <span>↗</span>
                <span>Slack</span>
              </button>

              <button
                (click)="refreshMessages()"
                type="button"
                [disabled]="isLoading()"
                title="Sync Slack"
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
          </div>

          <!-- ERROR BANNER -->
          <div
            *ngIf="errorMessage()"
            class="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-[10px] text-red-300 space-y-1"
          >
            <div class="flex items-center space-x-1.5 font-semibold text-red-400">
              <span>⚠️</span>
              <span>Slack Sync Notice</span>
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
              placeholder="Search by sender, channel, text..."
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

          <!-- MESSAGES LIST -->
          <div class="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            <div
              *ngFor="let msg of filteredMessages()"
              (click)="openInSlack(msg)"
              role="button"
              tabindex="0"
              (keydown.enter)="openInSlack(msg)"
              title="Click to open in Slack"
              class="group cursor-pointer rounded-xl border border-neutral-800/90 bg-neutral-900/80 p-3 text-xs transition-all duration-150 hover:border-neutral-600 hover:bg-neutral-800/90 active:scale-[0.99]"
              [class.border-l-2]="!msg.isRead"
              [class.border-l-purple-500]="!msg.isRead"
              [class.bg-neutral-900/95]="!msg.isRead"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2 overflow-hidden">
                  <div class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-800 font-mono text-[9px] font-bold text-neutral-300">
                    {{ getInitials(msg.sender.name) }}
                  </div>
                  <span class="truncate font-semibold"
                    [class.text-white]="!msg.isRead"
                    [class.text-neutral-300]="msg.isRead"
                  >{{ msg.sender.name }}</span>
                </div>

                <span class="font-mono text-[9px] text-neutral-500">
                  {{ formatRelativeTime(msg.timestamp) }}
                </span>
              </div>

              <!-- Channel / subject label -->
              <div class="mt-1 flex items-center space-x-1.5 font-mono text-[9px] text-neutral-400">
                <span
                  class="rounded px-1.5 py-0.5"
                  [ngClass]="{
                    'bg-purple-500/10 text-purple-300 border border-purple-500/30': isMpim(msg),
                    'bg-neutral-800 text-neutral-300': !isMpim(msg)
                  }"
                >
                  {{ isMpim(msg) ? 'group DM' : 'DM' }}
                </span>
                <span *ngIf="isMpim(msg)" class="truncate text-neutral-400">{{ msg.subject }}</span>
              </div>

              <!-- Snippet -->
              <p class="mt-1 line-clamp-3 text-[11px] leading-relaxed text-neutral-300">
                {{ msg.snippet }}
              </p>
            </div>

            <!-- EMPTY STATE -->
            <div
              *ngIf="filteredMessages().length === 0 && !isLoading()"
              class="py-8 text-center font-mono text-xs text-neutral-500"
            >
              <div class="mb-1 text-sm">💬</div>
              No recent DMs.
            </div>
          </div>
        </div>
      </ng-container>

    </div>
  `,
})
export class SlackComponent implements OnInit {
  public searchQuery = '';
  public isLoading = signal<boolean>(false);
  private localError = signal<string | null>(null);

  public errorMessage = computed(
    () => this.localError() || this.integrationManager.messagesError()
  );

  public isConnected = computed(
    () => this.integrationManager.getConnectionsForProvider('slack').length > 0
  );

  private currentConnection = computed(
    () => this.integrationManager.getConnectionsForProvider('slack')[0]
  );

  public teamName = computed(() => this.currentConnection()?.config?.['teamName'] || '');
  public teamDomain = computed(() => this.currentConnection()?.config?.['teamDomain'] || '');
  public teamId = computed(() => this.currentConnection()?.config?.['teamId'] || '');

  public slackMessages = computed(() =>
    this.integrationManager.unifiedMessages().filter((m) => m.providerId === 'slack')
  );

  public filteredMessages = computed(() => {
    const list = this.slackMessages();
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        m.sender.name.toLowerCase().includes(q) ||
        m.snippet.toLowerCase().includes(q)
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
      this.refreshMessages();
    }
  }

  public async onSignInWithSlack(): Promise<void> {
    if (this.isConnecting()) return;
    const mySeq = ++this.signInSeq;
    this.isConnecting.set(true);
    this.connectError.set(null);
    this.localError.set(null);

    try {
      const conn = await this.integrationManager.connectProvider('slack', {});

      if (mySeq !== this.signInSeq) return;

      if (conn.status === 'error') {
        this.connectError.set(
          conn.errorMessage || 'Sign-in failed. Please try again.'
        );
        return;
      }

      await this.refreshMessages();
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

  public async refreshMessages(): Promise<void> {
    if (this.isLoading()) return;
    this.isLoading.set(true);
    this.localError.set(null);
    try {
      await this.integrationManager.fetchMessages();
    } catch (err: any) {
      this.localError.set(err?.message || 'Failed to fetch Slack messages.');
    } finally {
      this.isLoading.set(false);
    }
  }

  public openInSlack(msg: UnifiedMessage): void {
    // Prefer the slack:// deep link so the desktop client focuses if the
    // user has it installed; fall back to app.slack.com.
    const teamId = this.teamId();
    const channelId = (msg.metadata?.['channelId'] as string) || msg.threadId;
    if (teamId && channelId) {
      const deep = `slack://channel?team=${encodeURIComponent(teamId)}&id=${encodeURIComponent(channelId)}`;
      this.windowService.openExternalUrl(deep);
    } else if (msg.webUrl) {
      this.windowService.openExternalUrl(msg.webUrl);
    }

    if (!msg.isRead) {
      msg.isRead = true;
      this.markAsRead(msg).catch((err) =>
        console.warn('[Slack] Mark-as-read remote sync:', err)
      );
    }
  }

  public openSlackApp(): void {
    const teamId = this.teamId();
    const url = teamId
      ? `slack://open?team=${encodeURIComponent(teamId)}`
      : 'https://app.slack.com';
    this.windowService.openExternalUrl(url);
  }

  public async markAsRead(msg: UnifiedMessage): Promise<void> {
    const providers =
      this.integrationManager.getConnectedCapabilityProviders<MessageProvider>('messages');
    for (const p of providers) {
      if (
        p.connection.connectionId === msg.connectionId &&
        p.capabilityInstance.markAsRead
      ) {
        await p.capabilityInstance.markAsRead(p.connection.connectionId, msg.sourceId);
      }
    }
  }

  public isMpim(msg: UnifiedMessage): boolean {
    return (msg.metadata?.['channelType'] as string) === 'mpim';
  }

  public getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  public formatRelativeTime(isoString: string): string {
    if (!isoString) return '';
    const then = new Date(isoString).getTime();
    if (isNaN(then)) return '';
    const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}
