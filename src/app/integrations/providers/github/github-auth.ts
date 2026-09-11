import { AuthHandler, AuthResult } from '../../core/auth/auth-handler.interface';
import { GitHubOAuthService } from '../../core/auth/github-oauth.service';

/**
 * GitHub OAuth 2.0 Authentication Handler.
 *
 * Delegates to the Rust-side loopback OAuth flow and returns the access
 * token plus basic profile fields (login, email, avatar) as connection
 * metadata. Classic OAuth Apps issue long-lived tokens without a refresh
 * counterpart, so refreshToken() is intentionally not implemented — a
 * revoked/expired token forces a fresh sign-in.
 */
export class GitHubAuthHandler implements AuthHandler {
  public readonly authType = 'oauth2' as const;

  constructor(private oauth?: GitHubOAuthService) {}

  public async authenticate(_credentials: Record<string, string>): Promise<AuthResult> {
    if (!this.oauth) {
      return {
        success: false,
        errorMessage: 'GitHub OAuth service unavailable in this environment.',
      };
    }

    try {
      const tokens = await this.oauth.login();
      const accountName = tokens.name || tokens.login || tokens.email || 'GitHub Account';
      return {
        success: true,
        accountName,
        accountEmail: tokens.email,
        avatarUrl: tokens.avatarUrl,
        token: tokens.accessToken,
        configMetadata: {
          login: tokens.login,
          avatarUrl: tokens.avatarUrl,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        errorMessage:
          err?.message || 'GitHub sign-in was cancelled or failed. Please try again.',
      };
    }
  }

  public async validateConnection(
    config: Record<string, string>,
    token: string
  ): Promise<boolean> {
    if (!token) return false;

    try {
      const res = await fetch('https://api.github.com/user', {
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
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }
}
