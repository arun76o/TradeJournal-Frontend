import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Auth, authState } from '@angular/fire/auth';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { UserProfile } from '../../models/trade.model';
import { ProfileService } from '../../services/profile.service';
import { AlertService } from '../../core/services/alert.service';
import { TwoFactorService } from '../../core/services/two-factor.service';
import { Router } from '@angular/router';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from '@angular/fire/auth';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  private auth = inject(Auth);
  private profileService = inject(ProfileService);
  private alertService = inject(AlertService);
  private twoFactorService = inject(TwoFactorService);
  private router = inject(Router);
  private http = inject(HttpClient);
  //  private profileService = inject(ProfileService);

  @ViewChild('fileInput')
fileInput!: ElementRef<HTMLInputElement>;

openFilePicker() {
  this.fileInput.nativeElement.click();
}

  userName = '';
  userEmail = '';
  userInitials = 'T';
  tradingGoal = '';
  maxDailyLoss = 0;
  maxRiskPerTrade = 0;
  preferredMarkets = '';
  profileImageUrl: string = '';

  selectedFile!: File;

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  hideCurrentPassword = true;
  hideNewPassword = true;
  hideConfirmPassword = true;

  twoFactorEnabled = false;
  twoFactorLoading = false;
  private currentUserUid = '';

  ngOnInit(): void {
    authState(this.auth).subscribe((user) => {
      if (!user) {
        return;
      }
      this.currentUserUid = user.uid;
      this.userName = user.displayName || user.email?.split('@')[0] || 'Trader';
      this.userEmail = user.email || '';
      this.userInitials = this.userName.slice(0, 2).toUpperCase();
      this.loadProfile(user.uid);
    });
  }

  async changePassword() {
    const user = this.auth.currentUser;

    if (!user || !user.email) {
      this.alertService.error('Error', 'User not found.');
      return;
    }

    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.alertService.warning(
        'Missing Fields',
        'Please fill all password fields.',
      );

      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.alertService.error(
        'Password Mismatch',
        'New password and confirm password do not match.',
      );

      return;
    }

    if (this.newPassword.length < 6) {
      this.alertService.warning(
        'Weak Password',
        'Password must contain at least 6 characters.',
      );

      return;
    }

    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        this.currentPassword,
      );

      await reauthenticateWithCredential(user, credential);

      await updatePassword(user, this.newPassword);

      this.alertService.success('Success', 'Password changed successfully.');

      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
    } catch (error: any) {
      console.error(error);
      this.alertService.error('Error', error.message);
    }
  }

  onProfileImageSelected(event: any) {
    if (!event.target.files.length) {
      return;
    }

    this.selectedFile = event.target.files[0];

    this.uploadProfileImage();
  }

  // uploadProfileImage(): Promise<string> {
  //   return new Promise((resolve, reject) => {
  //     if (!this.selectedFile) {
  //       resolve(this.profileImageUrl);
  //       return;
  //     }

  //     const formData = new FormData();

  //     formData.append('file', this.selectedFile);
  //     formData.append('upload_preset', 'trade-journal');

  //     this.http
  //       .post<any>(
  //         'https://api.cloudinary.com/v1_1/dytjlbf1c/image/upload',
  //         formData,
  //       )
  //       .subscribe({
  //         next: (res) => resolve(res.secure_url),
  //         error: (err) => reject(err),
  //       });
  //   });
  // }

  uploadProfileImage() {
    const formData = new FormData();

    formData.append('file', this.selectedFile);

    formData.append('upload_preset', 'trade-journal');

    this.http
      .post<any>(
        'https://api.cloudinary.com/v1_1/dytjlbf1c/image/upload',
        formData,
      )
      .subscribe({
        next: (res) => {
          this.profileImageUrl = res.secure_url;

          this.saveProfile();
        },

        error: (err) => {
          console.error(err);
        },
      });
  }

  loadProfile(userId: string): void {
    this.profileService.getProfile(userId).subscribe({
      next: (profile) => {
        this.userName = profile.displayName;
        this.userEmail = profile.email;

        this.tradingGoal = profile.tradingGoal;
        this.preferredMarkets = profile.preferredMarkets;

        this.maxDailyLoss = profile.maxDailyLoss;
        this.maxRiskPerTrade = profile.maxRiskPerTrade;
        this.profileImageUrl = profile.profileImageUrl ? profile.profileImageUrl : '';
        this.twoFactorEnabled = profile.twoFactorEnabled ?? false;
      },

      error: (err) => {
        console.log('Profile not found');
      },
    });
  }

  toggleTwoFactor(): void {
    if (this.twoFactorLoading) return;

    if (this.twoFactorEnabled) {
      this.alertService.confirm(
        'Disable Two-Factor Authentication?',
        'Your account will no longer require an email verification code during login.'
      ).then((result) => {
        if (result.isConfirmed) {
          this.disableTwoFactor();
        } else {
          this.twoFactorEnabled = true;
        }
      });
    } else {
      this.alertService.confirm(
        'Enable Two-Factor Authentication?',
        "When enabled, we'll send a verification code to your registered email each time additional login verification is required."
      ).then((result) => {
        if (result.isConfirmed) {
          this.enableTwoFactor();
        } else {
          this.twoFactorEnabled = false;
        }
      });
    }
  }

  private enableTwoFactor(): void {
    this.twoFactorLoading = true;

    this.twoFactorService.startEnableTwoFactor().subscribe({
      next: (res) => {
        if (res.challengeId) {
          this.twoFactorService.storeChallenge(
            res.challengeId,
            res.expiresInSeconds || 300,
            res.maskedEmail || '',
            'enable-2fa'
          );
          this.twoFactorLoading = false;
          this.router.navigate(['/verify-otp']);
        }
      },
      error: (err) => {
        this.twoFactorLoading = false;
        this.twoFactorEnabled = false;
        const msg = err?.error?.message || 'Failed to start 2FA setup. Please try again.';
        this.alertService.error('Error', msg);
      },
    });
  }

  private disableTwoFactor(): void {
    this.twoFactorLoading = true;

    this.twoFactorService.disable().subscribe({
      next: () => {
        this.twoFactorEnabled = false;
        this.twoFactorLoading = false;
        this.twoFactorService.clearSession();
        this.alertService.success('Disabled', 'Two-factor authentication has been disabled.');
      },
      error: (err) => {
        this.twoFactorLoading = false;
        this.twoFactorEnabled = true;
        const msg = err?.error?.message || 'Failed to disable 2FA. Please try again.';
        this.alertService.error('Error', msg);
      },
    });
  }

  saveProfile(): void {
    authState(this.auth).subscribe((user) => {
      if (!user) {
        this.alertService.error('Not Logged In', 'Please login again.');
        return;
      }

      const profile: UserProfile = {
        id: user.uid,
        displayName: this.userName,
        email: this.userEmail,
        tradingGoal: this.tradingGoal,
        preferredMarkets: this.preferredMarkets,
        maxDailyLoss: this.maxDailyLoss,
        maxRiskPerTrade: this.maxRiskPerTrade,
        profileImageUrl: this.profileImageUrl,
      };

      this.profileService.saveProfile(profile).subscribe({
        next: () => {
          this.alertService.success(
            'Profile Saved',
            'Your profile has been updated successfully.',
          );
        },

        error: (err) => {
          console.error(err);

          this.alertService.error('Save Failed', 'Unable to save profile.');
        },
      });
    });
  }
}
