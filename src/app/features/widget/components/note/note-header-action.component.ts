import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NoteStateService } from './note-state.service';

@Component({
  selector: 'app-note-header-action',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="no-drag flex items-center">
      <!-- In List View: + New Note Button (styled exactly like close button) -->
      <button
        *ngIf="state.viewMode() === 'list'"
        (click)="state.createNewNote()"
        type="button"
        title="New Note"
        class="glass-btn flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-300 hover:text-white transition active:scale-95"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <!-- In Editor View: Back Button (in the exact same place on the left, styled like close button) -->
      <button
        *ngIf="state.viewMode() === 'editor'"
        (click)="state.goBackToList()"
        type="button"
        title="Back to Notes"
        class="glass-btn flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-300 hover:text-white transition active:scale-95"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>
    </div>
  `,
})
export class NoteHeaderActionComponent {
  constructor(public state: NoteStateService) {}
}
