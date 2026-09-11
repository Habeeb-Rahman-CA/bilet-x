import { Injectable } from '@angular/core';
import { TauriService } from '../../../core/tauri/tauri.service';

export interface SlackLoginResult {
  accessToken: string;
  userId: string;
  userName: string;
  teamId: string;
  teamName: string;
  teamDomain: string;
}

interface RustSlackTokens {
  access_token: string;
  user_id: string;
  user_name: string;
  team_id: string;
  team_name: string;
  team_domain: string;
}

/**
 * Bridges Angular to the Rust-side Slack OAuth v2 loopback flow.
 * Rust opens the system browser, runs a local HTTP listener on port
 * 43732, exchanges the auth code at slack.com/api/oauth.v2.access, and
 * returns the user-level access token (xoxp-*) plus team/user metadata.
 *
 * Slack user tokens don't expire by default. If the workspace opts into
 * token rotation, we'll need to add a refresh flow — not implemented
 * here yet since Bilet-X is a single-user desktop widget.
 */
@Injectable({
  providedIn: 'root',
})
export class SlackOAuthService {
  constructor(private tauri: TauriService) {}

  public isAvailable(): boolean {
    return this.tauri.isTauriAvailable();
  }

  public async login(): Promise<SlackLoginResult> {
    if (!this.tauri.isTauriAvailable()) {
      throw new Error('Slack sign-in requires the desktop app.');
    }
    const raw = await this.tauri.invokeCommand<RustSlackTokens>('slack_oauth_login');
    return {
      accessToken: raw.access_token,
      userId: raw.user_id,
      userName: raw.user_name,
      teamId: raw.team_id,
      teamName: raw.team_name,
      teamDomain: raw.team_domain,
    };
  }
}
