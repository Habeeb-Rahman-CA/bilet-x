import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TauriService } from '../../../core/tauri/tauri.service';

@Component({
  selector: 'app-ipc-logger',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="glass-card flex h-full flex-col overflow-hidden border border-neutral-800 bg-black">
      <!-- Header bar -->
      <div
        class="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-2.5"
      >
        <div class="flex items-center space-x-2">
          <span class="flex h-2 w-2 rounded-full bg-white"></span>
          <h3 class="text-xs font-bold tracking-wider text-neutral-200 uppercase">
            IPC Activity Monitor
          </h3>
          <span class="border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
            {{ tauriService.ipcLogs().length }} entries
          </span>
        </div>
        <button
          (click)="tauriService.clearLogs()"
          type="button"
          class="border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-[11px] font-medium text-neutral-300 transition hover:bg-neutral-800 hover:text-white"
        >
          Clear Logs
        </button>
      </div>

      <!-- Log Entries Stream -->
      <div class="flex-1 space-y-2 overflow-y-auto p-3 font-mono text-xs">
        <div
          *ngIf="tauriService.ipcLogs().length === 0"
          class="flex h-32 items-center justify-center text-xs text-neutral-500 italic"
        >
          No IPC events recorded.
        </div>

        <div
          *ngFor="let log of tauriService.ipcLogs()"
          class="group border border-neutral-800 bg-neutral-950 p-2.5 transition-all hover:border-neutral-700"
        >
          <div class="mb-1 flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span
                class="inline-block border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-neutral-200 uppercase"
              >
                {{ log.type }}
              </span>
              <span class="font-bold text-neutral-100">{{ log.command }}</span>
            </div>
            <div class="flex items-center space-x-2 text-[10px] text-neutral-400">
              <span *ngIf="log.durationMs !== undefined" class="font-sans text-neutral-400">
                {{ log.durationMs }}ms
              </span>
              <span>{{ log.timestamp }}</span>
            </div>
          </div>

          <div *ngIf="log.payload" class="mt-1 overflow-x-auto text-[11px] text-neutral-400">
            <pre
              class="border border-neutral-800 bg-black p-2 break-all whitespace-pre-wrap text-neutral-300"
              >{{ formatPayload(log.payload) }}</pre>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class IpcLoggerComponent {
  constructor(public tauriService: TauriService) {}

  public formatPayload(payload: any): string {
    if (typeof payload === 'string') return payload;
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  }
}

