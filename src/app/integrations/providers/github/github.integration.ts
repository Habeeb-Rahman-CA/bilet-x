import { Injectable } from '@angular/core';
import { BaseIntegration } from '../../core/base-integration';
import { TaskProvider, TaskFilter } from '../../core/capabilities/task-provider.interface';
import { CapabilityType, IntegrationCategory } from '../../core/capabilities/capability.types';
import { ConnectionConfigField } from '../../core/models/connection.model';
import { UnifiedTask, TaskStatus, TaskPriority } from '../../core/models/unified-task.model';
import { GitHubAuthHandler } from './github-auth';
import { GitHubIssue } from './github.models';
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

  constructor(
    tokenStorage: TauriTokenStorageService,
    githubOAuth?: GitHubOAuthService
  ) {
    super(tokenStorage);
    this.authHandler = new GitHubAuthHandler(githubOAuth);
  }

  // ==========================================
  // TASK PROVIDER CAPABILITY IMPLEMENTATION
  // ==========================================

  public async fetchTasks(connectionId: string, _filter?: TaskFilter): Promise<UnifiedTask[]> {
    const token = await this.getAccessToken(connectionId);
    if (!token) {
      throw new Error(`[GitHub] No token found for connection "${connectionId}"`);
    }

    // GitHub's /issues endpoint returns "issues assigned to the authenticated
    // user across all visible repositories" — exactly what we want. state=open
    // filters to non-closed items; sort=updated gives the freshest first.
    const url =
      'https://api.github.com/issues?state=open&filter=assigned&sort=updated&direction=desc&per_page=50';
    const res = await fetch(url, {
      headers: this.authHandler.getAuthHeaders({}, token),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new Error(`GitHub API HTTP Error: ${res.status} ${res.statusText}${bodyText ? ` — ${bodyText.slice(0, 200)}` : ''}`);
    }

    const issues: GitHubIssue[] = await res.json();
    return issues.map((issue) => this.normalizeGitHubIssue(issue, connectionId));
  }

  public async updateTaskStatus(
    connectionId: string,
    taskId: string,
    status: TaskStatus
  ): Promise<UnifiedTask> {
    // GitHub issue close/reopen would use PATCH on
    // /repos/{owner}/{repo}/issues/{number} — not wired up in this pass.
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
      },
    };
  }

  // ==========================================
  // INTERNALS
  // ==========================================

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
    if (names.some((n) => n.includes('high') || n.includes('important') || n.includes('p1'))) {
      return 'high';
    }
    if (names.some((n) => n.includes('low') || n.includes('minor') || n.includes('p3') || n.includes('p4'))) {
      return 'low';
    }
    return 'medium';
  }
}
