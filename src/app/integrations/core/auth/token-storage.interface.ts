/**
 * Storage interface for sensitive tokens, passwords, and API keys.
 * Kept isolated and secure (not stored in plain unencrypted localStorage).
 */
export interface TokenStorage {
  /**
   * Save a secret token for a given connection
   */
  setToken(connectionId: string, token: string): Promise<void>;

  /**
   * Retrieve the secret token for a given connection
   */
  getToken(connectionId: string): Promise<string | null>;

  /**
   * Remove the secret token for a given connection
   */
  deleteToken(connectionId: string): Promise<void>;

  /**
   * Check if a token exists for a given connection without exposing it
   */
  hasToken(connectionId: string): Promise<boolean>;
}
