import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';
import { PropFirmService } from '../../services/prop-firm.service';
import { PropFirm } from '../../models/prop-firm.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { AlertService } from '../../core/services/alert.service';
import { DashboardRefreshService } from '../../core/services/dashboard-refresh.service';
import {
  normalizePropFirmStatus,
  PROP_FIRM_CURRENCIES,
  PROP_FIRM_STATUSES,
} from '../../core/utils/prop-firm-analytics.util';

@Component({
  selector: 'app-prop-firm-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './prop-firm-form.component.html',
  styleUrls: ['./prop-firm-form.component.scss'],
})
export class PropFirmFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private propFirmService = inject(PropFirmService);
  private alertService = inject(AlertService);
  private dashboardRefreshService = inject(DashboardRefreshService);

  firmForm: FormGroup;
  currencies = PROP_FIRM_CURRENCIES;
  accountTypes = ['Challenge', 'Evaluation', 'Funded', 'Live', 'Demo'];
  statuses: string[] = PROP_FIRM_STATUSES;

  isEditMode = false;
  firmId = '';
  isLoading = false;
  formReady = false;
  loadError = '';
  saveError = '';

  private paramSubscription?: Subscription;

  constructor() {
    this.firmForm = this.fb.group({
      firmName: ['', [Validators.required, Validators.maxLength(80)]],
      accountName: [''],
      accountId: [''],
      accountType: ['Funded', Validators.required],
      initialBalance: [null, [Validators.required, Validators.min(0.01)]],
      accountCurrency: ['USD', Validators.required],
      accountSize: [null],
      profitTarget: [null],
      maximumDailyLoss: [null],
      maximumOverallDrawdown: [null],
      amountSpent: [null, [Validators.required, Validators.min(0)]],
      payouts: [null, [Validators.min(0)]],
      status: ['Active', Validators.required],
      startDate: [null],
      notes: [''],
    });
  }

  ngOnInit(): void {
    this.paramSubscription = this.route.paramMap.subscribe((params) => {
      this.firmId = params.get('id') ?? '';
      this.isEditMode = !!this.firmId;
      this.loadError = '';
      this.saveError = '';
      this.formReady = false;

      if (this.isEditMode) {
        this.loadFirm();
      } else {
        this.formReady = true;
      }
    });
  }

  ngOnDestroy(): void {
    this.paramSubscription?.unsubscribe();
  }

  private loadFirm(): void {
    this.isLoading = true;
    this.propFirmService.getPropFirm(this.firmId).subscribe({
      next: (firm) => {
        this.patchForm(firm);
        this.isLoading = false;
        this.formReady = true;
      },
      error: (err) => {
        this.isLoading = false;
        this.loadError =
          err?.status === 403
            ? 'You do not have permission to edit this prop firm.'
            : 'This prop firm could not be found.';
      },
    });
  }

  private patchForm(firm: PropFirm): void {
    this.firmForm.patchValue({
      firmName: firm.firmName ?? '',
      accountName: firm.accountName ?? '',
      accountId: firm.accountId ?? '',
      accountType: firm.accountType || 'Funded',
      initialBalance: firm.initialBalance ?? null,
      accountCurrency: firm.accountCurrency || 'USD',
      accountSize: firm.accountSize ?? null,
      profitTarget: firm.profitTarget ?? null,
      maximumDailyLoss: firm.maximumDailyLoss ?? null,
      maximumOverallDrawdown: firm.maximumOverallDrawdown ?? null,
      amountSpent: firm.amountSpent ?? 0,
      payouts: firm.payouts ?? 0,
      status: normalizePropFirmStatus(firm.status),
      startDate: firm.startDate ? new Date(firm.startDate) : null,
      notes: firm.notes ?? '',
    });
  }

  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  saveFirm(): void {
    this.saveError = '';

    if (this.firmForm.invalid) {
      Object.keys(this.firmForm.controls).forEach((key) => {
        this.firmForm.get(key)?.markAsTouched();
      });
      this.alertService.warning('Incomplete Form', 'Please fill all required fields.');
      return;
    }

    const raw = this.firmForm.getRawValue();
    const startDate = raw.startDate ? new Date(raw.startDate).toISOString() : null;

    const payload: PropFirm = {
      firmName: String(raw.firmName ?? '').trim(),
      accountName: String(raw.accountName ?? '').trim(),
      accountId: String(raw.accountId ?? '').trim(),
      accountType: raw.accountType ?? '',
      initialBalance: Number(raw.initialBalance ?? 0),
      accountCurrency: raw.accountCurrency ?? 'USD',
      accountSize: this.toNumber(raw.accountSize),
      profitTarget: this.toNumber(raw.profitTarget),
      maximumDailyLoss: this.toNumber(raw.maximumDailyLoss),
      maximumOverallDrawdown: this.toNumber(raw.maximumOverallDrawdown),
      amountSpent: this.toNumber(raw.amountSpent) ?? 0,
      payouts: this.toNumber(raw.payouts) ?? 0,
      status: normalizePropFirmStatus(raw.status),
      startDate,
      notes: String(raw.notes ?? '').trim(),
    };

    this.isLoading = true;

    if (this.isEditMode) {
      this.propFirmService.updatePropFirm(this.firmId, payload).subscribe({
        next: () => {
          this.isLoading = false;
          this.dashboardRefreshService.triggerRefresh();
          this.alertService.success('Prop Firm Updated', 'Prop firm updated successfully.');
          this.router.navigate(['/prop-firms', this.firmId]);
        },
        error: (err) => {
          this.isLoading = false;
          this.saveError = err?.error?.message || 'Failed to update the prop firm.';
        },
      });
    } else {
      this.propFirmService.addPropFirm(payload).subscribe({
        next: (res: any) => {
          this.isLoading = false;
          this.dashboardRefreshService.triggerRefresh();
          this.alertService.success('Prop Firm Created', 'Prop firm created successfully.');
          this.router.navigate(['/prop-firms', res?.id ?? '']);
        },
        error: (err) => {
          this.isLoading = false;
          this.saveError = err?.error?.message || 'Failed to create the prop firm.';
        },
      });
    }
  }

  cancel(): void {
    if (this.isEditMode) {
      this.router.navigate(['/prop-firms', this.firmId]);
    } else {
      this.router.navigate(['/prop-firms']);
    }
  }
}
