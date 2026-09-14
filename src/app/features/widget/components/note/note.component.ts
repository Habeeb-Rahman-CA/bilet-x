import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PersistenceService } from '../../../../core/tauri/persistence.service';


@Component({
  selector: 'app-note',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex h-full flex-col gap-4">
      <!-- Body. Plain textarea — dashes typed by the user render as the
           bulleted look in the reference; no markdown parsing. -->
      <textarea
        [ngModel]="body()"
        (ngModelChange)="onBodyChange($event)"
        placeholder="- Start a bullet with a dash"
        class="min-h-0 w-full flex-1 resize-none border-0 bg-transparent p-0 text-sm leading-relaxed text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-0"
      ></textarea>
    </div>
  `,
})
export class NoteComponent {
  constructor(public persistence: PersistenceService) {}

  public title = computed(() => {
    const text = this.persistence.scratchpadText();
    const nl = text.indexOf('\n');
    return nl === -1 ? text : text.slice(0, nl);
  });

  public body = computed(() => {
    const text = this.persistence.scratchpadText();
    const nl = text.indexOf('\n');
    return nl === -1 ? '' : text.slice(nl + 1);
  });

  public onTitleChange(newTitle: string): void {
    const body = this.body();
    // Preserve the newline separator even when body is empty so the next
    // keystroke in the body textarea doesn't accidentally merge back into
    // the title line.
    this.persistence.saveScratchpad(body ? `${newTitle}\n${body}` : newTitle);
  }

  public onBodyChange(newBody: string): void {
    const title = this.title();
    this.persistence.saveScratchpad(title ? `${title}\n${newBody}` : `\n${newBody}`);
  }
}
