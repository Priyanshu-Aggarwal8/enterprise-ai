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
  risk_tier?: string;
  sandbox_status?: string;
  requires_approval?: boolean;
  sandbox_report?: string | null;
  bound_agents?: BoundAgentSummary[];
}

export interface ToolSandboxReport {
  passed: boolean;
  risk_tier: string;
  requires_approval: boolean;
  issues: string[];
  test_output?: string | null;
  test_error?: string | null;
}

export interface ToolApprovalRequest {
  approval_id: string;
  task_id: string;
  tool_name: string;
  tool_id: string;
  risk_tier: string;
  args_preview: string;
  message: string;
}

export interface BoundAgentSummary {
  id: string;
  name: string;
}

export interface Secret {
  id: string;
  provider: string;
  key_preview: string;
}

export interface AgentDefinition {
  id: string;
  name: string;
  purpose: string;
  system_prompt: string;
  model_name: string;
  tool_ids?: string[];
  created_at?: string;
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

  sandboxTestTool(
    name: string,
    description: string,
    pythonCode: string,
    testInput: string = 'sandbox-test'
  ): Observable<ToolSandboxReport> {
    return this.http.post<ToolSandboxReport>(`${this.baseUrl}/tools/sandbox-test`, {
      name,
      description,
      python_code: pythonCode,
      test_input: testInput
    });
  }

  respondToolApproval(approvalId: string, approved: boolean): Observable<any> {
    return this.http.post(`${this.baseUrl}/agents/tool-approvals/${approvalId}`, {
      approved
    });
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

  // Agent definitions
  getAgents(): Observable<AgentDefinition[]> {
    return this.http.get<AgentDefinition[]>(`${this.baseUrl}/agents`);
  }

  createAgent(
    name: string,
    purpose: string,
    systemPrompt: string,
    modelName: string,
    toolIds: string[] = []
  ): Observable<AgentDefinition> {
    return this.http.post<AgentDefinition>(`${this.baseUrl}/agents`, {
      name,
      purpose,
      system_prompt: systemPrompt,
      model_name: modelName,
      tool_ids: toolIds
    });
  }

  updateAgent(
    agentId: string,
    name: string,
    purpose: string,
    systemPrompt: string,
    modelName: string,
    toolIds: string[] = []
  ): Observable<AgentDefinition> {
    return this.http.put<AgentDefinition>(`${this.baseUrl}/agents/${agentId}`, {
      name,
      purpose,
      system_prompt: systemPrompt,
      model_name: modelName,
      tool_ids: toolIds
    });
  }

  deleteAgent(agentId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/agents/${agentId}`);
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

  // Saved Chats
  getSavedChats(orgId?: string): Observable<any[]> {
    const id = orgId || this.getOrgId();
    return this.http.get<any[]>(`${this.baseUrl}/chats?org_id=${id}`);
  }

  saveChat(orgId: string | undefined, title: string, content: string, agentId?: string, sessionId?: string): Observable<any> {
    const id = orgId || this.getOrgId();
    return this.http.post<any>(`${this.baseUrl}/chats`, {
      title,
      content,
      agent_id: agentId,
      session_id: sessionId
    });
  }

  updateChat(chatId: string, title: string, content: string): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/chats/${chatId}`, {
      title,
      content
    });
  }

  deleteChat(chatId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/chats/${chatId}`);
  }
}