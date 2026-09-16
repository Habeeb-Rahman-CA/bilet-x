import { UnifiedMessage } from '../models/unified-message.model';
import { BaseCapabilityFilter } from './capability.types';

export interface MessageFilter extends BaseCapabilityFilter {
  unreadOnly?: boolean;
  folderOrLabel?: string;
  senderEmail?: string;
}

/**
 * Full body of a single message. `text` is always populated (HTML is stripped
 * down when the message only ships an `text/html` body); `html` is the raw
 * source and is provided so a UI can offer a "view rich HTML" toggle if it
 * wants to sanitize + render it itself.
 */
export interface UnifiedMessageBody {
  text: string;
  html?: string;
  hasHtml: boolean;
}

/**
 * MessageProvider capability contract.
 * Implemented by Gmail, Outlook, Slack, etc.
 */
export interface MessageProvider {
  /**
   * Fetch normalized messages/emails from the provider.
   */
  fetchMessages(connectionId: string, filter?: MessageFilter): Promise<UnifiedMessage[]>;

  /**
   * Optional: fetch the full body for a single message (for detail views).
   */
  fetchMessageBody?(connectionId: string, messageId: string): Promise<UnifiedMessageBody>;

  /**
   * Optional: mark a specific message as read.
   */
  markAsRead?(connectionId: string, messageId: string): Promise<void>;

  /**
   * Optional: star or flag a message.
   */
  toggleStarred?(connectionId: string, messageId: string, starred: boolean): Promise<void>;

  /**
   * Optional: send a new message or reply. When `threadId` /
   * `inReplyToHeader` are set, the implementation is responsible for
   * attaching it to the existing conversation; otherwise it's a fresh mail.
   */
  sendMessage?(connectionId: string, draft: MessageDraft): Promise<void>;
}

export interface MessageDraft {
  to: string;
  subject?: string;
  body: string;
  /** Provider-native thread identifier for replies. */
  threadId?: string;
  /** RFC-822 Message-ID of the original, used to set In-Reply-To/References. */
  inReplyToHeader?: string;
}
