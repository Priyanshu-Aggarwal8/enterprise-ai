import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AgentStreamService } from '../../services/agent-stream.service';
import { Subscription } from 'rxjs';

interface ChatMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
  isStreaming?: boolean;
}

@Component({
  selector: 'app-agent-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agent-workspace.component.html'
})
export class AgentWorkspaceComponent implements OnInit, OnDestroy {
  orgId: string = '';
  agentId: string = '123';
  sessionId: string = 'thread-alpha';
  
  prompt: string = '';
  isExecuting: boolean = false;
  chatHistory: ChatMessage[] = [];
  
  private streamSub!: Subscription;

  constructor(
    private api: ApiService,
    private stream: AgentStreamService
  ) {}

  ngOnInit() {
    this.chatHistory.push({
      role: 'system',
      content: 'Workspace initialized. Please configure your Organization ID to begin.'
    });

    this.streamSub = this.stream.messages$.subscribe({
      next: (data) => this.handleStreamUpdate(data),
      error: (err) => this.handleStreamError(err)
    });
  }

  ngOnDestroy() {
    if (this.streamSub) this.streamSub.unsubscribe();
    this.stream.disconnect();
  }

  async submitPrompt() {
    if (!this.prompt.trim() || !this.orgId.trim()) return;

    const userText = this.prompt;
    this.chatHistory.push({ role: 'user', content: userText });
    this.prompt = '';
    this.isExecuting = true;

    this.chatHistory.push({ role: 'agent', content: 'Connecting...', isStreaming: true });

    try {
      this.api.runAgent(this.orgId, this.agentId, this.sessionId, userText).subscribe({
        next: (res) => {
          this.stream.connect(res.task_id);
        },
        error: (err) => {
          this.updateLatestAgentMessage('Error: Could not connect to API.');
          this.isExecuting = false;
        }
      });
    } catch (e) {
      console.error(e);
    }
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