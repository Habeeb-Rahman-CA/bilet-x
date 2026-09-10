import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IntegrationManagerService } from '../../../../integrations/core/integration-manager.service';
import { MessageProvider } from '../../../../integrations/core/capabilities/message-provider.interface';
import { UnifiedMessage } from '../../../../integrations/core/models/unified-message.model';
import { WindowService } from '../../../../core/tauri/window.service';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex h-full flex-col">

      <!-- ==========================================
           NOT CONNECTED — SIGN IN WITH GOOGLE CARD
           ========================================== -->
      <ng-container *ngIf="!isConnected()">
        <div class="flex flex-1 flex-col items-center justify-center space-y-5 px-3 py-8">

          <div class="flex flex-col items-center space-y-1 text-center">
            <div class="text-sm font-semibold text-white">Connect Gmail</div>
            <div class="text-[10px] leading-relaxed text-neutral-400 max-w-[220px]">
              Sign in once with Google — Bilet-X keeps you signed in and refreshes your session automatically.
            </div>
          </div>

          <!-- Error banner -->
          <div
            *ngIf="connectError()"
            class="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[10px] leading-relaxed text-red-300"
          >
            <span class="mr-1">⚠️</span>{{ connectError() }}
          </div>

          <!-- Sign in with Google button (idle) -->
          <button
            *ngIf="!isConnecting()"
            (click)="onSignInWithGoogle()"
            type="button"
            class="flex w-full items-center justify-center space-x-2 rounded-lg bg-white py-2.5 px-4 font-semibold text-[12px] text-neutral-900 transition hover:bg-neutral-100 active:scale-[0.99]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23 12.24c0-.79-.07-1.55-.2-2.28H12v4.32h6.16c-.27 1.44-1.08 2.66-2.29 3.48v2.88h3.7c2.16-1.99 3.43-4.92 3.43-8.4z"/>
              <path fill="#34A853" d="M12 23c3.1 0 5.7-1.03 7.57-2.78l-3.7-2.88c-1.03.69-2.34 1.1-3.87 1.1-2.98 0-5.5-2.01-6.4-4.71H1.75v2.96C3.6 20.53 7.5 23 12 23z"/>
              <path fill="#FBBC05" d="M5.6 13.73C5.37 13.04 5.24 12.3 5.24 11.5s.13-1.54.36-2.23V6.31H1.75C1.02 7.77.6 9.58.6 11.5s.42 3.73 1.15 5.19l3.85-2.96z"/>
              <path fill="#EA4335" d="M12 4.75c1.68 0 3.19.58 4.38 1.72l3.28-3.28C17.7 1.19 15.1 0 12 0 7.5 0 3.6 2.47 1.75 6.31l3.85 2.96c.9-2.7 3.42-4.52 6.4-4.52z"/>
            </svg>
            <span>Sign in with Google</span>
          </button>

          <!-- Waiting state (with Cancel) -->
          <div *ngIf="isConnecting()" class="w-full space-y-2">
            <div class="flex w-full items-center justify-center space-x-2 rounded-lg bg-neutral-800 py-2.5 px-4 font-medium text-[12px] text-neutral-300">
              <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
              </svg>
              <span>Waiting for Google...</span>
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
            Complete the sign-in in your browser. If you see a Google error page, tap Cancel here and try again.
          </p>
        </div>
      </ng-container>

      <!-- ==========================================
           CONNECTED — INBOX VIEW
           ========================================== -->
      <ng-container *ngIf="isConnected()">
        <div class="flex h-full flex-col space-y-2.5 text-xs">

          <!-- HEADER CONTROLS -->
          <div class="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/90 p-2 text-xs">
            <div class="flex items-center space-x-1.5 font-mono text-[10px] text-neutral-400">
              <span class="flex h-2 w-2 rounded-full bg-emerald-400"></span>
              <span class="font-medium text-neutral-200">Gmail</span>
              <span *ngIf="unreadCount() > 0" class="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-red-400 border border-red-500/30">
                {{ unreadCount() }} Unread
              </span>
            </div>

            <div class="flex items-center space-x-1">
              <!-- Compose -->
              <button
                (click)="openCompose()"
                type="button"
                title="Compose Email"
                class="flex h-6 items-center space-x-1 rounded-lg border border-neutral-800 bg-neutral-800 px-2 font-mono text-[9px] text-neutral-300 transition hover:bg-neutral-700 hover:text-white"
              >
                <span>+</span>
                <span>Compose</span>
              </button>

              <!-- Refresh -->
              <button
                (click)="refreshMessages()"
                type="button"
                [disabled]="isLoading()"
                title="Sync Gmail"
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
              <span>Google Sync Notice</span>
            </div>
            <div class="leading-relaxed">{{ errorMessage() }}</div>
          </div>

          <!-- SEARCH / FILTER BAR -->
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
              placeholder="Search subjects, senders, snippets..."
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
              *ngFor="let mail of filteredMessages()"
              (click)="openMailDetail(mail)"
              role="button"
              tabindex="0"
              (keydown.enter)="openMailDetail(mail)"
              title="Click to open email thread in browser"
              class="group cursor-pointer rounded-xl border border-neutral-800/90 bg-neutral-900/80 p-3 text-xs transition-all duration-150 hover:border-neutral-600 hover:bg-neutral-800/90 active:scale-[0.99]"
              [class.border-l-2]="!mail.isRead"
              [class.border-l-red-500]="!mail.isRead"
              [class.bg-neutral-900/95]="!mail.isRead"
            >
              <!-- Sender & Timestamp -->
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2 overflow-hidden">
                  <div class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-800 font-mono text-[9px] font-bold text-neutral-300">
                    {{ getInitials(mail.sender.name) }}
                  </div>
                  <span class="truncate font-semibold"
                    [class.text-white]="!mail.isRead"
                    [class.text-neutral-300]="mail.isRead"
                  >{{ mail.sender.name }}</span>
                </div>

                <div class="flex items-center space-x-1.5 shrink-0">
                  <span class="font-mono text-[9px] text-neutral-500">
                    {{ formatRelativeTime(mail.timestamp) }}
                  </span>
                  <!-- Star -->
                  <button
                    (click)="$event.stopPropagation(); toggleStar(mail)"
                    type="button"
                    [title]="mail.isStarred ? 'Starred' : 'Star'"
                    class="rounded p-0.5 text-neutral-500 transition hover:text-yellow-400"
                    [class.text-yellow-400]="mail.isStarred"
                  >★</button>
                  <!-- Open icon -->
                  <button
                    *ngIf="mail.webUrl"
                    (click)="$event.stopPropagation(); openMailDetail(mail)"
                    type="button"
                    class="rounded p-1 text-neutral-500 transition hover:bg-neutral-700 hover:text-white"
                    title="Open in Gmail"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Subject -->
              <div class="mt-1 font-medium truncate"
                [class.text-neutral-100]="!mail.isRead"
                [class.text-neutral-400]="mail.isRead"
              >{{ mail.subject }}</div>

              <!-- Snippet -->
              <p class="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-neutral-400">
                {{ mail.snippet }}
              </p>

              <!-- Labels -->
              <div *ngIf="mail.labels && mail.labels.length > 0" class="mt-2 flex flex-wrap gap-1 font-mono text-[8px]">
                <span
                  *ngFor="let label of filterLabels(mail.labels)"
                  class="rounded bg-neutral-800/80 px-1.5 py-0.5 text-neutral-400"
                >{{ label }}</span>
              </div>
            </div>

            <!-- EMPTY STATE -->
            <div
              *ngIf="filteredMessages().length === 0 && !isLoading()"
              class="py-8 text-center font-mono text-xs text-neutral-500"
            >
              <div class="mb-1 text-sm">📭</div>
              No messages found.
            </div>
          </div>
        </div>
      </ng-container>

    </div>
  `,
})
export class MessagesComponent implements OnInit {
  public searchQuery = '';
  public isLoading = signal<boolean>(false);
  private localError = signal<string | null>(null);

  public errorMessage = computed(
    () => this.localError() || this.integrationManager.messagesError()
  );

  public isConnected = computed(
    () => this.integrationManager.getConnectionsForProvider('gmail').length > 0
  );

  public unreadCount = computed(
    () => this.integrationManager.unifiedMessages().filter((m) => !m.isRead).length
  );

  public filteredMessages = computed(() => {
    const list = this.integrationManager.unifiedMessages();
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
      this.refreshMessages();
    }
  }

  public async onSignInWithGoogle(): Promise<void> {
    if (this.isConnecting()) return;
    const mySeq = ++this.signInSeq;
    this.isConnecting.set(true);
    this.connectError.set(null);
    this.localError.set(null);

    try {
      const conn = await this.integrationManager.connectProvider('gmail', {
        queryFilter: 'is:unread in:inbox',
      });

      if (mySeq !== this.signInSeq) return; // cancelled — ignore stale result

      if (conn.status === 'error') {
        this.connectError.set(
          conn.errorMessage || 'Sign-in failed. Please try again.'
        );
        return;
      }

      // Explicitly refresh so any provider error surfaces in the inbox banner.
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
    // Bump the sequence so any in-flight OAuth response gets discarded.
    // The Rust listener keeps draining in the background until its timeout —
    // harmless because we ignore the eventual response.
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
      this.localError.set(err?.message || 'Failed to fetch Gmail messages.');
    } finally {
      this.isLoading.set(false);
    }
  }

  public openMailDetail(mail: UnifiedMessage): void {
    if (mail.webUrl) {
      this.windowService.openExternalUrl(mail.webUrl);
    }
    if (!mail.isRead) {
      mail.isRead = true;
      this.markAsRead(mail).catch((err) =>
        console.warn('[Messages] Mark-as-read remote sync:', err)
      );
    }
  }

  public openCompose(): void {
    this.windowService.openExternalUrl(
      'https://mail.google.com/mail/u/0/#inbox?compose=new'
    );
  }

  public async markAsRead(mail: UnifiedMessage): Promise<void> {
    const providers =
      this.integrationManager.getConnectedCapabilityProviders<MessageProvider>('messages');
    for (const p of providers) {
      if (
        p.connection.connectionId === mail.connectionId &&
        p.capabilityInstance.markAsRead
      ) {
        await p.capabilityInstance.markAsRead(p.connection.connectionId, mail.sourceId);
      }
    }
  }

  public async toggleStar(mail: UnifiedMessage): Promise<void> {
    const nextState = !mail.isStarred;
    mail.isStarred = nextState;

    const providers =
      this.integrationManager.getConnectedCapabilityProviders<MessageProvider>('messages');
    for (const p of providers) {
      if (
        p.connection.connectionId === mail.connectionId &&
        p.capabilityInstance.toggleStarred
      ) {
        await p.capabilityInstance.toggleStarred(
          p.connection.connectionId,
          mail.sourceId,
          nextState
        );
      }
    }
  }

  public getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  public filterLabels(labels: string[]): string[] {
    return labels.filter((l) => l !== 'UNREAD' && l !== 'INBOX');
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
