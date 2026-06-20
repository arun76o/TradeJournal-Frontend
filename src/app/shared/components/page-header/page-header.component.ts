import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tj-page-header">
      <div class="tj-page-header-row">
        <div>
          <h1>{{ title }}</h1>
          @if (subtitle) {
            <p>{{ subtitle }}</p>
          }
        </div>
        <ng-content select="[actions]"></ng-content>
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
}
