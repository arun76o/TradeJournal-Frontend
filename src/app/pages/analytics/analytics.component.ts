import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { TradeService } from '../../services/trade.service';
import { SettingsService } from '../../core/services/settings.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import {
  computeDashboardStats,
  computeMonthlyPnL,
  computeWeeklyStats,
  computeStrategyStats,
  computeDrawdown,
  computeDayOfWeekHeatmap,
} from '../../core/utils/trade-analytics.util';
import { Trade } from '../../models/trade.model';
import { getBaseChartOptions } from '../../core/utils/chart-options.util';
import { Auth } from '@angular/fire/auth';
import { authState } from '@angular/fire/auth';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    BaseChartDirective,
    PageHeaderComponent,
    KpiCardComponent,
  ],
  templateUrl: './analytics.component.html',
})
export class AnalyticsComponent implements OnInit {
  private tradeService = inject(TradeService);
  readonly settings = inject(SettingsService);
  private auth = inject(Auth);

  isLoading = true;
  stats = computeDashboardStats([]);
  drawdown = { maxDrawdown: 0, maxDrawdownPercent: 0 };
  strategyStats: ReturnType<typeof computeStrategyStats> = [];
  weeklyStats: ReturnType<typeof computeWeeklyStats> = [];
  heatmapData = computeDayOfWeekHeatmap([]);

  monthlyChart: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [
      { data: [], backgroundColor: [], borderRadius: 6, label: 'Monthly' },
    ],
  };
  weeklyChart: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        borderColor: '#6366f1',
        tension: 0.4,
        fill: false,
        label: 'Weekly P&L',
      },
    ],
  };
  chartOptions = getBaseChartOptions();

  ngOnInit(): void {
    authState(this.auth).subscribe((user) => {
      if (!user) {
        this.isLoading = false;
        return;
      }

      this.tradeService.getTrades(user.uid).subscribe({
        next: (trades: Trade[]) => {
          this.stats = computeDashboardStats(trades);
          this.drawdown = computeDrawdown(trades);
          this.strategyStats = computeStrategyStats(trades);
          this.weeklyStats = computeWeeklyStats(trades);
          this.heatmapData = computeDayOfWeekHeatmap(trades);

          const monthly = computeMonthlyPnL(trades);

          this.monthlyChart = {
            labels: monthly.map((m) => m.month),
            datasets: [
              {
                label: 'Net P&L',
                data: monthly.map((m) => m.net),
                backgroundColor: monthly.map((m) =>
                  m.net >= 0 ? '#10b981' : '#ef4444',
                ),
                borderRadius: 6,
              },
            ],
          };

          this.weeklyChart = {
            labels: this.weeklyStats.map((w) => w.week),
            datasets: [
              {
                label: 'Weekly P&L',
                data: this.weeklyStats.map((w) => w.pnl),
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4,
                fill: true,
              },
            ],
          };

          this.isLoading = false;
        },

        error: () => {
          this.isLoading = false;
        },
      });
    });
  }

  formatCurrency(v: number): string {
    return this.settings.formatCurrency(v);
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

  get profitFactorDisplay(): string {
    if (this.stats.profitFactor === Infinity) return '∞';
    return this.stats.profitFactor.toFixed(2);
  }
}
