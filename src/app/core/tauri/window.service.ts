import { Injectable, signal, WritableSignal } from '@angular/core';
import { TauriService } from './tauri.service';

@Injectable({
  providedIn: 'root',
})
export class WindowService {
  public readonly isMaximized: WritableSignal<boolean> = signal(false);
  public readonly isFocused: WritableSignal<boolean> = signal(true);
  public readonly title: WritableSignal<string> = signal('Bilet-X Desktop');

  constructor(private tauriService: TauriService) {}

  public async setPosition(position: string): Promise<void> {
    try {
      await this.tauriService.invokeCommand('set_widget_position', { position });
    } catch (e) {
      console.warn('Set widget position failed', e);
    }
  }

  public async minimize(): Promise<void> {
    try {
      await this.tauriService.invokeCommand('window_minimize');
    } catch (e) {
      console.warn('Window minimize triggered', e);
    }
  }

  public async toggleMaximize(): Promise<void> {
    try {
      const res = await this.tauriService.invokeCommand<boolean>('window_toggle_maximize');
      this.isMaximized.set(res);
    } catch (e) {
      this.isMaximized.update((v) => !v);
    }
  }

  public async close(): Promise<void> {
    try {
      await this.tauriService.invokeCommand('window_close');
    } catch (e) {
      console.warn('Window close requested', e);
    }
  }

  public async setWindowSize(width: number, height: number): Promise<void> {
    try {
      await this.tauriService.invokeCommand('set_window_size', { width, height });
    } catch (e) {
      console.warn('Set window size triggered:', width, height, e);
    }
  }

  public async setWindowPosition(x: number, y: number): Promise<void> {
    try {
      await this.tauriService.invokeCommand('set_window_position', { x, y });
    } catch (e) {
      console.warn('Set window position failed', e);
    }
  }

  public async focusWindow(): Promise<void> {
    try {
      await this.tauriService.invokeCommand('window_set_focus');
    } catch (e) {
      console.warn('Focus window triggered', e);
    }
  }

  public async setInteractiveArea(
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<void> {
    try {
      await this.tauriService.invokeCommand('set_interactive_area', { x, y, width, height });
    } catch (e) {
      console.warn('Set interactive area failed', e);
    }
  }

  public async setGlobalShortcut(shortcut: string): Promise<boolean> {
    try {
      await this.tauriService.invokeCommand('set_global_shortcut', { shortcut });
      return true;
    } catch (e) {
      console.warn('Set global shortcut failed', e);
      return false;
    }
  }

  public async openExternalUrl(url: string): Promise<void> {
    if (!url) return;
    try {
      if (this.tauriService.isTauriAvailable()) {
        await this.tauriService.invokeCommand('open_external_url', { url });
        return;
      }
    } catch (e) {
      console.warn('Tauri open_external_url failed, falling back to window.open', e);
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  public async onToggleWidget(callback: () => void): Promise<() => void> {
    if (!this.tauriService.isTauriAvailable()) {
      return () => {};
    }
    try {
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen('toggle-widget', () => {
        callback();
      });
      return unlisten;
    } catch (e) {
      console.warn('Failed to listen to toggle-widget event', e);
      return () => {};
    }
  }
}
