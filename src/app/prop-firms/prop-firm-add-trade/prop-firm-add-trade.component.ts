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
import { PropFirmTradeService } from '../../services/prop-firm-trade.service';
import { PropFirm } from '../../models/prop-firm.model';
import { PropFirmTrade } from '../../models/prop-firm-trade.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { AlertService } from '../../core/services/alert.service';
import {
  ImageUploadService,
  PendingImage,
} from '../../core/services/image-upload.service';
import { formatBytes } from '../../core/utils/image-compression.util';
import { formatFirmCurrency } from '../../core/utils/prop-firm-analytics.util';

interface PropTradePreview {
  grossAccount: number;
  fees: number;
  netAccount: number;
  netINR: number;
}

@Component({
  selector: 'app-prop-firm-add-trade',
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
  templateUrl: './prop-firm-add-trade.component.html',
  styleUrls: ['./prop-firm-add-trade.component.scss'],
})
export class PropFirmAddTradeComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private propFirmService = inject(PropFirmService);
  private propFirmTradeService = inject(PropFirmTradeService);
  private alertService = inject(AlertService);
  private imageUpload = inject(ImageUploadService);

  tradeForm: FormGroup;
  firm: PropFirm | null = null;

  firmId = '';
  tradeId = '';
  isEditMode = false;

  isLoading = true;
  formReady = false;
  loadError = '';
  saveError = '';

  /** Screenshots already stored on this trade. */
  existingImageUrls: string[] = [];
  /** Newly picked screenshots - compressed, uploaded when the trade is saved. */
  pendingImages: PendingImage[] = [];
  isCompressing = false;
  isDragging = false;

  sideOptions = ['BUY', 'SELL'];
  strategies = [
    'Breakout',
    'Liquidity',
    'Reversal',
    'Trend Following',
    'Scalping',
    'Swing',
    'Gap & Go',
    'VWAP Bounce',
    'ORB',
  ];

  /** USD-base FX table. Only ever used to convert within the prop firm account. */
  rates: Record<string, number> = { USD: 1, INR: 86 };

  preview: PropTradePreview = { grossAccount: 0, fees: 0, netAccount: 0, netINR: 0 };

  private paramSubscription?: Subscription;
  private valueSubscription?: Subscription;

  constructor() {
    this.tradeForm = this.fb.group({
      symbol: ['', [Validators.required, Validators.minLength(1)]],
      side: ['BUY', Validators.required],
      entryPrice: [null, [Validators.required, Validators.min(0.01)]],
      exitPrice: [null, [Validators.required, Validators.min(0.01)]],
      stopLoss: [null, [Validators.required, Validators.min(0.01)]],
      takeProfit: [null, [Validators.required, Validators.min(0.01)]],
      quantity: [0.01, [Validators.required, Validators.min(0.01)]],
      strategy: ['', Validators.required],
      tradeDate: [new Date(), Validators.required],
      notes: [''],
      grossProfitUSD: [null],
      grossProfitINR: [null],
      fees: [0, Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadRates();

    this.valueSubscription = this.tradeForm.valueChanges.subscribe(() => this.recalcPreview());

    this.paramSubscription = this.route.paramMap.subscribe((params) => {
      this.firmId = params.get('id') ?? '';
      this.tradeId = params.get('tradeId') ?? '';
      this.isEditMode = !!this.tradeId;
      this.saveError = '';
      this.loadError = '';
      this.formReady = false;
      this.existingImageUrls = [];
      this.pendingImages = [];
      this.isCompressing = false;
      this.isDragging = false;
      this.loadFirm();
    });
  }

  ngOnDestroy(): void {
    this.paramSubscription?.unsubscribe();
    this.valueSubscription?.unsubscribe();
  }

  private loadRates(): void {
    this.propFirmTradeService.getUsdRates().subscribe({
      next: (res: any) => {
        if (res?.rates) this.rates = { USD: 1, ...res.rates };
        this.recalcPreview();
      },
      error: () => {
        this.rates = { USD: 1, INR: 86 };
        this.recalcPreview();
      },
    });
  }

  private loadFirm(): void {
    this.isLoading = true;

    if (!this.firmId) {
      this.isLoading = false;
      this.loadError = 'No prop firm selected.';
      return;
    }

    this.propFirmService.getPropFirm(this.firmId).subscribe({
      next: (firm) => {
        this.firm = firm;
        if (this.isEditMode) this.loadTrade();
        else {
          this.isLoading = false;
          this.formReady = true;
          this.recalcPreview();
        }
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

  private loadTrade(): void {
    this.propFirmTradeService.getTrade(this.firmId, this.tradeId).subscribe({
      next: (trade) => {
        this.tradeForm.patchValue({
          symbol: trade.symbol ?? '',
          side: trade.side || 'BUY',
          entryPrice: trade.entryPrice ?? null,
          exitPrice: trade.exitPrice ?? null,
          stopLoss: trade.stopLoss ?? null,
          takeProfit: trade.takeProfit ?? null,
          quantity: trade.quantity ?? 0.01,
          strategy: trade.strategy ?? '',
          tradeDate: trade.tradeDate ? new Date(trade.tradeDate) : new Date(),
          notes: trade.notes ?? '',
          grossProfitUSD: trade.grossProfitUSD ?? null,
          grossProfitINR: trade.grossProfitINR ?? null,
          fees: trade.fees ?? 0,
        });
        this.existingImageUrls = trade.imageUrls ?? [];
        this.pendingImages = [];
        this.isLoading = false;
        this.formReady = true;
        this.recalcPreview();
      },
      error: () => {
        this.isLoading = false;
        this.loadError = 'This trade could not be found.';
      },
    });
  }

  // ── Conversion helpers (prop firm account currency aware) ──────

  get currency(): string {
    return (this.firm?.accountCurrency || '').toUpperCase() || 'INR';
  }

  get usdInrRate(): number {
    return this.rates['INR'] || 86;
  }

  /** 1 USD expressed in the prop firm account currency. */
  private usdToAccount(usd: number): number {
    const rate = this.rates[this.currency] || 1;
    return usd * rate;
  }

  /** Prop firm account currency amount expressed in INR. */
  private accountToINR(amount: number): number {
    const rate = this.rates[this.currency] || 1;
    return rate > 0 ? (amount / rate) * this.usdInrRate : amount;
  }

  formatMoney(value: number): string {
    return formatFirmCurrency(value || 0, this.currency);
  }

  formatINR(value: number): string {
    return formatFirmCurrency(value || 0, 'INR');
  }

  // ── Cross-converting input pair ────────────────────────────────

  onUsdInput(): void {
    const usd = this.tradeForm.get('grossProfitUSD')?.value;
    if (usd !== null && usd !== '' && Number.isFinite(Number(usd))) {
      this.tradeForm.patchValue(
        { grossProfitINR: Number((Number(usd) * this.usdInrRate).toFixed(2)) },
        { emitEvent: false }
      );
    }
    this.recalcPreview();
  }

  onInrInput(): void {
    const inr = this.tradeForm.get('grossProfitINR')?.value;
    if (inr !== null && inr !== '' && Number.isFinite(Number(inr))) {
      this.tradeForm.patchValue(
        { grossProfitUSD: Number((Number(inr) / this.usdInrRate).toFixed(2)) },
        { emitEvent: false }
      );
    }
    this.recalcPreview();
  }

  private recalcPreview(): void {
    const raw = this.tradeForm.getRawValue();
    const grossUSD = Number(raw.grossProfitUSD ?? 0) || 0;
    const fees = Number(raw.fees ?? 0) || 0;
    const grossAccount = this.usdToAccount(grossUSD);
    const netAccount = grossAccount - fees;

    this.preview = {
      grossAccount,
      fees,
      netAccount,
      netINR: this.accountToINR(netAccount),
    };
  }

  // ── Screenshots (compressed client-side, uploaded on save) ─────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    void this.processFiles(input.files);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    if (!event.dataTransfer?.files.length) return;
    void this.processFiles(event.dataTransfer.files);
  }

  private async processFiles(files: FileList | null): Promise<void> {
    const picked = Array.from(files ?? []);
    if (picked.length === 0) return;

    this.isCompressing = true;

    try {
      const { images, errors } = await this.imageUpload.prepare(picked);
      this.pendingImages.push(...images);

      if (errors.length) {
        this.alertService.warning('Optimization Skipped', errors.join('\n'));
      }
    } catch (error) {
      console.error(error);
      this.alertService.error(
        'Compression Failed',
        'The selected images could not be processed.'
      );
    } finally {
      this.isCompressing = false;
    }
  }

  removeExistingImage(index: number): void {
    this.existingImageUrls.splice(index, 1);
  }

  removeNewImage(index: number): void {
    this.pendingImages.splice(index, 1);
  }

  /** Original → compressed size shown under every pending thumbnail. */
  compressionLabel(image: PendingImage): string {
    if (image.compressed) {
      return `${formatBytes(image.originalSize)} → ${formatBytes(image.compressedSize)}`;
    }
    if (image.compressionError) {
      return `${formatBytes(image.originalSize)} · original kept`;
    }
    return `${formatBytes(image.originalSize)} · already optimized`;
  }

  private async uploadImagesToCloudinary(): Promise<string[]> {
    if (this.pendingImages.length === 0) return [];
    return this.imageUpload.uploadAll(this.pendingImages.map((p) => p.file));
  }

  // ── Save ───────────────────────────────────────────────────────

  async saveTrade(): Promise<void> {
    this.saveError = '';

    if (this.tradeForm.invalid) {
      Object.keys(this.tradeForm.controls).forEach((key) => {
        this.tradeForm.get(key)?.markAsTouched();
      });
      this.alertService.warning('Incomplete Form', 'Please fill all required fields.');
      return;
    }

    if (!this.firm) {
      this.saveError = 'Prop firm could not be loaded.';
      return;
    }

    if (this.isCompressing) {
      this.saveError = 'Images are still being optimized. Please try again in a moment.';
      return;
    }

    const raw = this.tradeForm.getRawValue();
    const grossProfitUSD = Number((Number(raw.grossProfitUSD ?? 0) || 0).toFixed(2));
    const grossProfitINR = Number((Number(raw.grossProfitINR ?? 0) || 0).toFixed(2));
    const grossProfit = Number(this.usdToAccount(grossProfitUSD).toFixed(2));
    const fees = Number((Number(raw.fees ?? 0) || 0).toFixed(2));
    const netProfit = Number((grossProfit - fees).toFixed(2));
    const netProfitINR = Number(this.accountToINR(netProfit).toFixed(2));

    this.isLoading = true;

    let uploadedUrls: string[] = [];
    try {
      uploadedUrls = await this.uploadImagesToCloudinary();
    } catch (error) {
      console.error(error);
      this.isLoading = false;
      this.saveError = 'One or more screenshots could not be uploaded.';
      this.alertService.error('Upload Failed', 'Failed to upload image.');
      return;
    }

    const payload: PropFirmTrade = {
      propFirmId: this.firmId,
      userId: '',
      id: this.tradeId || undefined,
      symbol: String(raw.symbol ?? '').trim(),
      side: raw.side ?? 'BUY',
      entryPrice: Number(raw.entryPrice ?? 0),
      exitPrice: Number(raw.exitPrice ?? 0),
      stopLoss: Number(raw.stopLoss ?? 0),
      takeProfit: Number(raw.takeProfit ?? 0),
      quantity: Number(raw.quantity ?? 0),
      strategy: raw.strategy ?? '',
      notes: String(raw.notes ?? ''),
      tradeDate: new Date(raw.tradeDate).toISOString(),
      grossProfitUSD,
      grossProfitINR,
      grossProfit,
      fees,
      netProfit,
      netProfitINR,
      imageUrls: [...this.existingImageUrls, ...uploadedUrls],
    };

    if (this.isEditMode) {
      this.propFirmTradeService.updateTrade(this.firmId, this.tradeId, payload).subscribe({
        next: () => {
          this.isLoading = false;
          this.alertService.success('Trade Updated', 'Prop firm trade updated successfully.');
          this.router.navigate(['/prop-firms', this.firmId, 'trades']);
        },
        error: (err) => {
          this.isLoading = false;
          this.saveError = err?.error?.message || 'Failed to update the trade.';
        },
      });
    } else {
      this.propFirmTradeService.addTrade(payload).subscribe({
        next: () => {
          this.isLoading = false;
          this.alertService.success('Trade Saved', 'Prop firm trade saved successfully.');
          this.router.navigate(['/prop-firms', this.firmId]);
        },
        error: (err) => {
          this.isLoading = false;
          this.saveError = err?.error?.message || 'Failed to save the trade.';
        },
      });
    }
  }

  cancel(): void {
    if (this.firmId) {
      this.router.navigate([
        '/prop-firms',
        this.firmId,
        this.isEditMode ? 'trades' : '',
      ].filter(Boolean));
    } else {
      this.router.navigate(['/prop-firms']);
    }
  }
}
