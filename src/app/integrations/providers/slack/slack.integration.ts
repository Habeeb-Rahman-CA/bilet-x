import { Injectable, Injector } from '@angular/core';
import { BaseIntegration } from '../../core/base-integration';
import { MessageProvider, MessageFilter } from '../../core/capabilities/message-provider.interface';
import { CapabilityType, IntegrationCategory } from '../../core/capabilities/capability.types';
import { ConnectionConfigField } from '../../core/models/connection.model';
import { UnifiedMessage } from '../../core/models/unified-message.model';
import { SlackAuthHandler } from './slack-auth';
import {
  SlackConversation,
  SlackConversationsListResponse,
  SlackHistoryResponse,
  SlackMessage,
  SlackUser,
  SlackUsersInfoResponse,
} from './slack.models';
import { TauriTokenStorageService } from '../../core/auth/tauri-token-storage.service';
import { SlackOAuthService } from '../../core/auth/slack-oauth.service';
import { IntegrationManagerService } from '../../core/integration-manager.service';
import { TauriService } from '../../../core/tauri/tauri.service';

@Injectable({
  providedIn: 'root',
})
export class SlackIntegration extends BaseIntegration implements MessageProvider {
  public readonly id = 'slack';
  public readonly displayName = 'Slack';
  public readonly description = 'See recent direct messages and group DMs from Slack';
  public readonly category: IntegrationCategory = 'communication';
  public readonly icon = 'slack';
  public readonly supportedCapabilities: readonly CapabilityType[] = ['messages'] as const;
  public readonly hasInlineConnectUI = true;

  public readonly configFields: readonly ConnectionConfigField[] = [];

  public readonly authHandler: SlackAuthHandler;

  // Per-user profile cache keyed by Slack user ID. Slack API returns messages
  // with sender IDs only; we resolve display names lazily and cache to keep
  // fetchMessages under the Tier 3 rate limit (50/min).
  private userCache = new Map<string, SlackUser>();

  constructor(
    tokenStorage: TauriTokenStorageService,
    private injector: Injector,
    private tauri: TauriService,
    slackOAuth?: SlackOAuthService
  ) {
    super(tokenStorage);
    this.authHandler = new SlackAuthHandler(slackOAuth);
  }

  // ==========================================
  // MESSAGE PROVIDER CAPABILITY IMPLEMENTATION
  // ==========================================

  public async fetchMessages(
    connectionId: string,
    _filter?: MessageFilter
  ): Promise<UnifiedMessage[]> {
    const token = await this.getAccessToken(connectionId);
    if (!token) {
      throw new Error(`[Slack] No token found for connection "${connectionId}"`);
    }

    // Step 1: list all DM and group-DM conversations we're part of.
    const conversations = await this.listDmConversations(token);

    // Step 2: fetch latest message per conversation (capped to 20 DMs to
    // stay comfortably under rate limits — ~40 API calls per refresh worst
    // case including user info).
    const capped = conversations.slice(0, 20);
    const messages: UnifiedMessage[] = [];

    for (const conv of capped) {
      const latest = await this.fetchLatestInChannel(token, conv.id);
      if (!latest || !latest.text) continue;

      const senderName = await this.resolveSenderName(token, latest, conv);
      const config = this.getConnectionConfig(connectionId);
      messages.push(this.normalizeSlackMessage(latest, conv, senderName, connectionId, config));
    }

    // Sort newest first.
    messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return messages;
  }

  public async markAsRead(connectionId: string, messageId: string): Promise<void> {
    // messageId shape is "conv:ts" (see normalize). Slack's conversations.mark
    // needs channel + ts separately.
    const [channel, ts] = messageId.split(':');
    if (!channel || !ts) return;

    const token = await this.getAccessToken(connectionId);
    if (!token) return;

    const body = new URLSearchParams({ channel, ts }).toString();
    await this.slackPost(token, 'conversations.mark', body);
  }

  // ==========================================
  // DATA NORMALIZATION
  // ==========================================

  public normalizeSlackMessage(
    msg: SlackMessage,
    conv: SlackConversation,
    senderName: string,
    connectionId: string,
    config: Record<string, string>
  ): UnifiedMessage {
    // Slack ts is seconds.microseconds — convert to ISO.
    const seconds = parseFloat(msg.ts);
    const iso = isFinite(seconds) ? new Date(seconds * 1000).toISOString() : new Date().toISOString();

    const teamDomain = config['teamDomain'] || '';
    const teamId = config['teamId'] || '';
    const webUrl = teamDomain
      ? `https://${teamDomain}.slack.com/archives/${conv.id}/p${msg.ts.replace('.', '')}`
      : teamId
      ? `https://app.slack.com/client/${teamId}/${conv.id}`
      : undefined;

    // Subject line: for DMs use the sender's display name (that's what your
    // Slack sidebar shows); for group DMs / channels use the channel name.
    const subject = conv.is_im
      ? senderName || 'Direct message'
      : conv.name_normalized || conv.name || 'Group message';

    return {
      id: `slack:${conv.id}:${msg.ts}`,
      sourceId: `${conv.id}:${msg.ts}`,
      threadId: conv.id,
      providerId: this.id,
      connectionId,
      sender: {
        name: senderName || msg.user || 'Slack user',
        email: '',
      },
      subject,
      snippet: this.stripSlackFormatting(msg.text || ''),
      timestamp: iso,
      // Slack doesn't return an isRead flag from history — anything newer
      // than our last-refresh moment could be considered unread, but that's
      // stateful. Mark everything unread by default; user opens → mark read.
      isRead: false,
      webUrl,
      metadata: {
        channelId: conv.id,
        channelType: conv.is_im ? 'im' : conv.is_mpim ? 'mpim' : conv.is_group ? 'group' : 'channel',
        senderId: msg.user || '',
      },
    };
  }

  // ==========================================
  // INTERNALS
  // ==========================================

  private async listDmConversations(token: string): Promise<SlackConversation[]> {
    const data = await this.slackGet<SlackConversationsListResponse>(
      token,
      'conversations.list',
      'types=im,mpim&exclude_archived=true&limit=100'
    );
    if (!data.ok) {
      throw new Error(`Slack conversations.list error: ${data.error || 'unknown'}`);
    }
    return (data.channels || []).filter((c) => !c.is_archived);
  }

  private async fetchLatestInChannel(
    token: string,
    channelId: string
  ): Promise<SlackMessage | null> {
    const data = await this.slackGet<SlackHistoryResponse>(
      token,
      'conversations.history',
      `channel=${encodeURIComponent(channelId)}&limit=1`
    );
    if (!data.ok) return null;
    return data.messages?.[0] || null;
  }

  private async resolveSenderName(
    token: string,
    msg: SlackMessage,
    conv: SlackConversation
  ): Promise<string> {
    // Prefer the message's sender ID. For DMs, if sender is missing (system
    // messages), fall back to the conversation's other-user ID.
    const senderId = msg.user || conv.user;
    if (!senderId) return '';

    const cached = this.userCache.get(senderId);
    if (cached) return this.extractName(cached);

    try {
      const data = await this.slackGet<SlackUsersInfoResponse>(
        token,
        'users.info',
        `user=${encodeURIComponent(senderId)}`
      );
      if (!data.ok || !data.user) return senderId;
      this.userCache.set(senderId, data.user);
      return this.extractName(data.user);
    } catch {
      return senderId;
    }
  }

  // Slack's Web API doesn't serve CORS headers, so browser fetch() from the
  // Angular webview is blocked. Route through Rust (ureq) via Tauri commands.
  private async slackGet<T>(token: string, path: string, query: string): Promise<T> {
    const raw = await this.tauri.invokeCommand<string>('slack_api_get', {
      token,
      path,
      query,
    });
    return JSON.parse(raw) as T;
  }

  private async slackPost(token: string, path: string, body: string): Promise<string> {
    return this.tauri.invokeCommand<string>('slack_api_post', {
      token,
      path,
      body,
    });
  }

  private extractName(user: SlackUser): string {
    return (
      user.profile?.display_name?.trim() ||
      user.profile?.real_name?.trim() ||
      user.real_name?.trim() ||
      user.name?.trim() ||
      user.id
    );
  }

  /**
   * Strip Slack's mrkdwn shortcuts so snippets read like plain text in the
   * dock panel. Keeps user/channel mentions readable, removes URL brackets.
   */
  private stripSlackFormatting(text: string): string {
    return text
      // <@U123> or <@U123|name> → @name
      .replace(/<@([A-Z0-9]+)(?:\|([^>]+))?>/g, (_m, id, name) => `@${name || id}`)
      // <#C123|name> → #name
      .replace(/<#([A-Z0-9]+)(?:\|([^>]+))?>/g, (_m, _id, name) => `#${name || 'channel'}`)
      // <url|label> → label; <url> → url
      .replace(/<((?:https?|mailto:)[^|>]+)\|([^>]+)>/g, '$2')
      .replace(/<((?:https?|mailto:)[^>]+)>/g, '$1');
  }

  private getConnectionConfig(connectionId: string): Record<string, string> {
    const mgr = this.injector.get(IntegrationManagerService, null);
    return mgr?.getConnection(connectionId)?.config ?? {};
  }
}
