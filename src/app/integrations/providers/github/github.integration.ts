import { Injectable } from '@angular/core';
import { BaseIntegration } from '../../core/base-integration';
import { TaskProvider, TaskFilter } from '../../core/capabilities/task-provider.interface';
import { CapabilityType, IntegrationCategory } from '../../core/capabilities/capability.types';
import { ConnectionConfigField } from '../../core/models/connection.model';
import { UnifiedTask, TaskStatus, TaskPriority } from '../../core/models/unified-task.model';
import { GitHubAuthHandler } from './github-auth';
import {
  GitHubIssue,
  GitHubComment,
  GitHubPullRequestDetail,
  GitHubMergeResult,
} from './github.models';
import { TauriTokenStorageService } from '../../core/auth/tauri-token-storage.service';
import { GitHubOAuthService } from '../../core/auth/github-oauth.service';

@Injectable({
  providedIn: 'root',
})
export class GitHubIntegration extends BaseIntegration implements TaskProvider {
  public readonly id = 'github';
  public readonly displayName = 'GitHub';
  public readonly description = 'Show issues and PRs assigned to you across all repositories';
  public readonly category: IntegrationCategory = 'developer';
  public readonly icon = 'github';
  public readonly supportedCapabilities: readonly CapabilityType[] = ['tasks'] as const;
  public readonly hasInlineConnectUI = true;

  // One-click OAuth: no user-editable config fields.
  public readonly configFields: readonly ConnectionConfigField[] = [];

  public readonly authHandler: GitHubAuthHandler;

  constructor(tokenStorage: TauriTokenStorageService, githubOAuth?: GitHubOAuthService) {
    super(tokenStorage);
    this.authHandler = new GitHubAuthHandler(githubOAuth);
  }

  // ==========================================
  // TASK PROVIDER CAPABILITY IMPLEMENTATION
  // ==========================================

  public async fetchTasks(connectionId: string, _filter?: TaskFilter): Promise<UnifiedTask[]> {
    const token = await this.getAuthToken(connectionId);

    // GitHub's /issues endpoint returns "issues assigned to the authenticated
    // user across all visible repositories" — exactly what we want. state=open
    // filters to non-closed items; sort=updated gives the freshest first.
    const url =
      'https://api.github.com/issues?state=open&filter=all&sort=updated&direction=desc&per_page=50';
    const res = await fetch(url, {
      headers: this.authHandler.getAuthHeaders({}, token),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new Error(
        `GitHub API HTTP Error: ${res.status} ${res.statusText}${bodyText ? ` — ${bodyText.slice(0, 200)}` : ''}`
      );
    }

    const issues: GitHubIssue[] = await res.json();
    return issues.map((issue) => this.normalizeGitHubIssue(issue, connectionId));
  }

  public async updateTaskStatus(
    connectionId: string,
    taskId: string,
    status: TaskStatus
  ): Promise<UnifiedTask> {
    // Check if taskId or sourceId matches "owner/repo#number"
    const match = taskId.match(/([^/]+\/[^#]+)#(\d+)/);
    if (match) {
      const repoFullName = match[1];
      const issueNumber = parseInt(match[2], 10);
      if (status === 'done') {
        await this.closeIssue(connectionId, repoFullName, issueNumber);
      } else {
        await this.reopenIssue(connectionId, repoFullName, issueNumber);
      }
    }

    return {
      id: `github:${taskId}`,
      sourceId: taskId,
      providerId: this.id,
      connectionId,
      title: `Issue ${taskId}`,
      status,
      priority: 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // ==========================================
  // GITHUB ISSUES & PRS EXTENDED OPERATIONS
  // ==========================================

  /**
   * Fetch comments for an issue or pull request.
   */
  public async fetchComments(
    connectionId: string,
    repoFullName: string,
    issueNumber: number
  ): Promise<GitHubComment[]> {
    const token = await this.getAuthToken(connectionId);
    const url = `https://api.github.com/repos/${encodeURI(repoFullName)}/issues/${issueNumber}/comments?per_page=100`;

    const res = await fetch(url, {
      headers: this.authHandler.getAuthHeaders({}, token),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Failed to fetch comments: ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 150)}` : ''}`
      );
    }

    return (await res.json()) as GitHubComment[];
  }

  /**
   * Post a comment to an issue or pull request.
   */
  public async addComment(
    connectionId: string,
    repoFullName: string,
    issueNumber: number,
    body: string
  ): Promise<GitHubComment> {
    const token = await this.getAuthToken(connectionId);
    const url = `https://api.github.com/repos/${encodeURI(repoFullName)}/issues/${issueNumber}/comments`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.authHandler.getAuthHeaders({}, token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Failed to post comment: ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 150)}` : ''}`
      );
    }

    return (await res.json()) as GitHubComment;
  }

  /**
   * Close a GitHub issue.
   */
  public async closeIssue(
    connectionId: string,
    repoFullName: string,
    issueNumber: number
  ): Promise<void> {
    const token = await this.getAuthToken(connectionId);
    const url = `https://api.github.com/repos/${encodeURI(repoFullName)}/issues/${issueNumber}`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        ...this.authHandler.getAuthHeaders({}, token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Failed to close issue: ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 150)}` : ''}`
      );
    }
  }

  /**
   * Reopen a GitHub issue.
   */
  public async reopenIssue(
    connectionId: string,
    repoFullName: string,
    issueNumber: number
  ): Promise<void> {
    const token = await this.getAuthToken(connectionId);
    const url = `https://api.github.com/repos/${encodeURI(repoFullName)}/issues/${issueNumber}`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        ...this.authHandler.getAuthHeaders({}, token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state: 'open', state_reason: 'reopened' }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Failed to reopen issue: ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 150)}` : ''}`
      );
    }
  }

  /**
   * Fetch pull request details (mergeability, branch head/base, diff stats).
   */
  public async fetchPullRequestDetail(
    connectionId: string,
    repoFullName: string,
    prNumber: number
  ): Promise<GitHubPullRequestDetail> {
    const token = await this.getAuthToken(connectionId);
    const url = `https://api.github.com/repos/${encodeURI(repoFullName)}/pulls/${prNumber}`;

    const res = await fetch(url, {
      headers: this.authHandler.getAuthHeaders({}, token),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Failed to fetch PR details: ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 150)}` : ''}`
      );
    }

    return (await res.json()) as GitHubPullRequestDetail;
  }

  /**
   * Merge a pull request.
   */
  public async mergePullRequest(
    connectionId: string,
    repoFullName: string,
    prNumber: number,
    commitTitle?: string,
    mergeMethod: 'merge' | 'squash' | 'rebase' = 'merge'
  ): Promise<GitHubMergeResult> {
    const token = await this.getAuthToken(connectionId);
    const url = `https://api.github.com/repos/${encodeURI(repoFullName)}/pulls/${prNumber}/merge`;

    const payload: Record<string, string> = {
      merge_method: mergeMethod,
    };
    if (commitTitle) {
      payload['commit_title'] = commitTitle;
    }

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        ...this.authHandler.getAuthHeaders({}, token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data.message || res.statusText;
      if (res.status === 405) {
        throw new Error(`Pull request cannot be merged: ${msg}`);
      }
      if (res.status === 409) {
        throw new Error(`Head branch was modified or has conflicts: ${msg}`);
      }
      throw new Error(`Merge failed (${res.status}): ${msg}`);
    }

    return {
      sha: data.sha,
      merged: !!data.merged,
      message: data.message || 'Pull request successfully merged.',
    };
  }

  /**
   * Close a pull request without merging.
   */
  public async closePullRequest(
    connectionId: string,
    repoFullName: string,
    prNumber: number
  ): Promise<void> {
    const token = await this.getAuthToken(connectionId);
    const url = `https://api.github.com/repos/${encodeURI(repoFullName)}/pulls/${prNumber}`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        ...this.authHandler.getAuthHeaders({}, token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state: 'closed' }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Failed to close pull request: ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 150)}` : ''}`
      );
    }
  }

  // ==========================================
  // DATA NORMALIZATION
  // ==========================================

  public normalizeGitHubIssue(issue: GitHubIssue, connectionId: string): UnifiedTask {
    const repoInfo = this.extractRepo(issue);
    const isPR = !!issue.pull_request;
    const normalizedStatus: TaskStatus = issue.state === 'closed' ? 'done' : 'todo';
    const priority: TaskPriority = this.inferPriorityFromLabels(issue.labels || []);
    const primaryAssignee = issue.assignee || issue.assignees?.[0];
    const sourceId = repoInfo.fullName
      ? `${repoInfo.fullName}#${issue.number}`
      : String(issue.number);

    return {
      id: `github:${sourceId}`,
      sourceId,
      providerId: this.id,
      connectionId,
      title: (isPR ? '[PR] ' : '') + issue.title,
      description: issue.body ?? '',
      status: normalizedStatus,
      statusRaw: issue.state,
      priority,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      webUrl: issue.html_url,
      assignee: primaryAssignee
        ? {
            name: primaryAssignee.login,
            avatarUrl: primaryAssignee.avatar_url,
          }
        : undefined,
      labels: (issue.labels || []).map((l) => l.name).filter(Boolean),
      project: repoInfo.fullName
        ? {
            id: repoInfo.fullName,
            name: repoInfo.name || repoInfo.fullName,
            key: repoInfo.fullName,
          }
        : undefined,
      metadata: {
        isPR: isPR ? 'true' : 'false',
        githubNumber: String(issue.number),
        repoFullName: repoInfo.fullName,
      },
    };
  }

  // ==========================================
  // INTERNALS
  // ==========================================

  private async getAuthToken(connectionId: string): Promise<string> {
    const token = await this.getAccessToken(connectionId);
    if (!token) {
      throw new Error(`[GitHub] No token found for connection "${connectionId}". Please sign in.`);
    }
    return token;
  }

  /**
   * The /issues endpoint sometimes embeds a `repository` object and sometimes
   * only exposes `repository_url` — normalize both shapes into { fullName, name }.
   */
  private extractRepo(issue: GitHubIssue): { fullName: string; name: string } {
    if (issue.repository?.full_name) {
      return {
        fullName: issue.repository.full_name,
        name: issue.repository.name || issue.repository.full_name.split('/').pop() || '',
      };
    }
    if (issue.repository_url) {
      // https://api.github.com/repos/{owner}/{name}
      const match = issue.repository_url.match(/\/repos\/([^/]+)\/([^/?#]+)/);
      if (match) {
        return { fullName: `${match[1]}/${match[2]}`, name: match[2] };
      }
    }
    return { fullName: '', name: '' };
  }

  private inferPriorityFromLabels(labels: { name: string }[]): TaskPriority {
    const names = labels.map((l) => l.name.toLowerCase());
    if (names.some((n) => n.includes('critical') || n.includes('blocker') || n.includes('p0'))) {
      return 'urgent';
    }
    if (
      names.some(
        (n) => n.includes('high') || n.includes('p1') || n.includes('urgent') || n.includes('bug')
      )
    ) {
      return 'high';
    }
    if (names.some((n) => n.includes('low') || n.includes('p3') || n.includes('minor'))) {
      return 'low';
    }
    return 'medium';
  }
}
