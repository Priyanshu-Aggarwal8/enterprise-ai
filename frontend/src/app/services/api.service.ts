import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface Organization {
  id: string;
  name: string;
}

export interface CustomTool {
  id: string;
  name: string;
  description: string;
  python_code: string;
}

export interface Secret {
  id: string;
  provider: string;
  key_preview: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.apiUrl;
  private auth = inject(AuthService);

  constructor(private http: HttpClient) {}

  /**
   * Get the current org_id, either from auth service or throw error if not available
   */
  private getOrgId(fallback?: string): string {
    const orgId = this.auth.getOrgId() || fallback;
    if (!orgId) {
      throw new Error('Organization ID not available. User may not be assigned to an organization yet.');
    }
    return orgId;
  }

  syncUser(): Observable<any> {
    return this.http.post(`${this.baseUrl}/users/sync`, {});
  }

  getOrganizations(): Observable<Organization[]> {
    return this.http.get<Organization[]>(`${this.baseUrl}/organizations`);
  }

  createOrganization(name: string): Observable<Organization> {
    return this.http.post<Organization>(`${this.baseUrl}/organizations`, { name });
  }

  joinOrganization(orgId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/organizations/${orgId}/join`, {});
  }

  // Secret Management
  getSecrets(orgId?: string): Observable<Secret[]> {
    const id = orgId || this.getOrgId();
    return this.http.get<Secret[]>(`${this.baseUrl}/organizations/${id}/secrets`);
  }

  addSecret(orgId: string, provider: string, secretKey: string): Observable<any> {
    const id = orgId || this.getOrgId();
    return this.http.post(`${this.baseUrl}/organizations/${id}/secrets`, {
      provider,
      raw_api_key: secretKey
    });
  }

  updateSecret(orgId: string, secretId: string, provider: string, secretKey: string): Observable<any> {
    const id = orgId || this.getOrgId();
    return this.http.put(`${this.baseUrl}/organizations/${id}/secrets/${secretId}`, {
      provider,
      raw_api_key: secretKey
    });
  }

  deleteSecret(orgId: string, secretId: string): Observable<any> {
    const id = orgId || this.getOrgId();
    return this.http.delete(`${this.baseUrl}/organizations/${id}/secrets/${secretId}`);
  }

  // Custom Tool Management
  getCustomTools(orgId?: string): Observable<CustomTool[]> {
    const id = orgId || this.getOrgId();
    return this.http.get<CustomTool[]>(`${this.baseUrl}/tools`);
  }

  createCustomTool(orgId: string | undefined, name: string, description: string, pythonCode: string): Observable<CustomTool> {
    const id = orgId || this.getOrgId();
    return this.http.post<CustomTool>(`${this.baseUrl}/tools`, {
      name: name,
      description: description,
      python_code: pythonCode
    });
  }

  updateCustomTool(toolId: string, name: string, description: string, pythonCode: string): Observable<CustomTool> {
    const orgId = this.getOrgId();
    return this.http.put<CustomTool>(`${this.baseUrl}/tools/${toolId}`, {
      name: name,
      description: description,
      python_code: pythonCode
    });
  }

  deleteCustomTool(toolId: string): Observable<any> {
    const orgId = this.getOrgId(); // Ensure orgId is present
    return this.http.delete(`${this.baseUrl}/tools/${toolId}`);
  }

  uploadDocument(orgId?: string, file?: File): Observable<any> {
    const id = orgId || this.getOrgId();
    const formData = new FormData();
    if (file) {
      formData.append('file', file, file.name);
    }
    return this.http.post(`${this.baseUrl}/documents/upload`, formData);
  }

  // Document management
  getDocuments(orgId?: string): Observable<any[]> {
    const id = orgId || this.getOrgId();
    return this.http.get<any[]>(`${this.baseUrl}/documents?org_id=${id}`);
  }

  deleteDocument(orgId: string, filename: string): Observable<any> {
    const id = orgId || this.getOrgId();
    // Deletion is scoped server-side by current user org, filename param is required
    return this.http.delete(`${this.baseUrl}/documents?filename=${encodeURIComponent(filename)}`);
  }

  runAgent(orgId: string | undefined, agentId: string, sessionId: string, prompt: string): Observable<any> {
    const id = orgId || this.getOrgId();
    return this.http.post(`${this.baseUrl}/agents/run`, {
      org_id: id,
      agent_id: agentId,
      prompt: prompt,
      session_id: sessionId
    });
  }
}