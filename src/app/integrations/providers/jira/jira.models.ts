/**
 * Raw Jira REST API models
 */
export interface JiraUser {
  accountId?: string;
  displayName: string;
  emailAddress?: string;
  avatarUrls?: Record<string, string>;
}

export interface JiraPriority {
  id: string;
  name: string;
  iconUrl?: string;
}

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory?: {
    id: number;
    key: string; // 'new' | 'indeterminate' | 'done'
    name: string;
  };
}

export interface JiraIssueFields {
  summary: string;
  description?: string | { content?: any[] };
  created: string;
  updated: string;
  duedate?: string;
  status: JiraStatus;
  priority?: JiraPriority;
  assignee?: JiraUser;
  labels?: string[];
  project?: {
    id: string;
    key: string;
    name: string;
  };
}

export interface JiraIssue {
  id: string;
  key: string; // e.g. "PROJ-123"
  self: string;
  fields: JiraIssueFields;
}

export interface JiraSearchResponse {
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}
