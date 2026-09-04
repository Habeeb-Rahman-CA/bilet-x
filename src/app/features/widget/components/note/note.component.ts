import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PersistenceService } from '../../../../core/tauri/persistence.service';

@Component({
  selector: 'app-note',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col space-y-2">
      <div class="flex items-center justify-between font-mono text-[10px] text-neutral-400">
        <span class="flex items-center space-x-1.5">
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span class="text-emerald-400 font-medium">Saved</span>
        </span>
        <span>{{ persistence.scratchpadText().length }} chars</span>
      </div>
      <textarea
        [ngModel]="persistence.scratchpadText()"
        (ngModelChange)="onScratchpadChange($event)"
        placeholder="Type your notes here..."
        rows="10"
        class="w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900/90 p-3.5 text-xs text-neutral-100 placeholder-neutral-500 focus:border-neutral-500 focus:outline-none font-sans leading-relaxed selection:bg-neutral-700 selection:text-white"
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
