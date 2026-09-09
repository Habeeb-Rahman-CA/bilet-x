import { Injectable, computed, effect, signal } from '@angular/core';
import { IntegrationRegistryService } from './integration-registry.service';
import { CapabilityType } from './capabilities/capability.types';
import { TaskProvider, TaskFilter } from './capabilities/task-provider.interface';
import { MessageProvider, MessageFilter } from './capabilities/message-provider.interface';
import { CalendarProvider, CalendarFilter } from './capabilities/calendar-provider.interface';
import { NotificationProvider, NotificationFilter } from './capabilities/notification-provider.interface';
import { UnifiedTask } from './models/unified-task.model';
import { UnifiedMessage } from './models/unified-message.model';
import { UnifiedCalendarEvent } from './models/unified-calendar.model';
import { UnifiedNotification } from './models/unified-notification.model';
import { UserConnection } from './models/connection.model';
import { PersistenceService } from '../../core/tauri/persistence.service';
import { TokenStorage } from './auth/token-storage.interface';
import { TauriTokenStorageService } from './auth/tauri-token-storage.service';
import { Integration } from './integration.interface';

const CONNECTIONS_STORAGE_KEY = 'integration_user_connections';

@Injectable({
  providedIn: 'root',
})
export class IntegrationManagerService {
  /** All configured user connections */
  public connections = signal<UserConnection[]>([]);

  /** Aggregated normalized data signals */
  public unifiedTasks = signal<UnifiedTask[]>([]);
  public unifiedMessages = signal<UnifiedMessage[]>([]);
  public unifiedEvents = signal<UnifiedCalendarEvent[]>([]);
  public unifiedNotifications = signal<UnifiedNotification[]>([]);

  /** Global sync state indicator */
  public isSyncing = signal<boolean>(false);

  /** Last per-capability fetch error surfaced to UI. */
  public messagesError = signal<string | null>(null);
  public tasksError = signal<string | null>(null);

  /** Active (connected) user connections */
  public activeConnections = computed(() =>
    this.connections().filter((c) => c.status === 'connected' || c.status === 'syncing')
  );

  constructor(
    private registry: IntegrationRegistryService,
    private persistence: PersistenceService,
    private tokenStorage: TauriTokenStorageService
  ) {
    // Load persisted connections once settings are available
    this.loadConnectionsFromStorage();
  }

  /**
   * Load stored connections from persistence service.
   */
  public async loadConnectionsFromStorage(): Promise<void> {
    try {
      const stored = this.persistence.getSettingValue(CONNECTIONS_STORAGE_KEY, '[]');
      const parsed: UserConnection[] = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        this.connections.set(parsed);
      }
    } catch (e) {
      console.warn('[IntegrationManager] Failed to load connections from storage', e);
    }
  }

  private async persistConnections(): Promise<void> {
    try {
      const serialized = JSON.stringify(this.connections());
      await this.persistence.setSetting(CONNECTIONS_STORAGE_KEY, serialized);
    } catch (e) {
      console.error('[IntegrationManager] Failed to persist connections', e);
    }
  }

  // ==========================================
  // CAPABILITY DISCOVERY & AGGREGATION METHODS
  // ==========================================

  /**
   * Check if any active connection currently provides the requested capability.
   * e.g. hasCapability('tasks'), hasCapability('messages')
   */
  public hasCapability(capability: CapabilityType): boolean {
    return this.getConnectedCapabilityProviders(capability).length > 0;
  }

  /**
   * Get all active connected providers that implement the given capability.
   */
  public getConnectedCapabilityProviders<T>(
    capability: CapabilityType
  ): { provider: Integration; capabilityInstance: T; connection: UserConnection }[] {
    const results: { provider: Integration; capabilityInstance: T; connection: UserConnection }[] = [];

    for (const conn of this.activeConnections()) {
      const provider = this.registry.get(conn.providerId);
      if (!provider) continue;

      const instance = provider.getCapability<T>(capability);
      if (instance) {
        results.push({ provider, capabilityInstance: instance, connection: conn });
      }
    }

    return results;
  }

  /**
   * Fetch tasks from all connected TaskProviders and normalize into unifiedTasks signal.
   */
  public async fetchTasks(filter?: TaskFilter): Promise<UnifiedTask[]> {
    const taskProviders = this.getConnectedCapabilityProviders<TaskProvider>('tasks');
    if (taskProviders.length === 0) {
      this.unifiedTasks.set([]);
      this.tasksError.set(null);
      return [];
    }

    const allTasks: UnifiedTask[] = [];
    const errors: string[] = [];

    await Promise.allSettled(
      taskProviders.map(async ({ capabilityInstance, connection }) => {
        try {
          const tasks = await capabilityInstance.fetchTasks(connection.connectionId, filter);
          allTasks.push(...tasks);
        } catch (err: any) {
          const msg = err?.message || String(err);
          console.error(`[IntegrationManager] Failed to fetch tasks from ${connection.providerId}`, err);
          errors.push(`${connection.providerId}: ${msg}`);
        }
      })
    );

    // Sort by updatedAt descending
    allTasks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    this.unifiedTasks.set(allTasks);
    this.tasksError.set(errors.length > 0 ? errors.join(' | ') : null);
    return allTasks;
  }

  /**
   * Fetch messages from all connected MessageProviders and normalize into unifiedMessages signal.
   */
  public async fetchMessages(filter?: MessageFilter): Promise<UnifiedMessage[]> {
    const msgProviders = this.getConnectedCapabilityProviders<MessageProvider>('messages');
    if (msgProviders.length === 0) {
      this.unifiedMessages.set([]);
      this.messagesError.set(null);
      return [];
    }

    const allMessages: UnifiedMessage[] = [];
    const errors: string[] = [];

    await Promise.allSettled(
      msgProviders.map(async ({ capabilityInstance, connection }) => {
        try {
          const messages = await capabilityInstance.fetchMessages(connection.connectionId, filter);
          allMessages.push(...messages);
        } catch (err: any) {
          const msg = err?.message || String(err);
          console.error(`[IntegrationManager] Failed to fetch messages from ${connection.providerId}`, err);
          errors.push(`${connection.providerId}: ${msg}`);
        }
      })
    );

    allMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    this.unifiedMessages.set(allMessages);
    this.messagesError.set(errors.length > 0 ? errors.join(' | ') : null);
    return allMessages;
  }

  /**
   * Fetch calendar events from all connected CalendarProviders.
   */
  public async fetchEvents(filter?: CalendarFilter): Promise<UnifiedCalendarEvent[]> {
    const calProviders = this.getConnectedCapabilityProviders<CalendarProvider>('calendar');
    if (calProviders.length === 0) {
      this.unifiedEvents.set([]);
      return [];
    }

    const allEvents: UnifiedCalendarEvent[] = [];

    await Promise.allSettled(
      calProviders.map(async ({ capabilityInstance, connection }) => {
        try {
          const events = await capabilityInstance.fetchEvents(connection.connectionId, filter);
          allEvents.push(...events);
        } catch (err) {
          console.error(`[IntegrationManager] Failed to fetch events from ${connection.providerId}`, err);
        }
      })
    );

    allEvents.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    this.unifiedEvents.set(allEvents);
    return allEvents;
  }

  /**
   * Fetch notifications from all connected NotificationProviders.
   */
  public async fetchNotifications(filter?: NotificationFilter): Promise<UnifiedNotification[]> {
    const notifProviders = this.getConnectedCapabilityProviders<NotificationProvider>('notifications');
    if (notifProviders.length === 0) {
      this.unifiedNotifications.set([]);
      return [];
    }

    const allNotifs: UnifiedNotification[] = [];

    await Promise.allSettled(
      notifProviders.map(async ({ capabilityInstance, connection }) => {
        try {
          const notifs = await capabilityInstance.fetchNotifications(connection.connectionId, filter);
          allNotifs.push(...notifs);
        } catch (err) {
          console.error(`[IntegrationManager] Failed to fetch notifications from ${connection.providerId}`, err);
        }
      })
    );

    allNotifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    this.unifiedNotifications.set(allNotifs);
    return allNotifs;
  }

  /**
   * Sync all connected providers across all capabilities.
   */
  public async syncAll(): Promise<void> {
    if (this.isSyncing()) return;
    this.isSyncing.set(true);

    try {
      await Promise.allSettled([
        this.fetchTasks(),
        this.fetchMessages(),
        this.fetchEvents(),
        this.fetchNotifications(),
      ]);

      // Update lastSyncedAt for active connections
      const now = new Date().toISOString();
      this.connections.update((list) =>
        list.map((c) => (c.status === 'connected' ? { ...c, lastSyncedAt: now } : c))
      );
      await this.persistConnections();
    } finally {
      this.isSyncing.set(false);
    }
  }

  // ==========================================
  // CONNECTION MANAGEMENT
  // ==========================================

  /**
   * Connect a provider with credentials. Supports creating a new connection or updating an existing one.
   */
  public async connectProvider(
    providerId: string,
    credentials: Record<string, string>,
    connectionId?: string
  ): Promise<UserConnection> {
    const provider = this.registry.get(providerId);
    if (!provider) {
      throw new Error(`Provider "${providerId}" not found in registry.`);
    }

    const connId = connectionId || `conn_${providerId}_${Date.now()}`;
    const existing = this.connections().find((c) => c.connectionId === connId);

    const connection = await provider.connect(connId, credentials, existing?.config);

    // Update connection list
    this.connections.update((prev) => {
      const idx = prev.findIndex((c) => c.connectionId === connId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = connection;
        return next;
      }
      return [...prev, connection];
    });

    await this.persistConnections();

    // Trigger initial sync if connected successfully
    if (connection.status === 'connected') {
      this.syncAll().catch((e) => console.warn('Initial sync error:', e));
    }

    return connection;
  }

  /**
   * Disconnect an active connection and remove its stored secret credentials.
   */
  public async disconnectConnection(connectionId: string): Promise<void> {
    const connection = this.connections().find((c) => c.connectionId === connectionId);
    if (!connection) return;

    const provider = this.registry.get(connection.providerId);
    if (provider) {
      await provider.disconnect(connectionId);
    }

    // Remove or mark as disconnected
    this.connections.update((prev) => prev.filter((c) => c.connectionId !== connectionId));
    await this.persistConnections();

    // Refresh active data
    await this.syncAll();
  }

  /**
   * Test connection validity without modifying existing saved state.
   */
  public async testConnection(connectionId: string): Promise<boolean> {
    const conn = this.connections().find((c) => c.connectionId === connectionId);
    if (!conn) return false;

    const provider = this.registry.get(conn.providerId);
    if (!provider) return false;

    return provider.testConnection(connectionId, conn.config);
  }

  /**
   * Get connections for a specific provider.
   */
  public getConnectionsForProvider(providerId: string): UserConnection[] {
    return this.connections().filter((c) => c.providerId === providerId);
  }

  /**
   * Get connection by ID.
   */
  public getConnection(connectionId: string): UserConnection | undefined {
    return this.connections().find((c) => c.connectionId === connectionId);
  }
}
