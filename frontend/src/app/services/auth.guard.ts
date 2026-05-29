import { Injectable, inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { map, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

/**
 * Guards routes to ensure user is authenticated
 */
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const api = inject(ApiService);

  return auth.user$.pipe(
    switchMap((user) => {
      if (!user) {
        router.navigate(['/login']);
        return of(false);
      }

      // User is authenticated, check if they have an organization
      // Try to sync user data which includes org_id
      return api.syncUser().pipe(
        map((res: any) => {
          if (res.org_id) {
            auth.setOrgId(res.org_id);
            return true;
          }
          // User has no organization, allow access (they'll be redirected to onboarding)
          return true;
        }),
        catchError((err) => {
          console.error('Failed to sync user', err);
          // Even if sync fails, user is still authenticated
          return of(true);
        })
      );
    }),
    catchError((err) => {
      console.error('Auth check failed', err);
      router.navigate(['/login']);
      return of(false);
    })
  );
};

/**
 * Guards routes to ensure user is NOT authenticated (for login page)
 */
export const noAuthGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.user$.pipe(
    map((user) => {
      if (user) {
        // User is authenticated, redirect to workspace
        router.navigate(['/workspace']);
        return false;
      }
      return true;
    })
  );
};
