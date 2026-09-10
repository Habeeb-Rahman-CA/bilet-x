import { CapabilityType, IntegrationCategory } from './capabilities/capability.types';
import { ConnectionConfigField, UserConnection } from './models/connection.model';
import { AuthHandler, AuthResult } from './auth/auth-handler.interface';
import { TokenStorage } from './auth/token-storage.interface';
import {
  StoredCredential,
  isExpiringSoon,
  parseCredential,
  serializeCredential,
} from './auth/stored-credential';
import { Integration } from './integration.interface';

/**
 * Base abstract class for integrations, implementing standard capability discovery,
 * connection lifecycle, and secure credential delegation.
 */
export abstract class BaseIntegration implements Integration {
  abstract readonly id: string;
  abstract readonly displayName: string;
  abstract readonly description: string;
  abstract readonly category: IntegrationCategory;
  abstract readonly icon: string;
  abstract readonly supportedCapabilities: readonly CapabilityType[];
  abstract readonly configFields: readonly ConnectionConfigField[];
  abstract readonly authHandler: AuthHandler;

  constructor(protected tokenStorage: TokenStorage) {}

  public hasCapability(capability: CapabilityType): boolean {
    return this.supportedCapabilities.includes(capability);
  }

  public getCapability<T>(capability: CapabilityType): T | null {
    if (!this.hasCapability(capability)) {
      return null;
    }
    // Check if `this` implements the capability methods
    return (this as unknown) as T;
  }

  public async connect(
    connectionId: string,
    credentials: Record<string, string>,
    existingConfig: Record<string, string> = {}
  ): Promise<UserConnection> {
    const authResult = await this.authHandler.authenticate(credentials);

    if (!authResult.success) {
      return {
        connectionId,
        providerId: this.id,
        accountName: credentials['accountName'] || this.displayName,
        status: 'error',
        errorMessage: authResult.errorMessage || 'Authentication failed',
        config: { ...existingConfig, ...this.extractNonSecretConfig(credentials) },
        hasStoredCredentials: false,
      };
    }

    if (authResult.token) {
      await this.persistCredentialFromAuth(connectionId, authResult);
    }

    const nonSecretConfig = {
      ...existingConfig,
      ...this.extractNonSecretConfig(credentials),
      ...(authResult.configMetadata ?? {}),
    };

    return {
      connectionId,
      providerId: this.id,
      accountName:
        authResult.accountName ||
        credentials['accountName'] ||
        authResult.accountEmail ||
        `${this.displayName} Account`,
      accountEmail: authResult.accountEmail,
      avatarUrl: authResult.avatarUrl,
      status: 'connected',
      connectedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      config: nonSecretConfig,
      hasStoredCredentials: !!authResult.token,
    };
  }

  public async disconnect(connectionId: string): Promise<void> {
    await this.tokenStorage.deleteToken(connectionId);
  }

  public async testConnection(
    connectionId: string,
    config: Record<string, string>,
    explicitToken?: string
  ): Promise<boolean> {
    const token = explicitToken || (await this.getAccessToken(connectionId));
    if (!token) return false;
    return this.authHandler.validateConnection(config, token);
  }

  // ==========================================
  // CREDENTIAL HELPERS (available to subclasses)
  // ==========================================

  /**
   * Return the raw current access token for a connection, or null.
   * Does NOT auto-refresh. Use getValidAccessToken() for OAuth flows.
   */
  protected async getAccessToken(connectionId: string): Promise<string | null> {
    const raw = await this.tokenStorage.getToken(connectionId);
    return parseCredential(raw)?.accessToken ?? null;
  }

  /**
   * Return a non-expired access token, transparently refreshing via the
   * AuthHandler if the current one is close to expiring and a refresh token
   * is available. Persists the refreshed credential back to TokenStorage.
   */
  protected async getValidAccessToken(
    connectionId: string,
    config: Record<string, string> = {}
  ): Promise<string | null> {
    const raw = await this.tokenStorage.getToken(connectionId);
    const cred = parseCredential(raw);
    if (!cred) return null;

    if (
      cred.refreshToken &&
      this.authHandler.refreshToken &&
      isExpiringSoon(cred)
    ) {
      const refreshed = await this.refreshAndPersist(connectionId, config, cred);
      if (refreshed) return refreshed;
    }
    return cred.accessToken;
  }

  /**
   * Force a refresh of the access token using the stored refresh token.
   * Returns the new access token, or null if refresh failed or no refresh token.
   */
  protected async forceRefresh(
    connectionId: string,
    config: Record<string, string> = {}
  ): Promise<string | null> {
    const raw = await this.tokenStorage.getToken(connectionId);
    const cred = parseCredential(raw);
    if (!cred?.refreshToken || !this.authHandler.refreshToken) return null;
    return this.refreshAndPersist(connectionId, config, cred);
  }

  private async refreshAndPersist(
    connectionId: string,
    config: Record<string, string>,
    cred: StoredCredential
  ): Promise<string | null> {
    if (!cred.refreshToken || !this.authHandler.refreshToken) return null;
    try {
      const result = await this.authHandler.refreshToken(config, cred.refreshToken);
      if (!result.success || !result.token) {
        console.warn(`[${this.id}] Token refresh failed:`, result.errorMessage);
        return null;
      }
      const updated: StoredCredential = {
        accessToken: result.token,
        refreshToken: result.refreshToken || cred.refreshToken,
        expiresAt: result.expiresIn
          ? Date.now() + (result.expiresIn - 60) * 1000
          : undefined,
      };
      await this.tokenStorage.setToken(connectionId, serializeCredential(updated));
      return updated.accessToken;
    } catch (err) {
      console.warn(`[${this.id}] Token refresh threw:`, err);
      return null;
    }
  }

  private async persistCredentialFromAuth(
    connectionId: string,
    authResult: AuthResult
  ): Promise<void> {
    if (!authResult.token) return;
    const cred: StoredCredential = {
      accessToken: authResult.token,
      refreshToken: authResult.refreshToken,
      expiresAt: authResult.expiresIn
        ? Date.now() + (authResult.expiresIn - 60) * 1000
        : undefined,
    };
    await this.tokenStorage.setToken(connectionId, serializeCredential(cred));
  }

  /**
   * Separates non-secret config fields from sensitive credentials to prevent
   * accidental exposure in logs or UI.
   */
  protected extractNonSecretConfig(
    credentials: Record<string, string>
  ): Record<string, string> {
    const secretKeys = new Set(
      this.configFields.filter((f) => f.isSecret).map((f) => f.key)
    );
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(credentials)) {
      if (!secretKeys.has(key)) {
        result[key] = value;
      }
    }
    return result;
  }
}
