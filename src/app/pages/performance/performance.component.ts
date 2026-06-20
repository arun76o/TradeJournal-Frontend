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
  computeEquityCurve,
  computeDrawdown,
  getTradePnL,
} from '../../core/utils/trade-analytics.util';
import { getBaseChartOptions } from '../../core/utils/chart-options.util';
import { Auth, authState } from '@angular/fire/auth';

@Component({
  selector: 'app-performance',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    BaseChartDirective,
    PageHeaderComponent,
    KpiCardComponent,
  ],
  templateUrl: './performance.component.html',
})
export class PerformanceComponent implements OnInit {
  private tradeService = inject(TradeService);
  readonly settings = inject(SettingsService);
  private auth = inject(Auth);

  isLoading = true;
  stats = computeDashboardStats([]);
  drawdown = { maxDrawdown: 0, maxDrawdownPercent: 0 };
  expectancy = 0;
  avgWin = 0;
  avgLoss = 0;
  largestWinStreak = 0;
  largestLossStreak = 0;

  equityChart: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        borderColor: '#3b82f6',
        fill: true,
        backgroundColor: 'rgba(59,130,246,0.1)',
        tension: 0.4,
        label: 'Equity',
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
        next: (trades) => {
          this.stats = computeDashboardStats(trades);
          this.drawdown = computeDrawdown(trades);

          const wins = trades.filter((t) => getTradePnL(t) > 0);
          const losses = trades.filter((t) => getTradePnL(t) < 0);

          this.avgWin = wins.length
            ? wins.reduce((s, t) => s + getTradePnL(t), 0) / wins.length
            : 0;

          this.avgLoss = losses.length
            ? Math.abs(
                losses.reduce((s, t) => s + getTradePnL(t), 0) / losses.length,
              )
            : 0;

          this.expectancy = trades.length
            ? this.stats.totalPnL / trades.length
            : 0;

          const sorted = [...trades].sort(
            (a, b) =>
              new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime(),
          );

          let winStreak = 0;
          let lossStreak = 0;
          let maxWin = 0;
          let maxLoss = 0;

          sorted.forEach((t) => {
            const pnl = getTradePnL(t);

            if (pnl > 0) {
              winStreak++;
              lossStreak = 0;
              maxWin = Math.max(maxWin, winStreak);
            } else if (pnl < 0) {
              lossStreak++;
              winStreak = 0;
              maxLoss = Math.max(maxLoss, lossStreak);
            } else {
              winStreak = 0;
              lossStreak = 0;
            }
          });

          this.largestWinStreak = maxWin;
          this.largestLossStreak = maxLoss;

          const equity = computeEquityCurve(trades);

          this.equityChart = {
            labels: equity.labels,
            datasets: [
              {
                label: 'Equity',
                data: equity.data,
                borderColor: '#3b82f6',
                fill: true,
                backgroundColor: 'rgba(59,130,246,0.08)',
                tension: 0.4,
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

  get profitFactorDisplay(): string {
    if (this.stats.profitFactor === Infinity) return '∞';
    return this.stats.profitFactor.toFixed(2);
  }
}
