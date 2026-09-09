import { AuthHandler, AuthResult } from '../../core/auth/auth-handler.interface';
import { GoogleOAuthService } from '../../core/auth/google-oauth.service';

/**
 * Gmail OAuth2 Authentication Handler.
 *
 * Uses the loopback (installed-app) OAuth 2.0 flow driven by the Rust side
 * of the app: a local HTTP listener on 127.0.0.1 receives the callback from
 * Google, and the Tauri command exchanges the auth code + PKCE verifier for
 * access + refresh tokens.
 *
 * Refresh tokens are persisted via BaseIntegration/TokenStorage so the user
 * stays signed in indefinitely — access tokens are auto-refreshed on demand.
 */
export class GmailAuthHandler implements AuthHandler {
  public readonly authType = 'oauth2' as const;

  constructor(private oauth?: GoogleOAuthService) {}

  public async authenticate(credentials: Record<string, string>): Promise<AuthResult> {
    // Legacy path: paste a raw access token. Kept for tests / manual debugging.
    if (credentials['accessToken']) {
      return this.authenticateWithPastedToken(credentials);
    }

    if (!this.oauth) {
      return {
        success: false,
        errorMessage: 'Google OAuth service unavailable in this environment.',
      };
    }

    try {
      const tokens = await this.oauth.login();
      const email = tokens.email || credentials['email'] || 'Google Account';
      return {
        success: true,
        accountName: email,
        accountEmail: email,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      };
    } catch (err: any) {
      return {
        success: false,
        errorMessage:
          err?.message || 'Google sign-in was cancelled or failed. Please try again.',
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
        expiresIn: result.expiresIn,
      };
    } catch (err: any) {
      return {
        success: false,
        errorMessage: err?.message || 'Failed to refresh Google access token.',
      };
    }
  }

  public async validateConnection(
    config: Record<string, string>,
    token: string
  ): Promise<boolean> {
    if (!token) return false;

    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
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

  private async authenticateWithPastedToken(
    credentials: Record<string, string>
  ): Promise<AuthResult> {
    const email = credentials['email']?.trim();
    const token = credentials['accessToken']?.trim();

    if (!token) {
      return { success: false, errorMessage: 'Google OAuth Access Token is required.' };
    }

    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: this.getAuthHeaders({}, token),
      });

      if (res.ok) {
        const profile = await res.json();
        const accountEmail = profile.emailAddress || email || 'Google Account';
        return {
          success: true,
          accountName: accountEmail,
          accountEmail,
          token,
        };
      } else if (res.status === 401) {
        return {
          success: false,
          errorMessage:
            'Google OAuth Access Token is invalid or expired (401 Unauthorized).',
        };
      } else if (res.status === 403) {
        return {
          success: false,
          errorMessage:
            'Access denied (403 Forbidden). Ensure Gmail API is enabled and your token has the gmail.modify scope.',
        };
      }
    } catch (err: any) {
      console.warn('[GmailAuth] Network verification warning:', err);
    }

    if (!email) {
      return { success: false, errorMessage: 'Google account email is required.' };
    }

    return {
      success: true,
      accountName: credentials['accountName'] || email,
      accountEmail: email,
      token,
    };
  }
}
