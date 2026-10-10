import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PropFirmService } from '../services/prop-firm.service';
import { PropFirm } from '../models/prop-firm.model';
import { PageHeaderComponent } from '../shared/components/page-header/page-header.component';
import {
  formatFirmCurrency,
  normalizePropFirmStatus,
} from '../core/utils/prop-firm-analytics.util';

@Component({
  selector: 'app-prop-firms',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './prop-firms.component.html',
  styleUrls: ['./prop-firms.component.scss'],
})
export class PropFirmsComponent implements OnInit {
  private propFirmService = inject(PropFirmService);
  private router = inject(Router);

  firms: PropFirm[] = [];
  isLoading = true;

  ngOnInit(): void {
    this.loadFirms();
  }

  loadFirms(): void {
    this.propFirmService.getPropFirms().subscribe({
      next: (firms) => {
        this.firms = firms;
        this.isLoading = false;
      },
      error: () => {
        this.firms = [];
        this.isLoading = false;
      },
    });
  }

  openFirm(firm: PropFirm): void {
    if (!firm.id) return;
    this.router.navigate(['/prop-firms', firm.id]);
  }

  addFirm(): void {
    this.router.navigate(['/prop-firms/add']);
  }

  statusOf(firm: PropFirm): string {
    return normalizePropFirmStatus(firm.status);
  }

  statusClassOf(firm: PropFirm): string {
    const status = this.statusOf(firm);
    if (status === 'Failed') return 'failed';
    if (status === 'Passed') return 'passed';
    return '';
  }

  formatAccountSize(firm: PropFirm): string {
    const size = Number(firm.accountSize ?? firm.initialBalance ?? 0);
    return formatFirmCurrency(size, firm.accountCurrency || 'USD');
  }

  currencyOf(firm: PropFirm): string {
    return (firm.accountCurrency || 'USD').toUpperCase();
  }

  formatAmountSpent(firm: PropFirm): string {
    return formatFirmCurrency(Number(firm.amountSpent ?? 0), 'INR');
  }
}
