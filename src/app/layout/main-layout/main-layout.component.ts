import { Component, HostListener, OnInit, inject } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { Auth, authState } from '@angular/fire/auth';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { SettingsService } from '../../core/services/settings.service';
import { TradeService } from '../../services/trade.service';
import { computeDashboardStats } from '../../core/utils/trade-analytics.util';
import { DashboardRefreshService } from '../../core/services/dashboard-refresh.service';
import { ProfileService } from '../../services/profile.service';
import { TwoFactorService } from '../../core/services/two-factor.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  section?: string;
}

@Component({
  selector: 'app-main-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatBadgeModule,
  ],
  standalone: true,
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss'],
})
export class MainLayoutComponent implements OnInit {
  private router = inject(Router);
  private auth = inject(Auth);
  private authService = inject(AuthService);
  private tradeService = inject(TradeService);
  readonly themeService = inject(ThemeService);
  readonly settingsService = inject(SettingsService);
  private dashboardRefreshService = inject(DashboardRefreshService);
  private profileService = inject(ProfileService);
  private twoFactorService = inject(TwoFactorService);

  isSidebarOpen = true;
  isMobileSidebarOpen = false;
  globalSearch = '';
  accountPnL = 0;
  userName = 'Trader';
  userInitials = 'T';
  notificationCount = 3;
  profileImageUrl = '';
  isMobile = false;
  userEmail = '';

  navItems: NavItem[] = [
    {
      label: 'Dashboard',
      icon: 'dashboard',
      route: '/dashboard',
      section: 'main',
    },
    {
      label: 'Add Trade',
      icon: 'add_circle',
      route: '/addtrade',
      section: 'main',
    },
    {
      label: 'Trade History',
      icon: 'history',
      route: '/tradelist',
      section: 'main',
    },
    {
      label: 'Prop Firms',
      icon: 'account_balance',
      route: '/prop-firms',
      section: 'main',
    },
    {
      label: 'Analytics',
      icon: 'analytics',
      route: '/analytics',
      section: 'insights',
    },
    {
      label: 'Performance',
      icon: 'trending_up',
      route: '/performance',
      section: 'insights',
    },
    {
      label: 'Strategies',
      icon: 'psychology',
      route: '/strategies',
      section: 'insights',
    },
    {
      label: 'Calendar',
      icon: 'calendar_month',
      route: '/calendar',
      section: 'insights',
    },
    {
      label: 'Reports',
      icon: 'assessment',
      route: '/reports',
      section: 'insights',
    },
    { label: 'Profile', icon: 'person', route: '/profile', section: 'account' },
    {
      label: 'Settings',
      icon: 'settings',
      route: '/settings',
      section: 'account',
    },
  ];

  constructor() {
  console.error('Constructor');
}

  ngOnInit(): void {
    this.checkScreenSize();

    // Single authState subscription replaces three separate listeners.
    // Sets user info, fetches profile, and fetches trades for account P&L.
    authState(this.auth).subscribe((user) => {
      if (!user) {
        return;
      }

      this.userName = user.displayName || user.email?.split('@')[0] || 'Trader';
      this.userEmail = user.email || '';
      this.userInitials = this.userName.slice(0, 2).toUpperCase();

      this.profileService.getProfile(user.uid).subscribe({
        next: (profile) => {
          this.userName = profile.displayName;
          this.userEmail = profile.email;
          this.profileImageUrl = profile.profileImageUrl || '';
        },
        error: (err) => {
          console.error('Profile Error:', err);
        },
      });

      this.tradeService.getTrades(user.uid).subscribe({
        next: (trades) => {
          this.accountPnL = computeDashboardStats(trades).totalPnL;
        },
        error: () => {
          this.accountPnL = 0;
        },
      });
    });

    this.dashboardRefreshService.refresh$.subscribe(() => {
      this.loadAccountSummary();
    });
  }

  loadAccountSummary(): void {
    const user = this.auth.currentUser;
    if (!user) {
      return;
    }
    this.tradeService.getTrades(user.uid).subscribe({
      next: (trades) => {
        this.accountPnL = computeDashboardStats(trades).totalPnL;
      },
      error: () => {
        this.accountPnL = 0;
      },
    });
  }

  checkScreenSize(): void {
    this.isMobile = window.innerWidth <= 991;
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkScreenSize();
  }

  toggleMenu(): void {
    if (this.isMobile) {
      this.toggleMobileSidebar();
    } else {
      this.toggleSidebar();
    }
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  toggleMobileSidebar(): void {
    this.isMobileSidebarOpen = !this.isMobileSidebarOpen;
  }

  onSearch(): void {
    if (this.globalSearch.trim()) {
      this.router.navigate(['/tradelist'], {
        queryParams: { q: this.globalSearch.trim() },
      });
    }
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  logout(): void {
    this.twoFactorService.clearSession();
    this.twoFactorService.clearChallenge();
    this.authService.logout().then(() => {
      // Selectively remove auth/session keys instead of clearing all localStorage.
      // This preserves 'tj-theme' so the user's theme preference survives logout.
      localStorage.removeItem('tj-2fa-token');
      localStorage.removeItem('tj-2fa-challenge');
      localStorage.removeItem('tj-2fa-challenge-expiry');
      localStorage.removeItem('tj-2fa-masked-email');
      localStorage.removeItem('tj-2fa-purpose');
      localStorage.removeItem('tj-settings');
      this.router.navigate(['/login']);
    });
  }

  getMainNav(): NavItem[] {
    return this.navItems.filter((n) => n.section === 'main');
  }

  getInsightsNav(): NavItem[] {
    return this.navItems.filter((n) => n.section === 'insights');
  }

  getAccountNav(): NavItem[] {
    return this.navItems.filter((n) => n.section === 'account');
  }
}
