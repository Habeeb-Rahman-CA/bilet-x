/**
 * Authentication result after verifying credentials or completing OAuth.
 */
export interface AuthResult {
  success: boolean;
  accountName?: string;
  accountEmail?: string;
  avatarUrl?: string;
  token?: string;
  refreshToken?: string;
  expiresIn?: number;
  errorMessage?: string;
}

/**
 * Authentication handler contract.
 * Each provider has an isolated auth handler responsible for token verification,
 * OAuth flows, API key validation, or header construction.
 */
export interface AuthHandler {
  /**
   * Type of authentication mechanism
   */
  readonly authType: 'api_token' | 'basic_auth' | 'oauth2' | 'app_password';

  /**
   * Authenticate / validate the given credentials
   */
  authenticate(credentials: Record<string, string>): Promise<AuthResult>;

  /**
   * Test if the stored connection credentials are still valid
   */
  validateConnection(config: Record<string, string>, token: string): Promise<boolean>;

  /**
   * Refresh the access token if supported
   */
  refreshToken?(config: Record<string, string>, refreshToken: string): Promise<AuthResult>;

  /**
   * Build authorization headers for API calls
   */
  getAuthHeaders(config: Record<string, string>, token: string): Record<string, string>;
}
