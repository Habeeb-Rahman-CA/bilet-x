import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WidgetComponent } from './features/widget/widget.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, WidgetComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {}
