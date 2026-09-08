import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PersistenceService } from '../../../../core/tauri/persistence.service';

@Component({
  selector: 'app-note',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex h-full flex-col space-y-2">
      <div
        class="flex shrink-0 items-center justify-between font-mono text-[10px] text-neutral-400"
      >
        <span class="flex items-center space-x-1.5">
          <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"></span>
          <span class="font-medium text-emerald-400">Saved</span>
        </span>
        <span>{{ persistence.scratchpadText().length }} chars</span>
      </div>
      <textarea
        [ngModel]="persistence.scratchpadText()"
        (ngModelChange)="onScratchpadChange($event)"
        placeholder="Type your notes here..."
        class="min-h-0 w-full flex-1 resize-none rounded-xl border border-neutral-800 bg-neutral-900/90 p-3.5 font-sans text-xs leading-relaxed text-neutral-100 placeholder-neutral-500 selection:bg-neutral-700 selection:text-white focus:border-neutral-500 focus:outline-none"
      ></textarea>
    </div>
  `,
})
export class NoteComponent {
  constructor(public persistence: PersistenceService) {}

  public onScratchpadChange(newText: string): void {
    this.persistence.saveScratchpad(newText);
  }
}
