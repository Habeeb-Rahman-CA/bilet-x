/**
 * Unified Notification model for notifications providers
 */
export interface UnifiedNotification {
  id: string;
  sourceId: string;
  providerId: string;
  connectionId?: string;
  title: string;
  message: string;
  timestamp: string; // ISO string
  isRead: boolean;
  priority?: 'low' | 'normal' | 'urgent';
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}
