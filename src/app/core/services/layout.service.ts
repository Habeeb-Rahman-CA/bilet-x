import { Injectable } from '@angular/core';
import { WindowService } from '../tauri/window.service';

/**
 * Ensures the whole widget window sits fully within the current monitor's
 * visible area, so the panel has room to unfold when opened.
 *
 * Called by WidgetComponent right before expanding the panel. Reads the
 * live window position via DOM screen APIs (so it always reflects the
 * user's latest drag), and only issues a set_window_position if the
 * window would otherwise clip an edge. Small, single nudge — no layout
 * flip, no dock teleport.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  constructor(private windowService: WindowService) {}

  public async ensureVisible(): Promise<void> {
    const wx = window.screenLeft ?? window.screenX ?? 0;
    const wy = window.screenTop ?? window.screenY ?? 0;
    const ww = window.outerWidth || 640;
    const wh = window.outerHeight || 440;

    // screen.availLeft/availTop position the current monitor within the
    // virtual desktop (nonzero on secondary monitors); use absolute bounds
    // so the check works on any monitor.
    const availL = (window.screen as any).availLeft ?? 0;
    const availT = (window.screen as any).availTop ?? 0;
    const availW = window.screen.availWidth;
    const availH = window.screen.availHeight;
    const monitorRight = availL + availW;
    const monitorBottom = availT + availH;

    let newX = wx;
    let newY = wy;
    if (newX < availL) newX = availL;
    if (newY < availT) newY = availT;
    if (newX + ww > monitorRight) newX = monitorRight - ww;
    if (newY + wh > monitorBottom) newY = monitorBottom - wh;

    if (newX !== wx || newY !== wy) {
      await this.windowService.setWindowPosition(newX, newY);
    }
  }
}
