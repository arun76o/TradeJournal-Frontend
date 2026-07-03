import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Auth, authState } from '@angular/fire/auth';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { UserProfile } from '../../models/trade.model';
import { ProfileService } from '../../services/profile.service';
import { AlertService } from '../../core/services/alert.service';
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
    PageHeaderComponent,
  ],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit {
  private auth = inject(Auth);
  private profileService = inject(ProfileService);
  private alertService = inject(AlertService);
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

  ngOnInit(): void {
    authState(this.auth).subscribe((user) => {
      if (!user) {
        return;
      }
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
      },

      error: (err) => {
        console.log('Profile not found');
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
