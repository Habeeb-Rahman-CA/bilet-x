import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NoteStateService } from './note-state.service';
import { PersistenceService } from '../../../../core/tauri/persistence.service';

@Component({
  selector: 'app-note',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex h-full flex-col font-sans select-none text-neutral-100">
      <!-- ==========================================
           VIEW 1: NOTES LIST VIEW
           ========================================== -->
      <div *ngIf="state.viewMode() === 'list'" class="flex h-full flex-col space-y-2.5">
        <!-- Search Input Bar (shown when multiple notes exist) -->
        <div *ngIf="persistence.notes().length > 1" class="relative shrink-0">
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
            class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            [ngModel]="state.searchQuery()"
            (ngModelChange)="state.searchQuery.set($event)"
            placeholder="Search notes..."
            class="h-7 w-full rounded-lg border border-neutral-800 bg-neutral-900 pl-7 pr-7 font-mono text-[10px] text-neutral-200 placeholder-neutral-500 transition focus:border-neutral-500 focus:outline-none"
          />
          <button
            *ngIf="state.searchQuery()"
            type="button"
            (click)="state.searchQuery.set('')"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
          >
            ✕
          </button>
        </div>

        <!-- Notes Cards List -->
        <div class="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          <!-- Empty State -->
          <div
            *ngIf="state.notesList().length === 0"
            class="flex h-full flex-col items-center justify-center space-y-2 rounded-xl border border-dashed border-neutral-800 p-6 text-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-neutral-600"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <div class="font-mono text-xs text-neutral-400">
              {{ state.searchQuery() ? 'No notes match search' : 'No notes created yet' }}
            </div>
            <button
              *ngIf="!state.searchQuery()"
              type="button"
              (click)="state.createNewNote()"
              class="rounded-lg bg-neutral-800 px-3 py-1 font-mono text-[10px] text-neutral-200 transition hover:bg-neutral-700 hover:text-white"
            >
              + Create your first note
            </button>
          </div>

          <!-- Note Card -->
          <div
            *ngFor="let note of state.notesList()"
            (click)="state.openNote(note.id)"
            class="group relative flex cursor-pointer flex-col space-y-1.5 rounded-xl border border-neutral-800 bg-neutral-900 p-3 transition hover:border-neutral-700 hover:bg-neutral-850"
          >
            <!-- Card Header: Title & Time & Delete -->
            <div class="flex items-center justify-between">
              <span class="truncate font-semibold text-xs text-neutral-100">
                {{ state.getDisplayTitle(note) }}
              </span>

              <div class="flex items-center space-x-1.5">
                <span class="font-mono text-[9px] text-neutral-500">
                  {{ state.formatTimeAgo(note.updated_at) }}
                </span>
                <button
                  type="button"
                  (click)="state.deleteNote($event, note.id)"
                  title="Delete note"
                  class="rounded p-1 text-neutral-600 opacity-0 transition hover:bg-neutral-800 hover:text-red-400 group-hover:opacity-100"
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
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Content Preview (What is inside the note) -->
            <p class="line-clamp-2 font-sans text-[11px] leading-relaxed text-neutral-400">
              {{ state.getSnippet(note) }}
            </p>

            <!-- Card Footer: Stats -->
            <div class="flex items-center space-x-2 pt-0.5 font-mono text-[8px] text-neutral-500">
              <span>{{ state.getWordCount(note.content) }} words</span>
              <span>•</span>
              <span>{{ note.content.length }} chars</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ==========================================
           VIEW 2: NOTE EDITOR VIEW
           ========================================== -->
      <div *ngIf="state.viewMode() === 'editor'" class="flex h-full flex-col space-y-2.5">
        <!-- Note Title Input & Auto-Save Indicator -->
        <div class="relative shrink-0 flex items-center">
          <input
            type="text"
            [ngModel]="state.activeTitle()"
            (ngModelChange)="state.onTitleChange($event)"
            placeholder="Note title..."
            class="h-8 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 pr-16 font-sans text-xs font-semibold text-neutral-100 placeholder-neutral-500 transition focus:border-neutral-500 focus:outline-none"
          />
          <span
            class="pointer-events-none absolute right-2.5 font-mono text-[9px] text-neutral-500"
          >
            {{ state.isSaving() ? 'Saving...' : 'Saved' }}
          </span>
        </div>

        <!-- Note Content Textarea (Full remaining height) -->
        <div class="relative min-h-0 flex-1 rounded-xl border border-neutral-800 bg-neutral-900 p-2.5">
          <textarea
            [ngModel]="state.activeContent()"
            (ngModelChange)="state.onContentChange($event)"
            placeholder="Write note contents here...
- Supports bullet points with '-'
- Paste snippets, checklists, and ideas"
            class="h-full w-full resize-none border-0 bg-transparent p-0 font-sans text-xs leading-relaxed text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-0"
          ></textarea>
        </div>

        <!-- Editor Bottom Info Bar -->
        <div class="flex shrink-0 items-center justify-between font-mono text-[9px] text-neutral-500">
          <div class="flex items-center space-x-2">
            <span>{{ state.getWordCount(state.activeContent()) }} words</span>
            <span>•</span>
            <span>{{ state.activeContent().length }} characters</span>
          </div>

          <!-- Quick Bullet helper -->
          <button
            type="button"
            (click)="state.insertBullet()"
            class="rounded px-1.5 py-0.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
          >
            + Bullet (-)
          </button>
        </div>
      </div>
    </div>
  `,
})
export class NoteComponent {
  constructor(
    public state: NoteStateService,
    public persistence: PersistenceService
  ) {}
}
