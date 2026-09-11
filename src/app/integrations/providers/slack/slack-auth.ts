import { AuthHandler, AuthResult } from '../../core/auth/auth-handler.interface';
import { SlackOAuthService } from '../../core/auth/slack-oauth.service';

/**
 * Slack OAuth 2.0 (v2) Authentication Handler.
 *
 * Delegates to the Rust loopback flow. Team/user metadata (teamId,
 * teamName, teamDomain, userId, userName) flows into UserConnection.config
 * via configMetadata so subsequent API calls can build slack:// deep links
 * and render team names in the UI.
 *
 * User tokens (xoxp-*) don't expire by default — no refresh flow.
 */
export class SlackAuthHandler implements AuthHandler {
  public readonly authType = 'oauth2' as const;

  constructor(private oauth?: SlackOAuthService) {}

  public async authenticate(_credentials: Record<string, string>): Promise<AuthResult> {
    if (!this.oauth) {
      return {
        success: false,
        errorMessage: 'Slack OAuth service unavailable in this environment.',
      };
    }

    try {
      const tokens = await this.oauth.login();
      const accountName = tokens.userName || tokens.teamName || 'Slack Account';
      return {
        success: true,
        accountName,
        token: tokens.accessToken,
        configMetadata: {
          userId: tokens.userId,
          userName: tokens.userName,
          teamId: tokens.teamId,
          teamName: tokens.teamName,
          teamDomain: tokens.teamDomain,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        errorMessage:
          err?.message || 'Slack sign-in was cancelled or failed. Please try again.',
      };
    }
  }

  public async validateConnection(
    _config: Record<string, string>,
    token: string
  ): Promise<boolean> {
    // Slack's Web API can't be called from the webview (no CORS). The real
    // "is my token valid" check happens implicitly during fetchMessages,
    // which routes through the Rust proxy — a 401 there triggers the UI's
    // error banner. Here we just confirm we have a token at all.
    return !!token;
  }

  public getAuthHeaders(_config: Record<string, string>, token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };
  }
}
