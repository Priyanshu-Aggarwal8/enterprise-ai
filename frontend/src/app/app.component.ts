import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthService } from './services/auth.service';
import { ApiService } from './services/api.service';
import { ToastComponent } from './components/toast/toast.component';
import { BrandMarkComponent } from './components/brand-mark/brand-mark.component';
import { ThemeService } from './services/theme.service';
import { BRAND_NAME } from './core/brand';
import { Observable, Subscription, lastValueFrom } from 'rxjs';
import { map, filter, startWith } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ToastComponent, BrandMarkComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = BRAND_NAME;

  private auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);
  private theme = inject(ThemeService);
  private themeSub: Subscription | null = null;
  hasOrgKey: boolean = false;
  private orgIdSub: Subscription | null = null;
  showKeyDropdown: boolean = false;
  secretSummary: any[] | null = null;
  showProfileDropdown: boolean = false;
  darkMode: boolean = false;

  isLoginPage$: Observable<boolean> = this.router.events.pipe(
    filter(event => event instanceof NavigationEnd),
    map((event: any) => event.urlAfterRedirects.includes('/login')),
    startWith(this.router.url.includes('/login'))
  );

  isOnboardingPage$: Observable<boolean> = this.router.events.pipe(
    filter(event => event instanceof NavigationEnd),
    map((event: any) => event.urlAfterRedirects.includes('/onboarding')),
    startWith(this.router.url.includes('/onboarding'))
  );

  isLandingPage$: Observable<boolean> = this.router.events.pipe(
    filter(event => event instanceof NavigationEnd),
    map((event: any) => {
      const url = event.urlAfterRedirects as string;
      return url === '/landing' || url === '/';
    }),
    startWith(this.router.url === '/landing' || this.router.url === '/')
  );

  isLoggedIn$: Observable<boolean> = this.auth.user$.pipe(
    map((user) => !!user),
    startWith(false)
  );

  async logout() {
    try {
      await lastValueFrom(this.auth.logout());
    } catch (err: any) {
      console.error('Logout failed', err);
    }
    this.router.navigate(['/login']);
  }

  constructor() {
    this.orgIdSub = this.auth.orgId$.subscribe(orgId => {
      if (orgId) {
        this.api.getSecrets(orgId).subscribe({
          next: (s: any[]) => {
            this.secretSummary = s || [];
            this.hasOrgKey = Array.isArray(s) && s.length > 0;
          },
          error: () => { this.secretSummary = null; this.hasOrgKey = false; }
        });
      } else {
        this.secretSummary = null;
        this.hasOrgKey = false;
      }
    });
  }

  ngOnInit() {
    this.darkMode = this.theme.isDark;
    this.themeSub = this.theme.mode$.subscribe(() => {
      this.darkMode = this.theme.isDark;
    });
  }

  toggleDarkMode() {
    this.theme.toggleLightDark();
  }

  openProfile() {
    this.showProfileDropdown = false;
    this.router.navigate(['/profile']);
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  ngOnDestroy() {
    if (this.orgIdSub) this.orgIdSub.unsubscribe();
    this.themeSub?.unsubscribe();
  }
}
