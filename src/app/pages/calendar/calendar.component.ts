import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TradeService } from '../../services/trade.service';
import { SettingsService } from '../../core/services/settings.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { getTradePnL } from '../../core/utils/trade-analytics.util';
import { Trade } from '../../models/trade.model';
import { Auth, authState } from '@angular/fire/auth';

interface CalendarDay {
  date: Date;
  dayNum: number;
  isCurrentMonth: boolean;
  pnl: number;
  tradeCount: number;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './calendar.component.html',
})
export class CalendarComponent implements OnInit {
  private tradeService = inject(TradeService);
  readonly settings = inject(SettingsService);
  private auth = inject(Auth);

  isLoading = true;
  currentDate = new Date();
  calendarDays: CalendarDay[] = [];
  monthLabel = '';
  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  monthPnL = 0;
  monthTrades = 0;

  ngOnInit(): void {
    authState(this.auth).subscribe((user) => {
      if (!user) {
        this.isLoading = false;
        return;
      }

      this.tradeService.getTrades(user.uid).subscribe({
        next: (trades) => {
          this.buildCalendar(trades);
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
        },
      });
    });
  }

  buildCalendar(trades: Trade[]): void {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    this.monthLabel = this.currentDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const days: CalendarDay[] = [];

    for (let i = startPad - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({
        date: d,
        dayNum: d.getDate(),
        isCurrentMonth: false,
        pnl: 0,
        tradeCount: 0,
      });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const dayTrades = trades.filter((t) => {
        const td = new Date(t.tradeDate);
        return (
          td.getFullYear() === year &&
          td.getMonth() === month &&
          td.getDate() === d
        );
      });
      const pnl = dayTrades.reduce((s, t) => s + getTradePnL(t), 0);
      days.push({
        date,
        dayNum: d,
        isCurrentMonth: true,
        pnl,
        tradeCount: dayTrades.length,
      });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        date: d,
        dayNum: d.getDate(),
        isCurrentMonth: false,
        pnl: 0,
        tradeCount: 0,
      });
    }

    this.calendarDays = days;
    this.monthPnL = days
      .filter((d) => d.isCurrentMonth)
      .reduce((s, d) => s + d.pnl, 0);
    this.monthTrades = days
      .filter((d) => d.isCurrentMonth)
      .reduce((s, d) => s + d.tradeCount, 0);
  }

  prevMonth(): void {
    this.currentDate = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() - 1,
      1,
    );
    this.reload();
  }

  nextMonth(): void {
    this.currentDate = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() + 1,
      1,
    );
    this.reload();
  }

  private reload(): void {
    this.isLoading = true;
    authState(this.auth).subscribe((user) => {
      if (!user) {
        this.isLoading = false;
        return;
      }
      this.tradeService.getTrades(user.uid).subscribe({
        next: (trades) => {
          this.buildCalendar(trades);
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

  get tradingDaysCount(): number {
    return this.calendarDays.filter((d) => d.isCurrentMonth && d.tradeCount > 0)
      .length;
  }
}
