import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent {
  readonly features = [
    { title: 'Secure Key Storage', desc: 'Encrypted BYOK storage with preview-only access.', icon: '🔐' },
    { title: 'Custom Tools', desc: 'Define Python tools and bind them per agent.', icon: '🛠️' },
    { title: 'Document Ingestion', desc: 'Upload PDFs and make them searchable by agents.', icon: '📄' },
    { title: 'Agent Sessions', desc: 'Persistent, per-agent session context for continuity.', icon: '💬' }
  ];

  constructor(private router: Router) {}

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
