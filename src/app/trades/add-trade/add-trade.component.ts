// add-trade.component.ts
import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';
import { TradeService } from '../../services/trade.service';
import { SettingsService } from '../../core/services/settings.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { AlertService } from '../../core/services/alert.service';
import { DashboardRefreshService } from '../../core/services/dashboard-refresh.service';
import {
  ImageUploadService,
  PendingImage,
} from '../../core/services/image-upload.service';
import { formatBytes } from '../../core/utils/image-compression.util';
import { Auth, authState } from '@angular/fire/auth';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-add-trade',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './add-trade.component.html',
  styleUrls: ['./add-trade.component.scss'],
})
export class AddTradeComponent {
  tradeForm: FormGroup;
  sideOptions = ['BUY', 'SELL'];
  isLoading = false;
  usdInrRate = 86;

  /** Newly picked images, already compressed, awaiting upload. */
  pendingImages: PendingImage[] = [];
  /** True while the selected screenshots are being compressed. */
  isCompressing = false;

  existingImageUrls: string[] = [];
  isDragging = false;

  @ViewChild('fileInput')
  fileInput!: ElementRef;
  isEditMode = false;
  tradeId = '';

  readonly settingsService = inject(SettingsService);

  constructor(
    private fb: FormBuilder,
    private tradeService: TradeService,
    private alertService: AlertService,
    private dashboardRefreshService: DashboardRefreshService,
    private imageUpload: ImageUploadService,
    private auth: Auth,
    private route: ActivatedRoute,
  ) {
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
      netProfitINR: [{ value: null, disabled: true }],
    });

    // Auto-calculate profit/loss when relevant fields change
    this.tradeForm.valueChanges.subscribe(() => {
      this.calculateNetProfit();
    });
  }

  ngOnInit(): void {
    this.tradeService.getUsdInrRate().subscribe({
      next: (response) => {
        this.usdInrRate = response.rates.INR;
        console.log('USD to INR Rate:', this.usdInrRate);
      },
      error: () => {
        console.log('Unable to fetch exchange rate');
      },
    });

    this.tradeId = this.route.snapshot.paramMap.get('id') ?? '';

    if (this.tradeId) {
      this.isEditMode = true;

      this.tradeService.getTradeById(this.tradeId).subscribe((trade) => {
        this.tradeForm.patchValue(trade);
        this.existingImageUrls = trade.imageUrls ?? [];
      });
    }
  }

  calculateInrFromUsd() {
    const usd = this.tradeForm.get('grossProfitUSD')?.value;

    if (usd != null && usd !== '') {
      const inr = usd * this.usdInrRate;

      this.tradeForm.patchValue(
        {
          grossProfitINR: Number(inr.toFixed(2)),
        },
        { emitEvent: false },
      );
    }

    this.calculateNetProfit();
  }

  calculateUsdFromInr() {
    const inr = this.tradeForm.get('grossProfitINR')?.value;

    if (inr != null && inr !== '') {
      const usd = inr / this.usdInrRate;

      this.tradeForm.patchValue(
        {
          grossProfitUSD: Number(usd.toFixed(2)),
        },
        { emitEvent: false },
      );
    }

    this.calculateNetProfit();
  }

  calculateNetProfit() {
    const grossProfitINR = this.tradeForm.get('grossProfitINR')?.value;
    const fees = this.tradeForm.get('fees')?.value;

    if (grossProfitINR != null && fees != null) {
      const netProfitINR = grossProfitINR - fees;

      this.tradeForm.patchValue(
        {
          netProfitINR: Number(netProfitINR.toFixed(2)),
        },
        { emitEvent: false },
      );
    }
  }

  saveTrade() {
    authState(this.auth).subscribe(async (user) => {
      if (!user) {
        this.isLoading = false;
        return;
      }
      if (this.tradeForm.invalid) {
        Object.keys(this.tradeForm.controls).forEach((key) => {
          this.tradeForm.get(key)?.markAsTouched();
        });
        this.alertService.warning(
          'Incomplete Form',
          'Please fill all required fields.',
        );
        return;
      }
      this.isLoading = true;

      try {
        // Upload newly selected images
        const newImageUrls = await this.uploadImagesToCloudinary();
        const trade = this.tradeForm.getRawValue();
        // Preserve existing images and add new ones
        trade.imageUrls = [...this.existingImageUrls, ...newImageUrls];
        trade.userId = user.uid;
        trade.grossProfitUSD = Number((trade.grossProfitUSD ?? 0).toFixed(2));
        trade.grossProfitINR = Number((trade.grossProfitINR ?? 0).toFixed(2));
        trade.fees = Number((trade.fees ?? 0).toFixed(2));
        trade.netProfitINR = Number((trade.netProfitINR ?? 0).toFixed(2));
        if (this.isEditMode) {
          this.tradeService.updateTrade(this.tradeId, trade).subscribe({
            next: () => {
              this.isLoading = false;
              this.alertService.success(
                'Trade Updated',
                'Trade updated successfully!',
              );
              this.resetForm();
              this.dashboardRefreshService.triggerRefresh();
            },
            error: (error) => {
              console.error(error);
              this.isLoading = false;
              this.alertService.error(
                'Update Failed',
                'Failed to update trade.',
              );
            },
          });
        } else {
          this.tradeService.addTrade(trade).subscribe({
            next: () => {
              this.isLoading = false;

              this.alertService.success(
                'Trade Saved',
                'Trade saved successfully!',
              );
              this.resetForm();
              this.dashboardRefreshService.triggerRefresh();
            },
            error: (error) => {
              console.error(error);
              this.isLoading = false;
              this.alertService.error('Save Failed', 'Failed to save trade.');
            },
          });
        }
      } catch (error) {
        console.error(error);
        this.isLoading = false;
        this.alertService.error('Upload Failed', 'Failed to upload image.');
      }
    });
  }

  // onFileSelected(event: any) {
  //   this.selectedFiles = [];
  //   this.newImagePreviews = [];
  //   const files = event.target.files;
  //   for (let i = 0; i < files.length; i++) {
  //     this.selectedFiles.push(files[i]);
  //     const reader = new FileReader();
  //     reader.onload = () => {
  //       this.newImagePreviews.push(reader.result as string);
  //     };
  //     reader.readAsDataURL(files[i]);
  //   }
  // }

  onFileSelected(event: any) {
    this.processFiles(event.target.files);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();

    this.isDragging = true;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();

    this.isDragging = false;

    if (!event.dataTransfer?.files.length) return;

    this.processFiles(event.dataTransfer.files);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();

    this.isDragging = false;
  }
  async processFiles(files: FileList) {
    const picked = Array.from(files ?? []);
    if (picked.length === 0) return;

    this.isCompressing = true;

    try {
      const { images, errors } = await this.imageUpload.prepare(picked);
      this.pendingImages.push(...images);

      if (errors.length) {
        this.alertService.warning(
          'Optimization Skipped',
          errors.join('\n'),
        );
      }
    } catch (error) {
      console.error(error);
      this.alertService.error(
        'Compression Failed',
        'The selected images could not be processed.',
      );
    } finally {
      this.isCompressing = false;
    }
  }

  async uploadImagesToCloudinary(): Promise<string[]> {
    if (this.pendingImages.length === 0) {
      return [];
    }
    return this.imageUpload.uploadAll(this.pendingImages.map((p) => p.file));
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

  removeExistingImage(index: number) {
    this.existingImageUrls.splice(index, 1);
  }

  removeNewImage(index: number) {
    this.pendingImages.splice(index, 1);
  }

  resetForm() {
    this.tradeForm.reset({
      side: 'BUY',
      tradeDate: new Date(),
      quantity: 0.01,
      fees: 0,
      grossProfitUSD: null,
      grossProfitINR: null,
      netProfitINR: null,
    });
    this.pendingImages = [];
    this.existingImageUrls = [];
    this.isCompressing = false;
    // Clear file input
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
    // Reset edit mode
    this.tradeId = '';
    this.isEditMode = false;
  }
}
