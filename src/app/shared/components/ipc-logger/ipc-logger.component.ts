import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TauriService } from '../../../core/tauri/tauri.service';

@Component({
  selector: 'app-ipc-logger',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="glass-card flex h-full flex-col overflow-hidden rounded-xl border border-slate-800">
      <!-- Header bar -->
      <div
        class="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-4 py-2.5"
      >
        <div class="flex items-center space-x-2">
          <span class="flex h-2 w-2 rounded-full bg-cyan-400"></span>
          <h3 class="text-xs font-semibold tracking-wider text-slate-300 uppercase">
            IPC Activity Monitor
          </h3>
          <span class="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
            {{ tauriService.ipcLogs().length }} entries
          </span>
        </div>
        <button
          (click)="tauriService.clearLogs()"
          type="button"
          class="rounded-md px-2.5 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
        >
          Clear Logs
        </button>
      </div>

      <!-- Log Entries Stream -->
      <div class="flex-1 space-y-2 overflow-y-auto p-3 font-mono text-xs">
        <div
          *ngIf="tauriService.ipcLogs().length === 0"
          class="flex h-32 items-center justify-center text-xs text-slate-500 italic"
        >
          No IPC events recorded yet. Interact with the dashboard options to trigger commands.
        </div>

        <div
          *ngFor="let log of tauriService.ipcLogs()"
          class="group rounded-lg border bg-slate-900/40 p-2.5 transition-all hover:bg-slate-900/80"
          [ngClass]="{
            'border-indigo-500/20 bg-indigo-950/10': log.type === 'invoke',
            'border-emerald-500/20 bg-emerald-950/10': log.type === 'response',
            'border-rose-500/30 bg-rose-950/20': log.type === 'error',
            'border-purple-500/20 bg-purple-950/10': log.type === 'event',
          }"
        >
          <div class="mb-1 flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span
                class="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase"
                [ngClass]="{
                  'bg-indigo-500/20 text-indigo-300': log.type === 'invoke',
                  'bg-emerald-500/20 text-emerald-300': log.type === 'response',
                  'bg-rose-500/20 text-rose-300': log.type === 'error',
                  'bg-purple-500/20 text-purple-300': log.type === 'event',
                }"
              >
                {{ log.type }}
              </span>
              <span class="font-bold text-slate-200">{{ log.command }}</span>
            </div>
            <div class="flex items-center space-x-2 text-[10px] text-slate-400">
              <span *ngIf="log.durationMs !== undefined" class="font-sans text-slate-400">
                {{ log.durationMs }}ms
              </span>
              <span>{{ log.timestamp }}</span>
            </div>
          </div>

          <div *ngIf="log.payload" class="mt-1 overflow-x-auto text-[11px] text-slate-400">
            <pre
              class="rounded border border-slate-800/60 bg-slate-950/60 p-2 break-all whitespace-pre-wrap text-slate-300"
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
