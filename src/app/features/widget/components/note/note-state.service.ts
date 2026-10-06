import { Injectable, computed, signal } from '@angular/core';
import { NoteItem, PersistenceService } from '../../../../core/tauri/persistence.service';

@Injectable({
  providedIn: 'root',
})
export class NoteStateService {
  public viewMode = signal<'list' | 'editor'>('list');
  public searchQuery = signal<string>('');
  public selectedNoteId = signal<string | null>(null);
  public isSaving = signal<boolean>(false);

  // Active note editing fields
  public activeTitle = signal<string>('');
  public activeContent = signal<string>('');

  private saveDebounceTimer: number | null = null;

  public notesList = computed(() => {
    const all = this.persistence.notes();
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) {
      return all;
    }
    return all.filter(
      (n) =>
        n.title.toLowerCase().includes(query) ||
        n.content.toLowerCase().includes(query)
    );
  });

  constructor(public persistence: PersistenceService) {}

  public openNote(id: string): void {
    const note = this.persistence.notes().find((n) => n.id === id);
    if (note) {
      this.selectedNoteId.set(note.id);
      this.activeTitle.set(note.title);
      this.activeContent.set(note.content);
      this.viewMode.set('editor');
    }
  }

  public createNewNote(): void {
    const id = 'note_' + Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString();
    const newNote: NoteItem = {
      id,
      title: '',
      content: '',
      created_at: now,
      updated_at: now,
    };

    this.selectedNoteId.set(id);
    this.activeTitle.set('');
    this.activeContent.set('');
    this.viewMode.set('editor');

    void this.persistence.saveNote(newNote);
  }

  public goBackToList(): void {
    // Force final save before navigating back if debounce is pending
    if (this.saveDebounceTimer !== null) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
      void this.saveImmediately();
    }
    this.viewMode.set('list');
  }

  public onTitleChange(newTitle: string): void {
    this.activeTitle.set(newTitle);
    this.triggerAutosave();
  }

  public onContentChange(newContent: string): void {
    this.activeContent.set(newContent);
    this.triggerAutosave();
  }

  public insertBullet(): void {
    const current = this.activeContent();
    const addition = current ? '\n- ' : '- ';
    this.onContentChange(current + addition);
  }

  public async deleteNote(event: Event, id: string): Promise<void> {
    event.stopPropagation();
    await this.persistence.deleteNote(id);
    if (this.selectedNoteId() === id) {
      this.selectedNoteId.set(null);
      this.viewMode.set('list');
    }
  }

  public getDisplayTitle(note: NoteItem): string {
    if (note.title && note.title.trim()) {
      return note.title.trim();
    }
    const firstLine = note.content.split('\n')[0].replace(/^[-*#\s]+/, '').trim();
    return firstLine || 'Untitled Note';
  }

  public getSnippet(note: NoteItem): string {
    if (!note.content || !note.content.trim()) {
      return 'No content inside this note yet...';
    }
    return note.content.trim();
  }

  public getWordCount(text: string): number {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\s+/).length;
  }

  public formatTimeAgo(isoString: string): string {
    try {
      if (!isoString) return '';
      let normalized = isoString.trim();
      if (normalized.includes(' ') && !normalized.includes('T')) {
        normalized = normalized.replace(' ', 'T');
      }
      if (!normalized.endsWith('Z') && !/[+-]\d{2}(:?\d{2})?$/.test(normalized)) {
        normalized += 'Z';
      }
      const date = new Date(normalized);
      const now = new Date();
      const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (isNaN(diffSecs) || diffSecs < 60) return 'Just now';
      if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
      if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
      if (diffSecs < 172800) return 'Yesterday';
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }

  private triggerAutosave(): void {
    const id = this.selectedNoteId();
    if (!id) return;

    this.isSaving.set(true);
    if (this.saveDebounceTimer !== null) {
      clearTimeout(this.saveDebounceTimer);
    }

    this.saveDebounceTimer = window.setTimeout(async () => {
      await this.saveImmediately();
    }, 250);
  }

  private async saveImmediately(): Promise<void> {
    const id = this.selectedNoteId();
    if (!id) return;

    const title = this.activeTitle();
    const content = this.activeContent();
    const now = new Date().toISOString();

    const existing = this.persistence.notes().find((n) => n.id === id);
    const updatedNote: NoteItem = {
      id,
      title,
      content,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    await this.persistence.saveNote(updatedNote);
    this.isSaving.set(false);
  }
}
