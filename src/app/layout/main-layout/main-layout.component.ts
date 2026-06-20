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
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent implements OnInit {
  private router = inject(Router);
  private auth = inject(Auth);
  private authService = inject(AuthService);
  private tradeService = inject(TradeService);
  readonly themeService = inject(ThemeService);
  readonly settingsService = inject(SettingsService);
  private dashboardRefreshService = inject(DashboardRefreshService);

  isSidebarOpen = true;
  isMobileSidebarOpen = false;
  globalSearch = '';
  accountPnL = 0;
  userName = 'Trader';
  userInitials = 'T';
  notificationCount = 3;

  isMobile = false;

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

  ngOnInit(): void {
      this.checkScreenSize();
    authState(this.auth).subscribe((user) => {
      if (user) {
        const name = user.displayName || user.email?.split('@')[0] || 'Trader';
        this.userName = name;
        this.userInitials = name.slice(0, 2).toUpperCase();
      }
    });

    this.dashboardRefreshService.refresh$.subscribe(() => {
      this.loadAccountSummary();
    });

    this.loadAccountSummary();
  }

  loadAccountSummary(): void {
    authState(this.auth).subscribe((user) => {
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
    this.authService.logout().then(() => {
      localStorage.clear();
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
