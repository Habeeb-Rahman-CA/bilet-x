/**
 * Represents a configured user connection for an integration provider.
 * Supports multiple accounts per provider (e.g. personal Gmail + work Gmail).
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'syncing';

export interface UserConnection {
  connectionId: string; // Unique ID e.g. "conn_jira_work"
  providerId: string; // Provider ID e.g. "jira"
  accountName: string; // Label e.g. "Acme Corp Jira"
  accountEmail?: string;
  avatarUrl?: string;
  status: ConnectionStatus;
  errorMessage?: string;
  connectedAt?: string; // ISO date string
  lastSyncedAt?: string; // ISO date string
  config: Record<string, string>; // Non-sensitive configuration (domain, custom jql, filters)
  hasStoredCredentials: boolean;
}

export interface ConnectionConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'email' | 'select';
  placeholder?: string;
  description?: string;
  required?: boolean;
  isSecret?: boolean; // If true, stored in secure TokenStorage, never leaked to logs/UI plain text
  options?: { value: string; label: string }[];
  defaultValue?: string;
}
