import { Injectable } from '@angular/core';
import { BaseIntegration } from '../../core/base-integration';
import { MessageProvider, MessageFilter } from '../../core/capabilities/message-provider.interface';
import { CapabilityType, IntegrationCategory } from '../../core/capabilities/capability.types';
import { ConnectionConfigField } from '../../core/models/connection.model';
import { UnifiedMessage } from '../../core/models/unified-message.model';
import { GmailAuthHandler } from './gmail-auth';
import { GmailMessage } from './gmail.models';
import { TauriTokenStorageService } from '../../core/auth/tauri-token-storage.service';
import { GoogleOAuthService } from '../../core/auth/google-oauth.service';

@Injectable({
  providedIn: 'root',
})
export class GmailIntegration extends BaseIntegration implements MessageProvider {
  public readonly id = 'gmail';
  public readonly displayName = 'Gmail';
  public readonly description = 'Monitor unread emails, urgent threads, and inbox updates';
  public readonly category: IntegrationCategory = 'communication';
  public readonly icon = 'mail';
  public readonly supportedCapabilities: readonly CapabilityType[] = ['messages'] as const;
  public readonly hasInlineConnectUI = true;

  public readonly configFields: readonly ConnectionConfigField[] = [
    {
      key: 'queryFilter',
      label: 'Search / Inbox Query',
      type: 'text',
      placeholder: 'is:unread in:inbox',
      description: 'Gmail filter query (e.g. is:unread in:inbox or label:important)',
      required: false,
      isSecret: false,
      defaultValue: 'is:unread in:inbox',
    },
  ];

  public readonly authHandler: GmailAuthHandler;

  constructor(tokenStorage: TauriTokenStorageService, googleOAuth?: GoogleOAuthService) {
    super(tokenStorage);
    this.authHandler = new GmailAuthHandler(googleOAuth);
  }

  // ==========================================
  // MESSAGE PROVIDER CAPABILITY IMPLEMENTATION
  // ==========================================

  public async fetchMessages(
    connectionId: string,
    filter?: MessageFilter
  ): Promise<UnifiedMessage[]> {
    const messages = await this.callGmailWithRetry(connectionId, (token) =>
      this.fetchGmailApi(token, filter?.query)
    );
    return messages.map((m) => this.normalizeGmailMessage(m, connectionId));
  }

  public async markAsRead(connectionId: string, messageId: string): Promise<void> {
    await this.callGmailWithRetry(connectionId, async (token) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
        {
          method: 'POST',
          headers: this.authHandler.getAuthHeaders({}, token),
          body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
        }
      );
      if (!res.ok) {
        throw new GmailApiError(`Failed to mark as read: ${res.status}`, res.status);
      }
      return true;
    });
  }

  public async toggleStarred(
    connectionId: string,
    messageId: string,
    starred: boolean
  ): Promise<void> {
    await this.callGmailWithRetry(connectionId, async (token) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
        {
          method: 'POST',
          headers: this.authHandler.getAuthHeaders({}, token),
          body: JSON.stringify(
            starred ? { addLabelIds: ['STARRED'] } : { removeLabelIds: ['STARRED'] }
          ),
        }
      );
      if (!res.ok) {
        throw new GmailApiError(`Failed to toggle star: ${res.status}`, res.status);
      }
      return true;
    });
  }

  // ==========================================
  // DATA NORMALIZATION
  // ==========================================

  public normalizeGmailMessage(msg: GmailMessage, connectionId: string): UnifiedMessage {
    const headers = msg.payload?.headers || [];
    const getHeader = (name: string): string =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const subject = getHeader('Subject') || '(No Subject)';
    const fromHeader = getHeader('From') || 'Unknown Sender';
    const dateHeader = getHeader('Date');

    // Parse "Sender Name <email@example.com>"
    let senderName = fromHeader;
    let senderEmail = fromHeader;
    const match = fromHeader.match(/^(.*?)\s*<(.+?)>$/);
    if (match) {
      senderName = match[1].replace(/^"|"$/g, '').trim() || match[2];
      senderEmail = match[2].trim();
    }

    const timestamp = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();
    const isRead = !(msg.labelIds || []).includes('UNREAD');
    const isStarred = (msg.labelIds || []).includes('STARRED');

    return {
      id: `gmail:${msg.id}`,
      sourceId: msg.id,
      threadId: msg.threadId,
      providerId: this.id,
      connectionId,
      sender: {
        name: senderName,
        email: senderEmail,
      },
      subject,
      snippet: msg.snippet || '',
      timestamp,
      isRead,
      isStarred,
      labels: msg.labelIds,
      webUrl: `https://mail.google.com/mail/u/0/#inbox/${msg.threadId || msg.id}`,
      metadata: {
        labelIds: msg.labelIds,
      },
    };
  }

  // ==========================================
  // INTERNALS
  // ==========================================

  /**
   * Run a Gmail API call with automatic token refresh on 401.
   * If the first call fails with 401, forces a refresh via the stored
   * refresh token, retries once, and gives up if that also 401s.
   */
  private async callGmailWithRetry<T>(
    connectionId: string,
    fn: (token: string) => Promise<T>
  ): Promise<T> {
    const token = await this.getValidAccessToken(connectionId);
    if (!token) {
      throw new Error(`[Gmail] No token found for connection "${connectionId}"`);
    }

    try {
      return await fn(token);
    } catch (err) {
      if (!isUnauthorized(err)) throw err;

      const refreshed = await this.forceRefresh(connectionId);
      if (!refreshed) {
        throw new Error(
          'Google session expired and could not be refreshed. Please sign in again.'
        );
      }
      return fn(refreshed);
    }
  }

  private async fetchGmailApi(token: string, query?: string): Promise<GmailMessage[]> {
    const q = encodeURIComponent(query || 'is:unread in:inbox');
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=20`,
      {
        headers: this.authHandler.getAuthHeaders({}, token),
      }
    );

    if (!listRes.ok) {
      throw new GmailApiError(
        `Gmail API list failed: ${listRes.status} ${listRes.statusText}`,
        listRes.status
      );
    }

    const listData = await listRes.json();
    const items: { id: string }[] = listData.messages || [];

    if (items.length === 0) return [];

    const detailed: GmailMessage[] = [];
    const results = await Promise.allSettled(
      items.slice(0, 15).map(async (item) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=metadata`,
          { headers: this.authHandler.getAuthHeaders({}, token) }
        );
        if (msgRes.status === 401) {
          throw new GmailApiError('Unauthorized', 401);
        }
        if (msgRes.ok) {
          return (await msgRes.json()) as GmailMessage;
        }
        return null;
      })
    );

    // If any detail fetch was 401, bubble it up so the retry logic kicks in.
    for (const res of results) {
      if (res.status === 'rejected' && isUnauthorized(res.reason)) {
        throw res.reason;
      }
      if (res.status === 'fulfilled' && res.value) {
        detailed.push(res.value);
      }
    }

    return detailed;
  }
}

class GmailApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'GmailApiError';
  }
}

function isUnauthorized(err: unknown): boolean {
  if (err instanceof GmailApiError) return err.status === 401;
  const message = (err as any)?.message || '';
  return typeof message === 'string' && message.includes('401');
}
