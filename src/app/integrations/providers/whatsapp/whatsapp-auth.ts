import { AuthHandler, AuthResult } from '../../core/auth/auth-handler.interface';
import { WhatsAppOAuthService } from '../../core/auth/whatsapp-oauth.service';

/**
 * Meta / WhatsApp Business Cloud API Authentication Handler.
 *
 * Delegates to the Rust loopback flow, which handles the FB OAuth dialog,
 * upgrades to a long-lived (~60d) access token, and discovers the user's
 * first WABA + phone numbers in one shot. Non-secret business metadata
 * flows into UserConnection.config via AuthResult.configMetadata.
 *
 * Meta long-lived tokens have no refresh counterpart — when they expire
 * the user re-signs in. refreshToken() is therefore not implemented.
 */
export class WhatsAppAuthHandler implements AuthHandler {
  public readonly authType = 'oauth2' as const;

  constructor(private oauth?: WhatsAppOAuthService) {}

  public async authenticate(_credentials: Record<string, string>): Promise<AuthResult> {
    if (!this.oauth) {
      return {
        success: false,
        errorMessage: 'Meta OAuth service unavailable in this environment.',
      };
    }

    try {
      const tokens = await this.oauth.login();
      const accountName =
        tokens.businessName || tokens.wabaName || tokens.userName || 'WhatsApp Business';
      return {
        success: true,
        accountName,
        token: tokens.accessToken,
        expiresIn: tokens.expiresIn,
        configMetadata: {
          userId: tokens.userId,
          userName: tokens.userName,
          businessId: tokens.businessId,
          businessName: tokens.businessName,
          wabaId: tokens.wabaId,
          wabaName: tokens.wabaName,
          // Phone numbers as JSON so multiple values survive the flat
          // string-map config shape used by UserConnection.config.
          phoneNumbers: JSON.stringify(tokens.phoneNumbers),
        },
      };
    } catch (err: any) {
      return {
        success: false,
        errorMessage:
          err?.message || 'Meta sign-in was cancelled or failed. Please try again.',
      };
    }
  }

  public async validateConnection(
    config: Record<string, string>,
    token: string
  ): Promise<boolean> {
    if (!token) return false;

    try {
      const res = await fetch('https://graph.facebook.com/v20.0/me?fields=id', {
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
    };
  }
}
