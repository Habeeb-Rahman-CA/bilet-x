import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InboxServiceOption, InboxStateService } from './inbox-state.service';
import { TabIconComponent } from '../dock/tab-icon.component';

/**
 * Row of service-filter icons for the inbox. Rendered by the widget in
 * the panel header (next to the close button) so it sits parallel to
 * the close icon rather than stacked above the inbox body. Reads and
 * writes shared state via InboxStateService so the body component
 * (rendered separately in the panel content area) stays in sync.
 *
 * Connected services are listed first (sorted alphabetically) and their
 * icons are tinted in their canonical brand color (e.g. Gmail red, Jira blue).
 * Unconnected service icons stay visible at 40% opacity in neutral tone so
 * users can discover and click into them — the child component's built-in
 * connect card takes over once selected.
 */
@Component({
  selector: 'app-inbox-switcher',
  standalone: true,
  imports: [CommonModule, TabIconComponent],
  styles: [
    `
      /* Hide the scrollbar on the switcher row. overflow-x-auto is a
         safety net so nothing ever wraps out of the header; it should
         essentially never activate because the icons are sized to fit
         the ~348px panel inner width, but if a future release adds an
         eighth service (or the panel shrinks) we prefer a subtle
         horizontal scroll over a broken two-row layout. */
      .switcher-row {
        scrollbar-width: none;
      }
      .switcher-row::-webkit-scrollbar {
        display: none;
      }
    `,
  ],
  template: `
    <div
      class="switcher-row no-drag flex flex-nowrap items-center gap-1 overflow-x-auto"
    >
      <button
        *ngFor="let svc of state.services(); trackBy: trackByServiceId"
        (click)="state.selectService(svc.id)"
        type="button"
        [title]="svc.label + (state.isConnected(svc.id) ? '' : ' — not connected')"
        class="glass-btn relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-150"
        [class.is-selected]="state.activeService() === svc.id"
        [class.opacity-40]="!state.isConnected(svc.id) && svc.id !== 'all'"
      >
        <!-- Special-case the "all" icon: TabIconComponent doesn't know
             about an "all" tab so we draw an inline "inbox" glyph.
             Real services delegate to the shared icon component so we
             don't drift out of sync with the dock. -->
        <svg
          *ngIf="svc.id === 'all'"
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
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
        <app-tab-icon
          *ngIf="svc.id !== 'all'"
          [tab]="svc.tab"
          [size]="11"
          class="flex items-center justify-center transition-colors duration-150"
          [style.color]="state.isConnected(svc.id) ? state.getServiceColor(svc.id) : null"
        ></app-tab-icon>

        <!-- Per-service badge. Suppressed for 'all' — its count would
             double the summary badge already shown on the dock's
             inbox tab. -->
        <span
          *ngIf="svc.id !== 'all' && state.badgeFor(svc.id) > 0"
          class="absolute -top-0.5 -right-0.5 flex h-2.5 min-w-2.5 items-center justify-center rounded-full bg-red-500 px-1 font-mono text-[7px] font-bold text-white shadow"
        >
          {{ state.badgeFor(svc.id) }}
        </span>
      </button>
    </div>
  `,
})
export class InboxSwitcherComponent {
  constructor(public state: InboxStateService) {}

  public trackByServiceId(_index: number, svc: InboxServiceOption): string {
    return svc.id;
  }
}
