import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TradeService } from '../../services/trade.service';
import { SettingsService } from '../../core/services/settings.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { computeDashboardStats, getTradePnL, getTradeStatus } from '../../core/utils/trade-analytics.util';
import { Trade } from '../../models/trade.model';
import { Auth,authState  } from '@angular/fire/auth';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule, PageHeaderComponent],
  templateUrl: './reports.component.html',
})
export class ReportsComponent implements OnInit {
  private tradeService = inject(TradeService);
  readonly settings = inject(SettingsService);
  private auth = inject(Auth);

  isLoading = true;
  trades: Trade[] = [];
  stats = computeDashboardStats([]);
  generatedAt = new Date();

 ngOnInit(): void {
  authState(this.auth).subscribe(user => {

    if (!user) {
      this.isLoading = false;
      return;
    }

    this.tradeService.getTrades(user.uid).subscribe({
      next: (trades) => {

        this.trades = trades;
        this.stats = computeDashboardStats(trades);
        this.generatedAt = new Date();

        this.isLoading = false;
      },

      error: () => {
        this.isLoading = false;
      }
    });

  });

}

  formatCurrency(v: number): string {
    return this.settings.formatCurrency(v);
  }

  exportCsv(): void {
    const headers = ['Symbol', 'Side', 'Entry', 'Exit', 'Quantity', 'P&L', 'Strategy', 'Date', 'Status'];
    const rows = this.trades.map((t) => [
      t.symbol, t.side, t.entryPrice, t.exitPrice, t.quantity,
      getTradePnL(t), t.strategy, t.tradeDate, getTradeStatus(t),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportPdf(): void {
    window.print();
  }

  get profitFactorDisplay(): string {
    if (this.stats.profitFactor === Infinity) return '∞';
    return this.stats.profitFactor.toFixed(2);
  }
}
