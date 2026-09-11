import { Injectable } from '@angular/core';
import { TauriService } from '../../../core/tauri/tauri.service';

export interface OutlookLoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  email: string;
  displayName: string;
}

export interface OutlookRefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface RustOutlookTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  email: string;
  display_name: string;
}

interface RustRefreshedOutlookTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/**
 * Bridges Angular to the Rust-side Microsoft OAuth 2.0 loopback flow.
 * Rust opens the system browser, runs a local HTTP listener on port 43730,
 * exchanges the auth code with PKCE against
 * login.microsoftonline.com/common/oauth2/v2.0, and returns access +
 * refresh tokens plus /me profile fields.
 */
@Injectable({
  providedIn: 'root',
})
export class OutlookOAuthService {
  constructor(private tauri: TauriService) {}

  public isAvailable(): boolean {
    return this.tauri.isTauriAvailable();
  }

  public async login(): Promise<OutlookLoginResult> {
    if (!this.tauri.isTauriAvailable()) {
      throw new Error('Microsoft sign-in requires the desktop app.');
    }
    const raw = await this.tauri.invokeCommand<RustOutlookTokens>('outlook_oauth_login');
    return {
      accessToken: raw.access_token,
      refreshToken: raw.refresh_token,
      expiresIn: raw.expires_in,
      email: raw.email,
      displayName: raw.display_name,
    };
  }

  public async refresh(refreshToken: string): Promise<OutlookRefreshResult> {
    if (!this.tauri.isTauriAvailable()) {
      throw new Error('Token refresh requires the desktop app.');
    }
    const raw = await this.tauri.invokeCommand<RustRefreshedOutlookTokens>(
      'outlook_oauth_refresh',
      { refreshToken }
    );
    return {
      accessToken: raw.access_token,
      refreshToken: raw.refresh_token,
      expiresIn: raw.expires_in,
    };
  }
}
