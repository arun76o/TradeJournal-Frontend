import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { TradeService } from '../../services/trade.service';
import { SettingsService } from '../../core/services/settings.service';
import { Trade } from '../../models/trade.model';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import {
  computeDashboardStats,
  computeEquityCurve,
  computeMonthlyPnL,
  computeDailyPnL,
  computeDayOfWeekHeatmap,
  getTradePnL,
  getTradeStatus,
  DashboardStats,
  DayOfWeekPnL,
} from '../../core/utils/trade-analytics.util';
import { getBaseChartOptions } from '../../core/utils/chart-options.util';
import { Auth, authState } from '@angular/fire/auth';

@Component({
  selector: 'app-home',
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    BaseChartDirective,
    KpiCardComponent,
    PageHeaderComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private tradeService = inject(TradeService);
  private router = inject(Router);
  private auth = inject(Auth);
  readonly settings = inject(SettingsService);

  trades: Trade[] = [];
  stats: DashboardStats | null = null;
  recentTrades: Trade[] = [];
  heatmapData: DayOfWeekPnL[] = [];
  isLoading = true;

  doughnutChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: ['Wins', 'Losses', 'Breakeven'],
    datasets: [
      {
        data: [0, 0, 0],
        backgroundColor: ['#10b981', '#ef4444', '#94a3b8'],
        borderWidth: 0,
      },
    ],
  };
  doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const } },
  };

  equityChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        label: 'Equity Curve',
        data: [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
      },
    ],
  };
  equityOptions = getBaseChartOptions();

  monthlyChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [
      {
        label: 'Monthly P&L',
        data: [],
        backgroundColor: [],
        borderRadius: 6,
      },
    ],
  };
  monthlyOptions = getBaseChartOptions();

  dailyChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [
      {
        label: 'Daily P&L',
        data: [],
        backgroundColor: [],
        borderRadius: 4,
      },
    ],
  };
  dailyOptions = {
    ...getBaseChartOptions(),
    scales: { x: { display: false }, y: getBaseChartOptions().scales?.['y'] },
  };

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.isLoading = true;
    authState(this.auth).subscribe((user) => {
      if (!user) {
        this.isLoading = false;
        return;
      }
      this.tradeService.getTrades(user.uid).subscribe({
        next: (data) => {
          this.trades = data;
          this.stats = computeDashboardStats(data);
          this.recentTrades = [...data]
            .sort(
              (a, b) =>
                new Date(b.tradeDate).getTime() -
                new Date(a.tradeDate).getTime(),
            )
            .slice(0, 8);
          this.heatmapData = computeDayOfWeekHeatmap(data);
          this.buildCharts(data);
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
        },
      });
    });
  }

  private buildCharts(trades: Trade[]): void {
    const wins = trades.filter((t) => getTradePnL(t) > 0).length;
    const losses = trades.filter((t) => getTradePnL(t) < 0).length;
    const breakeven = trades.filter((t) => getTradePnL(t) === 0).length;
    this.doughnutChartData = {
      labels: ['Wins', 'Losses', 'Breakeven'],
      datasets: [
        {
          data: [wins, losses, breakeven],
          backgroundColor: ['#10b981', '#ef4444', '#94a3b8'],
          borderWidth: 0,
        },
      ],
    };

    const equity = computeEquityCurve(trades);
    this.equityChartData = {
      labels: equity.labels,
      datasets: [
        {
          label: 'Equity Curve',
          data: equity.data,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: equity.data.length > 30 ? 0 : 3,
        },
      ],
    };

    const monthly = computeMonthlyPnL(trades);
    this.monthlyChartData = {
      labels: monthly.map((m) => m.month),
      datasets: [
        {
          label: 'Net P&L',
          data: monthly.map((m) => m.net),
          backgroundColor: monthly.map((m) =>
            m.net >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)',
          ),
          borderRadius: 6,
        },
      ],
    };

    const daily = computeDailyPnL(trades);
    this.dailyChartData = {
      labels: daily.labels,
      datasets: [
        {
          label: 'Daily P&L',
          data: daily.data,
          backgroundColor: daily.data.map((v) =>
            v >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)',
          ),
          borderRadius: 4,
        },
      ],
    };
  }

  formatCurrency(value: number): string {
    return this.settings.formatCurrency(value);
  }

  getHeatmapClass(pnl: number, trades: number): string {
    if (trades === 0) return 'level-0';
    if (pnl > 500) return 'level-3';
    if (pnl > 100) return 'level-2';
    if (pnl > 0) return 'level-1';
    if (pnl < -500) return 'level-neg-3';
    if (pnl < -100) return 'level-neg-2';
    return 'level-neg-1';
  }

  getStatus(trade: Trade): string {
    return getTradeStatus(trade);
  }

  viewAllTrades(): void {
    this.router.navigate(['/tradelist']);
  }

  get profitFactorDisplay(): string {
    if (!this.stats) return '0';
    if (this.stats.profitFactor === Infinity) return '∞';
    return this.stats.profitFactor.toFixed(2);
  }
}
