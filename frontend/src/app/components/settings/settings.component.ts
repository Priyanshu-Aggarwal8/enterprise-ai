import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, Organization, CustomTool, Secret } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit, OnDestroy {
  isOnboarding: boolean = false;
  organizations: Organization[] = [];
  
  newOrgName: string = '';
  isCreatingOrg: boolean = false;

  joinOrgId: string = '';
  isJoiningOrg: boolean = false;
  joinErrorMessage: string = '';

  selectedOrgId: string = '';
  provider: string = 'google';
  rawApiKey: string = '';
  isAddingKey: boolean = false;
  keySuccessMessage: string = '';
  currentSecrets: Secret[] = []; // To store fetched secrets
  isEditingSecret: boolean = false;
  editingSecretId: string | null = null;
  deletingSecretId: string | null = null;

  customTools: CustomTool[] = [];
  toolName: string = '';
  toolDescription: string = '';
  toolCode: string = 'def run(input_string: str) -> str:\n    """Your custom logic here"""\n    return f"Processed: {input_string}"';
  isSavingTool: boolean = false;
  toolSuccessMessage: string = '';
  isEditingTool: boolean = false;
  editingToolId: string | null = null;
  deletingToolId: string | null = null;

  private orgIdSub: Subscription | null = null;
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService
  ) {}


  ngOnInit(): void {
    // Check if this is onboarding mode
    this.isOnboarding = this.route.snapshot.data['isOnboarding'] || false;
    
    this.loadOrganizations();
    
    // Subscribe to org_id changes and update selectedOrgId
    this.orgIdSub = this.auth.orgId$.subscribe({
      next: (orgId) => {
        if (orgId && !this.selectedOrgId) {
          this.selectedOrgId = orgId;
          this.onOrgChange();
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.orgIdSub) {
      this.orgIdSub.unsubscribe();
    }
  }

  loadOrganizations() {
    this.api.getOrganizations().subscribe({
      next: (data) => {
        this.organizations = data;
        // If user has an org_id from auth, use it; otherwise use first org
        const currentOrgId = this.auth.getOrgId();
        if (currentOrgId && data.find(o => o.id === currentOrgId)) {
          this.selectedOrgId = currentOrgId;
        } else if (data.length > 0 && !this.selectedOrgId) {
          this.selectedOrgId = data[0].id;
        }
        if (this.selectedOrgId) {
          this.onOrgChange();
        } else if (!this.isOnboarding) {
          // If not onboarding and no org selected, redirect to onboarding
          this.router.navigate(['/onboarding']);
        }
      },
      error: (err) => {
        console.error('Failed to load orgs', err);
        // If not onboarding and failed to load orgs, redirect to onboarding
        if (!this.isOnboarding) {
          this.router.navigate(['/onboarding']);
        }
      }
    });
  }

  onOrgChange() {
    if (!this.selectedOrgId) return;
    
    // Update auth service with selected org_id
    this.auth.setOrgId(this.selectedOrgId);
    
    // Load secrets
    this.api.getSecrets(this.selectedOrgId).subscribe({
      next: (secrets) => this.currentSecrets = secrets,
      error: (err) => console.error('Failed to load secrets', err)
    });

    // Only load tools if not in onboarding mode
    if (!this.isOnboarding) {
      this.api.getCustomTools(this.selectedOrgId).subscribe({
        next: (tools) => this.customTools = tools,
        error: (err) => console.error('Failed to load tools', err)
      });
    }
  }

  createOrganization() {
    if (!this.newOrgName.trim()) return;
    this.isCreatingOrg = true;
    this.api.createOrganization(this.newOrgName).subscribe({
      next: (org) => {
        this.newOrgName = '';
        this.isCreatingOrg = false;
        this.selectedOrgId = org.id;
        this.auth.setOrgId(org.id);
        this.loadOrganizations();
        this.toast.push('Organization created', 'success');
        // In onboarding mode, show API key prompt
        if (this.isOnboarding) {
          setTimeout(() => {
            document.querySelector('.api-key-section')?.scrollIntoView({ behavior: 'smooth' });
          }, 300);
        }
      },
      error: (err) => { console.error(err); this.isCreatingOrg = false; this.toast.push('Could not create organization', 'error'); }
    });
  }

  joinOrganization() {
    if (!this.joinOrgId.trim()) return;
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
        // In onboarding mode, show API key prompt
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

  // API Key Management
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
    this.rawApiKey = ''; // Never populate raw key
    this.keySuccessMessage = '';
  }

  saveSecret() {
    if (!this.selectedOrgId || !this.rawApiKey.trim()) return;
    this.isAddingKey = true;
    this.keySuccessMessage = '';

    if (this.isEditingSecret && this.editingSecretId) {
      this.api.updateSecret(this.selectedOrgId, this.editingSecretId, this.provider, this.rawApiKey).subscribe({
        next: (res) => {
          this.rawApiKey = '';
          this.isAddingKey = false;
          this.keySuccessMessage = `✅ Key updated. Preview: ${res.key_preview}`;
          this.onOrgChange(); // Reload secrets
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
          this.onOrgChange(); // Reload secrets
          this.toast.push('API key saved', 'success');
          
          // If onboarding, redirect to workspace after a delay
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

  // Backwards-compatible wrapper for template
  addApiKey() {
    this.saveSecret();
  }

  deleteSecret(secretId: string) {
    // show confirmation first
    this.deletingSecretId = secretId;
  }

  confirmDeleteSecret() {
    if (!this.selectedOrgId || !this.deletingSecretId) return;
    this.api.deleteSecret(this.selectedOrgId, this.deletingSecretId).subscribe({
      next: () => {
        this.keySuccessMessage = '✅ API Key deleted successfully.';
        this.deletingSecretId = null;
        this.onOrgChange(); // Reload secrets
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

  // Custom Tool Management
  startAddTool() {
    this.isEditingTool = false;
    this.editingToolId = null;
    this.toolName = '';
    this.toolDescription = '';
    this.toolCode = 'def run(input_string: str) -> str:\n    """Your custom logic here"""\n    return f"Processed: {input_string}"';
    this.toolSuccessMessage = '';
  }

  editTool(tool: CustomTool) {
    this.isEditingTool = true;
    this.editingToolId = tool.id;
    this.toolName = tool.name;
    this.toolDescription = tool.description;
    this.toolCode = tool.python_code;
    this.toolSuccessMessage = '';
  }

  saveCustomTool() {
    if (!this.selectedOrgId || !this.toolName.trim() || !this.toolCode.trim()) return;
    this.isSavingTool = true;
    this.toolSuccessMessage = '';

    if (this.isEditingTool && this.editingToolId) {
      this.api.updateCustomTool(this.editingToolId, this.toolName, this.toolDescription, this.toolCode).subscribe({
        next: (tool) => {
          this.isSavingTool = false;
          this.toolSuccessMessage = `✅ Tool '${tool.name}' updated successfully!`;
          this.toolName = '';
          this.toolDescription = '';
          this.toolCode = 'def run(input_string: str) -> str:\n    return f"Processed: {input_string}"';
          this.onOrgChange(); // Reload tools
          this.isEditingTool = false;
          this.editingToolId = null;
          this.toast.push(`Tool '${tool.name}' updated`, 'success');
        },
        error: (err) => {
          console.error(err);
          this.isSavingTool = false;
          this.toolSuccessMessage = 'Error updating tool.';
          this.toast.push('Error updating tool', 'error');
        }
      });
    } else {
      this.api.createCustomTool(this.selectedOrgId, this.toolName, this.toolDescription, this.toolCode).subscribe({
        next: (tool) => {
          this.isSavingTool = false;
          this.toolSuccessMessage = `✅ Tool '${tool.name}' saved successfully!`;
          this.toolName = '';
          this.toolDescription = '';
          this.toolCode = 'def run(input_string: str) -> str:\n    return f"Processed: {input_string}"';
          this.onOrgChange(); // Reload tools
          this.toast.push(`Tool '${tool.name}' created`, 'success');
        },
        error: (err) => {
          console.error(err);
          this.isSavingTool = false;
          this.toolSuccessMessage = 'Error saving tool.';
          this.toast.push('Error saving tool', 'error');
        }
      });
    }
  }

  deleteCustomTool(toolId: string) {
    // show confirmation modal
    this.deletingToolId = toolId;
  }

  confirmDeleteTool() {
    if (!this.deletingToolId) return;
    this.api.deleteCustomTool(this.deletingToolId).subscribe({
      next: () => {
        this.toolSuccessMessage = '✅ Custom Tool deleted successfully.';
        this.deletingToolId = null;
        this.onOrgChange(); // Reload tools
        this.toast.push('Tool deleted', 'success');
      },
      error: (err) => {
        console.error(err);
        this.toolSuccessMessage = 'Error: Could not delete custom tool.';
        this.deletingToolId = null;
        this.toast.push('Error deleting tool', 'error');
      }
    });
  }

  cancelDeleteTool() {
    this.deletingToolId = null;
  }

  completeOnboarding() {
    if (this.selectedOrgId) {
      this.router.navigate(['/workspace']);
    }
  }

  get hasOrganization(): boolean {
    return !!this.selectedOrgId && this.selectedOrgId.length > 0;
  }
}