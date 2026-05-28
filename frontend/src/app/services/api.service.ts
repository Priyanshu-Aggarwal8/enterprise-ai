import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface AgentRunResponse {
  message: string;
  task_id: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getOrganizations(): Observable<Organization[]> {
    return this.http.get<Organization[]>(`${this.baseUrl}/organizations/`);
  }

  createOrganization(name: string): Observable<Organization> {
    return this.http.post<Organization>(`${this.baseUrl}/organizations/`, { name });
  }

  addSecret(orgId: string, provider: string, rawApiKey: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/organizations/${orgId}/secrets`, {
      provider: provider,
      raw_api_key: rawApiKey
    });
  }

  runAgent(orgId: string, agentId: string, sessionId: string, prompt: string): Observable<AgentRunResponse> {
    return this.http.post<AgentRunResponse>(`${this.baseUrl}/agents/run`, {
      org_id: orgId,
      agent_id: agentId,
      session_id: sessionId,
      prompt: prompt
    });
  }
}