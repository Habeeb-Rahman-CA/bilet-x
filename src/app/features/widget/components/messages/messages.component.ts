import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IntegrationManagerService } from '../../../../integrations/core/integration-manager.service';
import {
  MessageDraft,
  MessageProvider,
} from '../../../../integrations/core/capabilities/message-provider.interface';
import { UnifiedMessage } from '../../../../integrations/core/models/unified-message.model';
import { WindowService } from '../../../../core/tauri/window.service';
import { DisconnectButtonComponent } from '../../../../shared/components/disconnect-button/disconnect-button.component';

interface MailDetailState {
  mail: UnifiedMessage;
  bodyText: string;
  isLoading: boolean;
  error: string | null;
  isSending: boolean;
  sendError: string | null;
  sendSuccess: boolean;
}

interface ComposeState {
  to: string;
  subject: string;
  body: string;
  isSending: boolean;
  sendError: string | null;
  sendSuccess: boolean;
}

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, DisconnectButtonComponent],
  template: `
    <div class="relative flex h-full flex-col">

      <!-- ==========================================
           MAIL DETAIL OVERLAY
           ========================================== -->
      <ng-container *ngIf="detail() as d">
        <div class="absolute inset-0 z-20 flex flex-col rounded-xl border border-neutral-800 bg-neutral-950/95 backdrop-blur-md">

          <!-- Toolbar -->
          <div class="flex items-center justify-between px-2.5 py-2">
            <div class="flex items-center space-x-1.5">
              <button
                (click)="toggleStar(d.mail)"
                type="button"
                [title]="d.mail.isStarred ? 'Starred' : 'Star'"
                class="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-800/80 text-neutral-300 transition hover:bg-neutral-700"
                [class.text-yellow-400]="d.mail.isStarred"
                [class.hover:text-yellow-400]="!d.mail.isStarred"
                [class.hover:text-yellow-300]="d.mail.isStarred"
              >
                <span class="text-[13px] leading-none">★</span>
              </button>
            </div>

            <div class="flex items-center space-x-1.5">
              
              <button
                (click)="closeMailDetail()"
                type="button"
                title="Close"
                class="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-800/80 text-neutral-300 transition hover:bg-neutral-700 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Sender + subject -->
          <div class="flex items-start space-x-2.5 px-3 pb-2 pt-1">
            <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-[#EA4335]">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
              </svg>
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold text-white">{{ d.mail.sender.name }}</div>
              <div class="truncate text-[11px] text-neutral-400">{{ d.mail.subject }}</div>
            </div>
            <div class="shrink-0 pt-0.5 font-mono text-[9px] text-neutral-500">
              {{ formatRelativeTime(d.mail.timestamp) }}
            </div>
          </div>

          <!-- Body -->
          <div class="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            <div *ngIf="d.isLoading" class="flex items-center space-x-2 py-4 font-mono text-[10px] text-neutral-500">
              <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              <span>Loading full message...</span>
            </div>

            <div
              *ngIf="d.error && !d.isLoading"
              class="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[10px] leading-relaxed text-red-300"
            >
              <span class="mr-1">⚠️</span>{{ d.error }}
            </div>

            <pre
              *ngIf="!d.isLoading && !d.error"
              class="whitespace-pre-wrap break-words font-sans text-[12px] leading-relaxed text-neutral-200"
            >{{ d.bodyText || '(Empty message)' }}</pre>
          </div>

          <!-- Reply composer -->
          <div class="mx-2 mb-2 rounded-xl border border-neutral-800 bg-neutral-900/80">
            <div
              *ngIf="d.sendError"
              class="border-b border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] leading-relaxed text-red-300"
            >
              <span class="mr-1">⚠️</span>{{ d.sendError }}
            </div>
            <div
              *ngIf="d.sendSuccess"
              class="border-b border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] leading-relaxed text-emerald-300"
            >
              ✓ Reply sent
            </div>
            <input
              type="text"
              [(ngModel)]="replyDraft"
              placeholder="Start typing"
              [disabled]="d.isSending"
              (keydown.enter)="sendReply(d.mail)"
              class="w-full bg-transparent px-3 pt-2.5 text-[12px] text-white placeholder-neutral-500 focus:outline-none disabled:opacity-50"
            />
            <div class="flex items-center justify-between px-2 py-1.5 text-neutral-400">
              <div class="flex items-center space-x-2">
                <button type="button" title="Formatting (not supported in-widget)" disabled class="cursor-not-allowed rounded p-1 text-[10px] font-semibold opacity-40">Aa</button>
                <button type="button" title="Mention (not supported in-widget)" disabled class="cursor-not-allowed rounded p-1 opacity-40">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
                  </svg>
                </button>
                <button type="button" title="Attach (not supported in-widget)" disabled class="cursor-not-allowed rounded p-1 opacity-40">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.49" />
                  </svg>
                </button>
              </div>
              <div class="flex items-center space-x-1.5">
                <button type="button" title="Emoji (not supported in-widget)" disabled class="cursor-not-allowed rounded p-1 opacity-40">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" />
                    <line x1="15" y1="9" x2="15.01" y2="9" />
                  </svg>
                </button>
                <button type="button" title="Voice (not supported in-widget)" disabled class="cursor-not-allowed rounded p-1 opacity-40">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </button>
                <button
                  type="button"
                  [title]="d.isSending ? 'Sending...' : 'Send reply'"
                  (click)="sendReply(d.mail)"
                  [disabled]="d.isSending || !replyDraft.trim()"
                  class="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-700 text-white transition hover:bg-neutral-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-neutral-700"
                >
                  <svg *ngIf="!d.isSending" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                  <svg *ngIf="d.isSending" class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- ==========================================
           COMPOSE NEW EMAIL OVERLAY
           ========================================== -->
      <ng-container *ngIf="compose() as c">
        <div class="absolute inset-0 z-20 flex flex-col rounded-xl border border-neutral-800 bg-neutral-950/95 backdrop-blur-md">

          <!-- Toolbar -->
          <div class="flex items-center justify-between px-2.5 py-2">
            <div class="text-[11px] font-semibold text-neutral-200">New message</div>
            <div class="flex items-center space-x-1.5">
              <button
                (click)="openComposeInGmail(c)"
                type="button"
                title="Continue in Gmail (opens browser)"
                class="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-800/80 text-neutral-300 transition hover:bg-neutral-700 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </button>
              <button
                (click)="closeCompose()"
                type="button"
                title="Close"
                class="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-800/80 text-neutral-300 transition hover:bg-neutral-700 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Address / subject fields -->
          <div class="mx-2 space-y-1 rounded-xl border border-neutral-800 bg-neutral-900/60 px-2 py-1.5 text-[11px]">
            <div class="flex items-center border-b border-neutral-800/70 pb-1.5">
              <span class="w-14 shrink-0 font-mono text-[10px] text-neutral-500">To</span>
              <input
                type="email"
                [ngModel]="c.to"
                (ngModelChange)="updateComposeField('to', $event)"
                placeholder="name@example.com"
                [disabled]="c.isSending"
                class="w-full bg-transparent text-white placeholder-neutral-500 focus:outline-none disabled:opacity-50"
              />
            </div>
            <div class="flex items-center">
              <span class="w-14 shrink-0 font-mono text-[10px] text-neutral-500">Subject</span>
              <input
                type="text"
                [ngModel]="c.subject"
                (ngModelChange)="updateComposeField('subject', $event)"
                placeholder="Optional"
                [disabled]="c.isSending"
                class="w-full bg-transparent text-white placeholder-neutral-500 focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          <!-- Body -->
          <div class="mx-2 mt-2 flex min-h-0 flex-1 flex-col rounded-xl border border-neutral-800 bg-neutral-900/60">
            <textarea
              [ngModel]="c.body"
              (ngModelChange)="updateComposeField('body', $event)"
              placeholder="Write your message..."
              [disabled]="c.isSending"
              class="min-h-0 flex-1 resize-none bg-transparent px-3 py-2 text-[12px] leading-relaxed text-white placeholder-neutral-500 focus:outline-none disabled:opacity-50"
            ></textarea>
          </div>

          <!-- Feedback + Send -->
          <div class="mx-2 mb-2 mt-2 space-y-1.5">
            <div
              *ngIf="c.sendError"
              class="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] leading-relaxed text-red-300"
            >
              <span class="mr-1">⚠️</span>{{ c.sendError }}
            </div>
            <div
              *ngIf="c.sendSuccess"
              class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] leading-relaxed text-emerald-300"
            >
              ✓ Message sent
            </div>
            <div class="flex items-center justify-end">
              <button
                type="button"
                (click)="sendCompose()"
                [disabled]="c.isSending || !c.to.trim() || !c.body.trim()"
                class="flex items-center space-x-1.5 rounded-lg bg-neutral-100 px-3 py-1.5 text-[11px] font-semibold text-neutral-900 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
              >
                <svg *ngIf="!c.isSending" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
                <svg *ngIf="c.isSending" class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
                <span>{{ c.isSending ? 'Sending...' : 'Send' }}</span>
              </button>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- ==========================================
           NOT CONNECTED — SIGN IN WITH GOOGLE CARD
           ========================================== -->
      <ng-container *ngIf="!isConnected()">
        <div class="flex flex-1 flex-col items-center justify-center space-y-5 px-3 py-8">

          <div class="flex flex-col items-center space-y-1 text-center">
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/80 text-[#EA4335]">
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
              </svg>
            </div>
            <div class="text-sm font-semibold text-white pt-1">Connect Gmail</div>
            <div class="text-[10px] leading-relaxed text-neutral-400 max-w-[220px]">
              Sign in once with Google
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

              <app-disconnect-button providerId="gmail"></app-disconnect-button>
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
                placeholder="Search emails..."
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
                [class.bg-red-500/20]="showUnreadOnly()"
                [class.text-red-400]="showUnreadOnly()"
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
              *ngFor="let mail of filteredMessages()"
              (click)="openMailDetail(mail)"
              role="button"
              tabindex="0"
              (keydown.enter)="openMailDetail(mail)"
              title="Open message"
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
                    (click)="$event.stopPropagation(); openMailInGmail(mail)"
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
              class="py-12 text-center font-mono text-xs text-neutral-500"
            >
              <div class="mb-1 text-base">✓</div>
              <div class="font-medium text-neutral-400">All caught up!</div>
              <div class="mt-0.5 text-[10px] text-neutral-600">
                {{ showUnreadOnly() ? 'No unread emails.' : 'No messages found.' }}
              </div>
            </div>
          </div>
        </div>
      </ng-container>

    </div>
  `,
})
export class MessagesComponent implements OnInit {
  public searchQuery = signal<string>('');
  public isLoading = signal<boolean>(false);
  private localError = signal<string | null>(null);

  public errorMessage = computed(
    () => this.localError() || this.integrationManager.messagesError()
  );

  public isConnected = computed(
    () => this.integrationManager.getConnectionsForProvider('gmail').length > 0
  );

  public gmailMessages = computed(() =>
    this.integrationManager.unifiedMessages().filter((m) => m.providerId === 'gmail')
  );

  public showUnreadOnly = signal<boolean>(true);

  public unreadCount = computed(
    () => this.gmailMessages().filter((m) => !m.isRead).length
  );

  public filteredMessages = computed(() => {
    let list = this.gmailMessages();
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

  public detail = signal<MailDetailState | null>(null);
  public detailMenuOpen = signal<boolean>(false);
  public replyDraft = '';
  public compose = signal<ComposeState | null>(null);

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
    const minWait = new Promise((resolve) => setTimeout(resolve, 500));
    try {
      await Promise.allSettled([this.integrationManager.fetchMessages(), minWait]);
    } catch (err: any) {
      this.localError.set(err?.message || 'Failed to fetch Gmail messages.');
    } finally {
      this.isLoading.set(false);
    }
  }

  public openMailDetail(mail: UnifiedMessage): void {
    this.detailMenuOpen.set(false);
    this.replyDraft = '';
    this.detail.set({
      mail,
      bodyText: '',
      isLoading: true,
      error: null,
      isSending: false,
      sendError: null,
      sendSuccess: false,
    });
    this.loadMailBody(mail);

    if (!mail.isRead) {
      mail.isRead = true;
      this.integrationManager.markMessageAsRead(mail.id);
      this.markAsRead(mail).catch((err) =>
        console.warn('[Messages] Mark-as-read remote sync:', err)
      );
    }
  }

  public closeMailDetail(): void {
    this.detail.set(null);
    this.detailMenuOpen.set(false);
    this.replyDraft = '';
  }

  public toggleDetailMenu(): void {
    this.detailMenuOpen.update((v) => !v);
  }

  public closeDetailMenu(): void {
    this.detailMenuOpen.set(false);
  }

  public async refreshDetail(): Promise<void> {
    const current = this.detail();
    if (!current) return;
    this.detailMenuOpen.set(false);
    this.detail.set({
      ...current,
      bodyText: '',
      isLoading: true,
      error: null,
      sendError: null,
      sendSuccess: false,
    });
    await this.loadMailBody(current.mail);
  }

  public openMailInGmail(mail: UnifiedMessage): void {
    if (mail.webUrl) {
      this.windowService.openExternalUrl(mail.webUrl);
    }
    if (!mail.isRead) {
      mail.isRead = true;
      this.integrationManager.markMessageAsRead(mail.id);
      this.markAsRead(mail).catch((err) =>
        console.warn('[Messages] Mark-as-read remote sync:', err)
      );
    }
  }

  public async sendReply(mail: UnifiedMessage): Promise<void> {
    const current = this.detail();
    if (!current || current.mail.id !== mail.id) return;
    if (current.isSending) return;

    const draft = this.replyDraft.trim();
    if (!draft) {
      this.detail.update((d) =>
        d && d.mail.id === mail.id
          ? { ...d, sendError: 'Type a reply first.', sendSuccess: false }
          : d
      );
      return;
    }

    const providers =
      this.integrationManager.getConnectedCapabilityProviders<MessageProvider>('messages');
    const match = providers.find(
      (p) => p.connection.connectionId === mail.connectionId
    );

    if (!match?.capabilityInstance.sendMessage) {
      this.detail.update((d) =>
        d && d.mail.id === mail.id
          ? {
              ...d,
              sendError: 'This provider does not support in-app sending yet.',
              sendSuccess: false,
            }
          : d
      );
      return;
    }

    this.detail.update((d) =>
      d && d.mail.id === mail.id
        ? { ...d, isSending: true, sendError: null, sendSuccess: false }
        : d
    );

    const rfcMessageId =
      typeof mail.metadata?.['rfcMessageId'] === 'string'
        ? (mail.metadata['rfcMessageId'] as string)
        : undefined;
    const baseSubject = mail.subject?.trim() || '';
    const replySubject = /^re:/i.test(baseSubject)
      ? baseSubject
      : `Re: ${baseSubject || '(no subject)'}`;

    const replyDraft: MessageDraft = {
      to: mail.sender.email,
      subject: replySubject,
      body: draft,
      threadId: mail.threadId,
      inReplyToHeader: rfcMessageId,
    };

    try {
      await match.capabilityInstance.sendMessage(
        match.connection.connectionId,
        replyDraft
      );
      this.replyDraft = '';
      this.detail.update((d) =>
        d && d.mail.id === mail.id
          ? { ...d, isSending: false, sendError: null, sendSuccess: true }
          : d
      );
    } catch (err: any) {
      this.detail.update((d) =>
        d && d.mail.id === mail.id
          ? {
              ...d,
              isSending: false,
              sendError: err?.message || 'Failed to send reply.',
              sendSuccess: false,
            }
          : d
      );
    }
  }

  public async markDetailRead(mail: UnifiedMessage): Promise<void> {
    if (mail.isRead) return;
    mail.isRead = true;
    try {
      await this.markAsRead(mail);
    } catch (err) {
      console.warn('[Messages] Mark-as-read from detail failed:', err);
    }
  }

  public async copyMailBody(state: MailDetailState): Promise<void> {
    this.detailMenuOpen.set(false);
    try {
      await navigator.clipboard.writeText(state.bodyText);
    } catch (err) {
      console.warn('[Messages] Clipboard copy failed:', err);
    }
  }

  private async loadMailBody(mail: UnifiedMessage): Promise<void> {
    const providers =
      this.integrationManager.getConnectedCapabilityProviders<MessageProvider>('messages');
    const match = providers.find(
      (p) => p.connection.connectionId === mail.connectionId
    );

    if (!match || !match.capabilityInstance.fetchMessageBody) {
      this.detail.update((d) =>
        d && d.mail.id === mail.id
          ? {
              ...d,
              isLoading: false,
              error: 'This provider cannot load full message bodies yet.',
              bodyText: mail.snippet || '',
            }
          : d
      );
      return;
    }

    try {
      const body = await match.capabilityInstance.fetchMessageBody(
        match.connection.connectionId,
        mail.sourceId
      );
      this.detail.update((d) =>
        d && d.mail.id === mail.id
          ? { ...d, isLoading: false, error: null, bodyText: body.text }
          : d
      );
    } catch (err: any) {
      this.detail.update((d) =>
        d && d.mail.id === mail.id
          ? {
              ...d,
              isLoading: false,
              error: err?.message || 'Failed to load message body.',
              bodyText: mail.snippet || '',
            }
          : d
      );
    }
  }

  public openCompose(): void {
    // Close any open detail so only one overlay shows at a time.
    this.detail.set(null);
    this.detailMenuOpen.set(false);
    this.compose.set({
      to: '',
      subject: '',
      body: '',
      isSending: false,
      sendError: null,
      sendSuccess: false,
    });
  }

  public closeCompose(): void {
    this.compose.set(null);
  }

  public updateComposeField(field: 'to' | 'subject' | 'body', value: string): void {
    this.compose.update((c) => (c ? { ...c, [field]: value, sendSuccess: false } : c));
  }

  public openComposeInGmail(state: ComposeState): void {
    const params = new URLSearchParams({
      view: 'cm',
      fs: '1',
      to: state.to,
      su: state.subject,
      body: state.body,
    });
    this.windowService.openExternalUrl(
      `https://mail.google.com/mail/u/0/?${params.toString()}`
    );
  }

  public async sendCompose(): Promise<void> {
    const state = this.compose();
    if (!state || state.isSending) return;
    const to = state.to.trim();
    const body = state.body.trim();
    if (!to || !body) {
      this.compose.update((c) =>
        c ? { ...c, sendError: 'To and body are required.', sendSuccess: false } : c
      );
      return;
    }

    // Compose is Gmail-only right now — grab the first connected Gmail provider.
    const providers =
      this.integrationManager.getConnectedCapabilityProviders<MessageProvider>('messages');
    const match = providers.find((p) => p.connection.providerId === 'gmail');

    if (!match?.capabilityInstance.sendMessage) {
      this.compose.update((c) =>
        c
          ? {
              ...c,
              sendError: 'No connected provider supports in-app sending.',
              sendSuccess: false,
            }
          : c
      );
      return;
    }

    this.compose.update((c) =>
      c ? { ...c, isSending: true, sendError: null, sendSuccess: false } : c
    );

    try {
      await match.capabilityInstance.sendMessage(match.connection.connectionId, {
        to,
        subject: state.subject.trim(),
        body,
      });
      this.compose.update((c) =>
        c
          ? {
              ...c,
              to: '',
              subject: '',
              body: '',
              isSending: false,
              sendError: null,
              sendSuccess: true,
            }
          : c
      );
    } catch (err: any) {
      this.compose.update((c) =>
        c
          ? {
              ...c,
              isSending: false,
              sendError: err?.message || 'Failed to send message.',
              sendSuccess: false,
            }
          : c
      );
    }
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
