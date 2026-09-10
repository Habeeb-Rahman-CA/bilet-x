import { Injectable, computed, effect, signal } from '@angular/core';
import { TauriService } from '../../../../core/tauri/tauri.service';
import { PersistenceService } from '../../../../core/tauri/persistence.service';

export interface ClipboardItem {
  id: string;
  content: string;
  created_at: string;
}

// Polling interval — a compromise between responsiveness and CPU / IPC noise.
// arboard reads are cheap; 1500ms feels effectively instant for the "copy in
// another app, alt-tab to widget" flow while keeping the loop invisible in
// profilers.
const POLL_INTERVAL_MS = 1500;

// How many entries we ask the DB for; the Rust side caps hard at 100.
const HISTORY_LIMIT = 100;

@Injectable({ providedIn: 'root' })
export class ClipboardService {
  public readonly history = signal<ClipboardItem[]>([]);
  public readonly isCapturing = computed<boolean>(
    () => this.persistence.getSettingValue('clipboard_capture_enabled', 'true') === 'true'
  );
  public readonly lastCopiedId = signal<string | null>(null);

  private lastSeenContent: string | null = null;
  private pollTimer: number | null = null;

  constructor(
    private tauri: TauriService,
    private persistence: PersistenceService
  ) {
    // Reload history whenever the DB might have changed underneath us (e.g. on
    // initial app boot after persistence hydrates). Cheap: read-only query.
    void this.loadHistory();

    // Toggle the poll loop based on the capture setting. Runs immediately at
    // construction so cold-start users see capture already active.
    effect(() => {
      if (this.isCapturing()) {
        this.startPolling();
      } else {
        this.stopPolling();
      }
    });
  }

  public async loadHistory(): Promise<void> {
    try {
      const items = await this.tauri.invokeCommand<ClipboardItem[]>(
        'db_get_clipboard_history',
        { limit: HISTORY_LIMIT }
      );
      this.history.set(items || []);
    } catch (e) {
      console.warn('Failed to load clipboard history', e);
    }
  }

  public async copyToClipboard(item: ClipboardItem): Promise<void> {
    try {
      await this.tauri.invokeCommand('clipboard_write_text', { text: item.content });
      // Seed lastSeenContent so the poll loop doesn't immediately re-save what
      // we just wrote back (which would move it to the top redundantly).
      this.lastSeenContent = item.content;
      this.lastCopiedId.set(item.id);
      window.setTimeout(() => {
        if (this.lastCopiedId() === item.id) this.lastCopiedId.set(null);
      }, 1500);
    } catch (e) {
      console.warn('Failed to write clipboard', e);
    }
  }

  public async deleteEntry(id: string): Promise<void> {
    try {
      await this.tauri.invokeCommand<boolean>('db_delete_clipboard_entry', { id });
      this.history.update((items) => items.filter((i) => i.id !== id));
    } catch (e) {
      console.warn('Failed to delete clipboard entry', e);
    }
  }

  public async clearAll(): Promise<void> {
    try {
      await this.tauri.invokeCommand('db_clear_clipboard_history');
      this.history.set([]);
    } catch (e) {
      console.warn('Failed to clear clipboard history', e);
    }
  }

  public async setCapturing(enabled: boolean): Promise<void> {
    await this.persistence.setSetting('clipboard_capture_enabled', enabled ? 'true' : 'false');
  }

  public toggleCapturing(): Promise<void> {
    return this.setCapturing(!this.isCapturing());
  }

  private startPolling(): void {
    if (this.pollTimer !== null) return;
    // Seed the last-seen value so the very first poll doesn't dump whatever
    // was already on the clipboard when the app started.
    void this.pollOnce(true);
    this.pollTimer = window.setInterval(() => void this.pollOnce(false), POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async pollOnce(seedOnly: boolean): Promise<void> {
    let current: string;
    try {
      current = await this.tauri.invokeCommand<string>('clipboard_read_text');
    } catch {
      return; // clipboard may be locked briefly on Windows; try again next tick
    }

    if (!current) {
      this.lastSeenContent = '';
      return;
    }

    if (current === this.lastSeenContent) return;
    this.lastSeenContent = current;

    if (seedOnly) return;

    try {
      const saved = await this.tauri.invokeCommand<ClipboardItem | null>(
        'db_save_clipboard_entry',
        { content: current }
      );
      if (saved) {
        this.history.update((items) => {
          // Move to top, dedupe by id (should be new, but be defensive).
          const others = items.filter((i) => i.id !== saved.id);
          return [saved, ...others].slice(0, HISTORY_LIMIT);
        });
      }
    } catch (e) {
      console.warn('Failed to save clipboard entry', e);
    }
  }
}
