import { Component, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SystemService } from '../../core/tauri/system.service';
import { IpcLoggerComponent } from '../../shared/components/ipc-logger/ipc-logger.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, IpcLoggerComponent],
  template: `
    <div class="flex h-full flex-col space-y-6 overflow-y-auto bg-slate-950 p-6">
      <!-- Top Navigation Tabs & Header -->
      <div
        class="flex flex-col gap-4 border-b border-slate-800 pb-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <div class="flex items-center space-x-3">
            <img
              src="bilet-x-dark-icon-v1.png"
              alt="Bilet-X Logo"
              class="h-8 w-8 rounded-lg border border-slate-800 bg-slate-900 object-contain p-0.5 shadow-md shadow-indigo-500/20"
            />
            <h1 class="text-2xl font-extrabold tracking-tight text-white">
              Bilet-X Control Center
            </h1>
            <span
              class="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400"
            >
              Angular 21 + Tauri v2
            </span>
          </div>
          <p class="mt-1 text-xs text-slate-400">
            Native Desktop Environment initialized with Rust backend & TypeScript Angular boundary.
          </p>
        </div>

        <!-- View Switcher Tabs -->
        <div
          class="flex items-center space-x-1 rounded-lg border border-slate-800 bg-slate-900/80 p-1"
        >
          <button
            (click)="activeTab.set('overview')"
            type="button"
            class="rounded-md px-3 py-1.5 text-xs font-medium transition-all"
            [ngClass]="
              activeTab() === 'overview'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            "
          >
            Dashboard
          </button>
          <button
            (click)="activeTab.set('ipc')"
            type="button"
            class="rounded-md px-3 py-1.5 text-xs font-medium transition-all"
            [ngClass]="
              activeTab() === 'ipc'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            "
          >
            IPC Inspector
          </button>
          <button
            (click)="activeTab.set('specs')"
            type="button"
            class="rounded-md px-3 py-1.5 text-xs font-medium transition-all"
            [ngClass]="
              activeTab() === 'specs'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            "
          >
            Boundary Specs
          </button>
        </div>
      </div>

      <!-- TAB 1: OVERVIEW -->
      <div *ngIf="activeTab() === 'overview'" class="space-y-6">
        <!-- Metrics Grid -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <!-- OS Info Card -->
          <div
            class="glass-card rounded-xl border border-slate-800 p-4 transition hover:border-slate-700"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-slate-400">Operating System</span>
              <span
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400"
                >💻</span
              >
            </div>
            <div class="mt-2 text-xl font-bold text-slate-100">
              {{ systemService.systemInfo()?.os || 'Loading...' }}
            </div>
            <div class="mt-1 text-[11px] text-slate-400">
              Architecture:
              <span class="font-mono text-slate-300">{{
                systemService.systemInfo()?.arch || 'x86_64'
              }}</span>
            </div>
          </div>

          <!-- Rust Engine Card -->
          <div
            class="glass-card rounded-xl border border-slate-800 p-4 transition hover:border-slate-700"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-slate-400">Rust & Tauri Core</span>
              <span
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400"
                >🦀</span
              >
            </div>
            <div class="mt-2 text-xl font-bold text-slate-100">Rust 1.94</div>
            <div class="mt-1 text-[11px] text-slate-400">
              Tauri API:
              <span class="font-mono text-slate-300"
                >v{{ systemService.systemInfo()?.tauri_version || '2.11.4' }}</span
              >
            </div>
          </div>

          <!-- Rust AppState Counter Card -->
          <div
            class="glass-card rounded-xl border border-slate-800 p-4 transition hover:border-slate-700"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-slate-400">Backend AppState Mutex</span>
              <span
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400"
                >⚡</span
              >
            </div>
            <div class="mt-2 text-2xl font-black text-emerald-400">
              {{ systemService.appState()?.counter ?? 0 }}
            </div>
            <div class="mt-1 text-[11px] text-slate-400">
              Total Invocations:
              <span class="font-mono text-slate-300">{{
                systemService.appState()?.total_invocations ?? 0
              }}</span>
            </div>
          </div>

          <!-- App Uptime Card -->
          <div
            class="glass-card rounded-xl border border-slate-800 p-4 transition hover:border-slate-700"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-slate-400">System Uptime</span>
              <span
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400"
                >⏱️</span
              >
            </div>
            <div class="mt-2 text-xl font-bold text-slate-100">
              {{ systemService.appState()?.uptime_seconds ?? 0 }}s
            </div>
            <div class="mt-1 text-[11px] text-slate-400">
              Host:
              <span class="font-mono text-slate-300">{{
                systemService.systemInfo()?.hostname || 'localhost'
              }}</span>
            </div>
          </div>
        </div>

        <!-- Interactive IPC Boundary Actions Grid -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <!-- Command Tester Card -->
          <div class="glass-card space-y-4 rounded-xl border border-slate-800 p-5">
            <div class="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h3 class="text-sm font-semibold text-white">Rust IPC Greeting Command</h3>
                <p class="text-[11px] text-slate-400">
                  Invoke custom command registered in Tauri generate_handler
                </p>
              </div>
              <span
                class="rounded bg-indigo-500/10 px-2 py-0.5 font-mono text-[10px] text-indigo-400"
              >
                #[tauri::command]
              </span>
            </div>

            <div class="space-y-3">
              <div>
                <label class="mb-1 block text-xs font-medium text-slate-300">Enter Name</label>
                <div class="flex space-x-2">
                  <input
                    [(ngModel)]="nameInput"
                    type="text"
                    placeholder="Enter your name..."
                    class="glass-input flex-1 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500"
                  />
                  <button
                    (click)="onGreet()"
                    type="button"
                    class="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
                  >
                    Invoke Greet
                  </button>
                </div>
              </div>

              <!-- Greet Response Box -->
              <div
                *ngIf="systemService.greetResponse()"
                class="rounded-lg border border-indigo-500/30 bg-slate-900/90 p-3"
              >
                <span
                  class="mb-1 block text-[10px] font-semibold tracking-wider text-indigo-400 uppercase"
                  >Response from Rust Backend:</span
                >
                <p class="font-mono text-xs text-slate-200">{{ systemService.greetResponse() }}</p>
              </div>
            </div>
          </div>

          <!-- App State Mutex & Event Emitter Card -->
          <div class="glass-card space-y-4 rounded-xl border border-slate-800 p-5">
            <div class="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h3 class="text-sm font-semibold text-white">AppState Mutex & Event Broadcaster</h3>
                <p class="text-[11px] text-slate-400">
                  Mutate state safely in Rust & emit events to Angular
                </p>
              </div>
              <span
                class="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400"
              >
                tauri::Emitter
              </span>
            </div>

            <div class="space-y-3">
              <div class="flex items-center space-x-3">
                <button
                  (click)="systemService.incrementCounter()"
                  type="button"
                  class="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500"
                >
                  + Increment Mutex Counter
                </button>
                <button
                  (click)="systemService.refreshAppState()"
                  type="button"
                  class="rounded-lg bg-slate-800 px-3 py-2.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700"
                >
                  🔄 Refresh State
                </button>
              </div>

              <div class="flex items-center space-x-2 border-t border-slate-800/60 pt-2">
                <input
                  [(ngModel)]="pingInput"
                  type="text"
                  placeholder="Ping message..."
                  class="glass-input flex-1 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500"
                />
                <button
                  (click)="onTriggerPing()"
                  type="button"
                  class="rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-purple-600/20 transition hover:bg-purple-500"
                >
                  Emit Event
                </button>
              </div>

              <!-- Received Event Notification -->
              <div
                *ngIf="systemService.lastEventMessage()"
                class="rounded-lg border border-purple-500/30 bg-purple-950/30 p-3"
              >
                <span
                  class="mb-1 block text-[10px] font-semibold tracking-wider text-purple-400 uppercase"
                  >Backend Event Listener Output:</span
                >
                <p class="font-mono text-xs text-slate-200">
                  {{ systemService.lastEventMessage() }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: IPC LOG INSPECTOR -->
      <div *ngIf="activeTab() === 'ipc'" class="h-[550px]">
        <app-ipc-logger></app-ipc-logger>
      </div>

      <!-- TAB 3: BOUNDARY SPECS & ARCHITECTURE -->
      <div
        *ngIf="activeTab() === 'specs'"
        class="glass-card space-y-4 rounded-xl border border-slate-800 p-6"
      >
        <h2 class="text-lg font-bold text-white">Angular ↔ Rust Boundary Specifications</h2>
        <p class="text-xs text-slate-400">
          Architectural overview of how data and execution flow across the web-to-native desktop
          barrier.
        </p>

        <div class="grid grid-cols-1 gap-4 pt-2 md:grid-cols-3">
          <div class="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
            <h4 class="text-xs font-bold tracking-wider text-indigo-400 uppercase">
              1. Angular Frontend
            </h4>
            <ul class="mt-2 list-inside list-disc space-y-1 text-xs text-slate-300">
              <li>Angular 21 Standalone Components</li>
              <li>TypeScript strict typing & path aliases</li>
              <li>Signals state reactivity (WritableSignal)</li>
              <li>Tailwind CSS v4 & glassmorphism theme</li>
            </ul>
          </div>

          <div class="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
            <h4 class="text-xs font-bold tracking-wider text-cyan-400 uppercase">
              2. Tauri IPC Bridge
            </h4>
            <ul class="mt-2 list-inside list-disc space-y-1 text-xs text-slate-300">
              <li>
                <code class="text-cyan-300">&#64;tauri-apps/api/core</code>
                <code class="text-cyan-300">invoke()</code>
              </li>
              <li>
                <code class="text-cyan-300">&#64;tauri-apps/api/event</code>
                <code class="text-cyan-300">listen()</code>
              </li>
              <li>Browser fallback mode for local web testing</li>
              <li>Real-time logging & latency inspection</li>
            </ul>
          </div>

          <div class="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
            <h4 class="text-xs font-bold tracking-wider text-emerald-400 uppercase">
              3. Rust Native Backend
            </h4>
            <ul class="mt-2 list-inside list-disc space-y-1 text-xs text-slate-300">
              <li>
                <code class="text-emerald-300">AppState</code> with thread-safe
                <code class="text-emerald-300">Mutex</code> locks
              </li>
              <li>Serde JSON serialization</li>
              <li>
                Modular <code class="text-emerald-300">commands/</code>,
                <code class="text-emerald-300">models/</code>,
                <code class="text-emerald-300">state/</code>
              </li>
              <li>Native window event management</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent {
  public activeTab: WritableSignal<'overview' | 'ipc' | 'specs'> = signal('overview');
  public nameInput = 'Developer';
  public pingInput = 'Ping from Desktop Window';

  constructor(public systemService: SystemService) {}

  public async onGreet(): Promise<void> {
    if (!this.nameInput.trim()) return;
    await this.systemService.greet(this.nameInput);
  }

  public async onTriggerPing(): Promise<void> {
    if (!this.pingInput.trim()) return;
    await this.systemService.triggerPing(this.pingInput);
  }
}
