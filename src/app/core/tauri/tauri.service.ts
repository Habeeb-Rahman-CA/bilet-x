import { Injectable, signal, WritableSignal } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { IPCLogEntry } from '../models/tauri.models';

@Injectable({
  providedIn: 'root',
})
export class TauriService {
  public readonly isTauriAvailable: WritableSignal<boolean> = signal(false);
  public readonly ipcLogs: WritableSignal<IPCLogEntry[]> = signal([]);

  private mockState = {
    counter: 42,
    active_theme: 'dark',
    invocations: 12,
  };

  constructor() {
    this.checkTauriAvailability();
  }

  private checkTauriAvailability(): void {
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    this.isTauriAvailable.set(isTauri);
    this.addLog({
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString(),
      command: 'system:init',
      type: 'response',
      payload: { isTauriEnvironment: isTauri },
    });
  }

  public async invokeCommand<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
    const startTime = performance.now();
    const logId = crypto.randomUUID();

    this.addLog({
      id: logId,
      timestamp: new Date().toLocaleTimeString(),
      command: cmd,
      type: 'invoke',
      payload: args,
    });

    try {
      let result: T;

      if (this.isTauriAvailable()) {
        result = await invoke<T>(cmd, args);
      } else {
        result = await this.mockInvoke<T>(cmd, args);
      }

      const durationMs = Math.round(performance.now() - startTime);

      this.addLog({
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        command: cmd,
        type: 'response',
        payload: result,
        durationMs,
      });

      return result;
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);

      this.addLog({
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        command: cmd,
        type: 'error',
        payload: err?.message || String(err),
        durationMs,
      });

      throw err;
    }
  }

  public async listenToEvent<T>(
    eventName: string,
    callback: (event: { payload: T }) => void
  ): Promise<UnlistenFn> {
    if (this.isTauriAvailable()) {
      return await listen<T>(eventName, callback);
    } else {
      // Browser Mock Event subscription
      const interval = setInterval(() => {
        // No-op mock loop, can be triggered manually in mock mode
      }, 5000);

      return () => clearInterval(interval);
    }
  }

  private async mockInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
    // Artificial mock latency for dev browser mode
    await new Promise((resolve) => setTimeout(resolve, 80));

    this.mockState.invocations++;

    switch (cmd) {
      case 'greet': {
        const name = (args['name'] as string) || 'User';
        return `Hello, ${name}! Greetings from Mock Web Browser environment.` as unknown as T;
      }
      case 'get_system_info': {
        return {
          os: 'Linux (Web Simulator)',
          arch: 'x86_64',
          rust_version: '1.94.1 (mock)',
          tauri_version: '2.11.4 (mock)',
          hostname: 'bilet-x-desktop',
          memory_info: '64-bit Architecture Active',
        } as unknown as T;
      }
      case 'get_app_state': {
        return {
          counter: this.mockState.counter,
          active_theme: this.mockState.active_theme,
          uptime_seconds: Math.floor(performance.now() / 1000),
          total_invocations: this.mockState.invocations,
        } as unknown as T;
      }
      case 'increment_counter': {
        this.mockState.counter++;
        return this.mockState.counter as unknown as T;
      }
      case 'set_theme': {
        const theme = (args['theme'] as string) || 'dark';
        this.mockState.active_theme = theme;
        return theme as unknown as T;
      }
      case 'trigger_ping': {
        const msg = (args['message'] as string) || 'ping';
        return `Mock event emitted with message: '${msg}'` as unknown as T;
      }
      case 'window_minimize':
      case 'window_toggle_maximize':
      case 'window_close': {
        return true as unknown as T;
      }
      default:
        throw new Error(`Command '${cmd}' not recognized in mock handler`);
    }
  }

  public clearLogs(): void {
    this.ipcLogs.set([]);
  }

  private addLog(entry: IPCLogEntry): void {
    this.ipcLogs.update((logs) => [entry, ...logs.slice(0, 49)]);
  }
}
