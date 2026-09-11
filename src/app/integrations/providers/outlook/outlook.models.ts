/**
 * Raw Microsoft Graph mail models — the subset we consume from
 * https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages
 */
export interface GraphEmailAddress {
  name?: string;
  address?: string;
}

export interface GraphRecipient {
  emailAddress?: GraphEmailAddress;
}

export interface GraphFlag {
  flagStatus?: 'notFlagged' | 'complete' | 'flagged';
}

export interface OutlookMessage {
  id: string;
  conversationId?: string;
  subject?: string | null;
  bodyPreview?: string;
  from?: GraphRecipient;
  sender?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  receivedDateTime: string; // ISO
  sentDateTime?: string;
  isRead: boolean;
  hasAttachments?: boolean;
  flag?: GraphFlag;
  webLink?: string;
  categories?: string[];
}

export interface OutlookListResponse {
  value: OutlookMessage[];
  '@odata.nextLink'?: string;
}
