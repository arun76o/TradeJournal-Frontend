import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="tj-kpi-card" [style.animation-delay]="delay">
      <div class="tj-kpi-icon" [ngClass]="iconColor">
        <mat-icon>{{ icon }}</mat-icon>
      </div>
      <div class="tj-kpi-content">
        <span class="tj-kpi-label">{{ label }}</span>
        <span class="tj-kpi-value" [ngClass]="valueClass">{{ value }}</span>
        @if (subtitle) {
          <span class="tj-kpi-change">{{ subtitle }}</span>
        }
      </div>
    </div>
  `,
})
export class KpiCardComponent {
  @Input() label = '';
  @Input() value: string | number = '';
  @Input() icon = 'analytics';
  @Input() iconColor: 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'neutral' = 'primary';
  @Input() valueClass = '';
  @Input() subtitle = '';
  @Input() delay = '0s';
}
