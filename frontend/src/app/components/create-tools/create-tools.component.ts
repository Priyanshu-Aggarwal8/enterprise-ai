import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, CustomTool, ToolSandboxReport } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-create-tools',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './create-tools.component.html',
  styleUrl: './create-tools.component.scss'
})
export class CreateToolsComponent implements OnInit {
  toolName = '';
  toolDescription = '';
  toolCode = 'def run(input_string: str) -> str:\n    """Your custom logic here"""\n    return f"Processed: {input_string}"';
  sandboxTestInput = 'sandbox-test';
  isSaving = false;
  isSandboxTesting = false;
  sandboxPassed = false;
  sandboxReport: ToolSandboxReport | null = null;
  isEditing = false;
  editingToolId: string | null = null;
  savedTools: CustomTool[] = [];

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadTools();
  }

  loadTools(): void {
    const orgId = this.auth.getOrgId();
    if (!orgId) return;
    this.api.getCustomTools(orgId).subscribe({
      next: (tools) => (this.savedTools = tools),
      error: (err) => console.error('Failed to load tools', err)
    });
  }

  isToolBound(tool: CustomTool): boolean {
    return (tool.bound_agents?.length ?? 0) > 0;
  }

  boundAgentLabel(tool: CustomTool): string {
    if (!tool.bound_agents?.length) return '';
    return tool.bound_agents.map((a) => a.name).join(', ');
  }

  onCodeChange(): void {
    this.sandboxPassed = false;
    this.sandboxReport = null;
  }

  runSandboxTest(): void {
    if (!this.toolCode.trim()) return;

    this.isSandboxTesting = true;
    this.sandboxReport = null;

    this.api.sandboxTestTool(
      this.toolName || 'preview_tool',
      this.toolDescription,
      this.toolCode,
      this.sandboxTestInput
    ).subscribe({
      next: (report) => {
        this.isSandboxTesting = false;
        this.sandboxReport = report;
        this.sandboxPassed = report.passed;
        if (report.passed) {
          this.toast.push(
            report.requires_approval
              ? 'Sandbox passed — tool will require human approval at runtime'
              : 'Sandbox security test passed',
            'success'
          );
        } else {
          this.toast.push('Sandbox test failed — fix issues before saving', 'error');
        }
      },
      error: (err) => {
        this.isSandboxTesting = false;
        this.toast.push(err.error?.detail?.message || 'Sandbox test failed', 'error');
      }
    });
  }

  resetForm(): void {
    this.isEditing = false;
    this.editingToolId = null;
    this.toolName = '';
    this.toolDescription = '';
    this.toolCode = 'def run(input_string: str) -> str:\n    """Your custom logic here"""\n    return f"Processed: {input_string}"';
    this.sandboxPassed = false;
    this.sandboxReport = null;
  }

  editTool(tool: CustomTool): void {
    if (this.isToolBound(tool)) {
      this.toast.push(
        `Cannot edit "${tool.name}" while bound to: ${this.boundAgentLabel(tool)}. Unbind from all agents first.`,
        'error'
      );
      return;
    }
    this.isEditing = true;
    this.editingToolId = tool.id;
    this.toolName = tool.name;
    this.toolDescription = tool.description;
    this.toolCode = tool.python_code;
    this.sandboxPassed = tool.sandbox_status === 'passed';
    this.sandboxReport = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  saveTool(): void {
    const orgId = this.auth.getOrgId();
    if (!orgId || !this.toolName.trim() || !this.toolCode.trim()) return;

    if (!this.sandboxPassed) {
      this.toast.push('Run the WASM sandbox security test before saving', 'error');
      return;
    }

    this.isSaving = true;
    const onDone = () => {
      this.isSaving = false;
      this.resetForm();
      this.loadTools();
    };

    if (this.isEditing && this.editingToolId) {
      this.api.updateCustomTool(this.editingToolId, this.toolName, this.toolDescription, this.toolCode).subscribe({
        next: (tool) => {
          this.toast.push(`Tool '${tool.name}' updated`, 'success');
          onDone();
        },
        error: (err) => {
          this.isSaving = false;
          this.handleSaveError(err);
        }
      });
    } else {
      this.api.createCustomTool(orgId, this.toolName, this.toolDescription, this.toolCode).subscribe({
        next: (tool) => {
          this.toast.push(`Tool '${tool.name}' created`, 'success');
          onDone();
        },
        error: (err) => {
          this.isSaving = false;
          this.handleSaveError(err);
        }
      });
    }
  }

  private handleSaveError(err: any): void {
    const detail = err.error?.detail;
    if (detail?.sandbox) {
      this.sandboxReport = detail.sandbox;
      this.sandboxPassed = false;
    }
    this.toast.push(detail?.message || detail || 'Error saving tool', 'error');
  }

  deleteTool(tool: CustomTool): void {
    if (this.isToolBound(tool)) {
      this.toast.push(
        `Cannot delete "${tool.name}" while bound to: ${this.boundAgentLabel(tool)}. Unbind from all agents first.`,
        'error'
      );
      return;
    }
    if (!confirm(`Delete tool "${tool.name}"?`)) return;
    this.api.deleteCustomTool(tool.id).subscribe({
      next: () => {
        this.toast.push('Tool deleted', 'success');
        this.loadTools();
      },
      error: (err) => {
        this.toast.push(err.error?.detail || 'Error deleting tool', 'error');
      }
    });
  }

  riskLabel(tier?: string): string {
    switch (tier) {
      case 'safe': return 'Safe';
      case 'sensitive': return 'Sensitive';
      case 'dangerous': return 'Dangerous';
      default: return 'Unverified';
    }
  }

  goToWorkspace(): void {
    this.router.navigate(['/workspace']);
  }
}
