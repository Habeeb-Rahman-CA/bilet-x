/**
 * Raw GitHub REST API models — the subset we consume from
 * https://api.github.com/issues and https://api.github.com/pulls.
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
  state_reason?: string | null;
  html_url: string;
  repository_url?: string;
  repository?: GitHubRepositoryRef;
  user?: GitHubUserRef;
  assignee?: GitHubUserRef | null;
  assignees?: GitHubUserRef[];
  labels?: GitHubLabel[];
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  pull_request?: unknown; // Presence indicates issue is actually a PR
  comments?: number;
}

export interface GitHubComment {
  id: number;
  user: GitHubUserRef;
  body: string;
  created_at: string;
  updated_at?: string;
  html_url?: string;
}

export interface GitHubBranchRef {
  label?: string;
  ref: string;
  sha: string;
  user?: GitHubUserRef;
  repo?: GitHubRepositoryRef;
}

export interface GitHubPullRequestDetail {
  id: number;
  number: number;
  title: string;
  body?: string | null;
  state: 'open' | 'closed';
  merged: boolean;
  mergeable: boolean | null;
  mergeable_state?: string; // 'clean', 'dirty', 'blocked', 'behind', 'unstable', 'has_hooks', 'unknown'
  merged_at?: string | null;
  closed_at?: string | null;
  merged_by?: GitHubUserRef | null;
  head: GitHubBranchRef;
  base: GitHubBranchRef;
  user?: GitHubUserRef;
  comments?: number;
  commits?: number;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubMergeResult {
  sha?: string;
  merged: boolean;
  message: string;
}
