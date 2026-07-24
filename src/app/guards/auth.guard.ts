import { inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { CanActivateFn, Router } from '@angular/router';
import { map, take, switchMap } from 'rxjs';
import { TwoFactorService } from '../core/services/two-factor.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  const twoFactorService = inject(TwoFactorService);

  return authState(auth).pipe(
    take(1),
    switchMap((user) => {
      if (!user) {
        router.navigate(['/login']);
        return [false];
      }

      if (twoFactorService.hasValidSession()) {
        return [true];
      }

      return twoFactorService.getStatus().pipe(
        map((status) => {
          if (!status.enabled) {
            return true;
          }

          if (twoFactorService.hasValidSession()) {
            return true;
          }

          const challengeId = twoFactorService.getChallengeId();
          if (challengeId) {
            router.navigate(['/verify-otp']);
            return false;
          }

          twoFactorService.startLoginTwoFactor().subscribe({
            next: (res) => {
              if (res.twoFactorRequired && res.challengeId) {
                twoFactorService.storeChallenge(
                  res.challengeId,
                  res.expiresInSeconds || 300,
                  res.maskedEmail || ''
                );
                router.navigate(['/verify-otp']);
              }
            },
            error: () => {
              router.navigate(['/login']);
            },
          });

          return false;
        })
      );
    })
  );
};
