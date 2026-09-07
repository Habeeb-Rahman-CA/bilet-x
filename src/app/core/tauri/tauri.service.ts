import { Injectable, signal, WritableSignal } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { IPCLogEntry } from '../models/tauri.models';

@Injectable({
  providedIn: 'root',
})
export class TauriService {
  public readonly isTauriAvailable: WritableSignal<boolean> = signal(false);
  public readonly ipcLogs: WritableSignal<IPCLogEntry[]> = signal([]);

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
      if (!this.isTauriAvailable()) {
        throw new Error(`Tauri unavailable; cannot invoke '${cmd}' outside the desktop shell`);
      }

      const result = await invoke<T>(cmd, args);
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

  public clearLogs(): void {
    this.ipcLogs.set([]);
  }

  private addLog(entry: IPCLogEntry): void {
    this.ipcLogs.update((logs) => [entry, ...logs.slice(0, 49)]);
  }
}
