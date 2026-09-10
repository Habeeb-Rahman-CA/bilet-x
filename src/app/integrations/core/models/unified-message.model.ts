/**
 * Unified Message model representing a normalized email/message across all communication providers
 * (e.g., Gmail, Outlook, Slack, etc.)
 */
export interface UnifiedMessage {
  id: string; // Unique global ID e.g. "gmail:18f3a9b1c"
  sourceId: string; // Original ID from provider
  threadId?: string;
  providerId: string; // Provider ID e.g. "gmail"
  connectionId?: string;
  sender: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
  recipients?: string[];
  subject: string;
  snippet: string;
  bodyPreview?: string;
  timestamp: string; // ISO date string
  isRead: boolean;
  isStarred?: boolean;
  hasAttachments?: boolean;
  labels?: string[];
  webUrl?: string; // Direct link to open in webmail/client
  metadata?: Record<string, unknown>;
}
