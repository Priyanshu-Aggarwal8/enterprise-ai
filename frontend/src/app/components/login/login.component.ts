import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { ThemeService } from '../../services/theme.service';
import { BrandMarkComponent } from '../brand-mark/brand-mark.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BrandMarkComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  isRegistering = false;
  errorMessage = '';
  isLoading = false;
  darkMode = false;

  private auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);
  private theme = inject(ThemeService);

  ngOnInit() {
    this.darkMode = this.theme.isDark;
  }

  toggleDarkMode() {
    this.theme.toggleLightDark();
    this.darkMode = this.theme.isDark;
  }

  onSubmit() {
    if (!this.email || !this.password) return;
    
    this.isLoading = true;
    this.errorMessage = '';
    
    const authAction = this.isRegistering 
      ? this.auth.register(this.email, this.password) 
      : this.auth.login(this.email, this.password);

    authAction.subscribe({
      next: () => {
        this.api.syncUser().subscribe({
          next: (res: any) => {
            if (res.org_id) {
              // User has an organization, set it and go to workspace
              this.auth.setOrgId(res.org_id);
              this.router.navigate(['/workspace']);
            } else {
              // User has no organization, redirect to onboarding
              this.router.navigate(['/onboarding']);
            }
            this.isLoading = false;
          },
          error: (err) => {
            console.error(err);
            this.errorMessage = 'Database sync failed. Check backend console.';
            this.isLoading = false;
          }
        });
      },
      error: (err) => {
        if (err.code === 'auth/invalid-credential') {
          this.errorMessage = 'Invalid email or password.';
        } else if (err.code === 'auth/email-already-in-use') {
          this.errorMessage = 'An account with this email already exists.';
        } else {
          this.errorMessage = err.message;
        }
        this.isLoading = false;
      }
    });
  }

  toggleMode() {
    this.isRegistering = !this.isRegistering;
    this.errorMessage = '';
  }
}