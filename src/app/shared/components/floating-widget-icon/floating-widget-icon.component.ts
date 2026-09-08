import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-floating-widget-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Icon-Only Desktop Floating Widget Container with Drag Support -->
    <div
      data-tauri-drag-region
      class="titlebar-drag-region flex h-full w-full items-center justify-center bg-black select-none"
    >
      <!-- Clickable Icon Button with no-drag to guarantee click event dispatch -->
      <button
        (click)="onClick.emit()"
        type="button"
        title="Bilet-X Desktop Widget - Click to Open"
        class="no-drag group relative flex h-12 w-12 cursor-pointer items-center justify-center border border-neutral-800 bg-black transition hover:border-neutral-400 focus:outline-none"
      >
        <img src="bilet-x-dark-icon-v1.png" alt="Bilet-X Widget" class="h-7 w-7 object-contain" />
        <span class="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-white"></span>
      </button>
    </div>
  `,
})
export class FloatingWidgetIconComponent {
  @Output() onClick = new EventEmitter<void>();
}
