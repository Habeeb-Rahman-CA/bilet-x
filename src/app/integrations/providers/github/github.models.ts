/**
 * Raw GitHub REST API models — the subset we consume from
 * https://api.github.com/issues.
 */
export interface GitHubUserRef {
  login: string;
  id?: number;
  avatar_url?: string;
  html_url?: string;
}

export interface GitHubLabel {
  id?: number;
  name: string;
  color?: string;
}

export interface GitHubRepositoryRef {
  id?: number;
  name?: string;
  full_name?: string;
  html_url?: string;
  owner?: GitHubUserRef;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body?: string | null;
  state: 'open' | 'closed';
  html_url: string;
  repository_url?: string;
  repository?: GitHubRepositoryRef;
  user?: GitHubUserRef;
  assignee?: GitHubUserRef | null;
  assignees?: GitHubUserRef[];
  labels?: GitHubLabel[];
  created_at: string;
  updated_at: string;
  pull_request?: unknown; // Presence indicates issue is actually a PR
}
