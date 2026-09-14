import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DockFlipService } from '../../../../core/services/dock-flip.service';
import { TabIconComponent } from './tab-icon.component';

export interface DockTab {
  id:
    | 'notes'
    | 'tasks'
    | 'messages'
    | 'jira'
    | 'github'
    | 'outlook'
    | 'whatsapp'
    | 'slack'
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
  imports: [CommonModule, TabIconComponent],
  styles: [
    `
      /* iOS-style edit-mode jiggle. Kept subtle so it feels alive but
         doesn't distract during a real reorder gesture. */
      @keyframes dock-jiggle {
        0%   { transform: rotate(-1.2deg); }
        50%  { transform: rotate(1.2deg); }
        100% { transform: rotate(-1.2deg); }
      }
      .jiggle {
        animation: dock-jiggle 0.32s ease-in-out infinite;
        transform-origin: center;
      }
      /* Offset alternating tabs so the jiggle doesn't march in lockstep. */
      .jiggle:nth-child(even) {
        animation-delay: -0.16s;
      }

      /* Add-tab popover positioning. Scoped CSS instead of Tailwind ngClass
         so v4's content scanner can't drop these transform utilities. Each
         class sits the popover flush against the + button with a 6px gap
         (the visual "seam" at the L-corner) and pins the perpendicular axis
         so icons land exactly on the same line as the + icon.
         flex-direction is also set here — depending on Tailwind's flex-col /
         flex-row from ngClass string keys turned out to be unreliable. */
      .popover-left {
        right: 100%;
        top: 50%;
        transform: translateY(-50%);
        margin-right: 6px;
        flex-direction: row;
      }
      .popover-right {
        left: 100%;
        top: 50%;
        transform: translateY(-50%);
        margin-left: 6px;
        flex-direction: row;
      }
      .popover-up {
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-bottom: 6px;
        flex-direction: column;
      }
      .popover-down {
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-top: 6px;
        flex-direction: column;
      }
    `,
  ],
  template: `
    <div
      class="titlebar-drag-region glass-surface flex items-center rounded-[22px] transition-all duration-300 ease-out select-none"
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
        'opacity-20': faded && !isEditMode,
        'opacity-100': !faded || isEditMode,
        'ring-1 ring-white/25': isEditMode
      }"
      (pointerdown)="onContainerPointerDown($event)"
      (pointerup)="onContainerPointerUp()"
      (pointercancel)="onContainerPointerUp()"
    >
      <!-- Edit-mode dock config buttons (size cycle + orientation toggle).
           Prepended before the tabs so they read as a small toolbar at the
           head of the dock. Hidden when not editing. -->
      <ng-container *ngIf="isEditMode">
        <button
          (click)="cycleDockSize.emit(); $event.stopPropagation()"
          (pointerdown)="$event.stopPropagation()"
          type="button"
          [title]="'Dock size: ' + size + ' (click to cycle)'"
          [ngClass]="{
            'h-7 w-7': size === 'compact',
            'h-9 w-9': size === 'normal',
            'h-11 w-11': size === 'large'
          }"
          class="no-drag glass-btn relative flex items-center justify-center rounded-full"
        >
          <!-- "Density" glyph: three horizontal bars, each thicker/taller than
               the last, hinting at the size ladder. -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            [attr.width]="iconSize"
            [attr.height]="iconSize"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
          >
            <line x1="6" y1="8" x2="18" y2="8" stroke-width="1.5" />
            <line x1="6" y1="12" x2="18" y2="12" stroke-width="2.5" />
            <line x1="6" y1="16" x2="18" y2="16" stroke-width="4" />
          </svg>
        </button>

        <button
          (click)="toggleDockOrientation.emit(); $event.stopPropagation()"
          (pointerdown)="$event.stopPropagation()"
          type="button"
          [title]="'Orientation: ' + orientation + ' (click to toggle)'"
          [ngClass]="{
            'h-7 w-7': size === 'compact',
            'h-9 w-9': size === 'normal',
            'h-11 w-11': size === 'large'
          }"
          class="no-drag glass-btn relative flex items-center justify-center rounded-full"
        >
          <!-- Rotates 90° to mirror current orientation state, so the icon
               itself reflects vertical vs horizontal at a glance. -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            [attr.width]="iconSize"
            [attr.height]="iconSize"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            [class.rotate-90]="orientation === 'horizontal'"
            class="transition-transform duration-200"
          >
            <rect x="9" y="3" width="6" height="18" rx="1.5" />
            <line x1="12" y1="7" x2="12" y2="7.01" />
          </svg>
        </button>

      </ng-container>

      <button
        *ngFor="let tab of visualTabs(); let i = index; trackBy: trackTabId"
        #tabBtn
        [attr.data-tab-index]="i"
        (click)="onTabClick(tab)"
        (pointerdown)="onPointerDown($event, tab, i)"
        (pointermove)="onPointerMove($event)"
        (pointerup)="onPointerUp($event)"
        (pointercancel)="onPointerCancel()"
        type="button"
        [title]="tab.label"
        [ngClass]="{
          'is-selected': activeTabId === tab.id && isPanelExpanded && dragIndex() !== i,
          'h-7 w-7': size === 'compact',
          'h-9 w-9': size === 'normal',
          'h-11 w-11': size === 'large',
          'z-10 ring-1 ring-white/40 bg-white/[0.14]': isDragging() && dragIndex() === i,
          'jiggle': isEditMode && !(isDragging() && dragIndex() === i),
          'cursor-grabbing': isDragging()
        }"
        class="no-drag glass-btn group relative flex cursor-pointer items-center justify-center rounded-full"
      >
        <!-- Unread badge indicator -->
        <span
          *ngIf="(tab.badgeCount || 0) > 0"
          class="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-1 font-mono text-[8px] font-bold text-white shadow"
        >
          {{ tab.badgeCount }}
        </span>

        <app-tab-icon [tab]="tab" [size]="iconSize"></app-tab-icon>
      </button>

      <!-- + button + popover (edit mode only). Wrapped in a relative
           positioning container so the popover renders as a sibling of
           the button — nesting a <div> with buttons inside a <button>
           is invalid HTML and some browsers refuse to render it. -->
      <div *ngIf="isEditMode" class="no-drag relative">
        <button
          #addBtn
          (click)="toggleAddPopover(); $event.stopPropagation()"
          type="button"
          [title]="isDragging() ? 'Drop here to remove' : 'Add tab'"
          [ngClass]="{
            'h-7 w-7': size === 'compact',
            'h-9 w-9': size === 'normal',
            'h-11 w-11': size === 'large',
            'bg-red-500/20 text-red-50 ring-1 ring-red-400/60 scale-110': isDragging() && isOverAddBtn(),
            'bg-red-500/10 text-red-200 ring-1 ring-red-400/30': isDragging() && !isOverAddBtn(),
            'is-selected': !isDragging() && isAddPopoverOpen(),
            'glass-btn': !isDragging() && !isAddPopoverOpen()
          }"
          class="flex items-center justify-center rounded-full transition-all duration-150 ease-out"
        >
          <!-- + when idle, × when a drag is in progress -->
          <svg
            *ngIf="!isDragging()"
            xmlns="http://www.w3.org/2000/svg"
            [attr.width]="iconSize"
            [attr.height]="iconSize"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          <svg
            *ngIf="isDragging()"
            xmlns="http://www.w3.org/2000/svg"
            [attr.width]="iconSize"
            [attr.height]="iconSize"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>

        <!-- Add-tab popover: perpendicular icon strip forming an L with the
             dock. For a vertical dock (+ at bottom), the popover is a
             horizontal row extending left/right from the +; for a horizontal
             dock (+ at right), it's a vertical column extending up/down. The
             popover sits flush against the + button — no gap — so the two
             strips share the L-corner cleanly. Padding + gap match the dock's
             size so icons land on the same axis as the + icon. -->
        <div
          *ngIf="isAddPopoverOpen() && !isDragging()"
          (click)="$event.stopPropagation()"
          (pointerdown)="$event.stopPropagation()"
          class="no-drag glass-surface absolute z-30 flex items-center rounded-2xl"
          [ngClass]="{
            'p-1.5 gap-2': size === 'compact',
            'p-2 gap-2.5': size === 'normal',
            'p-2.5 gap-3': size === 'large',
            'popover-left': popoverDirection === 'left',
            'popover-right': popoverDirection === 'right',
            'popover-up': popoverDirection === 'up',
            'popover-down': popoverDirection === 'down'
          }"
        >
          <div
            *ngIf="hiddenTabs.length === 0"
            class="whitespace-nowrap px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-neutral-500"
          >
            All tabs visible
          </div>

          <button
            *ngFor="let hidden of hiddenTabs"
            (click)="onAddTab(hidden); $event.stopPropagation()"
            (pointerdown)="$event.stopPropagation()"
            type="button"
            [title]="hidden.label"
            [ngClass]="{
              'h-7 w-7': size === 'compact',
              'h-9 w-9': size === 'normal',
              'h-11 w-11': size === 'large'
            }"
            class="no-drag glass-btn flex shrink-0 items-center justify-center rounded-full"
          >
            <app-tab-icon [tab]="hidden" [size]="iconSize"></app-tab-icon>
          </button>
        </div>
      </div>
    </div>
  `,
})
export class DockComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() tabs: DockTab[] = [];
  @Input() activeTabId: string = 'notes';
  @Input() isPanelExpanded: boolean = false;
  @Input() size: DockSize = 'normal';
  @Input() orientation: DockOrientation = 'vertical';
  @Input() faded: boolean = false;

  @Input() isEditMode: boolean = false;
  @Input() hiddenTabs: DockTab[] = [];
  /** Where the add-tab popover should open relative to the + button. */
  @Input() popoverDirection: 'left' | 'right' | 'up' | 'down' = 'left';

  @Output() tabSelect = new EventEmitter<DockTab>();
  @Output() tabReorder = new EventEmitter<{ fromIndex: number; toIndex: number }>();
  @Output() enterEditMode = new EventEmitter<void>();
  @Output() addTab = new EventEmitter<DockTab>();
  @Output() removeTab = new EventEmitter<DockTab>();
  @Output() cycleDockSize = new EventEmitter<void>();
  @Output() toggleDockOrientation = new EventEmitter<void>();

  @ViewChildren('tabBtn') private tabButtons?: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('addBtn') private addBtn?: ElementRef<HTMLElement>;

  /**
   * Live signal tracked during a drag session: is the pointer currently
   * over the "+" button (which visually transforms into an X)? Drives the
   * remove-target highlight and, on pointerup, the removeTab emission.
   */
  public isOverAddBtn = signal<boolean>(false);

  // Gesture: long-press (500ms hold without moving) any tab to enter
  // edit mode. Once in edit mode, any pointerdown on a tab arms a drag
  // session immediately (no long-press needed) — release to drop.
  //
  // A tap that ends before the long-press timer fires (or moves further
  // than MOVE_TOLERANCE_PX) is treated as a normal click and fires
  // tabSelect. In edit mode, a tap-then-release also fires tabSelect —
  // the widget listener exits edit mode when a tab is selected.
  private readonly LONG_PRESS_MS = 500;
  private readonly MOVE_TOLERANCE_PX = 5;
  private pressTimerId: number | null = null;
  private pressStartX = 0;
  private pressStartY = 0;
  private pressIndex: number | null = null;
  private armed = false;
  private justDragged = false;
  private dragStartIndex: number | null = null;
  public dragIndex = signal<number | null>(null);
  public isDragging = signal<boolean>(false);

  /** Whether the "+ add tab" popover is open. Only shown in edit mode. */
  public isAddPopoverOpen = signal<boolean>(false);

  /**
   * Snapshot of every tab button's screen rect, taken at the moment
   * dragging begins. Reused for hit-testing throughout the drag session.
   *
   * Why not measure live? During FLIP animations the buttons' visual
   * rects are transitioning between their old and new positions. Live
   * measurements would return mid-animation rects, so the tab whose
   * data-tab-index just updated to N+1 might still be visually at
   * position N — causing hit-tests to keep triggering "revert" reorders
   * back to the previous state until the animation completes. Static
   * layout rects avoid the whole ping-pong.
   */
  private tabRectSnapshot: DOMRect[] = [];

  /**
   * Shadow of the @Input `tabs` used to preview live-reorder positions
   * during a drag session. Kept in sync with `tabs` via ngOnChanges when
   * not dragging; mutated on each pointermove hop during a drag so the
   * FLIP service can animate every other tab into its new position.
   */
  public visualTabs = signal<DockTab[]>([]);

  constructor(
    private el: ElementRef<HTMLElement>,
    private flip: DockFlipService
  ) {}

  public ngAfterViewInit(): void {
    this.flip.register(this.el.nativeElement);
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['tabs'] && !this.isDragging()) {
      // Mirror the input into the local visual buffer whenever we're not
      // mid-drag. If a drag is in progress we intentionally ignore updates
      // — the local visualTabs is authoritative until pointerup completes.
      this.visualTabs.set([...this.tabs]);
    }
  }

  public ngOnDestroy(): void {
    this.cancelLongPress();
    this.flip.unregister();
  }

  public get iconSize(): number {
    return this.size === 'compact' ? 12 : this.size === 'large' ? 20 : 16;
  }

  public onTabClick(tab: DockTab): void {
    // A drag just completed — swallow the trailing click so tabSelect
    // doesn't fire on the tab the user dropped onto.
    if (this.justDragged) {
      this.justDragged = false;
      return;
    }
    this.tabSelect.emit(tab);
  }

  public trackTabId(_index: number, tab: DockTab): string {
    return tab.id;
  }

  public toggleAddPopover(): void {
    this.isAddPopoverOpen.update((v) => !v);
  }

  public onAddTab(tab: DockTab): void {
    this.addTab.emit(tab);
    this.isAddPopoverOpen.set(false);
  }

  /**
   * Long-press-anywhere-on-dock → edit mode. Fires on pointerdown against
   * the dock container itself (padding, gaps between icons). Presses that
   * land on a button — tabs, edit-mode toolbar buttons, + — bubble up
   * here too, but we skip them so their own handlers own the interaction
   * (tabs need long-press-and-arm; toolbar buttons need plain click).
   *
   * The dock container has `-webkit-app-region: drag` for window-drag
   * support, so if the user starts moving during the 500ms hold, Tauri
   * takes over and JS stops receiving pointermove events. The timer then
   * fires anyway, which is intentional: any 500ms hold on the dock reads
   * as "I want to edit," and users who wanted to drag will typically
   * release well before the timer.
   */
  public onContainerPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    if (this.isEditMode) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('button')) return;

    this.pressStartX = event.clientX;
    this.pressStartY = event.clientY;
    this.pressIndex = null;
    this.pressTimerId = window.setTimeout(
      () => this.onLongPressFired(),
      this.LONG_PRESS_MS
    );
  }

  public onContainerPointerUp(): void {
    this.cancelLongPress();
  }

  public onPointerDown(event: PointerEvent, _tab: DockTab, index: number): void {
    // Only handle primary button.
    if (event.button !== 0) return;

    const el = event.currentTarget as HTMLElement;
    try {
      el.setPointerCapture(event.pointerId);
    } catch {}

    if (this.isEditMode) {
      // Already in edit mode — arm drag immediately on any tab press.
      this.armDragFor(index);
      event.preventDefault();
      return;
    }

    // Not in edit mode — start long-press timer. If the user releases or
    // moves further than MOVE_TOLERANCE_PX before it fires, the tap is
    // treated as a normal click and tabSelect handles it.
    this.pressStartX = event.clientX;
    this.pressStartY = event.clientY;
    this.pressIndex = index;
    this.pressTimerId = window.setTimeout(
      () => this.onLongPressFired(),
      this.LONG_PRESS_MS
    );
  }

  private armDragFor(index: number): void {
    this.armed = true;
    this.dragStartIndex = index;
    this.dragIndex.set(index);
  }

  private onLongPressFired(): void {
    this.pressTimerId = null;
    // Notify parent to enter edit mode + arm this tab for immediate drag
    // so the same continuous gesture can slide right into reordering.
    this.enterEditMode.emit();
    if (this.pressIndex !== null) {
      this.armDragFor(this.pressIndex);
    }
    this.pressIndex = null;
  }

  private cancelLongPress(): void {
    if (this.pressTimerId !== null) {
      window.clearTimeout(this.pressTimerId);
      this.pressTimerId = null;
    }
    this.pressIndex = null;
  }

  public onPointerMove(event: PointerEvent): void {
    // If a long-press is pending, cancel it as soon as the pointer strays
    // past the tolerance — that's a swipe / accidental drag, not a hold.
    if (this.pressTimerId !== null) {
      const dx = event.clientX - this.pressStartX;
      const dy = event.clientY - this.pressStartY;
      if (
        Math.abs(dx) > this.MOVE_TOLERANCE_PX ||
        Math.abs(dy) > this.MOVE_TOLERANCE_PX
      ) {
        this.cancelLongPress();
      }
      return;
    }

    if (!this.armed) return;

    if (!this.isDragging()) {
      // First move after arming — enter drag mode. Snapshot visualTabs and
      // capture stable tab rects for hit-testing (see tabRectSnapshot doc).
      this.isDragging.set(true);
      this.visualTabs.set([...this.tabs]);
      this.tabRectSnapshot =
        this.tabButtons
          ?.toArray()
          .map((b) => b.nativeElement.getBoundingClientRect()) ?? [];
    }

    // Update the "over remove target" highlight regardless of whether we
    // actually reorder this frame.
    this.isOverAddBtn.set(this.isPointerOverAddBtn(event.clientX, event.clientY));

    const overIdx = this.findTabIndexUnderPointer(event.clientX, event.clientY);
    const currentIdx = this.dragIndex();
    if (overIdx === null || currentIdx === null || overIdx === currentIdx) {
      return;
    }

    this.flip.capture();
    this.visualTabs.update((tabs) => {
      const next = [...tabs];
      const [item] = next.splice(currentIdx, 1);
      next.splice(overIdx, 0, item);
      return next;
    });
    this.dragIndex.set(overIdx);
    void this.flip.play();
  }

  public onPointerUp(event: PointerEvent): void {
    this.cancelLongPress();

    const wasDragging = this.isDragging();
    if (wasDragging) {
      const droppedOnRemove = this.isPointerOverAddBtn(event.clientX, event.clientY);
      const from = this.dragStartIndex;
      const to = this.dragIndex();

      if (droppedOnRemove && from !== null) {
        // Dropped on the X (was +). Emit remove — parent flips the tab's
        // visibility to false. Reorder is skipped.
        const removed = this.tabs[from];
        if (removed) this.removeTab.emit(removed);
      } else if (from !== null && to !== null && from !== to) {
        this.tabReorder.emit({ fromIndex: from, toIndex: to });
      }

      // Swallow the trailing click that fires on pointerup so tabSelect
      // (or the + button's click) doesn't run on the drop target.
      this.justDragged = true;
    }

    this.armed = false;
    this.isDragging.set(false);
    this.isOverAddBtn.set(false);
    this.dragIndex.set(null);
    this.dragStartIndex = null;
    this.tabRectSnapshot = [];

    const el = event.currentTarget as HTMLElement;
    try {
      el.releasePointerCapture(event.pointerId);
    } catch {}
  }

  public onPointerCancel(): void {
    this.cancelLongPress();
    if (this.isDragging()) {
      this.justDragged = true;
      this.visualTabs.set([...this.tabs]);
    }
    this.armed = false;
    this.isDragging.set(false);
    this.isOverAddBtn.set(false);
    this.dragIndex.set(null);
    this.dragStartIndex = null;
    this.tabRectSnapshot = [];
  }

  /**
   * Whether the given screen point falls inside the + / X button's rect.
   * Used both to highlight the button as a drop target during a drag and
   * to decide, on pointerup, whether the drop counts as "remove".
   */
  private isPointerOverAddBtn(x: number, y: number): boolean {
    const el = this.addBtn?.nativeElement;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  /**
   * Find which tab position the pointer is currently over, using the
   * static rect snapshot captured at drag start.
   *
   * Because these rects don't move during the drag, hit-tests reflect
   * the fixed screen positions of slots 0..N. Live-reordering swaps
   * which tab OCCUPIES each slot in `visualTabs`, but the slot itself
   * (its rect) stays put — exactly what a reorder gesture wants.
   */
  private findTabIndexUnderPointer(x: number, y: number): number | null {
    for (let i = 0; i < this.tabRectSnapshot.length; i++) {
      const rect = this.tabRectSnapshot[i];
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return i;
      }
    }
    return null;
  }
}
