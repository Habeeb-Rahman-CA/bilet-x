import { Injectable } from '@angular/core';
import { TauriService } from '../../../core/tauri/tauri.service';

export interface JiraLoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  email: string;
  displayName: string;
  cloudId: string;
  siteUrl: string;
  siteName: string;
}

export interface JiraRefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface RustJiraTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  email: string;
  display_name: string;
  cloud_id: string;
  site_url: string;
  site_name: string;
}

interface RustRefreshedJiraTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/**
 * Bridges Angular to the Rust-side Atlassian OAuth 2.0 (3LO) loopback flow.
 * Rust opens the system browser, runs a local HTTP listener, exchanges the
 * auth code with PKCE, and returns tokens plus the first accessible Jira
 * site's cloudId (needed to build api.atlassian.com/ex/jira/{cloudId} URLs).
 */
@Injectable({
  providedIn: 'root',
})
export class JiraOAuthService {
  constructor(private tauri: TauriService) {}

  public isAvailable(): boolean {
    return this.tauri.isTauriAvailable();
  }

  public async login(): Promise<JiraLoginResult> {
    if (!this.tauri.isTauriAvailable()) {
      throw new Error('Jira sign-in requires the desktop app.');
    }
    const raw = await this.tauri.invokeCommand<RustJiraTokens>('jira_oauth_login');
    return {
      accessToken: raw.access_token,
      refreshToken: raw.refresh_token,
      expiresIn: raw.expires_in,
      email: raw.email,
      displayName: raw.display_name,
      cloudId: raw.cloud_id,
      siteUrl: raw.site_url,
      siteName: raw.site_name,
    };
  }

  public async refresh(refreshToken: string): Promise<JiraRefreshResult> {
    if (!this.tauri.isTauriAvailable()) {
      throw new Error('Token refresh requires the desktop app.');
    }
    const raw = await this.tauri.invokeCommand<RustRefreshedJiraTokens>(
      'jira_oauth_refresh',
      { refreshToken }
    );
    return {
      accessToken: raw.access_token,
      refreshToken: raw.refresh_token,
      expiresIn: raw.expires_in,
    };
  }
}
