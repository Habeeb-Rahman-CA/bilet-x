import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-2.5">
      <div class="rounded-xl border border-neutral-800 bg-neutral-900/90 p-3 text-xs space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-neutral-300 font-medium">Toggle Shortcut</span>
          <kbd class="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">Ctrl + K</kbd>
        </div>
        <div class="flex items-center justify-between border-t border-neutral-800/80 pt-2.5">
          <span class="text-neutral-300 font-medium">Quick Dismiss</span>
          <kbd class="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">ESC</kbd>
        </div>
        <div class="flex items-center justify-between border-t border-neutral-800/80 pt-2.5">
          <span class="text-neutral-300 font-medium">Theme</span>
          <span class="text-[11px] text-neutral-400 font-mono">Dark Minimal</span>
        </div>
      </div>
    </div>
  `,
})
export class SettingsComponent {}
