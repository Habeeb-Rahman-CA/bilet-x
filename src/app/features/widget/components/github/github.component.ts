import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IntegrationManagerService } from '../../../../integrations/core/integration-manager.service';
import { UnifiedTask } from '../../../../integrations/core/models/unified-task.model';
import { WindowService } from '../../../../core/tauri/window.service';
import { DisconnectButtonComponent } from '../../../../shared/components/disconnect-button/disconnect-button.component';
import { GitHubIntegration } from '../../../../integrations/providers/github/github.integration';
import {
  GitHubComment,
  GitHubPullRequestDetail,
} from '../../../../integrations/providers/github/github.models';

interface GitHubDetailState {
  task: UnifiedTask;
  isPR: boolean;
  repoFullName: string;
  issueNumber: number;
  prDetail: GitHubPullRequestDetail | null;
  comments: GitHubComment[];
  isLoadingDetail: boolean;
  isLoadingComments: boolean;
  isPostingComment: boolean;
  isPerformingAction: boolean;
  actionError: string | null;
  actionSuccess: string | null;
  commentDraft: string;
  commentError: string | null;
  commentSuccess: boolean;
}

@Component({
  selector: 'app-github',
  standalone: true,
  imports: [CommonModule, FormsModule, DisconnectButtonComponent],
  template: `
    <div class="relative flex h-full flex-col">
      <!-- ==========================================
           ISSUE / PR DETAIL OVERLAY
           ========================================== -->
      <ng-container *ngIf="detail() as d">
        <div
          class="absolute inset-0 z-20 flex flex-col rounded-xl border border-neutral-800 bg-neutral-950/95 backdrop-blur-md"
        >
          <!-- Top Toolbar -->
          <div class="flex items-center justify-end px-2.5 py-2">

            <div class="flex items-center space-x-1.5">
              
              <button
                (click)="closeDetail()"
                type="button"
                title="Close"
                class="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-800/80 text-neutral-300 transition hover:bg-neutral-700 hover:text-white"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Header & Title -->
          <div class="px-3 pb-2">
            <div class="mb-1 flex flex-wrap items-center gap-1.5 font-mono text-[9px]">
              <span class="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-200">
                {{ d.repoFullName }}#{{ d.issueNumber }}
              </span>
              <span
                class="rounded px-1.5 py-0.5 font-semibold"
                [class.bg-purple-500/20]="d.isPR"
                [class.text-purple-300]="d.isPR"
                [class.border]="d.isPR"
                [class.border-purple-500/30]="d.isPR"
                [class.bg-neutral-800]="!d.isPR"
                [class.text-neutral-300]="!d.isPR"
              >
                {{ d.isPR ? 'Pull Request' : 'Issue' }}
              </span>

              <!-- Status pill -->
              <span
                *ngIf="d.isPR && d.prDetail?.merged"
                class="rounded border border-purple-500/30 bg-purple-500/20 px-1.5 py-0.5 font-semibold text-purple-300"
              >
                ✓ Merged
              </span>
              <span
                *ngIf="
                  !(d.isPR && d.prDetail?.merged) &&
                  (d.task.status === 'done' || d.prDetail?.state === 'closed')
                "
                class="rounded border border-neutral-700 bg-neutral-800/80 px-1.5 py-0.5 font-semibold text-neutral-400"
              >
                Closed
              </span>
              <span
                *ngIf="
                  !(d.isPR && d.prDetail?.merged) &&
                  d.task.status !== 'done' &&
                  d.prDetail?.state !== 'closed'
                "
                class="rounded border border-emerald-500/30 bg-emerald-500/20 px-1.5 py-0.5 font-semibold text-emerald-400"
              >
                Open
              </span>
            </div>

            <div class="text-sm leading-snug font-semibold text-white">
              {{ cleanTitle(d.task.title) }}
            </div>

            <!-- Author & timestamps -->
            <div class="mt-1 flex items-center space-x-1.5 font-mono text-[10px] text-neutral-400">
              <img
                *ngIf="d.task.assignee?.avatarUrl"
                [src]="d.task.assignee?.avatarUrl"
                class="h-3.5 w-3.5 rounded-full border border-neutral-700"
                alt="Avatar"
              />
              <span class="text-neutral-300">{{ d.task.assignee?.name || 'Assigned to you' }}</span>
              <span>•</span>
              <span>Updated {{ formatRelativeTime(d.task.updatedAt) }}</span>
            </div>
          </div>

          <!-- Pull Request Branch / Diff stats bar -->
          <div
            *ngIf="d.isPR && d.prDetail"
            class="mx-3 mb-2 rounded-lg border border-neutral-800 bg-neutral-900/80 p-2 text-[10px]"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-1.5 font-mono">
                <span class="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-300">{{
                  d.prDetail.head.ref
                }}</span>
                <span class="text-neutral-500">→</span>
                <span class="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-300">{{
                  d.prDetail.base.ref
                }}</span>
              </div>
              <div class="flex items-center space-x-2 font-mono text-[9px]">
                <span *ngIf="d.prDetail.commits !== undefined" class="text-neutral-400">
                  {{ d.prDetail.commits }} commit{{ d.prDetail.commits === 1 ? '' : 's' }}
                </span>
                <span *ngIf="d.prDetail.additions !== undefined" class="text-emerald-400">
                  +{{ d.prDetail.additions }}
                </span>
                <span *ngIf="d.prDetail.deletions !== undefined" class="text-red-400">
                  -{{ d.prDetail.deletions }}
                </span>
              </div>
            </div>
          </div>

          <!-- Action & Status Banners -->
          <div class="px-3">
            <div
              *ngIf="d.actionError"
              class="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[10px] leading-relaxed text-red-300"
            >
              <span class="mr-1">⚠️</span>{{ d.actionError }}
            </div>
            <div
              *ngIf="d.actionSuccess"
              class="mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] leading-relaxed text-emerald-300"
            >
              ✓ {{ d.actionSuccess }}
            </div>
          </div>

          <!-- Scrollable Body: Description, Action buttons, and Comments -->
          <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-2">
            <!-- Primary Actions Card -->
            <div class="rounded-xl border border-neutral-800 bg-neutral-900/60 p-2.5">
              <!-- Actions for Pull Requests -->
              <div *ngIf="d.isPR" class="space-y-2">
                <div
                  *ngIf="d.prDetail?.merged"
                  class="flex items-center space-x-2 text-[11px] font-semibold text-purple-300"
                >
                  <span>✓</span>
                  <span>Pull request is merged and closed</span>
                </div>

                <div
                  *ngIf="!d.prDetail?.merged && d.task.status === 'done'"
                  class="flex items-center space-x-2 text-[11px] text-neutral-400"
                >
                  <span>This pull request is closed without merging.</span>
                </div>

                <div *ngIf="!d.prDetail?.merged && d.task.status !== 'done'" class="space-y-2">
                  <div class="flex items-center justify-between text-[10px]">
                    <span class="font-mono text-neutral-400 uppercase">Merge Status</span>
                    <span *ngIf="d.prDetail?.mergeable === true" class="font-mono text-emerald-400">
                      ✓ Able to merge cleanly
                    </span>
                    <span *ngIf="d.prDetail?.mergeable === false" class="font-mono text-red-400">
                      ⚠️ Cannot be merged (conflicts)
                    </span>
                    <span *ngIf="d.prDetail?.mergeable === null" class="font-mono text-neutral-500">
                      Checking mergeability...
                    </span>
                  </div>

                  <div class="flex items-center space-x-2">
                    <button
                      (click)="mergePR(d)"
                      type="button"
                      [disabled]="d.isPerformingAction || d.prDetail?.mergeable === false"
                      class="flex flex-1 items-center justify-center space-x-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <svg
                        *ngIf="d.isPerformingAction"
                        class="animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                      </svg>
                      <span>{{ d.isPerformingAction ? 'Merging…' : 'Merge Pull Request' }}</span>
                    </button>

                    <button
                      (click)="closePR(d)"
                      type="button"
                      [disabled]="d.isPerformingAction"
                      class="rounded-lg border border-neutral-700 bg-neutral-800/80 px-2.5 py-1.5 text-[11px] font-medium text-neutral-300 transition hover:bg-neutral-700 hover:text-white disabled:opacity-50"
                    >
                      Close PR
                    </button>
                  </div>
                </div>
              </div>

              <!-- Actions for Issues -->
              <div *ngIf="!d.isPR" class="flex items-center justify-between">
                <div class="text-[11px]">
                  <span *ngIf="d.task.status === 'done'" class="font-medium text-neutral-400">
                    This issue is closed.
                  </span>
                  <span *ngIf="d.task.status !== 'done'" class="font-medium text-emerald-400">
                    This issue is open.
                  </span>
                </div>

                <button
                  *ngIf="d.task.status !== 'done'"
                  (click)="closeIssue(d)"
                  type="button"
                  [disabled]="d.isPerformingAction"
                  class="flex items-center space-x-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-[11px] font-medium text-neutral-200 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                >
                  <svg
                    *ngIf="d.isPerformingAction"
                    class="animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                  </svg>
                  <span>{{ d.isPerformingAction ? 'Closing…' : 'Close Issue' }}</span>
                </button>

                <button
                  *ngIf="d.task.status === 'done'"
                  (click)="reopenIssue(d)"
                  type="button"
                  [disabled]="d.isPerformingAction"
                  class="flex items-center space-x-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  <svg
                    *ngIf="d.isPerformingAction"
                    class="animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                  </svg>
                  <span>{{ d.isPerformingAction ? 'Reopening…' : 'Reopen Issue' }}</span>
                </button>
              </div>
            </div>

            <!-- Description Card -->
            <div class="space-y-1.5 rounded-xl border border-neutral-800 bg-neutral-900/60 p-2.5">
              <div class="font-mono text-[9px] tracking-wider text-neutral-500 uppercase">
                Description
              </div>
              <pre
                *ngIf="d.task.description"
                class="font-sans text-[12px] leading-relaxed break-words whitespace-pre-wrap text-neutral-200"
                >{{ d.task.description }}</pre>
              <div
                *ngIf="!d.task.description"
                class="font-mono text-[11px] text-neutral-500 italic"
              >
                (No description provided)
              </div>
            </div>

            <!-- Labels & Metadata -->
            <div
              *ngIf="d.task.labels && d.task.labels.length > 0"
              class="space-y-1 rounded-xl border border-neutral-800 bg-neutral-900/60 p-2.5"
            >
              <div class="font-mono text-[9px] tracking-wider text-neutral-500 uppercase">
                Labels
              </div>
              <div class="flex flex-wrap gap-1">
                <span
                  *ngFor="let label of d.task.labels"
                  class="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[9px] text-neutral-300"
                  >{{ label }}</span
                >
              </div>
            </div>

            <!-- Comments Timeline -->
            <div class="space-y-2 pt-1">
              <div class="flex items-center justify-between font-mono text-[10px]">
                <span class="font-bold tracking-wider text-neutral-400 uppercase">
                  Comments ({{ d.comments.length }})
                </span>
                <span
                  *ngIf="d.isLoadingComments"
                  class="flex items-center space-x-1 text-neutral-500"
                >
                  <svg
                    class="animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  </svg>
                  <span>Loading…</span>
                </span>
              </div>

              <!-- Comment Cards -->
              <div
                *ngIf="d.comments.length === 0 && !d.isLoadingComments"
                class="py-3 text-center font-mono text-[10px] text-neutral-500"
              >
                No comments yet. Leave a comment below.
              </div>

              <div
                *ngFor="let comment of d.comments"
                class="space-y-1.5 rounded-xl border border-neutral-800/80 bg-neutral-900/50 p-2.5 text-xs"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-1.5">
                    <img
                      *ngIf="comment.user.avatar_url"
                      [src]="comment.user.avatar_url"
                      class="h-4 w-4 rounded-full border border-neutral-700"
                      alt="Avatar"
                    />
                    <span class="font-medium text-neutral-200">{{
                      comment.user.login || 'User'
                    }}</span>
                  </div>
                  <span class="font-mono text-[9px] text-neutral-500">
                    {{ formatRelativeTime(comment.created_at) }}
                  </span>
                </div>
                <pre
                  class="font-sans text-[11px] leading-relaxed break-words whitespace-pre-wrap text-neutral-300"
                  >{{ comment.body }}</pre>
              </div>
            </div>
          </div>

          <!-- Sticky Bottom Comment Composer -->
          <div class="mx-2 mb-2 rounded-xl border border-neutral-800 bg-neutral-900/90 shadow-lg">
            <div
              *ngIf="d.commentError"
              class="border-b border-red-500/30 bg-red-500/10 px-3 py-1 text-[10px] leading-relaxed text-red-300"
            >
              <span class="mr-1">⚠️</span>{{ d.commentError }}
            </div>
            <div
              *ngIf="d.commentSuccess"
              class="border-b border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] leading-relaxed text-emerald-300"
            >
              ✓ Comment posted
            </div>

            <div class="flex items-center px-3 py-2">
              <input
                type="text"
                [(ngModel)]="d.commentDraft"
                placeholder="Leave a comment..."
                [disabled]="d.isPostingComment"
                (keydown.enter)="postComment(d)"
                class="min-w-0 flex-1 bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none disabled:opacity-50"
              />
              <button
                (click)="postComment(d)"
                type="button"
                [disabled]="d.isPostingComment || !d.commentDraft.trim()"
                class="ml-2 flex h-7 items-center justify-center space-x-1 rounded-lg bg-neutral-800 px-2.5 font-mono text-[10px] font-semibold text-neutral-200 transition hover:bg-neutral-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg
                  *ngIf="d.isPostingComment"
                  class="animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                </svg>
                <span>{{ d.isPostingComment ? 'Posting…' : 'Comment' }}</span>
              </button>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- ==========================================
           NOT CONNECTED — SIGN IN WITH GITHUB CARD
           ========================================== -->
      <ng-container *ngIf="!isConnected()">
        <div class="flex flex-1 flex-col items-center justify-center space-y-5 px-3 py-8">
          <div class="flex flex-col items-center space-y-1 text-center">
            <div
              class="flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/80 text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  d="M12 .296C5.373.296 0 5.67 0 12.297c0 5.302 3.438 9.8 8.207 11.387.6.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.386-1.333-1.756-1.333-1.756-1.09-.744.083-.729.083-.729 1.205.084 1.84 1.236 1.84 1.236 1.07 1.834 2.807 1.304 3.492.997.108-.774.42-1.305.762-1.605-2.665-.303-5.467-1.332-5.467-5.93 0-1.31.467-2.381 1.235-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.51 11.51 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.654 1.653.243 2.874.12 3.176.77.84 1.233 1.911 1.233 3.221 0 4.61-2.807 5.624-5.479 5.921.43.371.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.565 22.092 24 17.598 24 12.297 24 5.67 18.627.296 12 .296z"
                />
              </svg>
            </div>
            <div class="pt-1 text-sm font-semibold text-white">Connect GitHub</div>
            <div class="max-w-[220px] text-[10px] leading-relaxed text-neutral-400">
              Sign in once with GitHub
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
            class="flex w-full items-center justify-center space-x-2 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-neutral-800 active:scale-[0.99]"
          >
            <!-- GitHub Octocat mark -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M12 .296C5.373.296 0 5.67 0 12.297c0 5.302 3.438 9.8 8.207 11.387.6.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.386-1.333-1.756-1.333-1.756-1.09-.744.083-.729.083-.729 1.205.084 1.84 1.236 1.84 1.236 1.07 1.834 2.807 1.304 3.492.997.108-.774.42-1.305.762-1.605-2.665-.303-5.467-1.332-5.467-5.93 0-1.31.467-2.381 1.235-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.51 11.51 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.654 1.653.243 2.874.12 3.176.77.84 1.233 1.911 1.233 3.221 0 4.61-2.807 5.624-5.479 5.921.43.371.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.565 22.092 24 17.598 24 12.297 24 5.67 18.627.296 12 .296z"
              />
            </svg>
            <span>Sign in with GitHub</span>
          </button>

          <!-- Waiting state (with Cancel) -->
          <div *ngIf="isConnecting()" class="w-full space-y-2">
            <div
              class="flex w-full items-center justify-center space-x-2 rounded-lg bg-neutral-800 px-4 py-2.5 text-[12px] font-medium text-neutral-300"
            >
              <svg
                class="animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              <span>Waiting for browser sign-in...</span>
            </div>
            <button
              (click)="cancelSignIn()"
              type="button"
              class="w-full text-center font-mono text-[10px] text-neutral-500 hover:text-neutral-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </ng-container>

      <!-- ==========================================
           CONNECTED — ISSUE & PR LIST VIEW
           ========================================== -->
      <ng-container *ngIf="isConnected()">
        <div class="flex flex-1 flex-col overflow-hidden px-3 pt-3">
          <!-- HEADER -->
          <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="text-sm font-semibold text-white">GitHub</span>
              <span
                *ngIf="openCount() > 0"
                class="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[9px] text-neutral-300"
              >
                {{ openCount() }} open
              </span>
            </div>

            <div class="flex items-center space-x-2">
              <button
                (click)="refreshTasks()"
                type="button"
                [disabled]="isLoading()"
                class="flex h-6 w-6 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-800 text-neutral-300 transition hover:bg-neutral-700 hover:text-white disabled:opacity-50"
                title="Sync GitHub"
              >
                <svg
                  [class.animate-spin]="isLoading()"
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M8 16H3v5" />
                </svg>
              </button>

              <app-disconnect-button providerId="github"></app-disconnect-button>
            </div>
          </div>

          <!-- ERROR BANNER -->
          <div
            *ngIf="errorMessage()"
            class="mb-3 space-y-1 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-[10px] text-red-300"
          >
            <div class="flex items-center space-x-1.5 font-semibold text-red-400">
              <span>⚠️</span>
              <span>GitHub Error</span>
            </div>
            <div>{{ errorMessage() }}</div>
          </div>

          <!-- SEARCH BAR -->
          <div
            class="mb-3 flex items-center space-x-2 rounded-xl border border-neutral-800 bg-neutral-900/80 px-3 py-1.5"
          >
            <svg
              class="text-neutral-500"
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              placeholder="Search issues by title, repo, number..."
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

          <!-- ISSUE & PR LIST -->
          <div class="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            <div
              *ngFor="let task of filteredTasks()"
              (click)="openIssueDetail(task)"
              role="button"
              tabindex="0"
              (keydown.enter)="openIssueDetail(task)"
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
                      {{ cleanTitle(task.title) }}
                    </span>
                  </div>

                  <div
                    class="flex flex-wrap items-center gap-1 font-mono text-[9px] text-neutral-400"
                  >
                    <span
                      *ngIf="task.project"
                      class="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-300"
                    >
                      {{ task.project.name }}
                    </span>
                    <span
                      *ngIf="issueNumber(task)"
                      class="rounded bg-neutral-800/70 px-1.5 py-0.5 text-neutral-400"
                    >
                      #{{ issueNumber(task) }}
                    </span>
                    <span
                      *ngIf="isPR(task)"
                      class="rounded border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-purple-300"
                    >
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
                  (click)="$event.stopPropagation(); openExternal(task.webUrl)"
                  type="button"
                  class="shrink-0 rounded p-1 text-neutral-500 transition hover:bg-neutral-700 hover:text-white"
                  title="Open on GitHub"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
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
  public searchQuery = signal<string>('');
  public isLoading = signal<boolean>(false);
  private localError = signal<string | null>(null);

  public detail = signal<GitHubDetailState | null>(null);

  public errorMessage = computed(() => this.localError() || this.integrationManager.tasksError());

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
    const q = this.searchQuery().trim().toLowerCase();
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
    public githubIntegration: GitHubIntegration,
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
        this.connectError.set(conn.errorMessage || 'Sign-in failed. Please try again.');
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
    const minWait = new Promise((resolve) => setTimeout(resolve, 500));
    try {
      await Promise.allSettled([this.integrationManager.fetchTasks(), minWait]);
    } catch (err: any) {
      this.localError.set(err?.message || 'Failed to fetch GitHub issues.');
    } finally {
      this.isLoading.set(false);
    }
  }

  public async refreshDetail(d: GitHubDetailState): Promise<void> {
    this.detail.update((curr) =>
      curr ? { ...curr, isLoadingComments: true, isLoadingDetail: curr.isPR } : curr
    );
    await this.loadDetailData(d);
  }

  // ==========================================
  // DETAIL VIEW HANDLERS
  // ==========================================

  public openIssueDetail(task: UnifiedTask): void {
    const isPR = this.isPR(task);
    const issueNumStr = this.issueNumber(task);
    const num = parseInt(issueNumStr, 10) || 0;
    const repoFullName = this.extractRepoFullName(task);

    const initialState: GitHubDetailState = {
      task,
      isPR,
      repoFullName,
      issueNumber: num,
      prDetail: null,
      comments: [],
      isLoadingDetail: isPR,
      isLoadingComments: true,
      isPostingComment: false,
      isPerformingAction: false,
      actionError: null,
      actionSuccess: null,
      commentDraft: '',
      commentError: null,
      commentSuccess: false,
    };

    this.detail.set(initialState);
    this.loadDetailData(initialState);
  }

  public closeDetail(): void {
    this.detail.set(null);
  }

  private async loadDetailData(state: GitHubDetailState): Promise<void> {
    const connId = this.getConnectionId(state.task);
    if (!connId || !state.repoFullName || !state.issueNumber) {
      this.detail.update((d) =>
        d ? { ...d, isLoadingDetail: false, isLoadingComments: false } : d
      );
      return;
    }

    // Load comments
    this.loadComments(connId, state.repoFullName, state.issueNumber);

    // If PR, load PR details (mergeability, branch info)
    if (state.isPR) {
      this.loadPRDetails(connId, state.repoFullName, state.issueNumber);
    }
  }

  private async loadComments(connectionId: string, repo: string, num: number): Promise<void> {
    try {
      const comments = await this.githubIntegration.fetchComments(connectionId, repo, num);
      this.detail.update((d) =>
        d && d.issueNumber === num ? { ...d, comments, isLoadingComments: false } : d
      );
    } catch (err: any) {
      this.detail.update((d) =>
        d && d.issueNumber === num
          ? {
              ...d,
              isLoadingComments: false,
              commentError: err?.message || 'Failed to load comments.',
            }
          : d
      );
    }
  }

  private async loadPRDetails(connectionId: string, repo: string, num: number): Promise<void> {
    try {
      const prDetail = await this.githubIntegration.fetchPullRequestDetail(connectionId, repo, num);
      this.detail.update((d) =>
        d && d.issueNumber === num ? { ...d, prDetail, isLoadingDetail: false } : d
      );
    } catch (err: any) {
      this.detail.update((d) =>
        d && d.issueNumber === num ? { ...d, isLoadingDetail: false } : d
      );
    }
  }

  // ==========================================
  // ACTIONS: COMMENTS, CLOSE, MERGE
  // ==========================================

  public async postComment(d: GitHubDetailState): Promise<void> {
    const text = d.commentDraft.trim();
    const connId = this.getConnectionId(d.task);
    if (!text || d.isPostingComment || !connId) return;

    this.detail.update((curr) =>
      curr ? { ...curr, isPostingComment: true, commentError: null, commentSuccess: false } : curr
    );

    try {
      const newComment = await this.githubIntegration.addComment(
        connId,
        d.repoFullName,
        d.issueNumber,
        text
      );

      this.detail.update((curr) =>
        curr
          ? {
              ...curr,
              comments: [...curr.comments, newComment],
              commentDraft: '',
              isPostingComment: false,
              commentSuccess: true,
            }
          : curr
      );

      setTimeout(() => {
        this.detail.update((curr) => (curr ? { ...curr, commentSuccess: false } : curr));
      }, 3000);
    } catch (err: any) {
      this.detail.update((curr) =>
        curr
          ? {
              ...curr,
              isPostingComment: false,
              commentError: err?.message || 'Failed to post comment. Please try again.',
            }
          : curr
      );
    }
  }

  public async closeIssue(d: GitHubDetailState): Promise<void> {
    const connId = this.getConnectionId(d.task);
    if (d.isPerformingAction || !connId) return;

    this.detail.update((curr) =>
      curr ? { ...curr, isPerformingAction: true, actionError: null, actionSuccess: null } : curr
    );

    try {
      await this.githubIntegration.closeIssue(connId, d.repoFullName, d.issueNumber);

      // Optimistically update local task status
      d.task.status = 'done';
      d.task.statusRaw = 'closed';

      this.detail.update((curr) =>
        curr
          ? {
              ...curr,
              isPerformingAction: false,
              actionSuccess: 'Issue closed successfully.',
            }
          : curr
      );

      this.refreshTasks();
    } catch (err: any) {
      this.detail.update((curr) =>
        curr
          ? {
              ...curr,
              isPerformingAction: false,
              actionError: err?.message || 'Failed to close issue.',
            }
          : curr
      );
    }
  }

  public async reopenIssue(d: GitHubDetailState): Promise<void> {
    const connId = this.getConnectionId(d.task);
    if (d.isPerformingAction || !connId) return;

    this.detail.update((curr) =>
      curr ? { ...curr, isPerformingAction: true, actionError: null, actionSuccess: null } : curr
    );

    try {
      await this.githubIntegration.reopenIssue(connId, d.repoFullName, d.issueNumber);

      // Optimistically update local task status
      d.task.status = 'todo';
      d.task.statusRaw = 'open';

      this.detail.update((curr) =>
        curr
          ? {
              ...curr,
              isPerformingAction: false,
              actionSuccess: 'Issue reopened.',
            }
          : curr
      );

      this.refreshTasks();
    } catch (err: any) {
      this.detail.update((curr) =>
        curr
          ? {
              ...curr,
              isPerformingAction: false,
              actionError: err?.message || 'Failed to reopen issue.',
            }
          : curr
      );
    }
  }

  public async mergePR(d: GitHubDetailState): Promise<void> {
    const connId = this.getConnectionId(d.task);
    if (d.isPerformingAction || !connId) return;

    this.detail.update((curr) =>
      curr ? { ...curr, isPerformingAction: true, actionError: null, actionSuccess: null } : curr
    );

    try {
      const res = await this.githubIntegration.mergePullRequest(
        connId,
        d.repoFullName,
        d.issueNumber
      );

      // Optimistically update local task & PR state
      d.task.status = 'done';
      d.task.statusRaw = 'closed';
      if (d.prDetail) {
        d.prDetail.merged = true;
        d.prDetail.state = 'closed';
      }

      this.detail.update((curr) =>
        curr
          ? {
              ...curr,
              isPerformingAction: false,
              actionSuccess: res.message || 'Pull request merged successfully.',
            }
          : curr
      );

      this.refreshTasks();
    } catch (err: any) {
      this.detail.update((curr) =>
        curr
          ? {
              ...curr,
              isPerformingAction: false,
              actionError: err?.message || 'Failed to merge pull request.',
            }
          : curr
      );
    }
  }

  public async closePR(d: GitHubDetailState): Promise<void> {
    const connId = this.getConnectionId(d.task);
    if (d.isPerformingAction || !connId) return;

    this.detail.update((curr) =>
      curr ? { ...curr, isPerformingAction: true, actionError: null, actionSuccess: null } : curr
    );

    try {
      await this.githubIntegration.closePullRequest(connId, d.repoFullName, d.issueNumber);

      d.task.status = 'done';
      d.task.statusRaw = 'closed';
      if (d.prDetail) {
        d.prDetail.state = 'closed';
      }

      this.detail.update((curr) =>
        curr
          ? {
              ...curr,
              isPerformingAction: false,
              actionSuccess: 'Pull request closed without merging.',
            }
          : curr
      );

      this.refreshTasks();
    } catch (err: any) {
      this.detail.update((curr) =>
        curr
          ? {
              ...curr,
              isPerformingAction: false,
              actionError: err?.message || 'Failed to close pull request.',
            }
          : curr
      );
    }
  }

  // ==========================================
  // HELPERS
  // ==========================================

  public openExternal(url?: string): void {
    if (url) {
      this.windowService.openExternalUrl(url);
    }
  }

  public issueNumber(task: UnifiedTask): string {
    return (task.metadata?.['githubNumber'] as string) || '';
  }

  public isPR(task: UnifiedTask): boolean {
    return task.metadata?.['isPR'] === 'true';
  }

  public cleanTitle(title: string): string {
    return title.replace(/^\[PR\]\s*/, '');
  }

  public extractRepoFullName(task: UnifiedTask): string {
    const fromMeta = task.metadata?.['repoFullName'];
    if (typeof fromMeta === 'string' && fromMeta) {
      return fromMeta;
    }
    if (task.project?.key) {
      return task.project.key;
    }
    if (task.project?.name) {
      return task.project.name;
    }
    // Fallback: parse from sourceId (format: owner/repo#123)
    const match = (task.sourceId || '').match(/^([^#]+)#/);
    return match ? match[1] : '';
  }

  public formatRelativeTime(iso: string | undefined): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);

    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  private getConnectionId(task: UnifiedTask): string {
    return (
      task.connectionId ||
      this.integrationManager.getConnectionsForProvider('github')[0]?.connectionId ||
      ''
    );
  }
}
