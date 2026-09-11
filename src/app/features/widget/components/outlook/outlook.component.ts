import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IntegrationManagerService } from '../../../../integrations/core/integration-manager.service';
import { MessageProvider } from '../../../../integrations/core/capabilities/message-provider.interface';
import { UnifiedMessage } from '../../../../integrations/core/models/unified-message.model';
import { WindowService } from '../../../../core/tauri/window.service';

@Component({
  selector: 'app-outlook',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex h-full flex-col">

      <!-- ==========================================
           NOT CONNECTED — SIGN IN WITH MICROSOFT CARD
           ========================================== -->
      <ng-container *ngIf="!isConnected()">
        <div class="flex flex-1 flex-col items-center justify-center space-y-5 px-3 py-8">

          <div class="flex flex-col items-center space-y-1 text-center">
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/80 text-[#0078D4]">
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h13.9q.44 0 .75.3.3.3.3.75V10.85l1.24.72h.01q.1.07.18.18.07.12.07.25zm-6-8.25v3h3v-3zm0 4.5v3h3v-3zm0 4.5v1.83l3.05-1.83zm-5.25-9v3h3.75v-3zm0 4.5v3h3.75v-3zm0 4.5v2.03l2.41 1.5 1.34-.8v-2.73zM9 3.75V6h2l.13.01.12.04v-2.3zM5.98 15.98q1.14 0 2.02-.53.87-.53 1.34-1.45.48-.92.48-2.1 0-1.13-.47-2.03-.48-.9-1.33-1.4-.86-.5-1.98-.5-1.14 0-2.02.53-.88.53-1.36 1.46-.48.93-.48 2.1 0 1.14.48 2.05.48.91 1.36 1.44.88.53 1.96.53zM24 20.44L14.28 14v6.86H24z"/>
              </svg>
            </div>
            <div class="text-sm font-semibold text-white pt-1">Connect Outlook</div>
            <div class="text-[10px] leading-relaxed text-neutral-400 max-w-[220px]">
              Sign in once with Microsoft — Bilet-X shows your Outlook inbox and refreshes the session automatically.
            </div>
          </div>

          <!-- Error banner -->
          <div
            *ngIf="connectError()"
            class="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[10px] leading-relaxed text-red-300"
          >
            <span class="mr-1">⚠️</span>{{ connectError() }}
          </div>

          <!-- Sign in with Microsoft button (idle) -->
          <button
            *ngIf="!isConnecting()"
            (click)="onSignInWithMicrosoft()"
            type="button"
            class="flex w-full items-center justify-center space-x-2 rounded-lg bg-white py-2.5 px-4 font-semibold text-[12px] text-neutral-900 transition hover:bg-neutral-100 active:scale-[0.99]"
          >
            <!-- Microsoft four-square mark -->
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 21 21" aria-hidden="true">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
            <span>Sign in with Microsoft</span>
          </button>

          <!-- Waiting state (with Cancel) -->
          <div *ngIf="isConnecting()" class="w-full space-y-2">
            <div class="flex w-full items-center justify-center space-x-2 rounded-lg bg-neutral-800 py-2.5 px-4 font-medium text-[12px] text-neutral-300">
              <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
              </svg>
              <span>Waiting for Microsoft...</span>
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
           CONNECTED — INBOX VIEW
           ========================================== -->
      <ng-container *ngIf="isConnected()">
        <div class="flex h-full flex-col space-y-2.5 text-xs">

          <!-- HEADER CONTROLS -->
          <div class="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/90 p-2 text-xs">
            <div class="flex items-center space-x-1.5 font-mono text-[10px] text-neutral-400">
              <span class="flex h-2 w-2 rounded-full bg-emerald-400"></span>
              <span class="font-medium text-neutral-200">Outlook</span>
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
                title="Sync Outlook"
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
              <span>Outlook Sync Notice</span>
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
              title="Click to open email in Outlook"
              class="group cursor-pointer rounded-xl border border-neutral-800/90 bg-neutral-900/80 p-3 text-xs transition-all duration-150 hover:border-neutral-600 hover:bg-neutral-800/90 active:scale-[0.99]"
              [class.border-l-2]="!mail.isRead"
              [class.border-l-blue-500]="!mail.isRead"
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
                  <!-- Flag (starred equivalent) -->
                  <button
                    (click)="$event.stopPropagation(); toggleStar(mail)"
                    type="button"
                    [title]="mail.isStarred ? 'Flagged' : 'Flag'"
                    class="rounded p-0.5 text-neutral-500 transition hover:text-yellow-400"
                    [class.text-yellow-400]="mail.isStarred"
                  >★</button>
                  <!-- Open icon -->
                  <button
                    *ngIf="mail.webUrl"
                    (click)="$event.stopPropagation(); openMailDetail(mail)"
                    type="button"
                    class="rounded p-1 text-neutral-500 transition hover:bg-neutral-700 hover:text-white"
                    title="Open in Outlook"
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

              <!-- Labels / categories -->
              <div *ngIf="mail.labels && mail.labels.length > 0" class="mt-2 flex flex-wrap gap-1 font-mono text-[8px]">
                <span
                  *ngFor="let label of mail.labels"
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
export class OutlookComponent implements OnInit {
  public searchQuery = '';
  public isLoading = signal<boolean>(false);
  private localError = signal<string | null>(null);

  public errorMessage = computed(
    () => this.localError() || this.integrationManager.messagesError()
  );

  public isConnected = computed(
    () => this.integrationManager.getConnectionsForProvider('outlook').length > 0
  );

  public outlookMessages = computed(() =>
    this.integrationManager.unifiedMessages().filter((m) => m.providerId === 'outlook')
  );

  public unreadCount = computed(
    () => this.outlookMessages().filter((m) => !m.isRead).length
  );

  public filteredMessages = computed(() => {
    const list = this.outlookMessages();
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

  public async onSignInWithMicrosoft(): Promise<void> {
    if (this.isConnecting()) return;
    const mySeq = ++this.signInSeq;
    this.isConnecting.set(true);
    this.connectError.set(null);
    this.localError.set(null);

    try {
      const conn = await this.integrationManager.connectProvider('outlook', {});

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
      this.localError.set(err?.message || 'Failed to fetch Outlook messages.');
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
        console.warn('[Outlook] Mark-as-read remote sync:', err)
      );
    }
  }

  public openCompose(): void {
    this.windowService.openExternalUrl(
      'https://outlook.office.com/mail/deeplink/compose'
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
