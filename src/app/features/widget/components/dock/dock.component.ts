import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DockFlipService } from '../../../../core/services/dock-flip.service';

export interface DockTab {
  id:
    | 'notes'
    | 'tasks'
    | 'messages'
    | 'jira'
    | 'github'
    | 'outlook'
    | 'whatsapp'
    | 'calendar'
    | 'calculator'
    | 'pomodoro'
    | 'clipboard'
    | 'activity'
    | 'settings'
    | string;
  label: string;
  icon?: string;
  badgeCount?: number;
}

export type DockSize = 'compact' | 'normal' | 'large';
export type DockOrientation = 'vertical' | 'horizontal';

@Component({
  selector: 'app-dock',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="titlebar-drag-region flex items-center rounded-2xl border border-neutral-800 bg-neutral-950/90 shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out select-none"
      [ngClass]="{
        'flex-col': orientation === 'vertical',
        'flex-row': orientation === 'horizontal',
        'space-y-2': orientation === 'vertical' && size === 'compact',
        'space-y-2.5': orientation === 'vertical' && size === 'normal',
        'space-y-3': orientation === 'vertical' && size === 'large',
        'space-x-2': orientation === 'horizontal' && size === 'compact',
        'space-x-2.5': orientation === 'horizontal' && size === 'normal',
        'space-x-3': orientation === 'horizontal' && size === 'large',
        'p-1.5': size === 'compact',
        'p-2': size === 'normal',
        'p-2.5': size === 'large',
        'opacity-20': faded,
        'opacity-100': !faded
      }"
    >
      <button
        *ngFor="let tab of tabs"
        (click)="onTabClick(tab)"
        type="button"
        [title]="tab.label"
        [ngClass]="{
          'bg-white text-black hover:text-black': activeTabId === tab.id && isPanelExpanded,
          'text-neutral-400 hover:text-white': activeTabId !== tab.id || !isPanelExpanded,
          'h-7 w-7': size === 'compact',
          'h-9 w-9': size === 'normal',
          'h-11 w-11': size === 'large'
        }"
        class="no-drag group relative flex items-center justify-center rounded-xl border border-transparent transition-all duration-200 ease-out hover:border-neutral-700"
      >
        <!-- Unread badge indicator -->
        <span
          *ngIf="(tab.badgeCount || 0) > 0"
          class="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-1 font-mono text-[8px] font-bold text-white shadow"
        >
          {{ tab.badgeCount }}
        </span>

        <!-- 1. Lucide FileText (Note) -->
        <svg
          *ngIf="tab.id === 'notes'"
          xmlns="http://www.w3.org/2000/svg"
          [attr.width]="iconSize"
          [attr.height]="iconSize"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-file-text"
        >
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="M10 9H8" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
        </svg>

        <!-- 2. Lucide CheckSquare (Task) -->
        <svg
          *ngIf="tab.id === 'tasks'"
          xmlns="http://www.w3.org/2000/svg"
          [attr.width]="iconSize"
          [attr.height]="iconSize"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-check-square"
        >
          <path d="m9 11 3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>

        <!-- 3. Gmail brand mark -->
        <svg
          *ngIf="tab.id === 'messages' || tab.icon === 'gmail'"
          xmlns="http://www.w3.org/2000/svg"
          [attr.width]="iconSize"
          [attr.height]="iconSize"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path
            d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"
          />
        </svg>

        <!-- 4. Jira brand mark -->
        <svg
          *ngIf="tab.id === 'jira' || tab.icon === 'jira'"
          xmlns="http://www.w3.org/2000/svg"
          [attr.width]="iconSize"
          [attr.height]="iconSize"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path
            d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.762a1.005 1.005 0 0 0-1.001-1.005zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.056A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z"
          />
        </svg>

        <!-- 4b. GitHub Octocat mark -->
        <svg
          *ngIf="tab.id === 'github' || tab.icon === 'github'"
          xmlns="http://www.w3.org/2000/svg"
          [attr.width]="iconSize"
          [attr.height]="iconSize"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path
            d="M12 .296C5.373.296 0 5.67 0 12.297c0 5.302 3.438 9.8 8.207 11.387.6.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.386-1.333-1.756-1.333-1.756-1.09-.744.083-.729.083-.729 1.205.084 1.84 1.236 1.84 1.236 1.07 1.834 2.807 1.304 3.492.997.108-.774.42-1.305.762-1.605-2.665-.303-5.467-1.332-5.467-5.93 0-1.31.467-2.381 1.235-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.51 11.51 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.654 1.653.243 2.874.12 3.176.77.84 1.233 1.911 1.233 3.221 0 4.61-2.807 5.624-5.479 5.921.43.371.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.565 22.092 24 17.598 24 12.297 24 5.67 18.627.296 12 .296z"
          />
        </svg>

        <!-- 4c. Outlook brand mark -->
        <svg
          *ngIf="tab.id === 'outlook' || tab.icon === 'outlook'"
          xmlns="http://www.w3.org/2000/svg"
          [attr.width]="iconSize"
          [attr.height]="iconSize"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path
            d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h13.9q.44 0 .75.3.3.3.3.75V10.85l1.24.72h.01q.1.07.18.18.07.12.07.25zm-6-8.25v3h3v-3zm0 4.5v3h3v-3zm0 4.5v1.83l3.05-1.83zm-5.25-9v3h3.75v-3zm0 4.5v3h3.75v-3zm0 4.5v2.03l2.41 1.5 1.34-.8v-2.73zM9 3.75V6h2l.13.01.12.04v-2.3zM5.98 15.98q1.14 0 2.02-.53.87-.53 1.34-1.45.48-.92.48-2.1 0-1.13-.47-2.03-.48-.9-1.33-1.4-.86-.5-1.98-.5-1.14 0-2.02.53-.88.53-1.36 1.46-.48.93-.48 2.1 0 1.14.48 2.05.48.91 1.36 1.44.88.53 1.96.53zM24 20.44L14.28 14v6.86H24z"
          />
        </svg>

        <!-- 4d. WhatsApp brand mark -->
        <svg
          *ngIf="tab.id === 'whatsapp' || tab.icon === 'whatsapp'"
          xmlns="http://www.w3.org/2000/svg"
          [attr.width]="iconSize"
          [attr.height]="iconSize"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path
            d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"
          />
        </svg>

        <!-- 5. Lucide Calendar -->
        <svg
          *ngIf="tab.id === 'calendar'"
          xmlns="http://www.w3.org/2000/svg"
          [attr.width]="iconSize"
          [attr.height]="iconSize"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-calendar"
        >
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h18" />
        </svg>

        <!-- 6. Lucide Calculator -->
        <svg
          *ngIf="tab.id === 'calculator'"
          xmlns="http://www.w3.org/2000/svg"
          [attr.width]="iconSize"
          [attr.height]="iconSize"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-calculator"
        >
          <rect width="16" height="20" x="4" y="2" rx="2" />
          <line x1="8" x2="16" y1="6" y2="6" />
          <line x1="16" x2="16" y1="14" y2="18" />
          <path d="M16 10h.01" />
          <path d="M12 10h.01" />
          <path d="M8 10h.01" />
          <path d="M12 14h.01" />
          <path d="M8 14h.01" />
          <path d="M12 18h.01" />
          <path d="M8 18h.01" />
        </svg>

        <!-- 7. Lucide Timer (Pomodoro) -->
        <svg
          *ngIf="tab.id === 'pomodoro'"
          xmlns="http://www.w3.org/2000/svg"
          [attr.width]="iconSize"
          [attr.height]="iconSize"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-timer"
        >
          <line x1="10" x2="14" y1="2" y2="2" />
          <line x1="12" x2="15" y1="14" y2="11" />
          <circle cx="12" cy="14" r="8" />
        </svg>

        <!-- 8. Lucide ClipboardList (Clipboard history) -->
        <svg
          *ngIf="tab.id === 'clipboard'"
          xmlns="http://www.w3.org/2000/svg"
          [attr.width]="iconSize"
          [attr.height]="iconSize"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-clipboard-list"
        >
          <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <path d="M12 11h4" />
          <path d="M12 16h4" />
          <path d="M8 11h.01" />
          <path d="M8 16h.01" />
        </svg>

        <!-- 9. Lucide History (Activity) -->
        <svg
          *ngIf="tab.id === 'activity'"
          xmlns="http://www.w3.org/2000/svg"
          [attr.width]="iconSize"
          [attr.height]="iconSize"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-history"
        >
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7v5l4 2" />
        </svg>

        <!-- 10. Lucide Settings (Settings) -->
        <svg
          *ngIf="tab.id === 'settings'"
          xmlns="http://www.w3.org/2000/svg"
          [attr.width]="iconSize"
          [attr.height]="iconSize"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-settings"
        >
          <path
            d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
          />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </div>
  `,
})
export class DockComponent implements AfterViewInit, OnDestroy {
  @Input() tabs: DockTab[] = [];
  @Input() activeTabId: string = 'notes';
  @Input() isPanelExpanded: boolean = false;
  @Input() size: DockSize = 'normal';
  @Input() orientation: DockOrientation = 'vertical';
  @Input() faded: boolean = false;

  @Output() tabSelect = new EventEmitter<DockTab>();

  constructor(
    private el: ElementRef<HTMLElement>,
    private flip: DockFlipService
  ) {}

  public ngAfterViewInit(): void {
    this.flip.register(this.el.nativeElement);
  }

  public ngOnDestroy(): void {
    this.flip.unregister();
  }

  public get iconSize(): number {
    return this.size === 'compact' ? 12 : this.size === 'large' ? 20 : 16;
  }

  public onTabClick(tab: DockTab): void {
    this.tabSelect.emit(tab);
  }
}
