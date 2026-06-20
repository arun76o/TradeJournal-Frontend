// login.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { AlertService } from '../../core/services/alert.service';

@Component({
  selector: 'app-login',
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
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private alertService = inject(AlertService);

  email = '';
  password = '';
  hidePassword = true;
  isLoading = false;

  async login() {
    if (!this.email || !this.password) {
      this.alertService.warning(
        'Incomplete Form',
        'Please enter both email and password',
      );
      return;
    }

    this.isLoading = true;

    try {
      const result = await this.authService.login(this.email, this.password);
      this.alertService.success('Login Success!');

      await this.router.navigate(['/dashboard']);
    } catch (error) {
      console.error(error);
      this.alertService.error(
        'Login Failed',
        'Invalid email or password. Please try again.',
      );
    } finally {
      this.isLoading = false;
    }
  }

  registerPage() {
    this.router.navigate(['/register']);
  }

  async loginWithGoogle() {
    this.isLoading = true;

    try {
      const result = await this.authService.googleLogin();
      console.log(result.user);
      this.alertService.success('Google Login Success!');
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      console.error(error);
       this.alertService.error(
        'Login Failed',
        'Google login failed. Please try again.',
      );
    } finally {
      this.isLoading = false;
    }
  }
}
