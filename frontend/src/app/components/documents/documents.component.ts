import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.scss'
})
export class DocumentsComponent implements OnInit {
  documents: any[] = [];
  loading: boolean = false;
  deletingFilename: string | null = null;

  constructor(private api: ApiService, private auth: AuthService) {}

  ngOnInit(): void {
    this.loadDocs();
  }

  loadDocs() {
    const orgId = this.auth.getOrgId();
    if (!orgId) return;
    this.loading = true;
    this.api.getDocuments(orgId).subscribe({
      next: (docs) => { this.documents = docs; this.loading = false; },
      error: (err) => { console.error(err); this.loading = false; }
    });
  }

  onFileSelected(event: any) {
    const file: File = event.target.files && event.target.files[0];
    if (!file) return;
    const orgId = this.auth.getOrgId();
    if (!orgId) return;
    // delete existing chunks for same filename then upload
    this.api.deleteDocument(orgId, file.name).subscribe({
      next: () => {
        this.api.uploadDocument(orgId, file).subscribe({ next: () => this.loadDocs(), error: (e) => console.error(e) });
      },
      error: (e) => {
        // if delete fails, still try upload
        console.error(e);
        this.api.uploadDocument(orgId, file).subscribe({ next: () => this.loadDocs(), error: (er) => console.error(er) });
      }
    });
  }

  confirmDelete(filename: string) {
    this.deletingFilename = filename;
  }

  doDelete() {
    if (!this.deletingFilename) return;
    const orgId = this.auth.getOrgId();
    if (!orgId) return;
    this.api.deleteDocument(orgId, this.deletingFilename).subscribe({ next: () => { this.deletingFilename = null; this.loadDocs(); }, error: (e) => { console.error(e); this.deletingFilename = null; } });
  }

  cancelDelete() { this.deletingFilename = null; }
}
