import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AgentStreamService } from '../../services/agent-stream.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

interface ChatMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
  isStreaming?: boolean;
}

@Component({
  selector: 'app-agent-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agent-workspace.component.html',
  styleUrl: './agent-workspace.component.scss'
})
export class AgentWorkspaceComponent implements OnInit, OnDestroy {
  agentId: string = '123';
  sessionId: string = ''; // Initialize as empty, will be generated
  orgId: string | null = null;
  hasActiveKey: boolean = false;
  documents: any[] = [];
  
  prompt: string = '';
  isExecuting: boolean = false;
  chatHistory: ChatMessage[] = [];
  errorMessage: string = '';
  
  private streamSub!: Subscription;
  private orgIdSub!: Subscription;

  constructor(
    private api: ApiService,
    private stream: AgentStreamService,
    private auth: AuthService
  ) {}

  get canChat(): boolean {
    return !!this.sessionId.trim() && !!this.agentId.trim() && !!this.orgId && this.hasActiveKey;
  }

  ngOnInit() {
    // Subscribe to org_id changes from auth service
    this.orgIdSub = this.auth.orgId$.subscribe({
      next: (orgId) => {
        this.orgId = orgId;
        if (!orgId) {
          this.errorMessage = 'Not assigned to an organization. Configure in Settings.';
        } else {
          this.errorMessage = '';
        }

        // Load or generate a persistent sessionId scoped to org + agent
        const storageKey = `session_${orgId || 'global'}_${this.agentId}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          this.sessionId = stored;
        } else if (!this.sessionId) {
          this.sessionId = uuidv4();
          localStorage.setItem(storageKey, this.sessionId);
        }

        // Fetch whether an active encrypted API key exists for this org
        if (orgId) {
          this.api.getSecrets(orgId).subscribe({
            next: (secrets: any[]) => {
              this.hasActiveKey = Array.isArray(secrets) && secrets.length > 0;
            },
            error: (err) => {
              console.error('Error fetching secrets', err);
              this.hasActiveKey = false;
            }
          });

          // Load documents for sidebar
          this.api.getDocuments(orgId).subscribe({
            next: (docs: any[]) => { this.documents = docs || []; },
            error: (err) => { console.error('Failed to load documents', err); this.documents = []; }
          });
        } else {
          this.hasActiveKey = false;
        }
      }
    });


    this.chatHistory.push({
      role: 'system',
      content: 'Workspace initialized. Secure connection established. Ready to chat.'
    });

    this.streamSub = this.stream.messages$.subscribe({
      next: (data) => this.handleStreamUpdate(data),
      error: (err) => this.handleStreamError(err)
    });
  }

  ngOnDestroy() {
    if (this.streamSub) this.streamSub.unsubscribe();
    if (this.orgIdSub) this.orgIdSub.unsubscribe();
    this.stream.disconnect();
  }

  async submitPrompt() {
    if (!this.canChat || !this.prompt.trim()) {
      if (!this.hasActiveKey) {
        this.chatHistory.push({ role: 'system', content: 'No active API key for this organization. Add one in Settings.' });
      }
      return;
    }

    const userText = this.prompt;
    this.chatHistory.push({ role: 'user', content: userText });
    this.prompt = '';
    this.isExecuting = true;

    this.chatHistory.push({ role: 'agent', content: 'Connecting...', isStreaming: true });

    try {
      this.api.runAgent(this.orgId || undefined, this.agentId, this.sessionId, userText).subscribe({
        next: (res) => {
          this.stream.connect(res.task_id);
        },
        error: (err) => {
          console.error(err);
          this.updateLatestAgentMessage('Error: Could not connect to API. ' + (err.error?.detail || err.message || ''));
          this.isExecuting = false;
        }
      });
    } catch (e) {
      console.error(e);
      this.updateLatestAgentMessage('Error: ' + String(e));
      this.isExecuting = false;
    }
  }

  // Persist session id when user edits it manually
  persistSessionId() {
    const storageKey = `session_${this.orgId || 'global'}_${this.agentId}`;
    if (this.sessionId && this.sessionId.trim()) {
      localStorage.setItem(storageKey, this.sessionId.trim());
    }
  }

  // Document upload from UI
  onFileSelected(event: any) {
    const file: File = event.target.files && event.target.files[0];
    if (!file) return;
    if (!this.orgId) {
      this.chatHistory.push({ role: 'system', content: 'Please select or create an organization before uploading documents.' });
      return;
    }

    this.chatHistory.push({ role: 'system', content: `Uploading ${file.name}...` });
    this.api.uploadDocument(this.orgId, file).subscribe({
      next: (res) => {
        this.chatHistory.push({ role: 'system', content: `Uploaded and ingested ${file.name}.` });
        // Refresh documents list
        this.api.getDocuments(this.orgId || undefined).subscribe({ next: (docs: any[]) => { this.documents = docs || []; } });
      },
      error: (err) => {
        console.error(err);
        this.chatHistory.push({ role: 'system', content: `Upload failed: ${err.error?.detail || err.message || 'Unknown error'}` });
      }
    });
  }

  deleteDocument(filename: string) {
    if (!this.orgId) return;
    if (!confirm(`Delete all document chunks for "${filename}"? This cannot be undone.`)) return;
    this.api.deleteDocument(this.orgId, filename).subscribe({
      next: () => {
        this.documents = this.documents.filter(d => d.filename !== filename);
        this.chatHistory.push({ role: 'system', content: `Deleted ${filename}` });
      },
      error: (err) => {
        console.error(err);
        this.chatHistory.push({ role: 'system', content: `Failed to delete ${filename}` });
      }
    });
  }

  private handleStreamUpdate(data: any) {
    if (data.status === 'started') {
      this.updateLatestAgentMessage('Agent initialized. Thinking...');
    } 
    else if (data.status === 'processing') {
      this.updateLatestAgentMessage(`[Thinking] ${data.message}`);
    } 
    else if (data.status === 'completed') {
      this.updateLatestAgentMessage(data.result, false);
      this.isExecuting = false;
      this.stream.disconnect(); 
    }
  }

  private handleStreamError(err: any) {
    this.updateLatestAgentMessage('Error: WebSocket connection lost.', false);
    this.isExecuting = false;
  }

  private updateLatestAgentMessage(text: string, isStreaming: boolean = true) {
    const lastMsg = this.chatHistory[this.chatHistory.length - 1];
    if (lastMsg && lastMsg.role === 'agent') {
      lastMsg.content = text;
      lastMsg.isStreaming = isStreaming;
    }
  }
}