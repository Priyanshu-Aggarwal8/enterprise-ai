import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  email: string | null = null;
  orgId: string | null = null;
  orgName: string | null = null;

  constructor(private api: ApiService, private auth: AuthService) {}

  ngOnInit(): void {
    // Refresh user sync to get org assignment
    this.api.syncUser().subscribe({
      next: (res) => {
        if (res && res.org_id) {
          this.auth.setOrgId(res.org_id);
          this.orgId = res.org_id;
        }
      },
      error: () => {}
    });

    this.auth.user$.subscribe(u => {
      this.email = u?.email || null;
    });

    // load org list and find name
    this.api.getOrganizations().subscribe({
      next: (orgs) => {
        const current = this.auth.getOrgId();
        if (current) {
          const found = orgs.find((o: any) => o.id === current);
          if (found) this.orgName = found.name;
          this.orgId = current;
        }
      }
    });
  }

  copyOrgId() {
    if (this.orgId) navigator.clipboard.writeText(this.orgId);
  }
}
