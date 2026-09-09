import { CapabilityType, IntegrationCategory } from './capabilities/capability.types';
import { ConnectionConfigField, UserConnection } from './models/connection.model';
import { AuthHandler } from './auth/auth-handler.interface';

/**
 * Base Integration contract.
 * Every provider (Gmail, Jira, GitHub, Outlook, Slack, Linear, etc.) implements this contract.
 * Integrations expose capabilities dynamically through getCapability().
 */
export interface Integration {
  /** Unique integration identifier (e.g. 'jira', 'gmail', 'github') */
  readonly id: string;

  /** Human-readable display name */
  readonly displayName: string;

  /** Short description of the integration */
  readonly description: string;

  /** Category for UI grouping (e.g. 'communication', 'tasks', 'calendar', 'developer') */
  readonly category: IntegrationCategory;

  /** Icon representation (SVG snippet or name) */
  readonly icon: string;

  /** List of capabilities supported by this integration */
  readonly supportedCapabilities: readonly CapabilityType[];

  /**
   * True when the provider owns its own connect UI in a dedicated tab.
   * Settings should render only the disconnect / test controls, not a generic
   * config form or Connect button, for these providers.
   */
  readonly hasInlineConnectUI?: boolean;

  /** Field definitions required for configuration & authentication */
  readonly configFields: readonly ConnectionConfigField[];

  /** Dedicated authentication handler */
  readonly authHandler: AuthHandler;

  /**
   * Check if this integration implements a specific capability
   */
  hasCapability(capability: CapabilityType): boolean;

  /**
   * Retrieve the capability implementation if supported, or null
   */
  getCapability<T>(capability: CapabilityType): T | null;

  /**
   * Establish a connection with the given credentials/configuration
   */
  connect(
    connectionId: string,
    credentials: Record<string, string>,
    existingConfig?: Record<string, string>
  ): Promise<UserConnection>;

  /**
   * Disconnect and clean up resources for a connection
   */
  disconnect(connectionId: string): Promise<void>;

  /**
   * Verify whether the connection and credentials are valid
   */
  testConnection(
    connectionId: string,
    config: Record<string, string>,
    token?: string
  ): Promise<boolean>;
}
