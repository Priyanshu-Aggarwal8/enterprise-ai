import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, Organization, Secret } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { ThemeMode, ThemeService } from '../../services/theme.service';
import { Subscription } from 'rxjs';
import { BRAND_NAME } from '../../core/brand';

interface ThemeOption {
  id: ThemeMode;
  label: string;
  description: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit, OnDestroy {
  readonly brandName = BRAND_NAME;
  readonly themeOptions: ThemeOption[] = [
    { id: 'light', label: 'Light', description: 'Bright backgrounds with dark text' },
    { id: 'dark', label: 'Dark', description: 'Dimmed surfaces for low-light use' },
    { id: 'system', label: 'System', description: 'Match your device appearance' }
  ];

  isOnboarding = false;
  organizations: Organization[] = [];
  userEmail = '';

  newOrgName = '';
  isCreatingOrg = false;

  joinOrgId = '';
  isJoiningOrg = false;
  joinErrorMessage = '';

  selectedOrgId = '';
  provider = 'google';
  rawApiKey = '';
  isAddingKey = false;
  keySuccessMessage = '';
  currentSecrets: Secret[] = [];
  isEditingSecret = false;
  editingSecretId: string | null = null;
  deletingSecretId: string | null = null;

  themeMode: ThemeMode = 'system';
  compactSidebar = false;
  streamResponses = true;

  private orgIdSub: Subscription | null = null;
  private userSub: Subscription | null = null;
  private themeSub: Subscription | null = null;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private theme = inject(ThemeService);

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.isOnboarding = this.route.snapshot.data['isOnboarding'] || false;
    this.themeMode = this.theme.mode;
    this.loadPreferenceToggles();
    this.loadOrganizations();

    this.themeSub = this.theme.mode$.subscribe(mode => {
      this.themeMode = mode;
    });

    this.userSub = this.auth.user$.subscribe(user => {
      this.userEmail = user?.email ?? '';
    });

    this.orgIdSub = this.auth.orgId$.subscribe(orgId => {
      if (orgId && !this.selectedOrgId) {
        this.selectedOrgId = orgId;
        this.onOrgChange();
      }
    });
  }

  ngOnDestroy(): void {
    this.orgIdSub?.unsubscribe();
    this.userSub?.unsubscribe();
    this.themeSub?.unsubscribe();
  }

  get hasOrganization(): boolean {
    return !!this.selectedOrgId && this.selectedOrgId.length > 0;
  }

  get selectedOrganizationName(): string {
    return this.organizations.find(o => o.id === this.selectedOrgId)?.name ?? 'Organization';
  }

  setTheme(mode: ThemeMode) {
    this.theme.setMode(mode);
    this.toast.push(`Theme set to ${mode}`, 'info');
  }

  onCompactSidebarChange() {
    try {
      localStorage.setItem('compactSidebar', String(this.compactSidebar));
    } catch {
      // ignore
    }
    this.toast.push(
      this.compactSidebar ? 'Compact sidebar preference saved' : 'Standard sidebar preference saved',
      'info'
    );
  }

  onStreamResponsesChange() {
    try {
      localStorage.setItem('streamResponses', String(this.streamResponses));
    } catch {
      // ignore
    }
  }

  copyOrgId() {
    if (!this.selectedOrgId) {
      return;
    }
    navigator.clipboard.writeText(this.selectedOrgId).then(() => {
      this.toast.push('Organization ID copied', 'success');
    }).catch(() => {
      this.toast.push('Could not copy organization ID', 'error');
    });
  }

  logout() {
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.toast.push('Logout failed', 'error')
    });
  }

  loadOrganizations() {
    this.api.getOrganizations().subscribe({
      next: (data) => {
        this.organizations = data;
        const currentOrgId = this.auth.getOrgId();
        if (currentOrgId && data.find(o => o.id === currentOrgId)) {
          this.selectedOrgId = currentOrgId;
        } else if (data.length > 0 && !this.selectedOrgId) {
          this.selectedOrgId = data[0].id;
        }
        if (this.selectedOrgId) {
          this.onOrgChange();
        } else if (!this.isOnboarding) {
          this.router.navigate(['/onboarding']);
        }
      },
      error: (err) => {
        console.error('Failed to load orgs', err);
        if (!this.isOnboarding) {
          this.router.navigate(['/onboarding']);
        }
      }
    });
  }

  onOrgChange() {
    if (!this.selectedOrgId) {
      return;
    }

    this.auth.setOrgId(this.selectedOrgId);

    this.api.getSecrets(this.selectedOrgId).subscribe({
      next: (secrets) => this.currentSecrets = secrets,
      error: (err) => console.error('Failed to load secrets', err)
    });
  }

  createOrganization() {
    if (!this.newOrgName.trim()) {
      return;
    }
    this.isCreatingOrg = true;
    this.api.createOrganization(this.newOrgName).subscribe({
      next: (org) => {
        this.newOrgName = '';
        this.isCreatingOrg = false;
        this.selectedOrgId = org.id;
        this.auth.setOrgId(org.id);
        this.loadOrganizations();
        this.toast.push('Organization created', 'success');
        if (this.isOnboarding) {
          setTimeout(() => {
            document.querySelector('.api-key-section')?.scrollIntoView({ behavior: 'smooth' });
          }, 300);
        }
      },
      error: (err) => {
        console.error(err);
        this.isCreatingOrg = false;
        this.toast.push('Could not create organization', 'error');
      }
    });
  }

  joinOrganization() {
    if (!this.joinOrgId.trim()) {
      return;
    }
    this.isJoiningOrg = true;
    this.joinErrorMessage = '';

    this.api.joinOrganization(this.joinOrgId).subscribe({
      next: () => {
        const orgId = this.joinOrgId;
        this.joinOrgId = '';
        this.isJoiningOrg = false;
        this.selectedOrgId = orgId;
        this.auth.setOrgId(orgId);
        this.loadOrganizations();
        if (this.isOnboarding) {
          setTimeout(() => {
            document.querySelector('.api-key-section')?.scrollIntoView({ behavior: 'smooth' });
          }, 300);
        }
      },
      error: (err) => {
        console.error(err);
        this.isJoiningOrg = false;
        this.joinErrorMessage = 'Failed to join organization. Please check the ID.';
      }
    });
  }

  startAddSecret() {
    this.isEditingSecret = false;
    this.editingSecretId = null;
    this.rawApiKey = '';
    this.keySuccessMessage = '';
  }

  editSecret(secret: Secret) {
    this.isEditingSecret = true;
    this.editingSecretId = secret.id;
    this.provider = secret.provider;
    this.rawApiKey = '';
    this.keySuccessMessage = '';
  }

  saveSecret() {
    if (!this.selectedOrgId || !this.rawApiKey.trim()) {
      return;
    }
    this.isAddingKey = true;
    this.keySuccessMessage = '';

    if (this.isEditingSecret && this.editingSecretId) {
      this.api.updateSecret(this.selectedOrgId, this.editingSecretId, this.provider, this.rawApiKey).subscribe({
        next: (res) => {
          this.rawApiKey = '';
          this.isAddingKey = false;
          this.keySuccessMessage = `✅ Key updated. Preview: ${res.key_preview}`;
          this.onOrgChange();
          this.isEditingSecret = false;
          this.editingSecretId = null;
          this.toast.push('API key updated', 'success');
        },
        error: (err) => {
          console.error(err);
          this.isAddingKey = false;
          this.keySuccessMessage = 'Error: Could not update API key.';
          this.toast.push('Error updating API key', 'error');
        }
      });
    } else {
      this.api.addSecret(this.selectedOrgId, this.provider, this.rawApiKey).subscribe({
        next: (res) => {
          this.rawApiKey = '';
          this.isAddingKey = false;
          this.keySuccessMessage = `✅ Key securely encrypted and stored. Preview: ${res.key_preview}`;
          this.onOrgChange();
          this.toast.push('API key saved', 'success');

          if (this.isOnboarding) {
            setTimeout(() => {
              this.router.navigate(['/workspace']);
            }, 2000);
          }
        },
        error: (err) => {
          console.error(err);
          this.isAddingKey = false;
          this.keySuccessMessage = 'Error: Could not save API key.';
          this.toast.push('Error saving API key', 'error');
        }
      });
    }
  }

  addApiKey() {
    this.saveSecret();
  }

  deleteSecret(secretId: string) {
    this.deletingSecretId = secretId;
  }

  confirmDeleteSecret() {
    if (!this.selectedOrgId || !this.deletingSecretId) {
      return;
    }
    this.api.deleteSecret(this.selectedOrgId, this.deletingSecretId).subscribe({
      next: () => {
        this.keySuccessMessage = '✅ API Key deleted successfully.';
        this.deletingSecretId = null;
        this.onOrgChange();
        this.toast.push('API key deleted', 'success');
      },
      error: (err) => {
        console.error(err);
        this.keySuccessMessage = 'Error: Could not delete API key.';
        this.deletingSecretId = null;
        this.toast.push('Error deleting API key', 'error');
      }
    });
  }

  cancelDeleteSecret() {
    this.deletingSecretId = null;
  }

  private loadPreferenceToggles() {
    try {
      this.compactSidebar = localStorage.getItem('compactSidebar') === 'true';
      const stream = localStorage.getItem('streamResponses');
      this.streamResponses = stream !== 'false';
    } catch {
      this.compactSidebar = false;
      this.streamResponses = true;
    }
  }
}
