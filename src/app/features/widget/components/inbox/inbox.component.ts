import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowService } from '../../../../core/tauri/window.service';
import { TabIconComponent } from '../dock/tab-icon.component';
import { MessagesComponent } from '../messages/messages.component';
import { OutlookComponent } from '../outlook/outlook.component';
import { SlackComponent } from '../slack/slack.component';
import { WhatsAppComponent } from '../whatsapp/whatsapp.component';
import { JiraComponent } from '../jira/jira.component';
import { GitHubComponent } from '../github/github.component';
import { UnifiedMessage } from '../../../../integrations/core/models/unified-message.model';
import { UnifiedTask } from '../../../../integrations/core/models/unified-task.model';
import { InboxStateService } from './inbox-state.service';

/**
 * Row in the unified "All" feed. Wraps either a UnifiedMessage or a
 * UnifiedTask with a common timestamp and a display shape the template
 * can render without further type narrowing.
 */
interface UnifiedFeedItem {
  kind: 'message' | 'task';
  id: string;
  providerId: string;
  title: string;
  subtitle: string;
  timestamp: string;
  webUrl?: string;
  isRead: boolean;
  raw: UnifiedMessage | UnifiedTask;
}

/**
 * Inbox body. The switcher strip lives in the panel header (rendered by
 * the widget via <app-inbox-switcher>) so it sits parallel to the close
 * button rather than stacked above the body. Both surfaces share state
 * through InboxStateService.
 */
@Component({
  selector: 'app-inbox',
  standalone: true,
  imports: [
    CommonModule,
    TabIconComponent,
    MessagesComponent,
    OutlookComponent,
    SlackComponent,
    WhatsAppComponent,
    JiraComponent,
    GitHubComponent,
  ],
  template: `
    <div class="flex h-full flex-col">
      <app-messages  *ngIf="state.activeService() === 'gmail'"    class="block h-full"></app-messages>
      <app-outlook   *ngIf="state.activeService() === 'outlook'"  class="block h-full"></app-outlook>
      <app-slack     *ngIf="state.activeService() === 'slack'"    class="block h-full"></app-slack>
      <app-whatsapp  *ngIf="state.activeService() === 'whatsapp'" class="block h-full"></app-whatsapp>
      <app-jira      *ngIf="state.activeService() === 'jira'"     class="block h-full"></app-jira>
      <app-github    *ngIf="state.activeService() === 'github'"   class="block h-full"></app-github>

      <!-- ALL: unified message + task feed. -->
      <div *ngIf="state.activeService() === 'all'" class="flex h-full flex-col">
        <div class="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          <div
            *ngFor="let item of unifiedFeed()"
            (click)="openFeedItem(item)"
            role="button"
            tabindex="0"
            (keydown.enter)="openFeedItem(item)"
            class="group cursor-pointer rounded-xl border border-neutral-800/90 bg-neutral-900/80 p-3 text-xs transition-all duration-150 hover:border-neutral-600 hover:bg-neutral-800/90 active:scale-[0.99]"
            [class.border-l-2]="item.kind === 'message' && !item.isRead"
            [class.border-l-red-500]="item.kind === 'message' && !item.isRead"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2 overflow-hidden">
                <!-- Provider icon on the row so users can tell at a
                     glance which service the item came from. -->
                <span class="flex h-5 w-5 shrink-0 items-center justify-center text-neutral-300">
                  <app-tab-icon [tab]="state.tabForProvider(item.providerId)" [size]="12"></app-tab-icon>
                </span>
                <span class="truncate font-semibold text-neutral-200">{{ item.title }}</span>
              </div>
              <span class="ml-2 shrink-0 font-mono text-[9px] text-neutral-500">
                {{ formatRelativeTime(item.timestamp) }}
              </span>
            </div>
            <p class="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-neutral-400">
              {{ item.subtitle }}
            </p>
          </div>

            <!-- EMPTY / ONBOARDING STATE.
                 Only shown when 'all' is genuinely empty. If the user
                 hasn't connected anything yet, nudge them into a service. -->
          <div
            *ngIf="unifiedFeed().length === 0"
            class="py-8 text-center font-mono text-xs text-neutral-500"
          >
            <div *ngIf="state.hasAnyConnection()">Nothing new across your services.</div>
            <div *ngIf="!state.hasAnyConnection()">
              Pick a service icon above to sign in and start seeing messages & tasks here.
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class InboxComponent {
  /**
   * Union of messages + tasks from every connected provider, sorted
   * newest first. Rebuilt whenever unifiedMessages or unifiedTasks
   * changes — cheap enough (dozens of items) that memoization by hand
   * isn't worth the complexity.
   */
  public unifiedFeed = computed<UnifiedFeedItem[]>(() => {
    const messages = this.state.integrationManager
      .unifiedMessages()
      .map<UnifiedFeedItem>((m) => ({
        kind: 'message',
        id: m.id,
        providerId: m.providerId,
        title: m.sender?.name || m.subject || '(no subject)',
        subtitle: m.subject || m.snippet || '',
        timestamp: m.timestamp,
        webUrl: m.webUrl,
        isRead: m.isRead,
        raw: m,
      }));

    const tasks = this.state.integrationManager
      .unifiedTasks()
      .map<UnifiedFeedItem>((t) => ({
        kind: 'task',
        id: t.id,
        providerId: t.providerId,
        title: t.title,
        subtitle: [t.sourceId, t.project?.key || t.project?.name, t.statusRaw || t.status]
          .filter(Boolean)
          .join(' · '),
        timestamp: t.updatedAt,
        webUrl: t.webUrl,
        isRead: true, // tasks don't carry an unread bit
        raw: t,
      }));

    return [...messages, ...tasks].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  });

  constructor(
    public state: InboxStateService,
    private windowService: WindowService
  ) {}

  public openFeedItem(item: UnifiedFeedItem): void {
    if (item.webUrl) {
      this.windowService.openExternalUrl(item.webUrl);
    }
  }

  public formatRelativeTime(isoString: string): string {
    if (!isoString) return '';
    const then = new Date(isoString).getTime();
    if (isNaN(then)) return '';
    const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }
}
