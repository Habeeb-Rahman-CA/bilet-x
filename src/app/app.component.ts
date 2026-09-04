import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TitlebarComponent } from './shared/components/titlebar/titlebar.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { SystemService } from './core/tauri/system.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, TitlebarComponent, DashboardComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  constructor(public systemService: SystemService) {}
}
