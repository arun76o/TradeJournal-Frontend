import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { Subscription } from 'rxjs';
import { PropFirmService } from '../../services/prop-firm.service';
import { PropFirmTradeService } from '../../services/prop-firm-trade.service';
import { PropFirm } from '../../models/prop-firm.model';
import { PropFirmTrade } from '../../models/prop-firm-trade.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { AlertService } from '../../core/services/alert.service';
import { DashboardRefreshService } from '../../core/services/dashboard-refresh.service';
import { getBaseChartOptions } from '../../core/utils/chart-options.util';
import { DashboardStats } from '../../core/utils/trade-analytics.util';
import {
  computeDrawdownFromInitial,
  computeFirmDrawdown,
  computeFirmEquity,
  computeLimitAmount,
  computeLimitUsage,
  computePropFirmStats,
  computeTodayPnL,
  formatFirmCurrency,
  getPropTradeStatus,
  normalizePropFirmStatus,
} from '../../core/utils/prop-firm-analytics.util';

@Component({
  selector: 'app-prop-firm-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    BaseChartDirective,
    PageHeaderComponent,
    KpiCardComponent,
  ],
  templateUrl: './prop-firm-dashboard.component.html',
  styleUrls: ['./prop-firm-dashboard.component.scss'],
})
export class PropFirmDashboardComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private propFirmService = inject(PropFirmService);
  private propFirmTradeService = inject(PropFirmTradeService);
  private alertService = inject(AlertService);
  private dashboardRefreshService = inject(DashboardRefreshService);

  firmId = '';
  firm: PropFirm | null = null;
  trades: PropFirmTrade[] = [];
  recentTrades: PropFirmTrade[] = [];
  stats: DashboardStats | null = null;

  isLoading = true;
  loadError = '';

  currentBalance = 0;
  todayPnl = 0;
  drawdownFromInitial = 0;
  peakDrawdown = 0;

  equityChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        label: 'Equity',
        data: [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
      },
    ],
  };
  equityOptions: ChartOptions = getBaseChartOptions();

  private paramSubscription?: Subscription;

  ngOnInit(): void {
    this.paramSubscription = this.route.paramMap.subscribe((params) => {
      this.firmId = params.get('id') ?? '';
      this.reload();
    });
  }

  ngOnDestroy(): void {
    this.paramSubscription?.unsubscribe();
  }

  private reload(): void {
    this.isLoading = true;
    this.loadError = '';
    this.firm = null;
    this.trades = [];
    this.recentTrades = [];
    this.stats = null;

    if (!this.firmId) {
      this.isLoading = false;
      return;
    }

    this.propFirmService.getPropFirm(this.firmId).subscribe({
      next: (firm) => {
        this.firm = firm;
        this.loadTrades();
      },
      error: (err) => {
        this.isLoading = false;
        this.loadError =
          err?.status === 403
            ? 'You do not have permission to access this prop firm.'
            : 'This prop firm could not be found.';
      },
    });
  }

  private loadTrades(): void {
    this.propFirmTradeService.getTrades(this.firmId).subscribe({
      next: (trades) => {
        this.trades = trades;
        this.buildView();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private buildView(): void {
    const initial = Number(this.firm?.initialBalance ?? 0);

    this.stats = computePropFirmStats(this.trades);
    this.currentBalance = initial + (this.stats?.totalPnL ?? 0);
    this.todayPnl = computeTodayPnL(this.trades);
    this.drawdownFromInitial = computeDrawdownFromInitial(this.trades, initial);
    this.peakDrawdown = computeFirmDrawdown(this.trades).maxDrawdown;

    this.recentTrades = this.trades.slice(0, 8);

    const equity = computeFirmEquity(this.trades, initial);
    this.equityChartData = {
      labels: equity.labels,
      datasets: [
        {
          label: `${this.currency} Equity`,
          data: equity.data,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          fill: true,
          tension: 0.4,
          showLine: true,
          spanGaps: true,
          pointRadius: equity.data.length > 30 ? 0 : 3,
          pointHoverRadius: 4,
        },
      ],
    };
    this.equityOptions = this.buildEquityOptions();
  }

  /**
   * Prop-firm specific chart options: the shared getBaseChartOptions() has no currency
   * formatting, so the Y axis and tooltips are formatted in the firm's account currency.
   * The shared helper itself is left untouched for the regular dashboard.
   */
  private buildEquityOptions(): ChartOptions {
    const base = getBaseChartOptions();
    const format = (value: number) => this.formatMoney(value);
    const scales = base.scales ?? {};
    const plugins = base.plugins ?? {};

    return {
      ...base,
      plugins: {
        ...plugins,
        tooltip: {
          ...plugins.tooltip,
          callbacks: {
            ...plugins.tooltip?.callbacks,
            label: (context) => {
              const parsed = context.parsed as { y?: number } | number | null;
              const value = typeof parsed === 'number' ? parsed : Number(parsed?.y ?? 0);
              return ` ${context.dataset.label ?? 'Equity'}: ${format(value)}`;
            },
          },
        },
      },
      scales: {
        ...scales,
        y: {
          ...scales['y'],
          ticks: {
            ...scales['y']?.ticks,
            callback: (value) => format(Number(value)),
          },
        },
      },
    };
  }

  get currency(): string {
    return (this.firm?.accountCurrency || '').toUpperCase() || 'INR';
  }

  get hasTrades(): boolean {
    return this.trades.length > 0;
  }

  get netPnl(): number {
    return this.stats?.totalPnL ?? 0;
  }

  get winRateDisplay(): string {
    return `${this.stats?.winRate ?? 0}%`;
  }

  /**
   * Configured account size: the dedicated accountSize when present, otherwise the
   * configured initial balance. Trading profit, payouts and amount spent are never added.
   */
  get accountSizeValue(): number {
    const size = Number(this.firm?.accountSize ?? this.firm?.initialBalance ?? 0);
    return Number.isFinite(size) && size > 0 ? size : 0;
  }

  /** Profit target stored as a percentage of the account size (8 => 8%). */
  get profitTargetPercent(): number | null {
    const pct = Number(this.firm?.profitTarget ?? 0);
    if (!Number.isFinite(pct) || pct <= 0) return null;
    return pct;
  }

  /** Derived for display only: account size x percentage / 100. */
  get profitTargetAmount(): number | null {
    return computeLimitAmount(this.accountSizeValue, this.profitTargetPercent);
  }

  get profitTargetProgress(): number | null {
    const amount = this.profitTargetAmount;
    if (amount === null || amount <= 0) return null;
    return (this.netPnl / amount) * 100;
  }

  /** Daily loss limit stored as a PERCENTAGE of the account size (3 => 3%). */
  get dailyLossPercent(): number | null {
    const pct = Number(this.firm?.maximumDailyLoss ?? 0);
    if (!Number.isFinite(pct) || pct <= 0) return null;
    return pct;
  }

  /** Derived for display only: account size x percentage / 100. */
  get dailyLossLimitAmount(): number | null {
    return computeLimitAmount(this.accountSizeValue, this.dailyLossPercent);
  }

  /** Loss actually recorded today; profits never offset the daily loss counter. */
  get dailyLossUsed(): number {
    return Math.max(0, -this.todayPnl);
  }

  get dailyLossUsage(): number | null {
    return computeLimitUsage(this.dailyLossUsed, this.dailyLossLimitAmount);
  }

  /** Overall drawdown stored as a percentage of the account size (10 => 10%). */
  get overallDrawdownPercent(): number | null {
    const pct = Number(this.firm?.maximumOverallDrawdown ?? 0);
    if (!Number.isFinite(pct) || pct <= 0) return null;
    return pct;
  }

  /** Derived for display only: account size x percentage / 100. */
  get overallDrawdownLimit(): number | null {
    return computeLimitAmount(this.accountSizeValue, this.overallDrawdownPercent);
  }

  get overallDrawdownUsage(): number | null {
    return computeLimitUsage(this.drawdownFromInitial, this.overallDrawdownLimit);
  }

  get dailyLossBreached(): boolean {
    return (this.dailyLossUsage ?? 0) >= 100;
  }

  get overallDrawdownBreached(): boolean {
    return (this.overallDrawdownUsage ?? 0) >= 100;
  }

  get profitTargetReached(): boolean {
    return (this.profitTargetProgress ?? 0) >= 100;
  }

  /** Clamped 0-100 so a progress bar can never render outside its track. */
  barWidth(percent: number | null): number {
    if (percent === null || !Number.isFinite(percent)) return 0;
    return Math.max(0, Math.min(100, percent));
  }

  formatMoney(value: number): string {
    return formatFirmCurrency(value, this.currency);
  }

  /** Amount Spent is always reported in INR, regardless of the account currency. */
  formatAmountSpent(): string {
    return formatFirmCurrency(Number(this.firm?.amountSpent ?? 0), 'INR');
  }

  /** Payouts are recorded in the firm's own account currency. */
  formatTakenPayout(): string {
    return formatFirmCurrency(Number(this.firm?.payouts ?? 0), this.currency);
  }

  get firmStatus(): string {
    return normalizePropFirmStatus(this.firm?.status);
  }

  get firmStatusClass(): string {
    const status = this.firmStatus;
    if (status === 'Failed') return 'failed';
    if (status === 'Passed') return 'passed';
    return '';
  }

  getStatus(trade: PropFirmTrade): string {
    return getPropTradeStatus(trade);
  }

  addPropFirm(): void {
    this.router.navigate(['/prop-firms/add']);
  }

  viewAllFirms(): void {
    this.router.navigate(['/prop-firms']);
  }

  addTrade(): void {
    this.router.navigate(['/prop-firms', this.firmId, 'add-trade']);
  }

  viewTrades(): void {
    this.router.navigate(['/prop-firms', this.firmId, 'trades']);
  }

  editFirm(): void {
    this.router.navigate(['/prop-firms/edit', this.firmId]);
  }

  deleteFirm(): void {
    const firm = this.firm;
    if (!firm?.id) return;

    const id = firm.id;
    const tradeCount = this.trades.length;
    const warning =
      tradeCount > 0
        ? `This prop firm has ${tradeCount} trade(s). Deleting it will also permanently ` +
          `delete all ${tradeCount} trade(s). This cannot be undone.`
        : 'This prop firm has no trades. This action cannot be undone.';

    this.alertService.confirm('Delete this prop firm?', warning).then((result) => {
      if (!result.isConfirmed) return;

      this.propFirmService.deletePropFirm(id).subscribe({
        next: () => {
          this.alertService.success(
            'Prop Firm Deleted',
            tradeCount > 0
              ? `Prop firm and its ${tradeCount} trade(s) were deleted.`
              : 'Prop firm deleted successfully.'
          );
          this.dashboardRefreshService.triggerRefresh();
          this.router.navigate(['/prop-firms']);
        },
        error: (err) => {
          if (err?.status === 409) {
            this.confirmDeleteWithTrades(id, err?.error?.tradeCount ?? tradeCount);
            return;
          }
          this.alertService.error('Delete Failed', 'Unable to delete the prop firm.');
        },
      });
    });
  }

  private confirmDeleteWithTrades(id: string, tradeCount: number): void {
    this.alertService
      .confirm(
        'Delete prop firm and all its trades?',
        `This prop firm still has ${tradeCount} trade(s). Deleting it will also ` +
          `permanently delete every one of those trades. This cannot be undone.`
      )
      .then((result) => {
        if (!result.isConfirmed) return;

        this.propFirmService.deletePropFirm(id, true).subscribe({
          next: () => {
            this.alertService.success(
              'Prop Firm Deleted',
              `Prop firm and its ${tradeCount} trade(s) were deleted.`
            );
            this.dashboardRefreshService.triggerRefresh();
            this.router.navigate(['/prop-firms']);
          },
          error: () => {
            this.alertService.error('Delete Failed', 'Unable to delete the prop firm.');
          },
        });
      });
  }
}
