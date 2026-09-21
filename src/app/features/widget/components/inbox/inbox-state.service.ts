import { Injectable, computed, signal } from '@angular/core';
import { IntegrationManagerService } from '../../../../integrations/core/integration-manager.service';
import { DockTab } from '../dock/dock.component';

/**
 * Ids the inbox knows about. 'all' is a synthetic filter that shows a
 * unified feed mixing every provider's messages and tasks; the rest
 * match provider ids in the integration registry so connection state
 * can be looked up directly.
 */
export type InboxServiceId =
  | 'all'
  | 'gmail'
  | 'outlook'
  | 'slack'
  | 'whatsapp'
  | 'jira'
  | 'github';

export interface InboxServiceOption {
  id: InboxServiceId;
  label: string;
  /** DockTab shape used to feed <app-tab-icon>. Only id/label/icon are read. */
  tab: DockTab;
}

/**
 * Shared state for the inbox. Split out into a service so the switcher
 * (rendered in the widget's panel header, next to the close button) and
 * the inbox body (rendered in the panel content area) can coordinate on
 * the currently active service without the widget having to know about
 * inbox internals. Also owns the per-service badge / connection helpers
 * used by both surfaces.
 */
@Injectable({ providedIn: 'root' })
export class InboxStateService {
  public readonly allService: InboxServiceOption = {
    id: 'all',
    label: 'All Inboxes',
    tab: { id: 'inbox', label: 'All' },
  };

  public readonly providerServices: InboxServiceOption[] = [
    { id: 'github',   label: 'GitHub',      tab: { id: 'github',   label: 'GitHub',   icon: 'github' } },
    { id: 'gmail',    label: 'Gmail',       tab: { id: 'messages', label: 'Gmail',    icon: 'gmail' } },
    { id: 'jira',     label: 'Jira',        tab: { id: 'jira',     label: 'Jira',     icon: 'jira' } },
    { id: 'outlook',  label: 'Outlook',     tab: { id: 'outlook',  label: 'Outlook',  icon: 'outlook' } },
    { id: 'slack',    label: 'Slack',       tab: { id: 'slack',    label: 'Slack',    icon: 'slack' } },
    { id: 'whatsapp', label: 'WhatsApp',    tab: { id: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp' } },
  ];

  /**
   * Reactive list of switcher options:
   * 1. "All Inboxes" is pinned first as the unified feed view.
   * 2. Connected services come first, sorted alphabetically by label.
   * 3. Disconnected services follow, sorted alphabetically by label.
   */
  public services = computed<InboxServiceOption[]>(() => {
    // Reading connections() registers reactive signal dependency
    const _conns = this.integrationManager.connections();
    const connected = this.providerServices
      .filter((svc) => this.isConnected(svc.id))
      .sort((a, b) => a.label.localeCompare(b.label));

    const disconnected = this.providerServices
      .filter((svc) => !this.isConnected(svc.id))
      .sort((a, b) => a.label.localeCompare(b.label));

    return [this.allService, ...connected, ...disconnected];
  });

  public activeService = signal<InboxServiceId>('all');

  constructor(public integrationManager: IntegrationManagerService) {}

  public selectService(id: InboxServiceId): void {
    this.activeService.set(id);
  }

  public isConnected(id: InboxServiceId): boolean {
    if (id === 'all') return true;
    return this.integrationManager.getConnectionsForProvider(id).length > 0;
  }

  public hasAnyConnection(): boolean {
    return this.integrationManager.activeConnections().length > 0;
  }

  /**
   * Service brand color when connected.
   * Returns the canonical brand hex color for the icon.
   */
  public getServiceColor(id: string): string | null {
    const brandColors: Record<string, string> = {
      gmail: '#EA4335',    // Red (Google / Gmail)
      jira: '#2684FF',     // Blue (Atlassian / Jira)
      outlook: '#0078D4',  // Blue (Microsoft Outlook)
      whatsapp: '#25D366', // Green (WhatsApp)
      slack: '#ECB22E',    // Yellow/Amber (Slack)
      github: '#8957E5',   // Purple (GitHub)
    };
    return brandColors[id] || null;
  }

  /** Unread count for messaging services / open count for task services. */
  public badgeFor(id: InboxServiceId): number {
    if (id === 'gmail' || id === 'outlook' || id === 'slack') {
      return this.integrationManager
        .unifiedMessages()
        .filter((m) => m.providerId === id && !m.isRead).length;
    }
    if (id === 'jira' || id === 'github') {
      return this.integrationManager
        .unifiedTasks()
        .filter(
          (t) => t.providerId === id && t.status !== 'done' && t.status !== 'cancelled'
        ).length;
    }
    return 0;
  }

  /**
   * Build a minimal DockTab so <app-tab-icon> can render the provider
   * glyph on unified-feed rows. Keys off provider id — maps to whichever
   * tab id the shared icon component keys off internally.
   */
  public tabForProvider(providerId: string): DockTab {
    const iconMap: Record<string, { id: string; icon: string }> = {
      gmail:    { id: 'messages', icon: 'gmail' },
      outlook:  { id: 'outlook',  icon: 'outlook' },
      slack:    { id: 'slack',    icon: 'slack' },
      whatsapp: { id: 'whatsapp', icon: 'whatsapp' },
      jira:     { id: 'jira',     icon: 'jira' },
      github:   { id: 'github',   icon: 'github' },
    };
    const mapped = iconMap[providerId] || { id: providerId, icon: providerId };
    return { id: mapped.id, label: providerId, icon: mapped.icon };
  }
}
