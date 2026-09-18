import { Injectable, Injector } from '@angular/core';
import { BaseIntegration } from '../../core/base-integration';
import {
  MessageProvider,
  MessageFilter,
  MessageDraft,
} from '../../core/capabilities/message-provider.interface';
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
  SlackChatMessage,
  SlackPostMessageResponse,
} from './slack.models';
import { TauriTokenStorageService } from '../../core/auth/tauri-token-storage.service';
import { SlackOAuthService } from '../../core/auth/slack-oauth.service';
import { IntegrationManagerService } from '../../core/integration-manager.service';
import { TauriService } from '../../../core/tauri/tauri.service';
import { PersistenceService } from '../../../core/tauri/persistence.service';

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

  private readMessageIds = new Set<string>();
  private persistenceLoaded = false;

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

    const config = this.getConnectionConfig(connectionId);
    const currentUserId = await this.getCurrentUserId(token, config);

    // Step 1: list all DM and group-DM conversations we're part of.
    const conversations = await this.listDmConversations(token);

    // Step 2: fetch recent messages per conversation (capped to 20 DMs to
    // stay comfortably under rate limits).
    const capped = conversations.slice(0, 20);
    const messages: UnifiedMessage[] = [];

    for (const conv of capped) {
      // In a 1:1 DM, conv.user is the other user's ID
      const partnerName =
        conv.is_im && conv.user
          ? await this.resolveUserName(token, conv.user)
          : conv.name_normalized ||
            conv.name ||
            (conv.is_mpim ? 'Group message' : 'Direct message');

      const history = await this.fetchRecentInChannel(token, conv.id, 8);
      if (!history || history.length === 0) continue;

      // Filter to legitimate text messages
      const validMessages = history.filter(
        (m) => m.text && (!m.subtype || m.subtype === 'bot_message')
      );
      if (validMessages.length === 0) continue;

      // Separate incoming messages from messages sent by current user
      const incoming = validMessages.filter(
        (m) => m.user && currentUserId && m.user !== currentUserId
      );

      // If there are incoming messages from the contact, include up to 3 newest.
      // If ALL recent messages were sent by the user, include the latest one with "You: ...".
      const messagesToInclude: SlackMessage[] =
        incoming.length > 0 ? incoming.slice(0, 3) : [validMessages[0]];

      for (const msg of messagesToInclude) {
        const isFromMe = !!currentUserId && msg.user === currentUserId;
        let senderDisplayName: string;

        if (conv.is_im) {
          // For 1:1 DM, the conversation item is ALWAYS labeled with the partner/contact name
          senderDisplayName = partnerName || 'Direct message';
        } else {
          // For group DM, show the person who sent the message (or "You")
          senderDisplayName = isFromMe
            ? 'You'
            : msg.user
            ? await this.resolveUserName(token, msg.user)
            : partnerName;
        }

        messages.push(
          this.normalizeSlackMessage(
            msg,
            conv,
            senderDisplayName,
            partnerName,
            isFromMe,
            connectionId,
            config
          )
        );
      }
    }

    // Sort newest first.
    messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return messages;
  }

  private ensureReadIdsLoaded(): void {
    if (this.persistenceLoaded) return;
    this.persistenceLoaded = true;
    try {
      const persistence = this.injector.get(PersistenceService, null);
      const raw = persistence?.getSettingValue('slack_read_messages', '[]');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((id: string) => this.readMessageIds.add(id));
        }
      }
    } catch {}
  }

  private saveReadMessageIds(): void {
    try {
      const persistence = this.injector.get(PersistenceService, null);
      const arr = Array.from(this.readMessageIds).slice(-500);
      persistence?.setSetting('slack_read_messages', JSON.stringify(arr));
    } catch {}
  }

  public async markAsRead(connectionId: string, messageId: string): Promise<void> {
    this.ensureReadIdsLoaded();
    const [channel, ts] = messageId.split(':');
    if (ts) this.readMessageIds.add(ts);
    if (channel) this.readMessageIds.add(channel);
    this.readMessageIds.add(messageId);
    this.saveReadMessageIds();

    const token = await this.getAccessToken(connectionId);
    if (!token) return;

    try {
      const body = new URLSearchParams({ channel, ts }).toString();
      await this.slackPost(token, 'conversations.mark', body);
    } catch {
      // Remote mark may fail if token lacks im:write scope, which is fine since we persist locally
    }
  }

  // ==========================================
  // DATA NORMALIZATION
  // ==========================================

  public normalizeSlackMessage(
    msg: SlackMessage,
    conv: SlackConversation,
    senderDisplayName: string,
    partnerName: string,
    isFromMe: boolean,
    connectionId: string,
    config: Record<string, string>
  ): UnifiedMessage {
    this.ensureReadIdsLoaded();

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

    // Subject line: for DMs use the contact's display name; for group DMs use channel name.
    const subject = conv.is_im
      ? partnerName || 'Direct message'
      : conv.name_normalized || conv.name || 'Group message';

    const rawSnippet = this.stripSlackFormatting(msg.text || '');
    const snippet = isFromMe ? `You: ${rawSnippet}` : rawSnippet;

    const isLocallyRead =
      this.readMessageIds.has(msg.ts) ||
      this.readMessageIds.has(`${conv.id}:${msg.ts}`) ||
      this.readMessageIds.has(conv.id);
    const isRead = isFromMe || isLocallyRead;

    return {
      id: `slack:${conv.id}:${msg.ts}`,
      sourceId: `${conv.id}:${msg.ts}`,
      threadId: conv.id,
      providerId: this.id,
      connectionId,
      sender: {
        name: senderDisplayName || 'Slack user',
        email: '',
      },
      subject,
      snippet,
      timestamp: iso,
      isRead,
      webUrl,
      metadata: {
        channelId: conv.id,
        channelType: conv.is_im ? 'im' : conv.is_mpim ? 'mpim' : conv.is_group ? 'group' : 'channel',
        senderId: msg.user || '',
        partnerName,
        isFromMe: isFromMe ? 'true' : 'false',
      },
    };
  }

  /**
   * Fetch recent conversation messages for an in-widget chat detail view.
   * Sorted chronologically (oldest at top, newest at bottom).
   */
  public async fetchConversationHistory(
    connectionId: string,
    channelId: string,
    limit = 30
  ): Promise<SlackChatMessage[]> {
    const token = await this.getAccessToken(connectionId);
    if (!token) {
      throw new Error(`[Slack] No token found for connection "${connectionId}"`);
    }

    const config = this.getConnectionConfig(connectionId);
    const currentUserId = await this.getCurrentUserId(token, config);

    const history = await this.fetchRecentInChannel(token, channelId, limit);
    if (!history || history.length === 0) return [];

    const validMessages = history.filter(
      (m) => m.text && (!m.subtype || m.subtype === 'bot_message')
    );

    const result: SlackChatMessage[] = [];
    for (const msg of validMessages) {
      const isFromMe = !!currentUserId && msg.user === currentUserId;
      let senderName = isFromMe ? 'You' : 'Slack user';
      let avatarUrl: string | undefined;

      if (msg.user) {
        const user = await this.getUser(token, msg.user);
        if (user) {
          if (!isFromMe) {
            senderName = this.extractName(user);
          }
          avatarUrl = user.profile?.image_48 || user.profile?.image_72;
        }
      }

      const rawText = msg.text || '';
      const text = this.stripSlackFormatting(rawText);
      const tsNum = parseFloat(msg.ts) * 1000;
      const timestamp = !isNaN(tsNum) ? new Date(tsNum).toISOString() : new Date().toISOString();

      result.push({
        id: msg.ts,
        ts: msg.ts,
        channelId,
        senderId: msg.user || '',
        senderName,
        avatarUrl,
        text,
        rawText,
        timestamp,
        isFromMe,
        threadTs: msg.thread_ts,
        replyCount: msg.reply_count,
      });
    }

    // Sort chronologically (oldest at top, newest at bottom for chat)
    result.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
    return result;
  }

  /**
   * Post a message to a Slack channel / conversation.
   */
  public async postChatMessage(
    connectionId: string,
    channelId: string,
    text: string,
    threadTs?: string
  ): Promise<SlackChatMessage> {
    const token = await this.getAccessToken(connectionId);
    if (!token) {
      throw new Error(`[Slack] No token found for connection "${connectionId}"`);
    }

    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('Message text cannot be empty.');
    }

    const config = this.getConnectionConfig(connectionId);
    const currentUserId = await this.getCurrentUserId(token, config);

    const payload: Record<string, any> = {
      channel: channelId,
      text: trimmed,
    };
    if (threadTs) {
      payload['thread_ts'] = threadTs;
    }

    let raw: string;
    try {
      raw = await this.slackPost(token, 'chat.postMessage', JSON.stringify(payload));
    } catch (err: any) {
      throw new Error(`Slack post failed: ${err?.message || err}`);
    }

    let res: SlackPostMessageResponse;
    try {
      res = JSON.parse(raw);
    } catch {
      throw new Error('Failed to parse Slack response.');
    }

    if (!res.ok) {
      if (res.error === 'missing_scope' || res.error === 'not_allowed_token_type') {
        throw new Error(
          'Missing permission (chat:write). Please disconnect and reconnect Slack to allow sending messages.'
        );
      }
      throw new Error(`Slack send error: ${res.error || 'unknown'}`);
    }

    const msgTs = res.ts || (Date.now() / 1000).toFixed(6);
    const tsNum = parseFloat(msgTs) * 1000;
    const timestamp = !isNaN(tsNum) ? new Date(tsNum).toISOString() : new Date().toISOString();

    return {
      id: msgTs,
      ts: msgTs,
      channelId,
      senderId: currentUserId,
      senderName: 'You',
      text: this.stripSlackFormatting(trimmed),
      rawText: trimmed,
      timestamp,
      isFromMe: true,
      threadTs: threadTs || res.message?.thread_ts,
    };
  }

  /**
   * Capability implementation for MessageProvider.sendMessage
   */
  public async sendMessage(connectionId: string, draft: MessageDraft): Promise<void> {
    const channelId = draft.to || draft.threadId;
    if (!channelId) {
      throw new Error('Slack channel or recipient ID is required.');
    }
    await this.postChatMessage(connectionId, channelId, draft.body, draft.threadId);
  }

  // ==========================================
  // INTERNALS
  // ==========================================

  private async getCurrentUserId(token: string, config: Record<string, string>): Promise<string> {
    if (config['userId']) return config['userId'];
    try {
      const res = await this.slackGet<{ ok: boolean; user_id?: string }>(token, 'auth.test', '');
      if (res.ok && res.user_id) return res.user_id;
    } catch {}
    return '';
  }

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

  private async fetchRecentInChannel(
    token: string,
    channelId: string,
    limit = 8
  ): Promise<SlackMessage[]> {
    const data = await this.slackGet<SlackHistoryResponse>(
      token,
      'conversations.history',
      `channel=${encodeURIComponent(channelId)}&limit=${limit}`
    );
    if (!data.ok || !data.messages) return [];
    return data.messages;
  }

  private async getUser(token: string, userId?: string): Promise<SlackUser | null> {
    if (!userId) return null;

    const cached = this.userCache.get(userId);
    if (cached) return cached;

    try {
      const data = await this.slackGet<SlackUsersInfoResponse>(
        token,
        'users.info',
        `user=${encodeURIComponent(userId)}`
      );
      if (!data.ok || !data.user) return null;
      this.userCache.set(userId, data.user);
      return data.user;
    } catch {
      return null;
    }
  }

  private async resolveUserName(token: string, userId?: string): Promise<string> {
    if (!userId) return '';
    const user = await this.getUser(token, userId);
    return user ? this.extractName(user) : userId;
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
