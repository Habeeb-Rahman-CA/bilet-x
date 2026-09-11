import { Injectable, Injector } from '@angular/core';
import { BaseIntegration } from '../../core/base-integration';
import { CapabilityType, IntegrationCategory } from '../../core/capabilities/capability.types';
import { ConnectionConfigField } from '../../core/models/connection.model';
import { WhatsAppAuthHandler } from './whatsapp-auth';
import { TauriTokenStorageService } from '../../core/auth/tauri-token-storage.service';
import { WhatsAppOAuthService } from '../../core/auth/whatsapp-oauth.service';
import { IntegrationManagerService } from '../../core/integration-manager.service';

export interface WhatsAppTemplate {
  id: string;
  name: string;
  status: string;
  language: string;
  category: string;
}

/**
 * WhatsApp Business Cloud API integration.
 *
 * Deliberately declares no capabilities — Meta's Cloud API is webhook-only
 * for inbound messages, so there is no polling endpoint that fits the
 * MessageProvider "give me recent unread messages" shape. This integration
 * handles the OAuth lifecycle and exposes direct helpers (fetchTemplates)
 * that the WhatsAppComponent calls to render the WABA dashboard.
 *
 * If we ever add a hosted webhook receiver, we can promote this to a real
 * MessageProvider then.
 */
@Injectable({
  providedIn: 'root',
})
export class WhatsAppIntegration extends BaseIntegration {
  public readonly id = 'whatsapp';
  public readonly displayName = 'WhatsApp Business';
  public readonly description = 'Manage your WhatsApp Business Account, phone numbers, and templates';
  public readonly category: IntegrationCategory = 'communication';
  public readonly icon = 'whatsapp';
  public readonly supportedCapabilities: readonly CapabilityType[] = [] as const;
  public readonly hasInlineConnectUI = true;

  public readonly configFields: readonly ConnectionConfigField[] = [];

  public readonly authHandler: WhatsAppAuthHandler;

  constructor(
    tokenStorage: TauriTokenStorageService,
    private injector: Injector,
    whatsappOAuth?: WhatsAppOAuthService
  ) {
    super(tokenStorage);
    this.authHandler = new WhatsAppAuthHandler(whatsappOAuth);
  }

  /**
   * Fetch the WABA's message templates from Graph. Component uses this to
   * render a small "N templates configured" summary and open the manager.
   */
  public async fetchTemplates(connectionId: string): Promise<WhatsAppTemplate[]> {
    const config = this.getConnectionConfig(connectionId);
    const wabaId = config['wabaId'];
    if (!wabaId) return [];

    const token = await this.getAccessToken(connectionId);
    if (!token) {
      throw new Error(`[WhatsApp] No token found for connection "${connectionId}"`);
    }

    const url = `https://graph.facebook.com/v20.0/${encodeURIComponent(wabaId)}/message_templates?fields=id,name,status,language,category&limit=25`;
    const res = await fetch(url, {
      headers: this.authHandler.getAuthHeaders(config, token),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new Error(
        `WhatsApp templates HTTP ${res.status} ${res.statusText}${bodyText ? ` — ${bodyText.slice(0, 200)}` : ''}`
      );
    }

    const data = await res.json();
    const items = (data?.data || []) as any[];
    return items.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      language: t.language,
      category: t.category,
    }));
  }

  private getConnectionConfig(connectionId: string): Record<string, string> {
    const mgr = this.injector.get(IntegrationManagerService, null);
    return mgr?.getConnection(connectionId)?.config ?? {};
  }
}
