import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PersistenceService } from '../../../../core/tauri/persistence.service';

@Component({
  selector: 'app-task',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex h-full flex-col space-y-3">
      <!-- TASK LIST CONTAINER — fills available space, scrolls when overflowed -->
      <div class="flex-1 min-h-0 space-y-2 overflow-y-auto pr-1">
        <div
          *ngFor="let task of persistence.tasks()"
          class="rounded-xl border border-neutral-800 bg-neutral-900/90 p-2.5 text-xs flex items-center justify-between group hover:border-neutral-700 transition"
        >
          <div class="flex items-center space-x-2">
            <span class="h-2 w-2 rounded-full bg-white"></span>
            <span class="text-neutral-200 font-medium">{{ task.title }}</span>
          </div>
          <button
            (click)="persistence.deleteTask(task.id)"
            type="button"
            class="text-neutral-500 hover:text-white text-[10px] transition"
          >
            Delete
          </button>
        </div>

        <div *ngIf="persistence.tasks().length === 0" class="text-center py-6 text-xs text-neutral-500 font-mono">
          No tasks yet.
        </div>
      </div>

      <!-- BOTTOM TASK INPUT FORM — pinned to bottom of the panel body -->
      <form
        (submit)="onTaskSubmit($event)"
        class="shrink-0 rounded-xl border border-neutral-800 bg-neutral-900/90 p-2 flex items-center justify-between text-xs"
      >
        <input
          type="text"
          [(ngModel)]="quickInputText"
          name="quickInputText"
          placeholder="Add a task..."
          class="w-full bg-transparent px-2 text-xs text-white placeholder-neutral-500 focus:outline-none"
        />
        <button
          type="submit"
          title="Add Task"
          class="flex h-6 w-6 items-center justify-center rounded-lg bg-white text-black hover:bg-neutral-200 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.5.5 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>
        </button>
      </form>
    </div>
  `,
})
export class TaskComponent {
  public quickInputText = '';

  constructor(public persistence: PersistenceService) {}

  public async onTaskSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.quickInputText.trim()) return;

    const text = this.quickInputText.trim();
    const now = new Date().toISOString();
    const id = 'task_' + Math.random().toString(36).substr(2, 9);

    await this.persistence.saveTask({
      id,
      title: text,
      description: 'Created via widget input bar',
      status: 'pending',
      priority: 'medium',
      created_at: now,
      updated_at: now,
    });

    this.quickInputText = '';
  }
}
