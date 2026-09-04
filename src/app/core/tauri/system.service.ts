import { Injectable, signal, WritableSignal } from '@angular/core';
import { TauriService } from './tauri.service';
import { AppStateInfo, SystemInfo } from '../models/tauri.models';

@Injectable({
  providedIn: 'root',
})
export class SystemService {
  public readonly systemInfo: WritableSignal<SystemInfo | null> = signal(null);
  public readonly appState: WritableSignal<AppStateInfo | null> = signal(null);
  public readonly greetResponse: WritableSignal<string> = signal('');
  public readonly lastEventMessage: WritableSignal<string> = signal('');
  public readonly isLoading: WritableSignal<boolean> = signal(false);

  constructor(private tauriService: TauriService) {
    this.initSystemData();
    this.setupEventListener();
  }

  public async initSystemData(): Promise<void> {
    this.isLoading.set(true);
    try {
      const [sysInfo, appSt] = await Promise.all([
        this.tauriService.invokeCommand<SystemInfo>('get_system_info'),
        this.tauriService.invokeCommand<AppStateInfo>('get_app_state'),
      ]);
      this.systemInfo.set(sysInfo);
      this.appState.set(appSt);
    } catch (err) {
      console.error('Failed to initialize system data:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  public async greet(name: string): Promise<string> {
    const response = await this.tauriService.invokeCommand<string>('greet', { name });
    this.greetResponse.set(response);
    await this.refreshAppState();
    return response;
  }

  public async incrementCounter(): Promise<number> {
    const newCount = await this.tauriService.invokeCommand<number>('increment_counter');
    await this.refreshAppState();
    return newCount;
  }

  public async setTheme(theme: 'dark' | 'light' | 'emerald' | 'cyan'): Promise<string> {
    const active = await this.tauriService.invokeCommand<string>('set_theme', { theme });
    await this.refreshAppState();
    return active;
  }

  public async triggerPing(message: string): Promise<string> {
    const res = await this.tauriService.invokeCommand<string>('trigger_ping', { message });
    return res;
  }

  public async refreshAppState(): Promise<void> {
    const st = await this.tauriService.invokeCommand<AppStateInfo>('get_app_state');
    this.appState.set(st);
  }

  private async setupEventListener(): Promise<void> {
    try {
      await this.tauriService.listenToEvent<{ message: string; timestamp: string; status: string }>(
        'backend-ping-event',
        (event) => {
          this.lastEventMessage.set(
            `Received Ping Event [${event.payload.timestamp}]: ${event.payload.message} (${event.payload.status})`
          );
        }
      );
    } catch (err) {
      console.warn('Could not register event listener:', err);
    }
  }
}
