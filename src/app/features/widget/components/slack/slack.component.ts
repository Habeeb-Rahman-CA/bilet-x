import { Component, ElementRef, OnInit, ViewChild, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IntegrationManagerService } from '../../../../integrations/core/integration-manager.service';
import { MessageProvider } from '../../../../integrations/core/capabilities/message-provider.interface';
import { UnifiedMessage } from '../../../../integrations/core/models/unified-message.model';
import { WindowService } from '../../../../core/tauri/window.service';
import { DisconnectButtonComponent } from '../../../../shared/components/disconnect-button/disconnect-button.component';
import { SlackIntegration } from '../../../../integrations/providers/slack/slack.integration';
import { SlackChatMessage } from '../../../../integrations/providers/slack/slack.models';

export interface SlackDetailState {
  message: UnifiedMessage;
  connectionId: string;
  channelId: string;
  partnerName: string;
  isMpim: boolean;
  chatMessages: SlackChatMessage[];
  isLoading: boolean;
  error: string | null;
  isSending: boolean;
  sendError: string | null;
  sendSuccess: boolean;
}

@Component({
  selector: 'app-slack',
  standalone: true,
  imports: [CommonModule, FormsModule, DisconnectButtonComponent],
  template: `
    <div class="relative flex h-full flex-col">

      <!-- ==========================================
           CHAT DETAIL OVERLAY
           ========================================== -->
      <ng-container *ngIf="detail() as d">
        <div class="absolute inset-0 z-20 flex flex-col rounded-xl border border-neutral-800 bg-neutral-950/95 backdrop-blur-md">

          <!-- Top Toolbar / Header -->
          <div class="flex items-center justify-between border-b border-neutral-800/80 px-2.5 py-2">
            <div class="flex items-center space-x-2 overflow-hidden">
              <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-800 font-mono text-[9px] font-bold text-neutral-300">
                {{ getInitials(d.partnerName) }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center space-x-1.5">
                  <span class="truncate text-xs font-semibold text-white">{{ d.partnerName }}</span>
                  <span
                    class="rounded px-1.5 py-0.5 font-mono text-[8px]"
                    [ngClass]="{
                      'bg-purple-500/15 text-purple-300 border border-purple-500/30': d.isMpim,
                      'bg-neutral-800 text-neutral-300 border border-neutral-700/50': !d.isMpim
                    }"
                  >
                    {{ d.isMpim ? 'group' : 'DM' }}
                  </span>
                </div>
              </div>
            </div>

            <div class="flex items-center space-x-1 shrink-0">
              <!-- Refresh chat messages -->
              <button
                (click)="refreshChat()"
                type="button"
                [disabled]="d.isLoading"
                title="Refresh conversation"
                class="flex h-6 w-6 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-800 text-neutral-300 transition hover:bg-neutral-700 hover:text-white disabled:opacity-50"
              >
                <svg
                  [class.animate-spin]="d.isLoading"
                  xmlns="http://www.w3.org/2000/svg" width="11" height="11"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                >
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M8 16H3v5" />
                </svg>
              </button>

              <!-- Open in Slack app button -->
              <button
                (click)="openInSlack(d.message)"
                type="button"
                title="Open in Slack app"
                class="flex h-6 items-center space-x-1 rounded-lg border border-neutral-800 bg-neutral-800 px-2 font-mono text-[9px] text-neutral-300 transition hover:bg-neutral-700 hover:text-white"
              >
                <span>↗</span>
                <span>Slack</span>
              </button>

              <!-- Close button -->
              <button
                (click)="closeChatDetail()"
                type="button"
                title="Close"
                class="flex h-6 w-6 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-800 text-neutral-300 transition hover:bg-neutral-700 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Chat Conversation Area -->
          <div #chatContainer class="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-2.5 text-xs">
            <!-- Loading indicator -->
            <div *ngIf="d.isLoading && d.chatMessages.length === 0" class="flex items-center justify-center space-x-2 py-8 font-mono text-[10px] text-neutral-500">
              <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              <span>Loading messages...</span>
            </div>

            <!-- Error banner in detail -->
            <div *ngIf="d.error" class="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[10px] text-red-300">
              ⚠️ {{ d.error }}
            </div>

            <!-- Messages list -->
            <ng-container *ngFor="let m of d.chatMessages">
              <!-- Outgoing (You) -->
              <div *ngIf="m.isFromMe" class="flex flex-col items-end">
                <div class="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#4A154B] px-3.5 py-2 text-[12px] text-white shadow-sm border border-purple-500/30 whitespace-pre-wrap break-words leading-relaxed">
                  {{ m.text }}
                </div>
                <span class="mt-0.5 mr-1 font-mono text-[9px] text-neutral-500">
                  {{ formatRelativeTime(m.timestamp) }}
                </span>
              </div>

              <!-- Incoming (Contact / Other) -->
              <div *ngIf="!m.isFromMe" class="flex items-start space-x-2 max-w-[88%]">
                <div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-800 font-mono text-[9px] font-bold text-neutral-300">
                  {{ getInitials(m.senderName) }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="mb-0.5 flex items-center space-x-1.5 font-mono text-[9px] text-neutral-500">
                    <span class="font-sans font-semibold text-neutral-300">{{ m.senderName }}</span>
                    <span>·</span>
                    <span>{{ formatRelativeTime(m.timestamp) }}</span>
                  </div>
                  <div class="rounded-2xl rounded-tl-sm border border-neutral-800 bg-neutral-900/90 px-3.5 py-2 text-[12px] text-neutral-200 shadow-sm whitespace-pre-wrap break-words leading-relaxed">
                    {{ m.text }}
                  </div>
                </div>
              </div>
            </ng-container>

            <!-- Empty chat state -->
            <div *ngIf="!d.isLoading && d.chatMessages.length === 0 && !d.error" class="py-12 text-center font-mono text-xs text-neutral-500">
              <div class="mb-1 text-base">💬</div>
              No messages found.
            </div>
          </div>

          <!-- Bottom Reply Composer -->
          <div class="mx-2 mb-2 rounded-xl border border-neutral-800 bg-neutral-900/90">
            <div *ngIf="d.sendError" class="border-b border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] text-red-300">
              ⚠️ {{ d.sendError }}
            </div>
            <div *ngIf="d.sendSuccess" class="border-b border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] text-emerald-300">
              ✓ Message sent
            </div>

            <div class="flex items-center space-x-2 p-1.5">
              <input
                type="text"
                [ngModel]="replyDraft()"
                (ngModelChange)="replyDraft.set($event)"
                [placeholder]="'Message ' + d.partnerName + '...'"
                [disabled]="d.isSending"
                (keydown.enter)="sendReply()"
                class="flex-1 bg-transparent px-2.5 py-1 text-[12px] text-white placeholder-neutral-500 focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                (click)="sendReply()"
                [disabled]="d.isSending || !replyDraft().trim()"
                [title]="d.isSending ? 'Sending...' : 'Send message'"
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#4A154B] text-white transition hover:bg-[#611f62] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#4A154B]"
              >
                <svg *ngIf="!d.isSending" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                <svg *ngIf="d.isSending" class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
              </button>
            </div>
          </div>

        </div>
      </ng-container>

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
              Sign in once with Slack
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
              <span *ngIf="unreadCount() > 0" class="rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-purple-300 border border-purple-500/30">
                {{ unreadCount() }} Unread
              </span>
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

              <app-disconnect-button providerId="slack"></app-disconnect-button>
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

          <!-- SEARCH & UNREAD TOGGLE -->
          <div class="flex items-center space-x-1.5">
            <div class="flex items-center rounded-xl border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5 text-xs flex-1">
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
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
                placeholder="Search DMs..."
                class="w-full bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none"
              />
              <button
                *ngIf="searchQuery()"
                (click)="searchQuery.set('')"
                type="button"
                class="text-[10px] text-neutral-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div class="flex items-center rounded-xl border border-neutral-800 bg-neutral-900/60 p-0.5 font-mono text-[9px]">
              <button
                type="button"
                (click)="showUnreadOnly.set(true)"
                class="rounded-lg px-2 py-1 transition"
                [class.bg-purple-500/20]="showUnreadOnly()"
                [class.text-purple-300]="showUnreadOnly()"
                [class.font-semibold]="showUnreadOnly()"
                [class.text-neutral-400]="!showUnreadOnly()"
                [class.hover:text-white]="!showUnreadOnly()"
              >
                Unread ({{ unreadCount() }})
              </button>
              <button
                type="button"
                (click)="showUnreadOnly.set(false)"
                class="rounded-lg px-2 py-1 transition"
                [class.bg-neutral-800]="!showUnreadOnly()"
                [class.text-neutral-200]="!showUnreadOnly()"
                [class.font-semibold]="!showUnreadOnly()"
                [class.text-neutral-500]="showUnreadOnly()"
                [class.hover:text-white]="showUnreadOnly()"
              >
                All
              </button>
            </div>
          </div>

          <!-- MESSAGES LIST -->
          <div class="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            <div
              *ngFor="let msg of filteredMessages()"
              (click)="openChatDetail(msg)"
              role="button"
              tabindex="0"
              (keydown.enter)="openChatDetail(msg)"
              title="Click to open conversation"
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

                <div class="flex items-center space-x-1.5 shrink-0">
                  <span class="font-mono text-[9px] text-neutral-500">
                    {{ formatRelativeTime(msg.timestamp) }}
                  </span>

                  <!-- Open externally in Slack client -->
                  <button
                    (click)="$event.stopPropagation(); openInSlack(msg)"
                    type="button"
                    class="rounded p-1 text-neutral-500 transition hover:bg-neutral-700 hover:text-white"
                    title="Open in Slack app"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </button>
                </div>
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
              class="py-12 text-center font-mono text-xs text-neutral-500"
            >
              <div class="mb-1 text-base">✓</div>
              <div class="font-medium text-neutral-400">All caught up!</div>
              <div class="mt-0.5 text-[10px] text-neutral-600">
                {{ showUnreadOnly() ? 'No unread messages.' : 'No messages found.' }}
              </div>
            </div>
          </div>
        </div>
      </ng-container>

    </div>
  `,
})
export class SlackComponent implements OnInit {
  @ViewChild('chatContainer') private chatContainer?: ElementRef<HTMLDivElement>;

  public searchQuery = signal<string>('');
  public isLoading = signal<boolean>(false);
  public detail = signal<SlackDetailState | null>(null);
  public replyDraft = signal<string>('');
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

  public showUnreadOnly = signal<boolean>(true);

  public unreadCount = computed(
    () => this.slackMessages().filter((m) => !m.isRead).length
  );

  public filteredMessages = computed(() => {
    let list = this.slackMessages();
    if (this.showUnreadOnly()) {
      list = list.filter((m) => !m.isRead);
    }
    const q = this.searchQuery().trim().toLowerCase();
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
    private windowService: WindowService,
    private slackIntegration: SlackIntegration
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
    const minWait = new Promise((resolve) => setTimeout(resolve, 500));
    try {
      await Promise.allSettled([this.integrationManager.fetchMessages(), minWait]);
    } catch (err: any) {
      this.localError.set(err?.message || 'Failed to fetch Slack messages.');
    } finally {
      this.isLoading.set(false);
    }
  }

  public openChatDetail(msg: UnifiedMessage): void {
    const channelId = ((msg.metadata?.['channelId'] as string) || msg.threadId || '').trim();
    const connectionId = msg.connectionId || this.currentConnection()?.connectionId || '';
    const partnerName = (msg.metadata?.['partnerName'] as string) || msg.sender.name || 'Chat';
    const isMpim = this.isMpim(msg);

    if (!channelId || !connectionId) {
      return;
    }

    this.replyDraft.set('');
    this.detail.set({
      message: msg,
      connectionId,
      channelId,
      partnerName,
      isMpim,
      chatMessages: [],
      isLoading: true,
      error: null,
      isSending: false,
      sendError: null,
      sendSuccess: false,
    });

    if (!msg.isRead) {
      msg.isRead = true;
      this.integrationManager.markMessageAsRead(msg.id);
      this.markAsRead(msg).catch((err) =>
        console.warn('[Slack] Mark-as-read remote sync:', err)
      );
    }

    this.loadChatHistory(connectionId, channelId);
  }

  public closeChatDetail(): void {
    this.detail.set(null);
    this.replyDraft.set('');
  }

  public async refreshChat(): Promise<void> {
    const d = this.detail();
    if (!d) return;

    this.detail.set({
      ...d,
      isLoading: true,
      error: null,
      sendError: null,
      sendSuccess: false,
    });

    const minWait = new Promise((resolve) => setTimeout(resolve, 500));
    try {
      const [messages] = await Promise.all([
        this.slackIntegration.fetchConversationHistory(d.connectionId, d.channelId, 30),
        minWait,
      ]);
      this.detail.update((curr) =>
        curr && curr.channelId === d.channelId
          ? { ...curr, chatMessages: messages, isLoading: false, error: null }
          : curr
      );
      this.scrollToBottom();
    } catch (err: any) {
      this.detail.update((curr) =>
        curr && curr.channelId === d.channelId
          ? {
              ...curr,
              isLoading: false,
              error: err?.message || 'Failed to refresh conversation.',
            }
          : curr
      );
    }
  }

  private async loadChatHistory(connectionId: string, channelId: string): Promise<void> {
    try {
      const messages = await this.slackIntegration.fetchConversationHistory(
        connectionId,
        channelId,
        30
      );
      this.detail.update((curr) =>
        curr && curr.channelId === channelId
          ? { ...curr, chatMessages: messages, isLoading: false, error: null }
          : curr
      );
      this.scrollToBottom();
    } catch (err: any) {
      this.detail.update((curr) =>
        curr && curr.channelId === channelId
          ? {
              ...curr,
              isLoading: false,
              error: err?.message || 'Failed to load conversation history.',
            }
          : curr
      );
    }
  }

  public async sendReply(): Promise<void> {
    const d = this.detail();
    if (!d || d.isSending) return;

    const text = this.replyDraft().trim();
    if (!text) {
      this.detail.update((curr) =>
        curr ? { ...curr, sendError: 'Type a message first.' } : curr
      );
      return;
    }

    this.detail.update((curr) =>
      curr ? { ...curr, isSending: true, sendError: null, sendSuccess: false } : curr
    );

    try {
      const sentMsg = await this.slackIntegration.postChatMessage(
        d.connectionId,
        d.channelId,
        text
      );

      this.replyDraft.set('');
      this.detail.update((curr) => {
        if (!curr || curr.channelId !== d.channelId) return curr;
        return {
          ...curr,
          chatMessages: [...curr.chatMessages, sentMsg],
          isSending: false,
          sendError: null,
          sendSuccess: true,
        };
      });

      // Update snippet in the feed
      d.message.snippet = `You: ${text}`;
      d.message.timestamp = sentMsg.timestamp;

      this.scrollToBottom();

      // Clear success notification after 3s
      setTimeout(() => {
        this.detail.update((curr) =>
          curr && curr.channelId === d.channelId ? { ...curr, sendSuccess: false } : curr
        );
      }, 3000);
    } catch (err: any) {
      this.detail.update((curr) =>
        curr && curr.channelId === d.channelId
          ? {
              ...curr,
              isSending: false,
              sendError: err?.message || 'Failed to send message.',
              sendSuccess: false,
            }
          : curr
      );
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.chatContainer?.nativeElement) {
        this.chatContainer.nativeElement.scrollTop =
          this.chatContainer.nativeElement.scrollHeight;
      }
    }, 60);
  }

  public openInSlack(msg: UnifiedMessage): void {
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
      this.integrationManager.markMessageAsRead(msg.id);
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
