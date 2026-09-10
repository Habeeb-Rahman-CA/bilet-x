import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Injector } from '@angular/core';
import { IntegrationRegistryService } from './core/integration-registry.service';
import { IntegrationManagerService } from './core/integration-manager.service';
import { JiraIntegration } from './providers/jira/jira.integration';
import { GmailIntegration } from './providers/gmail/gmail.integration';
import { BaseIntegration } from './core/base-integration';
import { TaskProvider } from './core/capabilities/task-provider.interface';
import { MessageProvider } from './core/capabilities/message-provider.interface';
import { UnifiedTask } from './core/models/unified-task.model';
import { UnifiedMessage } from './core/models/unified-message.model';
import { TokenStorage } from './core/auth/token-storage.interface';
import { AuthHandler } from './core/auth/auth-handler.interface';
import { CapabilityType } from './core/capabilities/capability.types';
import { JiraOAuthService } from './core/auth/jira-oauth.service';

// In-memory mock token storage for isolated unit testing
class MockTokenStorage implements TokenStorage {
  private store = new Map<string, string>();
  async setToken(connectionId: string, token: string): Promise<void> {
    this.store.set(connectionId, token);
  }
  async getToken(connectionId: string): Promise<string | null> {
    return this.store.get(connectionId) || null;
  }
  async deleteToken(connectionId: string): Promise<void> {
    this.store.delete(connectionId);
  }
  async hasToken(connectionId: string): Promise<boolean> {
    return this.store.has(connectionId);
  }
}

// Mock persistence service
class MockPersistenceService {
  private settings = new Map<string, string>();
  getSettingValue(key: string, defaultValue: string = ''): string {
    return this.settings.get(key) || defaultValue;
  }
  async setSetting(key: string, value: string): Promise<boolean> {
    this.settings.set(key, value);
    return true;
  }
}

// Fake OAuth service that skips the real browser flow. Used so we can
// exercise the OAuth-only Jira integration in unit tests without opening a
// browser or hitting Atlassian.
class MockJiraOAuthService implements Partial<JiraOAuthService> {
  isAvailable() { return true; }
  async login() {
    return {
      accessToken: 'jira_access_123',
      refreshToken: 'jira_refresh_456',
      expiresIn: 3600,
      email: 'dev@acme.com',
      displayName: 'Dev Acme',
      cloudId: 'cloud-abc',
      siteUrl: 'https://acme.atlassian.net',
      siteName: 'acme',
    };
  }
  async refresh() {
    return { accessToken: 'jira_access_refreshed', refreshToken: 'jira_refresh_456', expiresIn: 3600 };
  }
}

describe('Pluggable Integration Architecture', () => {
  let registry: IntegrationRegistryService;
  let manager: IntegrationManagerService;
  let tokenStorage: MockTokenStorage;
  let persistence: MockPersistenceService;
  let jira: JiraIntegration;
  let gmail: GmailIntegration;
  let jiraOAuth: MockJiraOAuthService;
  let injector: Injector;

  beforeEach(() => {
    registry = new IntegrationRegistryService();
    tokenStorage = new MockTokenStorage();
    persistence = new MockPersistenceService();
    jiraOAuth = new MockJiraOAuthService();
    manager = new IntegrationManagerService(
      registry,
      persistence as any,
      tokenStorage as any
    );
    // Minimal injector that only knows how to resolve IntegrationManagerService —
    // enough for JiraIntegration.getConnectionConfig() to find the connection.
    injector = Injector.create({
      providers: [{ provide: IntegrationManagerService, useValue: manager }],
    });
    jira = new JiraIntegration(tokenStorage as any, injector, jiraOAuth as any);
    gmail = new GmailIntegration(tokenStorage as any);
  });

  describe('1. Capability-Based Isolation', () => {
    it('Jira should only support tasks and notifications capabilities', () => {
      expect(jira.hasCapability('tasks')).toBe(true);
      expect(jira.hasCapability('notifications')).toBe(true);
      expect(jira.hasCapability('messages')).toBe(false);
      expect(jira.hasCapability('calendar')).toBe(false);

      const taskCap = jira.getCapability<TaskProvider>('tasks');
      expect(taskCap).toBeDefined();
      expect(typeof taskCap?.fetchTasks).toBe('function');

      const msgCap = jira.getCapability<MessageProvider>('messages');
      expect(msgCap).toBeNull();
    });

    it('Gmail should only support messages capability', () => {
      expect(gmail.hasCapability('messages')).toBe(true);
      expect(gmail.hasCapability('tasks')).toBe(false);
      expect(gmail.hasCapability('calendar')).toBe(false);

      const msgCap = gmail.getCapability<MessageProvider>('messages');
      expect(msgCap).toBeDefined();
      expect(typeof msgCap?.fetchMessages).toBe('function');

      const taskCap = gmail.getCapability<TaskProvider>('tasks');
      expect(taskCap).toBeNull();
    });
  });

  describe('2. Integration Registry', () => {
    beforeEach(() => {
      registry.register(jira);
      registry.register(gmail);
    });

    it('should register and retrieve providers by ID', () => {
      expect(registry.getAll().length).toBe(2);
      expect(registry.get('jira')).toBe(jira);
      expect(registry.get('gmail')).toBe(gmail);
    });

    it('should discover providers by capability', () => {
      const taskProviders = registry.getByCapability('tasks');
      expect(taskProviders.length).toBe(1);
      expect(taskProviders[0].id).toBe('jira');

      const msgProviders = registry.getByCapability('messages');
      expect(msgProviders.length).toBe(1);
      expect(msgProviders[0].id).toBe('gmail');
    });

    it('should categorize providers dynamically', () => {
      const comm = registry.getByCategory('communication');
      expect(comm.length).toBe(1);
      expect(comm[0].id).toBe('gmail');

      const tasks = registry.getByCategory('tasks');
      expect(tasks.length).toBe(1);
      expect(tasks[0].id).toBe('jira');
    });
  });

  describe('3. Data Normalization', () => {
    it('should normalize raw Jira issues into standard UnifiedTask format', () => {
      const rawJiraIssue = {
        id: '10023',
        key: 'BACKEND-42',
        self: 'https://test.atlassian.net/rest/api/3/issue/10023',
        fields: {
          summary: 'Implement OAuth2 token rotation',
          description: 'Ensure token rotation works seamlessly',
          created: '2026-09-01T10:00:00Z',
          updated: '2026-09-05T12:30:00Z',
          status: {
            id: '3',
            name: 'In Progress',
            statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress' },
          },
          priority: { id: '2', name: 'High' },
          assignee: {
            displayName: 'Alice Engineer',
            emailAddress: 'alice@company.com',
          },
          labels: ['security', 'auth'],
          project: { id: '101', key: 'BACKEND', name: 'Backend Services' },
        },
      };

      const normalized: UnifiedTask = jira.normalizeJiraIssue(
        rawJiraIssue,
        'conn_jira_1',
        'https://test.atlassian.net'
      );

      expect(normalized.id).toBe('jira:BACKEND-42');
      expect(normalized.sourceId).toBe('BACKEND-42');
      expect(normalized.providerId).toBe('jira');
      expect(normalized.title).toBe('Implement OAuth2 token rotation');
      expect(normalized.status).toBe('in_progress');
      expect(normalized.priority).toBe('high');
      expect(normalized.assignee?.name).toBe('Alice Engineer');
      expect(normalized.webUrl).toBe('https://test.atlassian.net/browse/BACKEND-42');
      expect(normalized.labels).toContain('security');
    });

    it('should normalize raw Gmail messages into standard UnifiedMessage format', () => {
      const rawGmailMsg = {
        id: 'msg_987abc',
        threadId: 'thread_123',
        labelIds: ['INBOX', 'UNREAD', 'STARRED'],
        snippet: 'Here are the minutes from today meeting...',
        payload: {
          headers: [
            { name: 'Subject', value: 'Sprint Retrospective Notes' },
            { name: 'From', value: 'Project Lead <lead@company.com>' },
            { name: 'Date', value: 'Wed, 09 Sep 2026 08:30:00 GMT' },
          ],
        },
      };

      const normalized: UnifiedMessage = gmail.normalizeGmailMessage(
        rawGmailMsg,
        'conn_gmail_1'
      );

      expect(normalized.id).toBe('gmail:msg_987abc');
      expect(normalized.sourceId).toBe('msg_987abc');
      expect(normalized.threadId).toBe('thread_123');
      expect(normalized.providerId).toBe('gmail');
      expect(normalized.subject).toBe('Sprint Retrospective Notes');
      expect(normalized.sender.name).toBe('Project Lead');
      expect(normalized.sender.email).toBe('lead@company.com');
      expect(normalized.isRead).toBe(false);
      expect(normalized.isStarred).toBe(true);
      expect(normalized.webUrl).toBe('https://mail.google.com/mail/u/0/#inbox/thread_123');
    });
  });

  describe('4. User Connection Lifecycle & IntegrationManager', () => {
    beforeEach(() => {
      registry.register(jira);
      registry.register(gmail);
    });

    it('should connect Jira via OAuth, store token securely, and persist site metadata', async () => {
      // One-click OAuth: no user credentials — the mock oauth service returns
      // access + refresh tokens plus cloudId/siteUrl in configMetadata.
      const conn = await manager.connectProvider('jira', {});

      expect(conn.status).toBe('connected');
      expect(conn.providerId).toBe('jira');
      expect(conn.hasStoredCredentials).toBe(true);
      expect(conn.accountEmail).toBe('dev@acme.com');

      // Token is saved in TokenStorage, not on the connection.
      expect(await tokenStorage.hasToken(conn.connectionId)).toBe(true);

      // Non-secret site metadata (cloudId/siteUrl/siteName) surfaces on config
      // so subsequent API calls can build api.atlassian.com/ex/jira/{cloudId} URLs.
      expect(conn.config['cloudId']).toBe('cloud-abc');
      expect(conn.config['siteUrl']).toBe('https://acme.atlassian.net');
      expect(conn.config['siteName']).toBe('acme');
    });

    it('should report capability availability based on active connections', async () => {
      expect(manager.hasCapability('tasks')).toBe(false);
      expect(manager.hasCapability('messages')).toBe(false);

      // Connect Jira via one-click OAuth (mock service resolves synchronously).
      await manager.connectProvider('jira', {});

      expect(manager.hasCapability('tasks')).toBe(true);
      expect(manager.hasCapability('messages')).toBe(false);

      // Connect Gmail
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ emailAddress: 'dev@gmail.com' }),
      } as Response);

      await manager.connectProvider('gmail', {
        email: 'dev@gmail.com',
        accessToken: 'ya29.token_2',
      });

      expect(manager.hasCapability('tasks')).toBe(true);
      expect(manager.hasCapability('messages')).toBe(true);
      fetchSpy.mockRestore();
    });

    it('should aggregate tasks across task providers without UI knowing the provider', async () => {
      // Stub the Jira REST search BEFORE connect — manager.connectProvider kicks
      // off a fire-and-forget syncAll() which fetches too, so a `mockResolvedValueOnce`
      // races against our own manager.fetchTasks() call below.
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          issues: [
            {
              id: '90001',
              key: 'ACME-1',
              self: 'https://api.atlassian.com/ex/jira/cloud-abc/rest/api/3/issue/90001',
              fields: {
                summary: 'Wire up sign-in flow',
                created: '2026-09-01T10:00:00Z',
                updated: '2026-09-05T12:00:00Z',
                status: { id: '1', name: 'To Do', statusCategory: { id: 2, key: 'new', name: 'To Do' } },
              },
            },
          ],
        }),
      } as Response);

      await manager.connectProvider('jira', {});

      const tasks = await manager.fetchTasks();
      expect(tasks.length).toBeGreaterThan(0);
      expect(manager.unifiedTasks().length).toBe(tasks.length);
      expect(tasks[0].title).toBe('Wire up sign-in flow');
      expect(tasks[0].sourceId).toBe('ACME-1');
      expect(tasks[0].webUrl).toBe('https://acme.atlassian.net/browse/ACME-1');
      fetchSpy.mockRestore();
    });

    it('should authenticate Gmail, activate messages capability, and fetch user emails', async () => {
      expect(manager.hasCapability('messages')).toBe(false);

      // Mock Google Gmail API response for unit test
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/users/me/profile')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ emailAddress: 'habeeb@gmail.com', messagesTotal: 42 }),
          } as Response;
        }
        if (urlStr.includes('/users/me/messages?')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ messages: [{ id: 'live_msg_101', threadId: 'thread_101' }] }),
          } as Response;
        }
        if (urlStr.includes('/users/me/messages/live_msg_101')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 'live_msg_101',
              threadId: 'thread_101',
              labelIds: ['INBOX', 'UNREAD'],
              snippet: 'Important team update regarding product release milestones.',
              payload: {
                headers: [
                  { name: 'Subject', value: 'Live Product Update' },
                  { name: 'From', value: 'Engineering Team <eng@company.com>' },
                  { name: 'Date', value: 'Wed, 09 Sep 2026 10:00:00 GMT' },
                ],
              },
            }),
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const conn = await manager.connectProvider('gmail', {
        email: 'habeeb@gmail.com',
        accessToken: 'ya29.live_oauth_token_123',
      });

      expect(conn.status).toBe('connected');
      expect(conn.accountEmail).toBe('habeeb@gmail.com');
      expect(manager.hasCapability('messages')).toBe(true);

      const messages = await manager.fetchMessages();
      expect(messages.length).toBe(1);
      expect(messages[0].id).toBe('gmail:live_msg_101');
      expect(messages[0].subject).toBe('Live Product Update');
      expect(messages[0].sender.email).toBe('eng@company.com');
      expect(messages[0].snippet).toBe('Important team update regarding product release milestones.');
      expect(messages[0].isRead).toBe(false);

      fetchSpy.mockRestore();
    });

    it('should cleanly disconnect provider and remove token', async () => {
      const conn = await manager.connectProvider('jira', {});

      expect(manager.activeConnections().length).toBe(1);
      expect(await tokenStorage.hasToken(conn.connectionId)).toBe(true);

      await manager.disconnectConnection(conn.connectionId);

      expect(manager.activeConnections().length).toBe(0);
      expect(await tokenStorage.hasToken(conn.connectionId)).toBe(false);
      expect(manager.hasCapability('tasks')).toBe(false);
    });
  });

  describe('5. Extensibility: Adding a New Provider Without Core Changes', () => {
    it('can dynamically create and register a new GitHub adapter providing TaskProvider capability', async () => {
      class MockGitHubAuth implements AuthHandler {
        readonly authType = 'api_token' as const;
        async authenticate(creds: Record<string, string>) {
          return { success: true, accountName: creds['username'] || 'octocat', token: creds['token'] };
        }
        async validateConnection() { return true; }
        getAuthHeaders(_c: any, token: string) {
          return { Authorization: `Bearer ${token}` };
        }
      }

      class GitHubIntegration extends BaseIntegration implements TaskProvider {
        readonly id = 'github';
        readonly displayName = 'GitHub Issues';
        readonly description = 'Sync repository issues and pull requests';
        readonly category = 'developer' as const;
        readonly icon = 'github';
        readonly supportedCapabilities: readonly CapabilityType[] = ['tasks'] as const;
        readonly configFields = [
          { key: 'token', label: 'Personal Access Token', type: 'password' as const, isSecret: true, required: true },
        ];
        readonly authHandler = new MockGitHubAuth();

        async fetchTasks(connectionId: string): Promise<UnifiedTask[]> {
          return [
            {
              id: 'github:octocat/hello-world#42',
              sourceId: '42',
              providerId: this.id,
              connectionId,
              title: 'Add support for dark mode theme switcher',
              status: 'in_progress',
              priority: 'high',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              webUrl: 'https://github.com/octocat/hello-world/issues/42',
            },
          ];
        }
      }

      const github = new GitHubIntegration(tokenStorage as any);

      // 1. Register into registry
      registry.register(github);

      // 2. Discover via capability query
      const taskProviders = registry.getByCapability('tasks');
      expect(taskProviders.map((p) => p.id)).toContain('github');

      // 3. Connect via manager
      const conn = await manager.connectProvider('github', { token: 'ghp_secret' });
      expect(conn.status).toBe('connected');

      // 4. Fetch tasks via capability layer without any core code changes
      const tasks = await manager.fetchTasks();
      expect(tasks.some((t) => t.id === 'github:octocat/hello-world#42')).toBe(true);
    });
  });
});
