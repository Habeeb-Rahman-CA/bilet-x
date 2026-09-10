/**
 * Raw Gmail REST API models
 */
export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: {
    size?: number;
    data?: string;
  };
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet: string;
  historyId?: string;
  internalDate?: string;
  payload?: {
    partId?: string;
    mimeType?: string;
    filename?: string;
    headers: GmailHeader[];
    body?: {
      size?: number;
      data?: string;
    };
    parts?: GmailMessagePart[];
  };
  sizeEstimate?: number;
  raw?: string;
}

export interface GmailListMessagesResponse {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}
