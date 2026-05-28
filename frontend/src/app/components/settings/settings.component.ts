import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Organization } from '../../services/api.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html'
})
export class SettingsComponent implements OnInit {
  organizations: Organization[] = [];
  
  newOrgName: string = '';
  isCreatingOrg: boolean = false;

  selectedOrgId: string = '';
  provider: string = 'google';
  rawApiKey: string = '';
  isAddingKey: boolean = false;
  keySuccessMessage: string = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadOrganizations();
  }

  loadOrganizations() {
    this.api.getOrganizations().subscribe({
      next: (data) => {
        this.organizations = data;
        if (data.length > 0 && !this.selectedOrgId) {
          this.selectedOrgId = data[0].id; 
        }
      },
      error: (err) => console.error('Failed to load orgs', err)
    });
  }

  createOrganization() {
    if (!this.newOrgName.trim()) return;
    this.isCreatingOrg = true;
    
    this.api.createOrganization(this.newOrgName).subscribe({
      next: (org) => {
        this.newOrgName = '';
        this.isCreatingOrg = false;
        this.loadOrganizations(); 
      },
      error: (err) => {
        console.error(err);
        this.isCreatingOrg = false;
      }
    });
  }

  addApiKey() {
    if (!this.selectedOrgId || !this.rawApiKey.trim()) return;
    this.isAddingKey = true;
    this.keySuccessMessage = '';

    this.api.addSecret(this.selectedOrgId, this.provider, this.rawApiKey).subscribe({
      next: (res) => {
        this.rawApiKey = '';
        this.isAddingKey = false;
        this.keySuccessMessage = `Success! Key securely encrypted and stored. Preview: ${res.key_preview}`;
      },
      error: (err) => {
        console.error(err);
        this.isAddingKey = false;
        this.keySuccessMessage = 'Error: Could not save API key.';
      }
    });
  }
}