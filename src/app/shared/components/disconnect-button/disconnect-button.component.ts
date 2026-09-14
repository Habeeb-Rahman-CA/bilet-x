import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IntegrationManagerService } from '../../../integrations/core/integration-manager.service';

/**
 * Minimal per-tab "sign out of this integration" affordance.
 *
 * Sits in an integration tab's toolbar so users don't have to navigate to
 * Settings to unlink an account. Renders only when there's at least one
 * active connection for the given providerId. First click primes a 3-second
 * confirmation state (icon flips to a check + label), second click actually
 * disconnects — cheaper than a modal, safer than a one-tap unlink.
 */
@Component({
  selector: 'app-disconnect-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      *ngIf="hasConnection()"
      (click)="onClick()"
      type="button"
      [title]="primed() ? 'Click again to disconnect' : 'Disconnect'"
      class="no-drag flex h-6 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-2 text-neutral-300 transition hover:bg-white/[0.12] hover:text-white"
      [class.text-red-300]="primed()"
      [class.border-red-400\\/30]="primed()"
    >
      <!-- Idle: chain-break glyph. Primed: checkmark. -->
      <svg *ngIf="!primed()" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 17H7A5 5 0 0 1 7 7h2" />
        <path d="M15 7h2a5 5 0 0 1 4 8" />
        <line x1="8" y1="12" x2="12" y2="12" />
        <line x1="2" y1="2" x2="22" y2="22" />
      </svg>
      <svg *ngIf="primed()" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <span class="font-mono text-[9px] tracking-wide">
        {{ primed() ? 'Confirm?' : 'Disconnect' }}
      </span>
    </button>
  `,
})
export class DisconnectButtonComponent {
  @Input({ required: true }) public providerId!: string;

  public primed = signal<boolean>(false);
  private primeTimer: number | undefined;

  public hasConnection = computed(
    () => this.integrationManager.getConnectionsForProvider(this.providerId).length > 0
  );

  constructor(private integrationManager: IntegrationManagerService) {}

  public onClick(): void {
    if (!this.primed()) {
      this.primed.set(true);
      if (this.primeTimer !== undefined) window.clearTimeout(this.primeTimer);
      // Auto-unprime after 3s if the user walks away — avoids a stale
      // "one-more-click-and-you're-out" trap.
      this.primeTimer = window.setTimeout(() => this.primed.set(false), 3000);
      return;
    }

    if (this.primeTimer !== undefined) {
      window.clearTimeout(this.primeTimer);
      this.primeTimer = undefined;
    }
    this.primed.set(false);
    void this.disconnect();
  }

  private async disconnect(): Promise<void> {
    const conns = this.integrationManager.getConnectionsForProvider(this.providerId);
    // Disconnect ALL connections for this provider — most tabs only ever
    // hold one, but if a user ever wires two Gmail accounts, the tab-level
    // button reads as "sign out of THIS integration" not "sign out of
    // account #1", so nuke the lot.
    for (const conn of conns) {
      await this.integrationManager.disconnectConnection(conn.connectionId);
    }
  }
}
