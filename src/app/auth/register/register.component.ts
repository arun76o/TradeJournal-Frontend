// register.component.ts
import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth, createUserWithEmailAndPassword, updateProfile } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  hidePassword = true;
  hideConfirmPassword = true;
  isLoading = false;

  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  registerForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(4), Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/)]],
    confirmPassword: ['', Validators.required]
  }, {
    validator: this.passwordMatchValidator
  });

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      return { passwordMismatch: true };
    }
    return null;
  }

  getPasswordStrength(): string {
    const password = this.registerForm.get('password')?.value;
    if (!password) return 'weak';
    
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Za-z]/.test(password) && /\d/.test(password)) strength++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;
    
    if (strength <= 1) return 'weak';
    if (strength === 2) return 'medium';
    return 'strong';
  }

  getPasswordStrengthText(): string {
    const strength = this.getPasswordStrength();
    if (strength === 'weak') return 'Weak - Add more characters';
    if (strength === 'medium') return 'Medium - Getting better!';
    return 'Strong - Excellent password!';
  }

  async register() {
    if (this.registerForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.registerForm.controls).forEach(key => {
        const control = this.registerForm.get(key);
        control?.markAsTouched();
      });
      
      this.snackBar.open('Please fix the errors in the form', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    const { name, email, password } = this.registerForm.value;

    if (!email || !password || !name) {
      this.snackBar.open('All fields are required', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    this.isLoading = true;

    try {
      const userCredential = await createUserWithEmailAndPassword(
        this.auth,
        email,
        password
      );

      // Update the user's profile with the display name
      await updateProfile(userCredential.user, {
        displayName: name
      });

      this.snackBar.open('Registration Successful! Welcome aboard! 🎉', 'Close', {
        duration: 4000,
        panelClass: ['success-snackbar']
      });

      // Navigate to login page after successful registration
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 1500);
      
    } catch (error: any) {
      console.error('Registration error:', error);
      
      let errorMessage = 'Registration failed. Please try again.';
      
      // Handle specific Firebase auth errors
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Email is already registered. Please use a different email or login.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email format. Please enter a valid email address.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak. Please use a stronger password.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Email/Password registration is not enabled. Please contact support.';
          break;
        default:
          errorMessage = error.message || 'Registration failed. Please try again.';
      }
      
      this.snackBar.open(errorMessage, 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar']
      });
    } finally {
      this.isLoading = false;
    }
  }
}