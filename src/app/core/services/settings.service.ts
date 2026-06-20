import { Injectable, signal } from '@angular/core';

export interface UserSettings {
  currency: string;
  currencySymbol: string;
  timezone: string;
  emailNotifications: boolean;
  tradeAlerts: boolean;
  weeklyReport: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  currency: 'INR',
  currencySymbol: '₹',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  emailNotifications: true,
  tradeAlerts: true,
  weeklyReport: false,
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly storageKey = 'tj-settings';
  readonly settings = signal<UserSettings>(this.load());

  private load(): UserSettings {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  update(partial: Partial<UserSettings>): void {
    const next = { ...this.settings(), ...partial };
    this.settings.set(next);
    localStorage.setItem(this.storageKey, JSON.stringify(next));
  }

  formatCurrency(value: number, digits = '1.2-2'): string {
    const s = this.settings();
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: s.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}
