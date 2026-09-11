import { Injectable } from '@angular/core';
import { BaseIntegration } from '../../core/base-integration';
import { MessageProvider, MessageFilter } from '../../core/capabilities/message-provider.interface';
import { CapabilityType, IntegrationCategory } from '../../core/capabilities/capability.types';
import { ConnectionConfigField } from '../../core/models/connection.model';
import { UnifiedMessage } from '../../core/models/unified-message.model';
import { OutlookAuthHandler } from './outlook-auth';
import { OutlookMessage, OutlookListResponse } from './outlook.models';
import { TauriTokenStorageService } from '../../core/auth/tauri-token-storage.service';
import { OutlookOAuthService } from '../../core/auth/outlook-oauth.service';

@Injectable({
  providedIn: 'root',
})
export class OutlookIntegration extends BaseIntegration implements MessageProvider {
  public readonly id = 'outlook';
  public readonly displayName = 'Outlook';
  public readonly description = 'Monitor unread emails and inbox updates from Microsoft 365 / Outlook.com';
  public readonly category: IntegrationCategory = 'communication';
  public readonly icon = 'outlook';
  public readonly supportedCapabilities: readonly CapabilityType[] = ['messages'] as const;
  public readonly hasInlineConnectUI = true;

  // One-click OAuth: no user-editable config fields.
  public readonly configFields: readonly ConnectionConfigField[] = [];

  public readonly authHandler: OutlookAuthHandler;

  constructor(
    tokenStorage: TauriTokenStorageService,
    outlookOAuth?: OutlookOAuthService
  ) {
    super(tokenStorage);
    this.authHandler = new OutlookAuthHandler(outlookOAuth);
  }

  // ==========================================
  // MESSAGE PROVIDER CAPABILITY IMPLEMENTATION
  // ==========================================

  public async fetchMessages(
    connectionId: string,
    filter?: MessageFilter
  ): Promise<UnifiedMessage[]> {
    const messages = await this.callGraphWithRetry(connectionId, (token) =>
      this.fetchInboxApi(token, filter?.query)
    );
    return messages.map((m) => this.normalizeOutlookMessage(m, connectionId));
  }

  public async markAsRead(connectionId: string, messageId: string): Promise<void> {
    await this.callGraphWithRetry(connectionId, async (token) => {
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}`,
        {
          method: 'PATCH',
          headers: this.authHandler.getAuthHeaders({}, token),
          body: JSON.stringify({ isRead: true }),
        }
      );
      if (!res.ok) {
        throw new OutlookApiError(`Failed to mark as read: ${res.status}`, res.status);
      }
      return true;
    });
  }

  public async toggleStarred(
    connectionId: string,
    messageId: string,
    starred: boolean
  ): Promise<void> {
    await this.callGraphWithRetry(connectionId, async (token) => {
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}`,
        {
          method: 'PATCH',
          headers: this.authHandler.getAuthHeaders({}, token),
          body: JSON.stringify({
            flag: { flagStatus: starred ? 'flagged' : 'notFlagged' },
          }),
        }
      );
      if (!res.ok) {
        throw new OutlookApiError(`Failed to toggle flag: ${res.status}`, res.status);
      }
      return true;
    });
  }

  // ==========================================
  // DATA NORMALIZATION
  // ==========================================

  public normalizeOutlookMessage(msg: OutlookMessage, connectionId: string): UnifiedMessage {
    const senderAddr = msg.from?.emailAddress || msg.sender?.emailAddress || {};
    const senderName = senderAddr.name || senderAddr.address || 'Unknown Sender';
    const senderEmail = senderAddr.address || '';

    const isStarred = msg.flag?.flagStatus === 'flagged';
    const timestamp = msg.receivedDateTime || msg.sentDateTime || new Date().toISOString();

    return {
      id: `outlook:${msg.id}`,
      sourceId: msg.id,
      threadId: msg.conversationId,
      providerId: this.id,
      connectionId,
      sender: {
        name: senderName,
        email: senderEmail,
      },
      subject: msg.subject || '(No Subject)',
      snippet: msg.bodyPreview || '',
      timestamp,
      isRead: !!msg.isRead,
      isStarred,
      hasAttachments: !!msg.hasAttachments,
      labels: msg.categories,
      webUrl: msg.webLink,
      metadata: {
        conversationId: msg.conversationId,
        flagStatus: msg.flag?.flagStatus,
      },
    };
  }

  // ==========================================
  // INTERNALS
  // ==========================================

  /**
   * Run a Graph API call with automatic token refresh on 401. Mirrors
   * GmailIntegration.callGmailWithRetry — access tokens are ~1h and
   * getValidAccessToken refreshes proactively as they near expiry, but a
   * stale token can still slip through.
   */
  private async callGraphWithRetry<T>(
    connectionId: string,
    fn: (token: string) => Promise<T>
  ): Promise<T> {
    const token = await this.getValidAccessToken(connectionId);
    if (!token) {
      throw new Error(`[Outlook] No token found for connection "${connectionId}"`);
    }

    try {
      return await fn(token);
    } catch (err) {
      if (!isUnauthorized(err)) throw err;

      const refreshed = await this.forceRefresh(connectionId);
      if (!refreshed) {
        throw new Error(
          'Microsoft session expired and could not be refreshed. Please sign in again.'
        );
      }
      return fn(refreshed);
    }
  }

  private async fetchInboxApi(token: string, query?: string): Promise<OutlookMessage[]> {
    // Default: pull the 20 most recent messages from Inbox. If the caller
    // passes a query string, treat it as a Graph $search value (e.g. `from:x`).
    const select =
      '$select=id,conversationId,subject,bodyPreview,from,sender,receivedDateTime,isRead,hasAttachments,flag,webLink,categories';
    const top = '$top=20';
    const orderBy = '$orderby=receivedDateTime desc';

    let url: string;
    if (query && query.trim()) {
      url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?${select}&${top}&$search=${encodeURIComponent(
        `"${query.trim()}"`
      )}`;
    } else {
      url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?${select}&${top}&${orderBy}`;
    }

    const res = await fetch(url, {
      headers: this.authHandler.getAuthHeaders({}, token),
    });

    if (res.status === 401) {
      throw new OutlookApiError('Unauthorized', 401);
    }
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new OutlookApiError(
        `Graph API HTTP Error: ${res.status} ${res.statusText}${bodyText ? ` — ${bodyText.slice(0, 200)}` : ''}`,
        res.status
      );
    }

    const data: OutlookListResponse = await res.json();
    return data.value || [];
  }
}

class OutlookApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'OutlookApiError';
  }
}

function isUnauthorized(err: unknown): boolean {
  if (err instanceof OutlookApiError) return err.status === 401;
  const message = (err as any)?.message || '';
  return typeof message === 'string' && message.includes('401');
}
