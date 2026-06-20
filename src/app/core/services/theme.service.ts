import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'tj-theme';
  readonly theme = signal<ThemeMode>('light');

  constructor() {
    const saved = localStorage.getItem(this.storageKey) as ThemeMode | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.applyTheme(saved ?? (prefersDark ? 'dark' : 'light'));
  }

  toggle(): void {
    this.applyTheme(this.theme() === 'light' ? 'dark' : 'light');
  }

  setTheme(theme: ThemeMode): void {
    this.applyTheme(theme);
  }

  private applyTheme(theme: ThemeMode): void {
    this.theme.set(theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this.storageKey, theme);
  }
}
