import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Subscription } from 'rxjs';
import { PropFirmService } from '../../services/prop-firm.service';
import { PropFirmTradeService } from '../../services/prop-firm-trade.service';
import { PropFirm } from '../../models/prop-firm.model';
import { PropFirmTrade } from '../../models/prop-firm-trade.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { AlertService } from '../../core/services/alert.service';
import {
  formatFirmCurrency,
  getPropTradePnL,
  getPropTradeStatus,
} from '../../core/utils/prop-firm-analytics.util';

type SortField =
  | 'symbol'
  | 'side'
  | 'entryPrice'
  | 'exitPrice'
  | 'quantity'
  | 'grossProfit'
  | 'fees'
  | 'netProfit'
  | 'strategy'
  | 'tradeDate';
type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-prop-firm-trade-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    PageHeaderComponent,
  ],
  templateUrl: './prop-firm-trade-list.component.html',
  styleUrls: ['./prop-firm-trade-list.component.scss'],
})
export class PropFirmTradeListComponent implements OnInit, OnDestroy {
  private propFirmService = inject(PropFirmService);
  private propFirmTradeService = inject(PropFirmTradeService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private alertService = inject(AlertService);

  firm: PropFirm | null = null;
  firmId = '';

  allTrades: PropFirmTrade[] = [];
  filteredTrades: PropFirmTrade[] = [];
  isLoading = true;
  loadError = '';

  searchQuery = '';
  filterSide = '';
  filterStrategy = '';
  filterProfitLoss = '';
  strategies: string[] = [];

  sortField: SortField = 'tradeDate';
  sortDir: SortDir = 'desc';

  totalTrades = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];
  currentPage = 0;

  galleryImages: string[] = [];
  currentImageIndex = 0;
  showImageModal = false;
  zoomLevel = 1;
  /** Screenshot URLs that failed to load - hidden from the table and gallery. */
  private brokenImages = new Set<string>();

  private paramSubscription?: Subscription;

  ngOnInit(): void {
    this.paramSubscription = this.route.paramMap.subscribe((params) => {
      this.firmId = params.get('id') ?? '';
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.paramSubscription?.unsubscribe();
  }

  private load(): void {
    this.isLoading = true;
    this.loadError = '';

    if (!this.firmId) {
      this.isLoading = false;
      this.loadError = 'No prop firm selected.';
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
      next: (data) => {
        this.allTrades = data.map((t) => ({
          ...t,
          netProfit: Number(t.netProfit ?? 0),
          grossProfit: Number(t.grossProfit ?? 0),
          fees: Number(t.fees ?? 0),
        }));

        this.strategies = [...new Set(this.allTrades.map((t) => t.strategy).filter(Boolean))];

        this.applyFilters();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  applyFilters(): void {
    let result = [...this.allTrades];

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.strategy?.toLowerCase().includes(q) ||
          t.side.toLowerCase().includes(q)
      );
    }

    if (this.filterSide) {
      result = result.filter((t) => t.side === this.filterSide);
    }

    if (this.filterStrategy) {
      result = result.filter((t) => t.strategy === this.filterStrategy);
    }

    if (this.filterProfitLoss) {
      result = result.filter((t) => {
        const status = getPropTradeStatus(t);
        return (
          (this.filterProfitLoss === 'PROFIT' && status === 'WIN') ||
          (this.filterProfitLoss === 'LOSS' && status === 'LOSS')
        );
      });
    }

    result.sort((a, b) => {
      const aVal = (a as any)[this.sortField];
      const bVal = (b as any)[this.sortField];
      let cmp = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal);
      } else if (this.sortField === 'tradeDate') {
        cmp = new Date(aVal).getTime() - new Date(bVal).getTime();
      } else {
        cmp = Number(aVal) - Number(bVal);
      }
      return this.sortDir === 'asc' ? cmp : -cmp;
    });

    this.filteredTrades = result;
    this.totalTrades = result.length;
    this.currentPage = 0;
  }

  onSort(field: SortField): void {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir = 'asc';
    }
    this.applyFilters();
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.currentPage = event.pageIndex;
  }

  getPaginatedTrades(): PropFirmTrade[] {
    const start = this.currentPage * this.pageSize;
    return this.filteredTrades.slice(start, start + this.pageSize);
  }

  get currency(): string {
    return (this.firm?.accountCurrency || '').toUpperCase() || 'INR';
  }

  formatCurrency(v: number): string {
    return formatFirmCurrency(Number(v) || 0, this.currency);
  }

  getStatus(trade: PropFirmTrade): string {
    return getPropTradeStatus(trade);
  }

  getTotalPnL(): number {
    return this.filteredTrades.reduce((s, t) => s + getPropTradePnL(t), 0);
  }

  getWins(): number {
    return this.filteredTrades.filter((t) => getPropTradeStatus(t) === 'WIN').length;
  }

  getLosses(): number {
    return this.filteredTrades.filter((t) => getPropTradeStatus(t) === 'LOSS').length;
  }

  getWinRate(): number {
    return this.filteredTrades.length
      ? Math.round((this.getWins() / this.filteredTrades.length) * 100)
      : 0;
  }

  /** Screenshots that can actually be shown (excludes ones that failed to load). */
  visibleImages(trade: PropFirmTrade): string[] {
    return (trade.imageUrls ?? []).filter((url) => !!url && !this.brokenImages.has(url));
  }

  onImageError(url: string): void {
    this.brokenImages.add(url);
  }

  openGallery(images: string[], index: number): void {
    this.galleryImages = images;
    this.currentImageIndex = index;
    this.showImageModal = true;
    this.zoomLevel = 1;
  }

  nextImage(): void {
    if (this.currentImageIndex < this.galleryImages.length - 1) {
      this.currentImageIndex++;
    }
  }

  previousImage(): void {
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
    }
  }

  closeImage(): void {
    this.showImageModal = false;
    this.zoomLevel = 1;
  }

  zoomIn(): void {
    if (this.zoomLevel < 3) this.zoomLevel += 0.2;
  }

  zoomOut(): void {
    if (this.zoomLevel > 0.4) this.zoomLevel -= 0.2;
  }

  resetZoom(): void {
    this.zoomLevel = 1;
  }

  addTrade(): void {
    this.router.navigate(['/prop-firms', this.firmId, 'add-trade']);
  }

  backToDashboard(): void {
    this.router.navigate(['/prop-firms', this.firmId]);
  }

  editTrade(trade: PropFirmTrade): void {
    if (!trade.id) return;
    this.router.navigate(['/prop-firms', this.firmId, 'edit-trade', trade.id]);
  }

  deleteTrade(trade: PropFirmTrade): void {
    if (!trade.id) return;
    const tradeId = trade.id;

    this.alertService
      .confirm(
        'Delete Trade?',
        `${trade.symbol} · this prop firm trade will be removed. This action cannot be undone.`
      )
      .then((result) => {
        if (!result.isConfirmed) return;

        this.propFirmTradeService.deleteTrade(this.firmId, tradeId).subscribe({
          next: () => {
            this.alertService.success('Deleted', 'Prop firm trade deleted successfully.');
            this.loadTrades();
          },
          error: () => {
            this.alertService.error('Delete Failed', 'Unable to delete the trade.');
          },
        });
      });
  }

  exportCsv(): void {
    const headers = [
      'Symbol',
      'Side',
      'Entry Price',
      'Exit Price',
      'Stop Loss',
      'Take Profit',
      'Quantity',
      'Gross Profit (Account)',
      'Fees',
      'Net Profit (Account)',
      'Net Profit (INR)',
      'Strategy',
      'Trade Date',
      'Status',
    ];

    const rows = this.filteredTrades.map((t) => [
      t.symbol,
      t.side,
      t.entryPrice,
      t.exitPrice,
      t.stopLoss,
      t.takeProfit,
      t.quantity,
      Number(t.grossProfit ?? 0),
      Number(t.fees ?? 0),
      Number(t.netProfit ?? 0),
      Number(t.netProfitINR ?? 0),
      t.strategy,
      t.tradeDate,
      getPropTradeStatus(t),
    ]);

    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (this.firm?.firmName || 'prop-firm').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    a.download = `propfirms-${safeName}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportPdf(): void {
    window.print();
  }
}
