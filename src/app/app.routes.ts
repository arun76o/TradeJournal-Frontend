import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

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
    path: 'verify-otp',
    loadComponent: () => import('./auth/verify-otp/verify-otp.component').then((m) => m.VerifyOtpComponent),
  },

  {
    path: '',
    loadComponent: () => import('./layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    canActivate: [authGuard],
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

      // ── Prop Firms workspace (separate data: propFirms / propFirmTrades) ──
      // Component-less parent: every child renders straight into the main layout outlet,
      // so /prop-firms is a card grid and /prop-firms/:id is the firm dashboard.
      {
        path: 'prop-firms',
        children: [
          { path: 'add', loadComponent: () => import('./prop-firms/prop-firm-form/prop-firm-form.component').then((m) => m.PropFirmFormComponent) },
          { path: 'edit/:id', loadComponent: () => import('./prop-firms/prop-firm-form/prop-firm-form.component').then((m) => m.PropFirmFormComponent) },
          { path: ':id', loadComponent: () => import('./prop-firms/prop-firm-dashboard/prop-firm-dashboard.component').then((m) => m.PropFirmDashboardComponent) },
          { path: ':id/add-trade', loadComponent: () => import('./prop-firms/prop-firm-add-trade/prop-firm-add-trade.component').then((m) => m.PropFirmAddTradeComponent) },
          { path: ':id/trades', loadComponent: () => import('./prop-firms/prop-firm-trade-list/prop-firm-trade-list.component').then((m) => m.PropFirmTradeListComponent) },
          { path: ':id/edit-trade/:tradeId', loadComponent: () => import('./prop-firms/prop-firm-add-trade/prop-firm-add-trade.component').then((m) => m.PropFirmAddTradeComponent) },
          { path: '', loadComponent: () => import('./prop-firms/prop-firms.component').then((m) => m.PropFirmsComponent) },
        ],
      },
    ],
  },
];
