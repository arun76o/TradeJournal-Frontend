import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChildren,
  QueryList,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Auth } from '@angular/fire/auth';
import { TwoFactorService } from '../../core/services/two-factor.service';
import { AlertService } from '../../core/services/alert.service';

@Component({
  selector: 'app-verify-otp',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './verify-otp.component.html',
  styleUrls: ['./verify-otp.component.scss'],
})
export class VerifyOtpComponent implements OnInit, OnDestroy {
  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  private router = inject(Router);
  private auth = inject(Auth);
  private twoFactorService = inject(TwoFactorService);
  private alertService = inject(AlertService);

  digits: string[] = ['', '', '', '', '', ''];
  isLoading = false;
  isResending = false;
  errorMessage = '';
  maskedEmail = '';
  challengeId = '';
  purpose = 'login';

  expirySeconds = 300;
  resendCooldownSeconds = 60;
  timeRemaining = 300;
  resendTimeRemaining = 60;
  isExpired = false;
  canResend = false;
  isVerified = false;

  private expiryTimer: any;
  private resendTimer: any;

  get formattedTime(): string {
    const mins = Math.floor(this.timeRemaining / 60);
    const secs = this.timeRemaining % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  get formattedResendTime(): string {
    const mins = Math.floor(this.resendTimeRemaining / 60);
    const secs = this.resendTimeRemaining % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  get isOtpComplete(): boolean {
    return this.digits.every((d) => d !== '');
  }

  get otpValue(): string {
    return this.digits.join('');
  }

  ngOnInit(): void {
    if (!this.auth.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    this.challengeId = this.twoFactorService.getChallengeId() || '';
    this.maskedEmail = this.twoFactorService.getMaskedEmail();
    this.purpose = this.twoFactorService.getChallengePurpose();

    if (!this.challengeId) {
      this.startNewChallenge();
      return;
    }

    const expiry = this.twoFactorService.getChallengeExpiry();
    if (expiry) {
      const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      if (remaining <= 0) {
        this.isExpired = true;
        this.timeRemaining = 0;
        this.canResend = true;
        return;
      }
      this.timeRemaining = remaining;
    }

    this.startTimers();
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  private startNewChallenge(): void {
    if (this.purpose === 'enable-2fa') {
      this.twoFactorService.startEnableTwoFactor().subscribe({
        next: (res) => {
          if (res.challengeId) {
            this.challengeId = res.challengeId;
            this.maskedEmail = res.maskedEmail || '';
            this.expirySeconds = res.expiresInSeconds || 300;
            this.resendCooldownSeconds = res.resendAvailableInSeconds || 60;
            this.timeRemaining = this.expirySeconds;
            this.resendTimeRemaining = this.resendCooldownSeconds;
            this.twoFactorService.storeChallenge(
              this.challengeId,
              this.expirySeconds,
              this.maskedEmail,
              this.purpose
            );
            this.startTimers();
          }
        },
        error: () => {
          this.errorMessage = 'Failed to start verification. Please try again.';
        },
      });
    } else {
      this.twoFactorService.startLoginTwoFactor().subscribe({
        next: (res) => {
          if (res.twoFactorRequired && res.challengeId) {
            this.challengeId = res.challengeId;
            this.maskedEmail = res.maskedEmail || '';
            this.expirySeconds = res.expiresInSeconds || 300;
            this.resendCooldownSeconds = res.resendAvailableInSeconds || 60;
            this.timeRemaining = this.expirySeconds;
            this.resendTimeRemaining = this.resendCooldownSeconds;
            this.twoFactorService.storeChallenge(
              this.challengeId,
              this.expirySeconds,
              this.maskedEmail,
              this.purpose
            );
            this.startTimers();
          } else {
            this.router.navigate(['/dashboard']);
          }
        },
        error: () => {
          this.errorMessage = 'Failed to start verification. Please try again.';
        },
      });
    }
  }

  private startTimers(): void {
    this.clearTimers();

    this.expiryTimer = setInterval(() => {
      this.timeRemaining--;
      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        this.isExpired = true;
        this.canResend = true;
        clearInterval(this.expiryTimer);
      }
    }, 1000);

    this.resendTimer = setInterval(() => {
      this.resendTimeRemaining--;
      if (this.resendTimeRemaining <= 0) {
        this.resendTimeRemaining = 0;
        this.canResend = true;
        clearInterval(this.resendTimer);
      }
    }, 1000);
  }

  private clearTimers(): void {
    if (this.expiryTimer) clearInterval(this.expiryTimer);
    if (this.resendTimer) clearInterval(this.resendTimer);
  }

  onDigitInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    if (!/^\d$/.test(value)) {
      this.digits[index] = '';
      input.value = '';
      return;
    }

    this.digits[index] = value;
    input.value = value;

    if (index < 5) {
      const nextInput = this.otpInputs.get(index + 1);
      if (nextInput) nextInput.nativeElement.focus();
    }

    this.errorMessage = '';

    if (this.isOtpComplete) {
      this.verifyOtp();
    }
  }

  onKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      if (this.digits[index] === '' && index > 0) {
        const prevInput = this.otpInputs.get(index - 1);
        if (prevInput) {
          prevInput.nativeElement.focus();
          this.digits[index - 1] = '';
        }
      } else {
        this.digits[index] = '';
      }
      this.errorMessage = '';
    } else if (event.key === 'Enter' && this.isOtpComplete) {
      this.verifyOtp();
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text') || '';
    const numericOnly = pastedData.replace(/\D/g, '').slice(0, 6);

    if (numericOnly.length === 0) return;

    for (let i = 0; i < 6; i++) {
      this.digits[i] = numericOnly[i] || '';
    }

    const focusIndex = Math.min(numericOnly.length, 5);
    const focusInput = this.otpInputs.get(focusIndex);
    if (focusInput) focusInput.nativeElement.focus();

    this.errorMessage = '';

    if (this.isOtpComplete) {
      setTimeout(() => this.verifyOtp(), 100);
    }
  }

  verifyOtp(): void {
    if (this.isLoading || this.isVerified || !this.isOtpComplete || this.isExpired) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.twoFactorService.verify(this.challengeId, this.otpValue).subscribe({
      next: (res) => {
        if (res.success && res.sessionToken) {
          this.isVerified = true;
          this.twoFactorService.storeSession(res.sessionToken);
          this.twoFactorService.clearChallenge();

          if (this.purpose === 'enable-2fa') {
            this.alertService.success('Two-Factor Enabled', 'Two-factor authentication has been enabled successfully.');
            this.router.navigate(['/profile']);
          } else if (this.purpose === 'disable-2fa') {
            this.twoFactorService.clearSession();
            this.alertService.success('Two-Factor Disabled', 'Two-factor authentication has been disabled.');
            this.router.navigate(['/profile']);
          } else {
            this.router.navigate(['/dashboard']);
          }
        }
      },
      error: (err) => {
        this.isLoading = false;
        const msg = err?.error?.message || err?.message || 'Verification failed.';
        this.errorMessage = msg;
        this.digits = ['', '', '', '', '', ''];
        const firstInput = this.otpInputs.get(0);
        if (firstInput) firstInput.nativeElement.focus();
      },
    });
  }

  resendCode(): void {
    if (this.isResending || !this.canResend) return;

    this.isResending = true;
    this.errorMessage = '';

    this.twoFactorService.resend(this.challengeId).subscribe({
      next: (res) => {
        this.isResending = false;
        this.canResend = false;
        this.isExpired = false;
        this.timeRemaining = res.expiresInSeconds || 300;
        this.resendTimeRemaining = res.resendAvailableInSeconds || 60;
        this.digits = ['', '', '', '', '', ''];
        this.twoFactorService.storeChallenge(
          this.challengeId,
          this.timeRemaining,
          this.maskedEmail,
          this.purpose
        );
        this.startTimers();
        this.alertService.success('Code Sent', 'A new verification code has been sent to your email.');
        const firstInput = this.otpInputs.get(0);
        if (firstInput) firstInput.nativeElement.focus();
      },
      error: (err) => {
        this.isResending = false;
        const msg = err?.error?.message || 'Failed to resend code. Please try again.';
        this.errorMessage = msg;
      },
    });
  }

  goBack(): void {
    this.twoFactorService.clearChallenge();
    this.twoFactorService.clearSession();
    this.router.navigate(['/login']);
  }
}
