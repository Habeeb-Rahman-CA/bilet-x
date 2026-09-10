// Capabilities
export * from './core/capabilities/capability.types';
export * from './core/capabilities/task-provider.interface';
export * from './core/capabilities/message-provider.interface';
export * from './core/capabilities/calendar-provider.interface';
export * from './core/capabilities/notification-provider.interface';
export * from './core/capabilities/file-provider.interface';

// Normalized Models
export * from './core/models/unified-task.model';
export * from './core/models/unified-message.model';
export * from './core/models/unified-calendar.model';
export * from './core/models/unified-notification.model';
export * from './core/models/connection.model';

// Auth & Security
export * from './core/auth/auth-handler.interface';
export * from './core/auth/token-storage.interface';
export * from './core/auth/tauri-token-storage.service';
export * from './core/auth/stored-credential';
export * from './core/auth/google-oauth.service';
export * from './core/auth/jira-oauth.service';

// Core Integration Contracts & Services
export * from './core/integration.interface';
export * from './core/base-integration';
export * from './core/integration-registry.service';
export * from './core/integration-manager.service';

// Provider Adapters
export * from './providers/jira/jira.integration';
export * from './providers/gmail/gmail.integration';
