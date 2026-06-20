import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { TradeService } from '../../services/trade.service';
import { SettingsService } from '../../core/services/settings.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { computeStrategyStats } from '../../core/utils/trade-analytics.util';
import { Auth,authState } from '@angular/fire/auth';

@Component({
  selector: 'app-strategies',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    BaseChartDirective,
    PageHeaderComponent,
  ],
  templateUrl: './strategies.component.html',
})
export class StrategiesComponent implements OnInit {
  private tradeService = inject(TradeService);
  readonly settings = inject(SettingsService);
  private auth = inject(Auth);

  isLoading = true;
  strategies: ReturnType<typeof computeStrategyStats> = [];
  chartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        backgroundColor: '#3b82f6',
        borderRadius: 6,
        label: 'P&L by Strategy',
      },
    ],
  };
  chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
  };

  ngOnInit(): void {
    authState(this.auth).subscribe(user => {

  if (!user) {
    this.isLoading = false;
    return;
  }
    this.tradeService.getTrades(user.uid).subscribe({
      next: (trades) => {
        this.strategies = computeStrategyStats(trades);
        this.chartData = {
          labels: this.strategies.map((s) => s.strategy),
          datasets: [
            {
              label: 'Total P&L',
              data: this.strategies.map((s) => s.totalPnL),
              backgroundColor: this.strategies.map((s) =>
                s.totalPnL >= 0 ? '#10b981' : '#ef4444',
              ),
              borderRadius: 6,
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
}
