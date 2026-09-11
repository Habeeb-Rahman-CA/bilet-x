import { Injectable } from '@angular/core';
import { TauriService } from '../../../core/tauri/tauri.service';

export interface WhatsAppPhoneNumber {
  id: string;
  displayPhoneNumber: string;
  verifiedName: string;
}

export interface WhatsAppLoginResult {
  accessToken: string;
  expiresIn: number;
  userId: string;
  userName: string;
  wabaId: string;
  wabaName: string;
  businessId: string;
  businessName: string;
  phoneNumbers: WhatsAppPhoneNumber[];
}

interface RustWhatsAppTokens {
  access_token: string;
  expires_in: number;
  user_id: string;
  user_name: string;
  waba_id: string;
  waba_name: string;
  business_id: string;
  business_name: string;
  phone_numbers: {
    id: string;
    display_phone_number: string;
    verified_name: string;
  }[];
}

/**
 * Bridges Angular to the Rust-side Meta OAuth flow for WhatsApp Business
 * Cloud API. Rust opens the system browser, runs a local HTTP listener on
 * port 43731, exchanges the code for a short-lived token, immediately
 * upgrades to a long-lived (~60 day) token, and discovers the user's first
 * WABA + phone numbers via Graph API.
 *
 * There is no refresh() — Meta long-lived tokens don't have a refresh
 * counterpart. When the token expires the user re-signs in.
 */
@Injectable({
  providedIn: 'root',
})
export class WhatsAppOAuthService {
  constructor(private tauri: TauriService) {}

  public isAvailable(): boolean {
    return this.tauri.isTauriAvailable();
  }

  public async login(): Promise<WhatsAppLoginResult> {
    if (!this.tauri.isTauriAvailable()) {
      throw new Error('WhatsApp sign-in requires the desktop app.');
    }
    const raw = await this.tauri.invokeCommand<RustWhatsAppTokens>('whatsapp_oauth_login');
    return {
      accessToken: raw.access_token,
      expiresIn: raw.expires_in,
      userId: raw.user_id,
      userName: raw.user_name,
      wabaId: raw.waba_id,
      wabaName: raw.waba_name,
      businessId: raw.business_id,
      businessName: raw.business_name,
      phoneNumbers: (raw.phone_numbers || []).map((p) => ({
        id: p.id,
        displayPhoneNumber: p.display_phone_number,
        verifiedName: p.verified_name,
      })),
    };
  }
}
