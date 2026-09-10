import { UnifiedNotification } from '../models/unified-notification.model';
import { BaseCapabilityFilter } from './capability.types';

export interface NotificationFilter extends BaseCapabilityFilter {
  unreadOnly?: boolean;
}

/**
 * NotificationProvider capability contract.
 * Implemented by Jira, GitHub, Slack, Linear, etc.
 */
export interface NotificationProvider {
  fetchNotifications(connectionId: string, filter?: NotificationFilter): Promise<UnifiedNotification[]>;
  markNotificationAsRead?(connectionId: string, id: string): Promise<void>;
}
