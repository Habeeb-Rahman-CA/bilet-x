import { Injectable } from '@angular/core';

/**
 * FLIP (First, Last, Invert, Play) animation helper for the dock buttons.
 *
 * Used by orientation changes: CSS can't interpolate `flex-direction`, so the
 * buttons re-layout instantly. FLIP compensates by measuring old and new
 * positions and animating each button from its old spot to the new one via
 * inverse-translate + transition.
 *
 * Usage:
 *   1. DockComponent registers its root element on mount.
 *   2. Caller invokes `capture()` before triggering the layout change.
 *   3. Caller invokes `play()` after the change; it awaits a paint frame,
 *      computes the delta, applies inverse transforms, and transitions each
 *      button to its true position.
 */
@Injectable({ providedIn: 'root' })
export class DockFlipService {
  private dockElement: HTMLElement | null = null;
  private captured: Map<Element, DOMRect> | null = null;
  private readonly DURATION_MS = 250;
  private readonly EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

  public register(el: HTMLElement): void {
    this.dockElement = el;
  }

  public unregister(): void {
    this.dockElement = null;
  }

  public capture(): void {
    if (!this.dockElement) return;
    const rects = new Map<Element, DOMRect>();
    this.dockElement.querySelectorAll('button').forEach((btn) => {
      rects.set(btn, btn.getBoundingClientRect());
    });
    this.captured = rects;
  }

  public async play(): Promise<void> {
    if (!this.dockElement || !this.captured) return;
    const first = this.captured;
    this.captured = null;

    // Give Angular one paint frame to commit the layout change so the
    // "Last" measurements reflect the new orientation.
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));

    const buttons = Array.from(this.dockElement.querySelectorAll('button')) as HTMLElement[];
    const moved: HTMLElement[] = [];

    for (const btn of buttons) {
      const oldRect = first.get(btn);
      if (!oldRect) continue;
      const newRect = btn.getBoundingClientRect();
      const dx = oldRect.left - newRect.left;
      const dy = oldRect.top - newRect.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;

      // Invert: transition-off + inverse translate places the button at its
      // pre-layout screen position without animation.
      btn.style.transition = 'none';
      btn.style.transform = `translate(${dx}px, ${dy}px)`;
      moved.push(btn);
    }

    if (moved.length === 0) return;

    // Force reflow so the browser commits the inverted state before the
    // transition property is re-attached.
    void this.dockElement.offsetHeight;

    await new Promise((r) => requestAnimationFrame(() => r(undefined)));

    // Play: remove the inverse transform under a targeted transition; the
    // browser now animates the button back to its true post-layout position.
    for (const btn of moved) {
      btn.style.transition = `transform ${this.DURATION_MS}ms ${this.EASING}`;
      btn.style.transform = '';
    }

    // Clear inline styles once the animation finishes so future frames use
    // the component's default class-based transitions.
    window.setTimeout(() => {
      for (const btn of moved) {
        btn.style.transition = '';
        btn.style.transform = '';
      }
    }, this.DURATION_MS + 30);
  }
}
