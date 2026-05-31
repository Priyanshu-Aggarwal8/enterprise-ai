import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, AgentDefinition, CustomTool } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-create-agent',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './create-agent.component.html',
  styleUrl: './create-agent.component.scss'
})
export class CreateAgentComponent implements OnInit {
  agentName = '';
  agentPurpose = '';
  systemPrompt = 'You are a helpful enterprise AI assistant. Use tools and documents when relevant.';
  modelName = 'gemini-2.5-flash';
  selectedToolIds: string[] = [];
  isSaving = false;
  isEditing = false;
  editingAgentId: string | null = null;
  savedAgents: AgentDefinition[] = [];
  availableTools: CustomTool[] = [];

  readonly modelOptions = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash'
  ];

  constructor(private api: ApiService, private toast: ToastService) {}

  ngOnInit(): void {
    this.loadAgents();
    this.loadTools();
  }

  loadAgents(): void {
    this.api.getAgents().subscribe({
      next: (agents) => (this.savedAgents = agents),
      error: (err) => console.error('Failed to load agents', err)
    });
  }

  loadTools(): void {
    this.api.getCustomTools().subscribe({
      next: (tools) => (this.availableTools = tools || []),
      error: (err) => console.error('Failed to load tools', err)
    });
  }

  isToolSelected(toolId: string): boolean {
    return this.selectedToolIds.includes(toolId);
  }

  toggleTool(toolId: string): void {
    if (this.isToolSelected(toolId)) {
      this.selectedToolIds = this.selectedToolIds.filter((id) => id !== toolId);
    } else {
      this.selectedToolIds = [...this.selectedToolIds, toolId];
    }
  }

  resetForm(): void {
    this.isEditing = false;
    this.editingAgentId = null;
    this.agentName = '';
    this.agentPurpose = '';
    this.systemPrompt = 'You are a helpful enterprise AI assistant. Use tools and documents when relevant.';
    this.modelName = 'gemini-2.5-flash';
    this.selectedToolIds = [];
  }

  editAgent(agent: AgentDefinition): void {
    this.isEditing = true;
    this.editingAgentId = agent.id;
    this.agentName = agent.name;
    this.agentPurpose = agent.purpose;
    this.systemPrompt = agent.system_prompt;
    this.modelName = agent.model_name;
    this.selectedToolIds = [...(agent.tool_ids || [])];
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  saveAgent(): void {
    if (!this.agentName.trim() || !this.agentPurpose.trim() || !this.systemPrompt.trim()) return;

    this.isSaving = true;
    const onDone = () => {
      this.isSaving = false;
      this.resetForm();
      this.loadAgents();
      this.loadTools();
    };

    if (this.isEditing && this.editingAgentId) {
      this.api.updateAgent(
        this.editingAgentId,
        this.agentName,
        this.agentPurpose,
        this.systemPrompt,
        this.modelName,
        this.selectedToolIds
      ).subscribe({
        next: (agent) => {
          this.toast.push(`Agent '${agent.name}' updated`, 'success');
          onDone();
        },
        error: (err) => {
          this.isSaving = false;
          this.toast.push(err.error?.detail || 'Error updating agent', 'error');
        }
      });
    } else {
      this.api.createAgent(
        this.agentName,
        this.agentPurpose,
        this.systemPrompt,
        this.modelName,
        this.selectedToolIds
      ).subscribe({
        next: (agent) => {
          this.toast.push(`Agent '${agent.name}' created`, 'success');
          onDone();
        },
        error: (err) => {
          this.isSaving = false;
          this.toast.push(err.error?.detail || 'Error creating agent', 'error');
        }
      });
    }
  }

  deleteAgent(agentId: string): void {
    if (!confirm('Delete this agent?')) return;
    this.api.deleteAgent(agentId).subscribe({
      next: () => {
        this.toast.push('Agent deleted', 'success');
        this.loadAgents();
        this.loadTools();
      },
      error: () => this.toast.push('Error deleting agent', 'error')
    });
  }

  boundToolNames(agent: AgentDefinition): string {
    if (!agent.tool_ids?.length) return 'None';
    return this.availableTools
      .filter((t) => agent.tool_ids!.includes(t.id))
      .map((t) => t.name)
      .join(', ') || `${agent.tool_ids.length} tool(s)`;
  }
}
