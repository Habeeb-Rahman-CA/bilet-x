import { Injectable, computed, Signal } from '@angular/core';
import { TauriService } from './tauri.service';
import { PersistenceService } from './persistence.service';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  public isNotificationsEnabled: Signal<boolean>;

  constructor(
    private tauriService: TauriService,
    private persistence: PersistenceService
  ) {
    this.isNotificationsEnabled = computed(
      () => this.persistence.getSettingValue('notifications_enabled', 'true') === 'true'
    );
  }

  public async sendNotification(title: string, body?: string): Promise<boolean> {
    if (!this.isNotificationsEnabled()) {
      return false;
    }

    try {
      await this.tauriService.invokeCommand('send_desktop_notification', {
        title,
        body: body || null,
      });
      return true;
    } catch (e) {
      console.warn('Failed to send desktop notification', e);
      return false;
    }
  }

  public async toggleNotifications(enabled: boolean): Promise<void> {
    await this.persistence.setSetting('notifications_enabled', enabled ? 'true' : 'false');
  }

  public async sendTestNotification(): Promise<boolean> {
    return this.sendNotification(
      'Bilet-X Desktop',
      'Desktop notifications are configured and active!'
    );
  }
}
