import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthService } from './services/auth.service';
import { ApiService } from './services/api.service';
import { ToastComponent } from './components/toast/toast.component';
import { Observable, Subscription, lastValueFrom } from 'rxjs';
import { map, filter, startWith } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ToastComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Enterprise AI Platform';

  private auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);
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
    try {
      const saved = localStorage.getItem('darkMode');
      this.darkMode = saved === 'true';
      if (this.darkMode) document.documentElement.classList.add('dark');
    } catch (e) {}
  }

  toggleDarkMode() {
    this.darkMode = !this.darkMode;
    try {
      if (this.darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('darkMode', String(this.darkMode));
    } catch (e) {}
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
  }
}
