import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface AiFeature {
  id: 'brain' | 'command' | 'privacy' | 'inbox';
  title: string;
  description: string;
  tag?: string;
}

@Component({
  selector: 'app-bilet-ai',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex h-full flex-col space-y-3 font-sans select-none">
      <!-- HERO HEADER CARD -->
      <div
        class="relative overflow-hidden rounded-2xl border border-neutral-800/80 bg-gradient-to-b from-neutral-900/90 via-neutral-900/60 to-black/80 p-3.5"
      >
        <!-- Background Ambient Glow -->
        <div
          class="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-transparent blur-2xl"
        ></div>
        <div
          class="pointer-events-none absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-gradient-to-tr from-cyan-500/15 via-blue-500/10 to-transparent blur-2xl"
        ></div>

        <div class="relative flex items-center justify-between">
          <div class="flex items-center space-x-2.5">
            <!-- Glowing AI Sparkle Avatar -->
            <div
              class="relative flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/20 via-purple-600/20 to-neutral-950 text-indigo-300 shadow-inner"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="animate-pulse"
              >
                <path
                  d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"
                />
                <path d="M5 3v4" />
                <path d="M19 17v4" />
                <path d="M3 5h4" />
                <path d="M17 19h4" />
              </svg>
            </div>

            <div>
              <div class="flex items-center space-x-2">
                <span
                  class="font-mono text-[13px] font-bold tracking-wider text-neutral-100 uppercase"
                  >Bilet AI</span
                >
                <span
                  class="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-widest text-indigo-300 uppercase"
                >
                  AI Helper
                </span>
              </div>
              <p class="text-[11px] text-neutral-400">Contextual intelligence on your desktop</p>
            </div>
          </div>

          <!-- Status Pill -->
          <div
            class="flex items-center space-x-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] font-medium text-amber-300"
          >
            <span class="h-1.5 w-1.5 animate-ping rounded-full bg-amber-400"></span>
            <span>Coming Soon</span>
          </div>
        </div>
      </div>

      <!-- UPCOMING CAPABILITIES LIST -->
      <div class="flex-1 space-y-2 overflow-y-auto pr-0.5">
        <div class="px-0.5 pt-0.5">
          <span
            class="font-mono text-[10px] font-semibold tracking-wider text-neutral-400 uppercase"
          >
            Upcoming Capabilities
          </span>
        </div>

        <div
          *ngFor="let feature of upcomingFeatures"
          class="group flex items-start space-x-3 rounded-xl border border-neutral-800/70 bg-neutral-900/40 p-3 transition hover:border-neutral-700 hover:bg-neutral-900/80"
        >
          <!-- Vector Feature Icon Container -->
          <div
            class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-400 group-hover:border-indigo-500/40 group-hover:text-indigo-300"
          >
            <!-- Brain / Context Icon -->
            <svg
              *ngIf="feature.id === 'brain'"
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M12 2a4.5 4.5 0 0 0-4.5 4.5c0 .77.2 1.48.55 2.1A4.5 4.5 0 0 0 6 13a4.5 4.5 0 0 0 2.05 3.82A4.5 4.5 0 0 0 12 21a4.5 4.5 0 0 0 3.95-4.18A4.5 4.5 0 0 0 18 13a4.5 4.5 0 0 0-2.05-4.4A4.5 4.5 0 0 0 16.5 6.5 4.5 4.5 0 0 0 12 2Z"
              />
              <path d="M12 2v19" />
            </svg>

            <!-- Command / Zap Icon -->
            <svg
              *ngIf="feature.id === 'command'"
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>

            <!-- Privacy / Shield Icon -->
            <svg
              *ngIf="feature.id === 'privacy'"
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
              />
              <path d="m9 12 2 2 4-4" />
            </svg>

            <!-- Inbox / Stream Icon -->
            <svg
              *ngIf="feature.id === 'inbox'"
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
              <path
                d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
              />
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between">
              <h4 class="text-[12px] font-semibold text-neutral-200">{{ feature.title }}</h4>
              <span *ngIf="feature.tag" class="font-mono text-[9px] text-neutral-500 uppercase">
                {{ feature.tag }}
              </span>
            </div>
            <p class="mt-0.5 text-[11px] leading-normal text-neutral-400">
              {{ feature.description }}
            </p>
          </div>
        </div>
      </div>

      <!-- NOTIFY / EARLY ACCESS FOOTER -->
      <div
        class="flex shrink-0 items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950/90 p-2.5"
      >
        <div class="flex items-center space-x-2">
          <div class="h-2 w-2 animate-pulse rounded-full bg-indigo-400"></div>
          <span class="text-[11px] text-neutral-300">Get early preview updates</span>
        </div>

        <button
          type="button"
          (click)="toggleNotify()"
          class="flex items-center space-x-1.5 rounded-lg border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wider uppercase transition-all duration-200"
          [ngClass]="{
            'border-emerald-500/40 bg-emerald-500/10 text-emerald-300': isNotified(),
            'border-neutral-700 bg-neutral-800 text-neutral-200 hover:border-indigo-500 hover:bg-indigo-600 hover:text-white':
              !isNotified(),
          }"
        >
          <svg
            *ngIf="isNotified()"
            xmlns="http://www.w3.org/2000/svg"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <svg
            *ngIf="!isNotified()"
            xmlns="http://www.w3.org/2000/svg"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span>{{ isNotified() ? 'Notified' : 'Notify Me' }}</span>
        </button>
      </div>
    </div>
  `,
})
export class BiletAiComponent {
  public isNotified = signal(false);

  public upcomingFeatures: AiFeature[] = [
    {
      id: 'brain',
      title: 'Context-Aware Notes & Tasks',
      description: 'Auto-links tasks, extracts due dates, and synthesizes multi-day note logs.',
      tag: 'Core LLM',
    },
    {
      id: 'command',
      title: 'Global AI Command Palette',
      description: 'Invoke quick AI edits and smart clipboard transforms from any app.',
      tag: 'Shortcut',
    },
    {
      id: 'privacy',
      title: 'Local Models & Ollama Support',
      description:
        'Run 100% private offline models (Llama 3, Mistral, Phi) with zero data sharing.',
      tag: 'Privacy',
    },
    {
      id: 'inbox',
      title: 'Unified Inbox Triage',
      description:
        'Prioritizes unread Gmail, Outlook, Slack, and Jira notifications in one digest.',
      tag: 'Smart Feed',
    },
  ];

  public toggleNotify(): void {
    this.isNotified.update((val) => !val);
  }
}
