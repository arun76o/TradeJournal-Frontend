import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ThemeService } from '../../core/services/theme.service';
import { SettingsService } from '../../core/services/settings.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule, MatFormFieldModule,
    MatSelectModule, MatSlideToggleModule, MatButtonModule, PageHeaderComponent,
  ],
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  readonly themeService = inject(ThemeService);
  readonly settingsService = inject(SettingsService);

  currencies = [
    { code: 'INR', symbol: '₹', label: 'Indian Rupee (₹)' },
    { code: 'USD', symbol: '$', label: 'US Dollar ($)' },
    { code: 'EUR', symbol: '€', label: 'Euro (€)' },
    { code: 'GBP', symbol: '£', label: 'British Pound (£)' },
  ];

  timezones = [
    'Asia/Kolkata', 'America/New_York', 'America/Chicago',
    'Europe/London', 'Asia/Tokyo', 'Australia/Sydney',
  ];

  get settings() {
    return this.settingsService.settings();
  }

  onCurrencyChange(code: string): void {
    const c = this.currencies.find((x) => x.code === code);
    this.settingsService.update({ currency: code, currencySymbol: c?.symbol ?? code });
  }

  onTimezoneChange(tz: string): void {
    this.settingsService.update({ timezone: tz });
  }

  onNotificationChange(key: 'emailNotifications' | 'tradeAlerts' | 'weeklyReport', value: boolean): void {
    this.settingsService.update({ [key]: value });
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.themeService.setTheme(theme);
  }
}
