import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthService } from './services/auth.service';
import { ApiService } from './services/api.service';
import { ToastComponent } from './components/toast/toast.component';
import { Observable, Subscription } from 'rxjs';
import { map, filter, startWith } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ToastComponent], 
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Enterprise AI Platform';
  
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);
  hasOrgKey: boolean = false;
  private orgKeySub: Subscription | null = null;
  showKeyDropdown: boolean = false;
  secretSummary: any[] | null = null;
  // Profile dropdown + dark mode
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

  logout() {
    this.auth.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (err) => {
        console.error('Logout failed', err);
        this.router.navigate(['/login']);
      }
    });
  }

  constructor() {
    this.orgKeySub = this.auth.orgId$.subscribe(orgId => {
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
    // Initialize dark mode from localStorage
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

  ngOnDestroy() {
    if (this.orgKeySub) this.orgKeySub.unsubscribe();
  }
}