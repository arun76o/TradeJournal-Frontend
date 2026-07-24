import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DayTradingSummary {
  date: Date;
  totalPnL: number;
  lotSize: number;
  profit: number;
  trades: number;
}

@Component({
  selector: 'app-day-summary-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './day-summary-dialog.component.html',
  styleUrl: './day-summary-dialog.component.scss',
})
export class DaySummaryDialogComponent {
  @Input() summary: DayTradingSummary | null = null;
  @Input() formattedDate = '';
  @Input() formatCurrency: (v: number) => string = (v) => v.toFixed(2);
  @Output() close = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('tj-dialog-overlay')) {
      this.onClose();
    }
  }
}
