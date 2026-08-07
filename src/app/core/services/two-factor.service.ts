import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, from, switchMap } from 'rxjs';
import { Auth } from '@angular/fire/auth';
import { environment } from '../../../environments/environment';

export interface TwoFactorStatusResponse {
  enabled: boolean;
}

export interface StartTwoFactorResponse {
  twoFactorRequired: boolean;
  challengeId?: string;
  expiresInSeconds?: number;
  resendAvailableInSeconds?: number;
  maskedEmail?: string;
}

export interface VerifyTwoFactorResponse {
  success: boolean;
  sessionToken?: string;
  message?: string;
}

export interface ResendTwoFactorResponse {
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class TwoFactorService {
  private http = inject(HttpClient);
  private auth = inject(Auth);
  private apiUrl = `${environment.apiUrl}/twofactor`;

  private twoFaTokenKey = 'tj-2fa-token';
  private challengeKey = 'tj-2fa-challenge';
  private challengeExpiryKey = 'tj-2fa-challenge-expiry';
  private challengeMaskedEmailKey = 'tj-2fa-masked-email';
  private challengePurposeKey = 'tj-2fa-purpose';

  private _twoFaVerified$ = new BehaviorSubject<boolean>(this.hasValidSession());
  twoFaVerified$ = this._twoFaVerified$.asObservable();

  private async getAuthHeaders(): Promise<HttpHeaders> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  getStatus(): Observable<TwoFactorStatusResponse> {
    return from(this.getAuthHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<TwoFactorStatusResponse>(`${this.apiUrl}/status`, { headers })
      )
    );
  }

  startLoginTwoFactor(): Observable<StartTwoFactorResponse> {
    return from(this.getAuthHeaders()).pipe(
      switchMap((headers) =>
        this.http.post<StartTwoFactorResponse>(
          `${this.apiUrl}/start`,
          { purpose: 'login' },
          { headers }
        )
      )
    );
  }

  startEnableTwoFactor(): Observable<StartTwoFactorResponse> {
    return from(this.getAuthHeaders()).pipe(
      switchMap((headers) =>
        this.http.post<StartTwoFactorResponse>(
          `${this.apiUrl}/enable/start`,
          {},
          { headers }
        )
      )
    );
  }

  verify(challengeId: string, otp: string): Observable<VerifyTwoFactorResponse> {
    return from(this.getAuthHeaders()).pipe(
      switchMap((headers) =>
        this.http.post<VerifyTwoFactorResponse>(
          `${this.apiUrl}/verify`,
          { challengeId, otp },
          { headers }
        )
      )
    );
  }

  verifyDisable(challengeId: string, otp: string): Observable<any> {
    return from(this.getAuthHeaders()).pipe(
      switchMap((headers) =>
        this.http.post(
          `${this.apiUrl}/disable-with-verify`,
          { challengeId, otp },
          { headers }
        )
      )
    );
  }

  resend(challengeId: string): Observable<ResendTwoFactorResponse> {
    return from(this.getAuthHeaders()).pipe(
      switchMap((headers) =>
        this.http.post<ResendTwoFactorResponse>(
          `${this.apiUrl}/resend`,
          { challengeId },
          { headers }
        )
      )
    );
  }

  disable(): Observable<any> {
    return from(this.getAuthHeaders()).pipe(
      switchMap((headers) =>
        this.http.post(`${this.apiUrl}/disable`, {}, { headers })
      )
    );
  }

  // Session token management
  storeSession(token: string): void {
    sessionStorage.setItem(this.twoFaTokenKey, token);
    this._twoFaVerified$.next(true);
  }

  getSessionToken(): string | null {
    return sessionStorage.getItem(this.twoFaTokenKey);
  }

  hasValidSession(): boolean {
    return !!sessionStorage.getItem(this.twoFaTokenKey);
  }

  clearSession(): void {
    sessionStorage.removeItem(this.twoFaTokenKey);
    sessionStorage.removeItem(this.challengeKey);
    sessionStorage.removeItem(this.challengeExpiryKey);
    sessionStorage.removeItem(this.challengeMaskedEmailKey);
    sessionStorage.removeItem(this.challengePurposeKey);
    this._twoFaVerified$.next(false);
  }

  storeChallenge(challengeId: string, expiresInSeconds: number, maskedEmail: string, purpose: string = 'login'): void {
    sessionStorage.setItem(this.challengeKey, challengeId);
    sessionStorage.setItem(this.challengeExpiryKey, String(Date.now() + expiresInSeconds * 1000));
    sessionStorage.setItem(this.challengeMaskedEmailKey, maskedEmail);
    sessionStorage.setItem(this.challengePurposeKey, purpose);
  }

  getChallengeId(): string | null {
    return sessionStorage.getItem(this.challengeKey);
  }

  getChallengeExpiry(): number | null {
    const val = sessionStorage.getItem(this.challengeExpiryKey);
    return val ? parseInt(val, 10) : null;
  }

  getMaskedEmail(): string {
    return sessionStorage.getItem(this.challengeMaskedEmailKey) || '';
  }

  getChallengePurpose(): string {
    return sessionStorage.getItem(this.challengePurposeKey) || 'login';
  }

  clearChallenge(): void {
    sessionStorage.removeItem(this.challengeKey);
    sessionStorage.removeItem(this.challengeExpiryKey);
    sessionStorage.removeItem(this.challengeMaskedEmailKey);
    sessionStorage.removeItem(this.challengePurposeKey);
  }
}
