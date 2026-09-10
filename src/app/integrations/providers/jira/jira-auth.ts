import { AuthHandler, AuthResult } from '../../core/auth/auth-handler.interface';
import { JiraOAuthService } from '../../core/auth/jira-oauth.service';

/**
 * Atlassian Jira OAuth 2.0 (3LO) Authentication Handler.
 *
 * Delegates to the Rust-side loopback OAuth flow, then reports back the
 * access + refresh tokens along with the first accessible Jira site's
 * cloudId + siteUrl (surfaced via configMetadata so BaseIntegration persists
 * them on the UserConnection). Subsequent API calls use
 * https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/...
 */
export class JiraAuthHandler implements AuthHandler {
  public readonly authType = 'oauth2' as const;

  constructor(private oauth?: JiraOAuthService) {}

  public async authenticate(_credentials: Record<string, string>): Promise<AuthResult> {
    if (!this.oauth) {
      return {
        success: false,
        errorMessage: 'Atlassian OAuth service unavailable in this environment.',
      };
    }

    try {
      const tokens = await this.oauth.login();
      const displayName = tokens.displayName || tokens.email || 'Atlassian Account';
      return {
        success: true,
        accountName: displayName,
        accountEmail: tokens.email,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        configMetadata: {
          cloudId: tokens.cloudId,
          siteUrl: tokens.siteUrl,
          siteName: tokens.siteName,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        errorMessage:
          err?.message || 'Atlassian sign-in was cancelled or failed. Please try again.',
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
        errorMessage: err?.message || 'Failed to refresh Atlassian access token.',
      };
    }
  }

  public async validateConnection(
    config: Record<string, string>,
    token: string
  ): Promise<boolean> {
    if (!token) return false;

    try {
      const res = await fetch('https://api.atlassian.com/me', {
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
