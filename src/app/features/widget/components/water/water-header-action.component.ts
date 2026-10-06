import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WaterService } from './water.service';

@Component({
  selector: 'app-water-header-action',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="no-drag flex items-center">
      <!-- In Settings View: Back Button on Left Side (styled like close button) -->
      <button
        *ngIf="water.viewMode() === 'settings'"
        (click)="water.viewMode.set('main')"
        type="button"
        title="Back to Hydration"
        class="glass-btn flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-300 hover:text-white transition active:scale-95"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>
    </div>
  `,
})
export class WaterHeaderActionComponent {
  constructor(public water: WaterService) {}
}
