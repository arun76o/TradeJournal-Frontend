import { inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { HttpErrorResponse } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { map, take, switchMap, catchError, of } from 'rxjs';
import { TwoFactorService } from '../core/services/two-factor.service';
import { AlertService } from '../core/services/alert.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  const twoFactorService = inject(TwoFactorService);
  const alertService = inject(AlertService);

  const blockToLogin = (message: string, error?: unknown) => {
    console.error(`[authGuard] ${message}`, error ?? '');
    alertService.error('Sign-in Could Not Be Verified', message);
    router.navigate(['/login']);
    return of(false);
  };

  return authState(auth).pipe(
    take(1),
    switchMap((user) => {
      if (!user) {
        router.navigate(['/login']);
        return of(false);
      }

      if (twoFactorService.hasValidSession()) {
        return of(true);
      }

      return twoFactorService.getStatus().pipe(
        switchMap((status) => {
          if (!status.enabled || twoFactorService.hasValidSession()) {
            return of(true);
          }

          const challengeId = twoFactorService.getChallengeId();
          if (challengeId) {
            router.navigate(['/verify-otp']);
            return of(false);
          }

          return twoFactorService.startLoginTwoFactor().pipe(
            map((res) => {
              if (res.twoFactorRequired && res.challengeId) {
                twoFactorService.storeChallenge(
                  res.challengeId,
                  res.expiresInSeconds || 300,
                  res.maskedEmail || ''
                );
                router.navigate(['/verify-otp']);
                return false;
              }

              return true;
            })
          );
        }),
        catchError((error) => {
          const status = error instanceof HttpErrorResponse ? error.status : 0;

          if (status === 401 || status === 403) {
            return blockToLogin(
              'The server rejected your session. Please sign in again.',
              error
            );
          }

          return blockToLogin(
            'Could not reach the server to verify your sign-in. Please try again.',
            error
          );
        })
      );
    }),
    catchError((error) => {
      console.error('[authGuard] Authentication state could not be read.', error);
      router.navigate(['/login']);
      return of(false);
    })
  );
};
