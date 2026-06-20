import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./auth/register/register.component').then((m) => m.RegisterComponent),
  },

  {
    path: '',
    loadComponent: () => import('./layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      { path: 'dashboard', loadComponent: () => import('./dashboard/home/home.component').then((m) => m.HomeComponent) },
      { path: 'addtrade', loadComponent: () => import('./trades/add-trade/add-trade.component').then((m) => m.AddTradeComponent) },
      { path: 'edit-trade/:id',  loadComponent: () =>  import('./trades/add-trade/add-trade.component') .then((m) => m.AddTradeComponent)},
      { path: 'tradelist', loadComponent: () => import('./trades/trade-list/trade-list.component').then((m) => m.TradeListComponent) },
      { path: 'analytics', loadComponent: () => import('./pages/analytics/analytics.component').then((m) => m.AnalyticsComponent) },
      { path: 'performance', loadComponent: () => import('./pages/performance/performance.component').then((m) => m.PerformanceComponent) },
      { path: 'strategies', loadComponent: () => import('./pages/strategies/strategies.component').then((m) => m.StrategiesComponent) },
      { path: 'calendar', loadComponent: () => import('./pages/calendar/calendar.component').then((m) => m.CalendarComponent) },
      { path: 'reports', loadComponent: () => import('./pages/reports/reports.component').then((m) => m.ReportsComponent) },
      { path: 'profile', loadComponent: () => import('./pages/profile/profile.component').then((m) => m.ProfileComponent) },
      { path: 'settings', loadComponent: () => import('./pages/settings/settings.component').then((m) => m.SettingsComponent) },
    ],
  },
];
