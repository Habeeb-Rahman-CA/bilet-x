import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IntegrationManagerService } from '../../../../integrations/core/integration-manager.service';
import {
  WhatsAppIntegration,
  WhatsAppTemplate,
} from '../../../../integrations/providers/whatsapp/whatsapp.integration';
import { WhatsAppPhoneNumber } from '../../../../integrations/core/auth/whatsapp-oauth.service';
import { WindowService } from '../../../../core/tauri/window.service';

@Component({
  selector: 'app-whatsapp',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex h-full flex-col">

      <!-- ==========================================
           NOT CONNECTED — SIGN IN WITH META CARD
           ========================================== -->
      <ng-container *ngIf="!isConnected()">
        <div class="flex flex-1 flex-col items-center justify-center space-y-5 px-3 py-8">

          <div class="flex flex-col items-center space-y-1 text-center">
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/80 text-[#25D366]">
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
              </svg>
            </div>
            <div class="text-sm font-semibold text-white pt-1">Connect WhatsApp Business</div>
            <div class="text-[10px] leading-relaxed text-neutral-400 max-w-[240px]">
              Sign in with Meta to manage your WhatsApp Business Account. This links a WABA — personal WhatsApp chats aren't available via the Cloud API.
            </div>
          </div>

          <!-- Error banner -->
          <div
            *ngIf="connectError()"
            class="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[10px] leading-relaxed text-red-300"
          >
            <span class="mr-1">⚠️</span>{{ connectError() }}
          </div>

          <!-- Sign in with Meta button (idle) -->
          <button
            *ngIf="!isConnecting()"
            (click)="onSignInWithMeta()"
            type="button"
            class="flex w-full items-center justify-center space-x-2 rounded-lg bg-[#1877F2] py-2.5 px-4 font-semibold text-[12px] text-white transition hover:bg-[#166fe0] active:scale-[0.99]"
          >
            <!-- Meta / Facebook 'f' mark -->
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span>Sign in with Meta</span>
          </button>

          <!-- Waiting state -->
          <div *ngIf="isConnecting()" class="w-full space-y-2">
            <div class="flex w-full items-center justify-center space-x-2 rounded-lg bg-neutral-800 py-2.5 px-4 font-medium text-[12px] text-neutral-300">
              <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
              </svg>
              <span>Waiting for Meta...</span>
            </div>
            <button
              (click)="cancelSignIn()"
              type="button"
              class="w-full rounded-lg border border-neutral-800 bg-neutral-900 py-1.5 px-4 font-mono text-[10px] text-neutral-400 transition hover:border-neutral-700 hover:text-white"
            >
              Cancel
            </button>
          </div>

          <p *ngIf="!isConnecting()" class="text-center text-[9px] leading-relaxed text-neutral-500 max-w-[240px]">
            A browser tab will open for Meta consent. You'll be asked to grant WhatsApp Business permissions to Bilet-X.
          </p>
        </div>
      </ng-container>

      <!-- ==========================================
           CONNECTED — WABA DASHBOARD
           ========================================== -->
      <ng-container *ngIf="isConnected()">
        <div class="flex h-full flex-col space-y-2.5 text-xs">

          <!-- HEADER -->
          <div class="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/90 p-2 text-xs">
            <div class="flex items-center space-x-1.5 font-mono text-[10px] text-neutral-400 overflow-hidden">
              <span class="flex h-2 w-2 shrink-0 rounded-full bg-emerald-400"></span>
              <span class="font-medium text-neutral-200">WhatsApp Business</span>
              <span *ngIf="businessName()" class="truncate text-neutral-500">· {{ businessName() }}</span>
            </div>

            <button
              (click)="refresh()"
              type="button"
              [disabled]="isLoading()"
              title="Sync"
              class="flex h-6 w-6 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-800 text-neutral-300 transition hover:bg-neutral-700 hover:text-white disabled:opacity-50"
            >
              <svg
                [class.animate-spin]="isLoading()"
                xmlns="http://www.w3.org/2000/svg" width="12" height="12"
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
            </button>
          </div>

          <!-- ERROR BANNER -->
          <div
            *ngIf="errorMessage()"
            class="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-[10px] text-red-300 space-y-1"
          >
            <div class="flex items-center space-x-1.5 font-semibold text-red-400">
              <span>⚠️</span>
              <span>WhatsApp Notice</span>
            </div>
            <div class="leading-relaxed">{{ errorMessage() }}</div>
          </div>

          <!-- CONTENT: WABA info -->
          <div class="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">

            <!-- WABA SUMMARY CARD -->
            <div class="rounded-xl border border-neutral-800 bg-neutral-900/80 p-3 space-y-2">
              <div class="text-[9px] uppercase tracking-wider text-neutral-500 font-mono">Business Account</div>
              <div class="text-sm font-semibold text-white truncate" [title]="wabaName()">
                {{ wabaName() || '(no WABA linked)' }}
              </div>
              <div *ngIf="wabaId()" class="font-mono text-[9px] text-neutral-500 truncate">
                WABA ID: {{ wabaId() }}
              </div>
            </div>

            <!-- PHONE NUMBERS -->
            <div *ngIf="phoneNumbers().length > 0" class="space-y-1.5">
              <div class="text-[9px] uppercase tracking-wider text-neutral-500 font-mono px-1">
                Phone numbers ({{ phoneNumbers().length }})
              </div>
              <div
                *ngFor="let pn of phoneNumbers()"
                class="rounded-xl border border-neutral-800 bg-neutral-900/80 p-2.5 space-y-1"
              >
                <div class="flex items-center justify-between">
                  <div class="font-medium text-neutral-100 truncate">
                    {{ pn.displayPhoneNumber || '(unregistered)' }}
                  </div>
                  <span *ngIf="pn.verifiedName" class="rounded bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 font-mono text-[8px] text-emerald-400">
                    verified
                  </span>
                </div>
                <div *ngIf="pn.verifiedName" class="text-[10px] text-neutral-400 truncate">
                  {{ pn.verifiedName }}
                </div>
                <div class="font-mono text-[9px] text-neutral-500 truncate">
                  {{ pn.id }}
                </div>
              </div>
            </div>

            <!-- TEMPLATES -->
            <div *ngIf="templates().length > 0" class="space-y-1.5">
              <div class="text-[9px] uppercase tracking-wider text-neutral-500 font-mono px-1">
                Message templates ({{ templates().length }})
              </div>
              <div
                *ngFor="let t of templates()"
                class="rounded-xl border border-neutral-800 bg-neutral-900/80 p-2.5"
              >
                <div class="flex items-center justify-between space-x-2">
                  <div class="flex-1 space-y-1 overflow-hidden">
                    <div class="flex items-center space-x-1.5">
                      <span
                        class="h-1.5 w-1.5 shrink-0 rounded-full"
                        [class.bg-emerald-400]="t.status === 'APPROVED'"
                        [class.bg-amber-400]="t.status === 'PENDING'"
                        [class.bg-red-400]="t.status === 'REJECTED'"
                        [class.bg-neutral-500]="t.status !== 'APPROVED' && t.status !== 'PENDING' && t.status !== 'REJECTED'"
                      ></span>
                      <span class="truncate font-medium text-neutral-100" [title]="t.name">
                        {{ t.name }}
                      </span>
                    </div>
                    <div class="flex flex-wrap items-center gap-1 font-mono text-[9px] text-neutral-400">
                      <span class="rounded bg-neutral-800 px-1.5 py-0.5">{{ t.language }}</span>
                      <span class="rounded bg-neutral-800/70 px-1.5 py-0.5">{{ t.category }}</span>
                      <span class="rounded bg-neutral-800/90 px-1.5 py-0.5 uppercase">{{ t.status }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- WABA MISSING PROMPT -->
            <div *ngIf="!wabaId()" class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[10px] text-amber-200 space-y-1">
              <div class="font-semibold">No WhatsApp Business Account found on this Meta account.</div>
              <div class="leading-relaxed text-amber-300/80">
                Complete WhatsApp onboarding in Meta Business Manager (add a business phone number, verify the display name), then click Refresh here.
              </div>
            </div>

            <!-- MANAGE ON META -->
            <button
              (click)="openBusinessManager()"
              type="button"
              class="w-full rounded-lg border border-neutral-800 bg-neutral-900 py-2 px-3 font-mono text-[10px] text-neutral-300 transition hover:border-neutral-700 hover:text-white"
            >
              Open Meta Business Manager →
            </button>
          </div>
        </div>
      </ng-container>
    </div>
  `,
})
export class WhatsAppComponent implements OnInit {
  public isLoading = signal<boolean>(false);
  private localError = signal<string | null>(null);
  public templates = signal<WhatsAppTemplate[]>([]);

  public errorMessage = computed(() => this.localError());

  public isConnected = computed(
    () => this.integrationManager.getConnectionsForProvider('whatsapp').length > 0
  );

  private currentConnection = computed(
    () => this.integrationManager.getConnectionsForProvider('whatsapp')[0]
  );

  public businessName = computed(
    () => this.currentConnection()?.config?.['businessName'] || ''
  );

  public wabaId = computed(() => this.currentConnection()?.config?.['wabaId'] || '');

  public wabaName = computed(() => this.currentConnection()?.config?.['wabaName'] || '');

  public phoneNumbers = computed<WhatsAppPhoneNumber[]>(() => {
    const raw = this.currentConnection()?.config?.['phoneNumbers'];
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  public isConnecting = signal<boolean>(false);
  public connectError = signal<string | null>(null);

  private signInSeq = 0;

  constructor(
    public integrationManager: IntegrationManagerService,
    private whatsappIntegration: WhatsAppIntegration,
    private windowService: WindowService
  ) {}

  public ngOnInit(): void {
    if (this.isConnected() && this.wabaId()) {
      this.refresh();
    }
  }

  public async onSignInWithMeta(): Promise<void> {
    if (this.isConnecting()) return;
    const mySeq = ++this.signInSeq;
    this.isConnecting.set(true);
    this.connectError.set(null);
    this.localError.set(null);

    try {
      const conn = await this.integrationManager.connectProvider('whatsapp', {});

      if (mySeq !== this.signInSeq) return;

      if (conn.status === 'error') {
        this.connectError.set(
          conn.errorMessage || 'Sign-in failed. Please try again.'
        );
        return;
      }

      await this.refresh();
    } catch (err: any) {
      if (mySeq !== this.signInSeq) return;
      this.connectError.set(err?.message || 'Sign-in failed. Please try again.');
    } finally {
      if (mySeq === this.signInSeq) {
        this.isConnecting.set(false);
      }
    }
  }

  public cancelSignIn(): void {
    this.signInSeq++;
    this.isConnecting.set(false);
    this.connectError.set('Sign-in cancelled. You can try again.');
  }

  public async refresh(): Promise<void> {
    if (this.isLoading()) return;
    const conn = this.currentConnection();
    if (!conn || !this.wabaId()) {
      this.templates.set([]);
      return;
    }
    this.isLoading.set(true);
    this.localError.set(null);
    try {
      const templates = await this.whatsappIntegration.fetchTemplates(conn.connectionId);
      this.templates.set(templates);
    } catch (err: any) {
      this.localError.set(err?.message || 'Failed to fetch WhatsApp templates.');
    } finally {
      this.isLoading.set(false);
    }
  }

  public openBusinessManager(): void {
    const bizId = this.currentConnection()?.config?.['businessId'];
    const url = bizId
      ? `https://business.facebook.com/wa/manage/home/?business_id=${encodeURIComponent(bizId)}`
      : 'https://business.facebook.com/wa/manage/home/';
    this.windowService.openExternalUrl(url);
  }
}
