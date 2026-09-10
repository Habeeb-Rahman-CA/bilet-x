import { Injectable, Injector } from '@angular/core';
import { BaseIntegration } from '../../core/base-integration';
import { TaskProvider, TaskFilter } from '../../core/capabilities/task-provider.interface';
import { NotificationProvider, NotificationFilter } from '../../core/capabilities/notification-provider.interface';
import { CapabilityType, IntegrationCategory } from '../../core/capabilities/capability.types';
import { ConnectionConfigField } from '../../core/models/connection.model';
import { UnifiedTask, TaskStatus, TaskPriority } from '../../core/models/unified-task.model';
import { UnifiedNotification } from '../../core/models/unified-notification.model';
import { JiraAuthHandler } from './jira-auth';
import { JiraIssue, JiraSearchResponse } from './jira.models';
import { TauriTokenStorageService } from '../../core/auth/tauri-token-storage.service';
import { JiraOAuthService } from '../../core/auth/jira-oauth.service';
import { IntegrationManagerService } from '../../core/integration-manager.service';

// Hard-coded "assigned to me, still open" — matches the one-click UX (no
// config form). If a future release exposes a JQL input, thread it through
// TaskFilter.query.
const DEFAULT_ASSIGNED_JQL =
  'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC';

@Injectable({
  providedIn: 'root',
})
export class JiraIntegration extends BaseIntegration implements TaskProvider, NotificationProvider {
  public readonly id = 'jira';
  public readonly displayName = 'Jira Cloud';
  public readonly description = 'Sync Jira issues assigned to you';
  public readonly category: IntegrationCategory = 'tasks';
  public readonly icon = 'jira';
  public readonly supportedCapabilities: readonly CapabilityType[] = ['tasks', 'notifications'] as const;
  public readonly hasInlineConnectUI = true;

  // One-click OAuth: no user-editable config fields. cloudId + siteUrl are
  // discovered during sign-in and persisted on UserConnection.config via the
  // AuthResult.configMetadata path.
  public readonly configFields: readonly ConnectionConfigField[] = [];

  public readonly authHandler: JiraAuthHandler;

  constructor(
    tokenStorage: TauriTokenStorageService,
    private injector: Injector,
    jiraOAuth?: JiraOAuthService
  ) {
    super(tokenStorage);
    this.authHandler = new JiraAuthHandler(jiraOAuth);
  }

  // ==========================================
  // TASK PROVIDER CAPABILITY IMPLEMENTATION
  // ==========================================

  public async fetchTasks(connectionId: string, filter?: TaskFilter): Promise<UnifiedTask[]> {
    const config = this.getConnectionConfig(connectionId);
    const cloudId = config['cloudId'];
    if (!cloudId) {
      throw new Error(
        '[Jira] Missing cloudId on connection. Sign out and sign in again to re-discover your Jira site.'
      );
    }

    const jql = filter?.query?.trim() || DEFAULT_ASSIGNED_JQL;
    const issues = await this.callJiraWithRetry(connectionId, (token) =>
      this.fetchJiraIssuesApi(cloudId, token, jql)
    );
    const siteUrl = config['siteUrl'] || '';
    return issues.map((issue) => this.normalizeJiraIssue(issue, connectionId, siteUrl));
  }

  public async updateTaskStatus(
    connectionId: string,
    taskId: string,
    status: TaskStatus
  ): Promise<UnifiedTask> {
    // Transition API not wired up in this pass — return a shallow local
    // update so the UI can echo the change optimistically.
    return {
      id: `jira:${taskId}`,
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

  // ==================================================
  // NOTIFICATION PROVIDER CAPABILITY IMPLEMENTATION
  // ==================================================

  public async fetchNotifications(
    _connectionId: string,
    _filter?: NotificationFilter
  ): Promise<UnifiedNotification[]> {
    // No live Jira notifications feed yet — return empty so the aggregator
    // doesn't surface stale mock entries.
    return [];
  }

  // ==========================================
  // DATA NORMALIZATION
  // ==========================================

  public normalizeJiraIssue(
    issue: JiraIssue,
    connectionId: string,
    siteUrl: string
  ): UnifiedTask {
    const cleanSite = siteUrl.replace(/\/+$/, '');
    const categoryKey = issue.fields.status?.statusCategory?.key;

    let normalizedStatus: TaskStatus = 'todo';
    if (categoryKey === 'done' || issue.fields.status?.name?.toLowerCase().includes('done')) {
      normalizedStatus = 'done';
    } else if (
      categoryKey === 'indeterminate' ||
      issue.fields.status?.name?.toLowerCase().includes('progress')
    ) {
      normalizedStatus = 'in_progress';
    } else if (issue.fields.status?.name?.toLowerCase().includes('review')) {
      normalizedStatus = 'in_review';
    }

    const priorityName = issue.fields.priority?.name?.toLowerCase() || 'medium';
    let normalizedPriority: TaskPriority = 'medium';
    if (priorityName.includes('blocker') || priorityName.includes('urgent')) {
      normalizedPriority = 'urgent';
    } else if (priorityName.includes('high') || priorityName.includes('critical')) {
      normalizedPriority = 'high';
    } else if (priorityName.includes('low') || priorityName.includes('lowest')) {
      normalizedPriority = 'low';
    }

    return {
      id: `jira:${issue.key}`,
      sourceId: issue.key,
      providerId: this.id,
      connectionId,
      title: issue.fields.summary,
      description: typeof issue.fields.description === 'string' ? issue.fields.description : '',
      status: normalizedStatus,
      statusRaw: issue.fields.status?.name,
      priority: normalizedPriority,
      priorityRaw: issue.fields.priority?.name,
      dueDate: issue.fields.duedate,
      createdAt: issue.fields.created || new Date().toISOString(),
      updatedAt: issue.fields.updated || new Date().toISOString(),
      webUrl: cleanSite ? `${cleanSite}/browse/${issue.key}` : undefined,
      assignee: issue.fields.assignee
        ? {
            name: issue.fields.assignee.displayName,
            email: issue.fields.assignee.emailAddress,
            avatarUrl: issue.fields.assignee.avatarUrls?.['24x24'],
          }
        : undefined,
      labels: issue.fields.labels,
      project: issue.fields.project
        ? {
            id: issue.fields.project.id,
            name: issue.fields.project.name,
            key: issue.fields.project.key,
          }
        : undefined,
      metadata: {
        rawStatusCategory: categoryKey,
      },
    };
  }

  // ==========================================
  // INTERNALS
  // ==========================================

  /**
   * Run a Jira API call with automatic token refresh on 401. Mirrors
   * GmailIntegration.callGmailWithRetry — Atlassian access tokens are
   * short-lived and getValidAccessToken already refreshes proactively when
   * nearing expiry, but a stale token can still slip through a race.
   */
  private async callJiraWithRetry<T>(
    connectionId: string,
    fn: (token: string) => Promise<T>
  ): Promise<T> {
    const config = this.getConnectionConfig(connectionId);
    const token = await this.getValidAccessToken(connectionId, config);
    if (!token) {
      throw new Error(`[Jira] No token found for connection "${connectionId}"`);
    }

    try {
      return await fn(token);
    } catch (err) {
      if (!isUnauthorized(err)) throw err;

      const refreshed = await this.forceRefresh(connectionId, config);
      if (!refreshed) {
        throw new Error(
          'Atlassian session expired and could not be refreshed. Please sign in again.'
        );
      }
      return fn(refreshed);
    }
  }

  private async fetchJiraIssuesApi(
    cloudId: string,
    token: string,
    jql: string
  ): Promise<JiraIssue[]> {
    // Atlassian deprecated /rest/api/3/search (HTTP 410 as of 2025). The
    // replacement is /rest/api/3/search/jql with a token-based paginator; the
    // per-issue shape (id, key, fields) is unchanged so our normalizer works
    // as-is. We only pull the first page (up to 50 open issues) — plenty for a
    // dock badge.
    const fields = 'summary,status,priority,assignee,labels,project,created,updated,duedate';
    const url = `https://api.atlassian.com/ex/jira/${encodeURIComponent(cloudId)}/rest/api/3/search/jql?jql=${encodeURIComponent(
      jql
    )}&maxResults=50&fields=${encodeURIComponent(fields)}`;

    const res = await fetch(url, {
      headers: this.authHandler.getAuthHeaders({}, token),
    });

    if (res.status === 401) {
      throw new JiraApiError('Unauthorized', 401);
    }
    if (!res.ok) {
      throw new JiraApiError(
        `Jira API HTTP Error: ${res.status} ${res.statusText}`,
        res.status
      );
    }

    const data: JiraSearchResponse = await res.json();
    return data.issues || [];
  }

  /**
   * Look up the UserConnection's stored config (cloudId, siteUrl, siteName)
   * from the manager. Resolved lazily through the Injector to avoid an
   * eager import cycle (Manager → Registry → integrations at bootstrap).
   */
  private getConnectionConfig(connectionId: string): Record<string, string> {
    const mgr = this.injector.get(IntegrationManagerService, null);
    return mgr?.getConnection(connectionId)?.config ?? {};
  }
}

class JiraApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'JiraApiError';
  }
}

function isUnauthorized(err: unknown): boolean {
  if (err instanceof JiraApiError) return err.status === 401;
  const message = (err as any)?.message || '';
  return typeof message === 'string' && message.includes('401');
}
