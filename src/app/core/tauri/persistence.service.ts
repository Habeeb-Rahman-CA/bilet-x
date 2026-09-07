import { Injectable, signal } from '@angular/core';
import { TauriService } from './tauri.service';

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface SettingItem {
  key: string;
  value: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class PersistenceService {
  public notes = signal<NoteItem[]>([]);
  public tasks = signal<TaskItem[]>([]);
  public settings = signal<Map<string, string>>(new Map());
  public scratchpadText = signal<string>('');

  constructor(private tauriService: TauriService) {
    this.loadAllData();
  }

  public async loadAllData(): Promise<void> {
    await Promise.all([
      this.loadNotes(),
      this.loadTasks(),
      this.loadSettings(),
    ]);
  }

  // --- NOTES / SCRATCHPAD API ---
  public async loadNotes(): Promise<NoteItem[]> {
    try {
      const notes = await this.tauriService.invokeCommand<NoteItem[]>('db_get_notes');
      this.notes.set(notes || []);
      const scratchpad = (notes || []).find(n => n.id === 'main_scratchpad');
      if (scratchpad) {
        this.scratchpadText.set(scratchpad.content);
      }
      return notes || [];
    } catch (e) {
      console.warn('Failed to load SQLite notes', e);
      return [];
    }
  }

  public async saveScratchpad(content: string): Promise<void> {
    this.scratchpadText.set(content);
    const now = new Date().toISOString();
    const note: NoteItem = {
      id: 'main_scratchpad',
      title: 'Notepad',
      content,
      created_at: now,
      updated_at: now,
    };
    try {
      await this.tauriService.invokeCommand<NoteItem>('db_save_note', { note });
    } catch (e) {
      console.error('Failed to autosave scratchpad note to SQLite', e);
    }
  }

  public async saveNote(note: NoteItem): Promise<NoteItem | null> {

    try {
      const saved = await this.tauriService.invokeCommand<NoteItem>('db_save_note', { note });
      await this.loadNotes();
      return saved;
    } catch (e) {
      console.error('Failed to save note to SQLite', e);
      return null;
    }
  }

  public async deleteNote(id: string): Promise<boolean> {
    try {
      const ok = await this.tauriService.invokeCommand<boolean>('db_delete_note', { id });
      await this.loadNotes();
      return ok;
    } catch (e) {
      console.error('Failed to delete note from SQLite', e);
      return false;
    }
  }

  public async clearAllNotes(): Promise<number> {
    try {
      const removed = await this.tauriService.invokeCommand<number>('db_clear_notes');
      // main_scratchpad is stored as a note, so wipe the in-memory text too.
      this.scratchpadText.set('');
      await this.loadNotes();
      return removed;
    } catch (e) {
      console.error('Failed to clear notes from SQLite', e);
      return 0;
    }
  }

  // --- TASKS API ---
  public async loadTasks(): Promise<TaskItem[]> {
    try {
      const tasks = await this.tauriService.invokeCommand<TaskItem[]>('db_get_tasks');
      this.tasks.set(tasks || []);
      return tasks || [];
    } catch (e) {
      console.warn('Failed to load SQLite tasks', e);
      return [];
    }
  }

  public async saveTask(task: TaskItem): Promise<TaskItem | null> {
    try {
      const saved = await this.tauriService.invokeCommand<TaskItem>('db_save_task', { task });
      await this.loadTasks();
      return saved;
    } catch (e) {
      console.error('Failed to save task to SQLite', e);
      return null;
    }
  }

  public async deleteTask(id: string): Promise<boolean> {
    try {
      const ok = await this.tauriService.invokeCommand<boolean>('db_delete_task', { id });
      await this.loadTasks();
      return ok;
    } catch (e) {
      console.error('Failed to delete task from SQLite', e);
      return false;
    }
  }

  public async clearAllTasks(): Promise<number> {
    try {
      const removed = await this.tauriService.invokeCommand<number>('db_clear_tasks');
      await this.loadTasks();
      return removed;
    } catch (e) {
      console.error('Failed to clear tasks from SQLite', e);
      return 0;
    }
  }

  // --- SETTINGS API ---
  public async loadSettings(): Promise<Map<string, string>> {
    try {
      const list = await this.tauriService.invokeCommand<SettingItem[]>('db_get_settings');
      const map = new Map<string, string>();
      (list || []).forEach(item => map.set(item.key, item.value));
      this.settings.set(map);
      // Apply the saved theme immediately so it's live before any component
      // that reads it (e.g. the settings panel) is even instantiated.
      this.applyTheme(map.get('theme') || 'dark');
      return map;
    } catch (e) {
      console.warn('Failed to load SQLite settings', e);
      return new Map();
    }
  }

  public getSettingValue(key: string, defaultValue: string = ''): string {
    return this.settings().get(key) || defaultValue;
  }

  public async setSetting(key: string, value: string): Promise<boolean> {
    try {
      await this.tauriService.invokeCommand<SettingItem>('db_set_setting', { key, value });
      await this.loadSettings();
      if (key === 'theme') {
        this.applyTheme(value);
      }
      return true;
    } catch (e) {
      console.error('Failed to save setting to SQLite', e);
      return false;
    }
  }

  public applyTheme(theme: string): void {
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  }
}
