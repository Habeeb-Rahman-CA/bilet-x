import { Injectable, signal, WritableSignal } from '@angular/core';
import { TauriService } from './tauri.service';

@Injectable({
  providedIn: 'root',
})
export class WindowService {
  public readonly isMaximized: WritableSignal<boolean> = signal(false);
  public readonly isFocused: WritableSignal<boolean> = signal(true);
  public readonly title: WritableSignal<string> = signal('Bilet-X Desktop');

  constructor(private tauriService: TauriService) {
    this.positionRight();
  }

  public async positionRight(): Promise<void> {
    try {
      await this.tauriService.invokeCommand('position_window_right');
    } catch (e) {
      console.warn('Position window right failed', e);
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

  public async focusWindow(): Promise<void> {
    try {
      await this.tauriService.invokeCommand('window_set_focus');
    } catch (e) {
      console.warn('Focus window triggered', e);
    }
  }
}


