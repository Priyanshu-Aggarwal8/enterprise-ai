import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ApiService, AgentDefinition, CustomTool } from '../../services/api.service';
import { AgentStreamService } from '../../services/agent-stream.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

interface ChatMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
  isStreaming?: boolean;
}

interface WorkspaceLayout {
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

const LAYOUT_STORAGE_KEY = 'workspace_panel_layout_v1';
const COLLAPSED_STRIP_WIDTH = 28;
const LEFT_MIN = 200;
const LEFT_MAX = 520;
const LEFT_DEFAULT = 320;
const RIGHT_MIN = 180;
const RIGHT_MAX = 440;
const RIGHT_DEFAULT = 256;

@Component({
  selector: 'app-agent-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agent-workspace.component.html',
  styleUrl: './agent-workspace.component.scss'
})
export class AgentWorkspaceComponent implements OnInit, OnDestroy {
  selectedAgentId: string = '';
  sessionId: string = '';
  orgId: string | null = null;
  hasActiveKey: boolean = false;
  documents: any[] = [];
  customTools: CustomTool[] = [];
  agents: AgentDefinition[] = [];

  documentsPanelOpen = true;
  toolsPanelOpen = true;

  leftWidth = LEFT_DEFAULT;
  rightWidth = RIGHT_DEFAULT;
  leftCollapsed = false;
  rightCollapsed = false;
  isDragging = false;

  private leftWidthBeforeCollapse = LEFT_DEFAULT;
  private rightWidthBeforeCollapse = RIGHT_DEFAULT;
  activeDragSide: 'left' | 'right' | null = null;
  private dragStartX = 0;
  private dragStartWidth = 0;

  prompt: string = '';
  isExecuting: boolean = false;
  chatHistory: ChatMessage[] = [];
  errorMessage: string = '';

  private streamSub!: Subscription;
  private orgIdSub!: Subscription;
  private routerSub!: Subscription;

  constructor(
    private api: ApiService,
    private stream: AgentStreamService,
    private auth: AuthService,
    private router: Router
  ) {
    this.loadLayout();
  }

  get collapsedStripWidth(): number {
    return COLLAPSED_STRIP_WIDTH;
  }

  get leftShellWidth(): number {
    return this.leftCollapsed ? COLLAPSED_STRIP_WIDTH : this.leftWidth;
  }

  get rightShellWidth(): number {
    return this.rightCollapsed ? COLLAPSED_STRIP_WIDTH : this.rightWidth;
  }

  get panelTransition(): string {
    return this.isDragging ? 'none' : 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)';
  }

  get canChat(): boolean {
    return !!this.sessionId.trim() && !!this.selectedAgentId && !!this.orgId && this.hasActiveKey;
  }

  get selectedAgent(): AgentDefinition | undefined {
    return this.agents.find((a) => a.id === this.selectedAgentId);
  }

  isToolBoundToSelectedAgent(toolId: string): boolean {
    const agent = this.selectedAgent;
    return !!agent?.tool_ids?.includes(toolId);
  }

  ngOnInit() {
    this.orgIdSub = this.auth.orgId$.subscribe({
      next: (orgId) => {
        this.orgId = orgId;
        if (!orgId) {
          this.errorMessage = 'Not assigned to an organization. Configure in Settings.';
        } else {
          this.errorMessage = '';
        }

        const storageKey = `session_${orgId || 'global'}_${this.selectedAgentId || 'default'}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          this.sessionId = stored;
        } else if (!this.sessionId) {
          this.sessionId = uuidv4();
          localStorage.setItem(storageKey, this.sessionId);
        }

        if (orgId) {
          this.api.getSecrets(orgId).subscribe({
            next: (secrets: any[]) => {
              this.hasActiveKey = Array.isArray(secrets) && secrets.length > 0;
            },
            error: () => {
              this.hasActiveKey = false;
            }
          });

          this.api.getDocuments(orgId).subscribe({
            next: (docs: any[]) => {
              this.documents = docs || [];
            },
            error: () => {
              this.documents = [];
            }
          });

          this.api.getCustomTools(orgId).subscribe({
            next: (tools) => {
              this.customTools = tools || [];
            },
            error: () => {
              this.customTools = [];
            }
          });

          this.loadAgents();
        } else {
          this.hasActiveKey = false;
        }
      }
    });

    this.chatHistory.push({
      role: 'system',
      content: 'Workspace initialized. Select an agent to start chatting.'
    });

    this.streamSub = this.stream.messages$.subscribe({
      next: (data) => this.handleStreamUpdate(data),
      error: () => this.handleStreamError()
    });

    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        if (this.orgId) {
          this.loadAgents();
          this.refreshTools();
        }
      });
  }

  ngOnDestroy() {
    if (this.streamSub) this.streamSub.unsubscribe();
    if (this.orgIdSub) this.orgIdSub.unsubscribe();
    if (this.routerSub) this.routerSub.unsubscribe();
    this.stream.disconnect();
    this.endDrag();
  }

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    if (!this.isDragging || !this.activeDragSide) return;
    event.preventDefault();

    if (this.activeDragSide === 'left') {
      const delta = event.clientX - this.dragStartX;
      this.leftWidth = this.clamp(this.dragStartWidth + delta, LEFT_MIN, LEFT_MAX);
    } else {
      const delta = this.dragStartX - event.clientX;
      this.rightWidth = this.clamp(this.dragStartWidth + delta, RIGHT_MIN, RIGHT_MAX);
    }
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    if (this.isDragging) {
      this.endDrag();
      this.saveLayout();
    }
  }

  toggleLeftPanel(): void {
    if (this.leftCollapsed) {
      this.leftCollapsed = false;
      this.leftWidth = this.leftWidthBeforeCollapse;
    } else {
      this.leftWidthBeforeCollapse = this.leftWidth;
      this.leftCollapsed = true;
    }
    this.saveLayout();
  }

  toggleRightPanel(): void {
    if (this.rightCollapsed) {
      this.rightCollapsed = false;
      this.rightWidth = this.rightWidthBeforeCollapse;
    } else {
      this.rightWidthBeforeCollapse = this.rightWidth;
      this.rightCollapsed = true;
    }
    this.saveLayout();
  }

  startLeftResize(event: MouseEvent): void {
    event.preventDefault();
    this.isDragging = true;
    this.activeDragSide = 'left';
    this.dragStartX = event.clientX;
    this.dragStartWidth = this.leftWidth;
    document.body.classList.add('workspace-resizing');
  }

  startRightResize(event: MouseEvent): void {
    event.preventDefault();
    this.isDragging = true;
    this.activeDragSide = 'right';
    this.dragStartX = event.clientX;
    this.dragStartWidth = this.rightWidth;
    document.body.classList.add('workspace-resizing');
  }

  private endDrag(): void {
    this.isDragging = false;
    this.activeDragSide = null;
    document.body.classList.remove('workspace-resizing');
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private loadLayout(): void {
    try {
      const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (!raw) return;
      const layout = JSON.parse(raw) as WorkspaceLayout;
      if (layout.leftWidth) this.leftWidth = this.clamp(layout.leftWidth, LEFT_MIN, LEFT_MAX);
      if (layout.rightWidth) this.rightWidth = this.clamp(layout.rightWidth, RIGHT_MIN, RIGHT_MAX);
      this.leftCollapsed = !!layout.leftCollapsed;
      this.rightCollapsed = !!layout.rightCollapsed;
      this.leftWidthBeforeCollapse = this.leftWidth;
      this.rightWidthBeforeCollapse = this.rightWidth;
    } catch {
      /* ignore corrupt storage */
    }
  }

  private saveLayout(): void {
    const layout: WorkspaceLayout = {
      leftWidth: this.leftWidth,
      rightWidth: this.rightWidth,
      leftCollapsed: this.leftCollapsed,
      rightCollapsed: this.rightCollapsed
    };
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  }

  loadAgents(): void {
    this.api.getAgents().subscribe({
      next: (agents) => {
        this.agents = agents || [];
        if (!this.selectedAgentId && this.agents.length > 0) {
          this.selectAgent(this.agents[0].id);
        }
      },
      error: () => {
        this.agents = [];
      }
    });
  }

  selectAgent(agentId: string): void {
    if (this.selectedAgentId === agentId) return;
    this.selectedAgentId = agentId;

    const storageKey = `session_${this.orgId || 'global'}_${agentId}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      this.sessionId = stored;
    } else {
      this.sessionId = uuidv4();
      localStorage.setItem(storageKey, this.sessionId);
    }

    const agent = this.agents.find((a) => a.id === agentId);
    if (agent) {
      this.chatHistory.push({
        role: 'system',
        content: `Switched to agent: ${agent.name} (${agent.model_name})`
      });
    }
  }

  onAgentSelectChange(): void {
    if (this.selectedAgentId) {
      this.selectAgent(this.selectedAgentId);
    }
  }

  async submitPrompt() {
    if (!this.canChat || !this.prompt.trim()) {
      if (!this.hasActiveKey) {
        this.chatHistory.push({
          role: 'system',
          content: 'No active API key for this organization. Add one in Settings.'
        });
      } else if (!this.selectedAgentId) {
        this.chatHistory.push({
          role: 'system',
          content: 'Please select or create an agent before chatting.'
        });
      }
      return;
    }

    const userText = this.prompt;
    this.chatHistory.push({ role: 'user', content: userText });
    this.prompt = '';
    this.isExecuting = true;

    this.chatHistory.push({ role: 'agent', content: 'Connecting...', isStreaming: true });

    try {
      this.api.runAgent(this.orgId || undefined, this.selectedAgentId, this.sessionId, userText).subscribe({
        next: (res) => {
          this.stream.connect(res.task_id);
        },
        error: (err) => {
          console.error(err);
          this.updateLatestAgentMessage(
            'Error: Could not connect to API. ' + (err.error?.detail || err.message || '')
          );
          this.isExecuting = false;
        }
      });
    } catch (e) {
      console.error(e);
      this.updateLatestAgentMessage('Error: ' + String(e));
      this.isExecuting = false;
    }
  }

  onFileSelected(event: any) {
    const file: File = event.target.files && event.target.files[0];
    if (!file) return;
    if (!this.orgId) {
      this.chatHistory.push({
        role: 'system',
        content: 'Please select or create an organization before uploading documents.'
      });
      return;
    }

    this.chatHistory.push({ role: 'system', content: `Uploading ${file.name}...` });
    this.api.uploadDocument(this.orgId, file).subscribe({
      next: () => {
        this.chatHistory.push({ role: 'system', content: `Uploaded and ingested ${file.name}.` });
        this.api.getDocuments(this.orgId || undefined).subscribe({
          next: (docs: any[]) => {
            this.documents = docs || [];
          }
        });
      },
      error: (err) => {
        console.error(err);
        this.chatHistory.push({
          role: 'system',
          content: `Upload failed: ${err.error?.detail || err.message || 'Unknown error'}`
        });
      }
    });
  }

  deleteDocument(filename: string) {
    if (!this.orgId) return;
    if (!confirm(`Delete all document chunks for "${filename}"? This cannot be undone.`)) return;
    this.api.deleteDocument(this.orgId, filename).subscribe({
      next: () => {
        this.documents = this.documents.filter((d) => d.filename !== filename);
        this.chatHistory.push({ role: 'system', content: `Deleted ${filename}` });
      },
      error: () => {
        this.chatHistory.push({ role: 'system', content: `Failed to delete ${filename}` });
      }
    });
  }

  refreshTools(): void {
    if (!this.orgId) return;
    this.api.getCustomTools(this.orgId).subscribe({
      next: (tools) => (this.customTools = tools || [])
    });
  }

  goToCreateTools(): void {
    this.router.navigate(['/tools/create']);
  }

  goToCreateAgent(): void {
    this.router.navigate(['/agents/create']);
  }

  private handleStreamUpdate(data: any) {
    if (data.status === 'started') {
      this.updateLatestAgentMessage('Agent initialized. Thinking...');
    } else if (data.status === 'processing') {
      this.updateLatestAgentMessage(`[Thinking] ${data.message}`);
    } else if (data.status === 'completed') {
      this.updateLatestAgentMessage(data.result, false);
      this.isExecuting = false;
      this.stream.disconnect();
    }
  }

  private handleStreamError() {
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
