import { AuthHandler, AuthResult } from '../../core/auth/auth-handler.interface';
import { OutlookOAuthService } from '../../core/auth/outlook-oauth.service';

/**
 * Microsoft / Outlook OAuth 2.0 Authentication Handler.
 *
 * Delegates to the Rust-side loopback flow against
 * login.microsoftonline.com/common. Access tokens are short-lived
 * (~1 hour) so refreshToken() is wired via the `offline_access` scope.
 */
export class OutlookAuthHandler implements AuthHandler {
  public readonly authType = 'oauth2' as const;

  constructor(private oauth?: OutlookOAuthService) {}

  public async authenticate(_credentials: Record<string, string>): Promise<AuthResult> {
    if (!this.oauth) {
      return {
        success: false,
        errorMessage: 'Microsoft OAuth service unavailable in this environment.',
      };
    }

    try {
      const tokens = await this.oauth.login();
      const accountName = tokens.displayName || tokens.email || 'Microsoft Account';
      return {
        success: true,
        accountName,
        accountEmail: tokens.email,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      };
    } catch (err: any) {
      return {
        success: false,
        errorMessage:
          err?.message || 'Microsoft sign-in was cancelled or failed. Please try again.',
      };
    }
  }

  public async refreshToken(
    _config: Record<string, string>,
    refreshToken: string
  ): Promise<AuthResult> {
    if (!this.oauth) {
      return { success: false, errorMessage: 'OAuth service unavailable.' };
    }
    try {
      const result = await this.oauth.refresh(refreshToken);
      return {
        success: true,
        token: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      };
    } catch (err: any) {
      return {
        success: false,
        errorMessage: err?.message || 'Failed to refresh Microsoft access token.',
      };
    }
  }

  public async validateConnection(
    config: Record<string, string>,
    token: string
  ): Promise<boolean> {
    if (!token) return false;

    try {
      const res = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: this.getAuthHeaders(config, token),
      });
      return res.ok;
    } catch {
      return !!token;
    }
  }

  public getAuthHeaders(_config: Record<string, string>, token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }
}
