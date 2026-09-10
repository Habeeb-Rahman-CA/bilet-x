import { UnifiedMessage } from '../models/unified-message.model';
import { BaseCapabilityFilter } from './capability.types';

export interface MessageFilter extends BaseCapabilityFilter {
  unreadOnly?: boolean;
  folderOrLabel?: string;
  senderEmail?: string;
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
   * Optional: mark a specific message as read.
   */
  markAsRead?(connectionId: string, messageId: string): Promise<void>;

  /**
   * Optional: star or flag a message.
   */
  toggleStarred?(connectionId: string, messageId: string, starred: boolean): Promise<void>;
}
