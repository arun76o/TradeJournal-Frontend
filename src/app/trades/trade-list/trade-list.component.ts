import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TradeService } from '../../services/trade.service';
import { SettingsService } from '../../core/services/settings.service';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { Trade } from '../../models/trade.model';
import {
  getTradePnL,
  getTradeStatus,
} from '../../core/utils/trade-analytics.util';
import { Auth, authState } from '@angular/fire/auth';
import Swal from 'sweetalert2';
import { AlertService } from '../../core/services/alert.service';
import { DashboardRefreshService } from '../../core/services/dashboard-refresh.service';

type SortField =
  | 'symbol'
  | 'side'
  | 'entryPrice'
  | 'exitPrice'
  | 'quantity'
  | 'grossProfitUSD'
  | 'grossProfitINR'
  | 'fees'
  | 'netProfitINR'
  | 'strategy'
  | 'tradeDate';
type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-trade-list',
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
  templateUrl: './trade-list.component.html',
  styleUrls: ['./trade-list.component.scss'],
})
export class TradeListComponent implements OnInit {
  private tradeService = inject(TradeService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private alertService = inject(AlertService);
  readonly settings = inject(SettingsService);
  private auth = inject(Auth);
  private dashboardRefreshService = inject(DashboardRefreshService);

  allTrades: Trade[] = [];
  filteredTrades: Trade[] = [];
  isLoading = true;

  galleryImages: string[] = [];
  currentImageIndex = 0;
  showImageModal = false;
  zoomLevel = 1;

  searchQuery = '';
  filterSide = '';
  filterStrategy = '';
  strategies: string[] = [];

  sortField: SortField = 'tradeDate';
  sortDir: SortDir = 'desc';
  selectedImage: string | null = null;
  // showImageModal = false;

  totalTrades = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50];
  currentPage = 0;

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['q']) this.searchQuery = params['q'];
      this.loadTrades();
    });
  }

  loadTrades(): void {
    authState(this.auth).subscribe((user) => {
      if (!user) {
        this.isLoading = false;
        return;
      }

      this.isLoading = true;

      this.tradeService.getTrades(user.uid).subscribe({
        next: (data) => {
          this.allTrades = data.map((t) => ({
            ...t,
            grossProfitUSD: Number(t.grossProfitUSD),
            grossProfitINR: Number(t.grossProfitINR),
            fees: Number(t.fees),
            netProfitINR: Number(t.netProfitINR),
          }));

          this.strategies = [
            ...new Set(this.allTrades.map((t) => t.strategy).filter(Boolean)),
          ];

          this.applyFilters();
          this.isLoading = false;
        },

        error: () => {
          this.isLoading = false;
        },
      });
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
          t.side.toLowerCase().includes(q),
      );
    }

    if (this.filterSide) {
      result = result.filter((t) => t.side === this.filterSide);
    }

    if (this.filterStrategy) {
      result = result.filter((t) => t.strategy === this.filterStrategy);
    }

    result.sort((a, b) => {
      const aVal = a[this.sortField];
      const bVal = b[this.sortField];
      let cmp = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal);
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

  getPaginatedTrades(): Trade[] {
    const start = this.currentPage * this.pageSize;
    return this.filteredTrades.slice(start, start + this.pageSize);
    console.log('Alltrades', this.filteredTrades);
  }

  formatCurrency(v: number): string {
    return this.settings.formatCurrency(v);
  }

  getStatus(trade: Trade): string {
    return getTradeStatus(trade);
  }

  getTotalPnL(): number {
    return this.filteredTrades.reduce((s, t) => s + getTradePnL(t), 0);
  }

  exportCsv(): void {
    const headers = [
      'Symbol',
      'Side',
      'Entry Price',
      'Exit Price',
      'Quantity',
      'Gross Profit USD',
      'Gross Profit INR',
      'Fees',
      'Net Profit INR',
      'Strategy',
      'Trade Date',
      'Status',
    ];
    const rows = this.filteredTrades.map((t) => [
      t.symbol,
      t.side,
      t.entryPrice,
      t.exitPrice,
      t.quantity,
      t.grossProfitUSD,
      t.grossProfitINR,
      t.fees,
      t.netProfitINR,
      t.strategy,
      t.tradeDate,
      getTradeStatus(t),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportPdf(): void {
    window.print();
  }

  // deleteTrade(id: string | undefined): void {
  //   if (!id || !confirm('Are you sure you want to delete this trade?')) return;
  //   this.tradeService.deleteTrade(id).subscribe({
  //     next: () => this.loadTrades(),
  //     error: (err) => console.error(err),
  //   });
  // }

  deleteTrade(id: string | undefined): void {
    if (!id) return;

    this.alertService
      .confirm('Delete Trade?', 'This action cannot be undone.')
      .then((result) => {
        if (result.isConfirmed) {
          this.tradeService.deleteTrade(id).subscribe({
            next: () => {
              this.alertService.success(
                'Deleted',
                'Trade deleted successfully.',
              );

              this.loadTrades();
              this.dashboardRefreshService.triggerRefresh();
            },

            error: () => {
              this.alertService.error(
                'Delete Failed',
                'Unable to delete trade.',
              );
            },
          });
        }
      });
  }
  openGallery(images: string[], index: number) {
    this.galleryImages = images;
    this.currentImageIndex = index;
    this.showImageModal = true;
    this.zoomLevel = 1;
  }
  // openImage(imageUrl: string) {
  //   this.selectedImage = imageUrl;
  //   this.showImageModal = true;
  //     this.zoomLevel = 1;
  // }
  nextImage() {
    if (this.currentImageIndex < this.galleryImages.length - 1) {
      this.currentImageIndex++;
    }
  }

  previousImage() {
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
    }
  }

  closeImage() {
    this.showImageModal = false;
    this.zoomLevel = 1;
  }
  editTrade(trade: Trade) {
    this.router.navigate(['/edit-trade', trade.id]);
  }

  zoomIn() {
    if (this.zoomLevel < 3) {
      this.zoomLevel += 0.2;
    }
  }

  zoomOut() {
    if (this.zoomLevel > 0.4) {
      this.zoomLevel -= 0.2;
    }
  }

  resetZoom() {
    this.zoomLevel = 1;
  }
}
