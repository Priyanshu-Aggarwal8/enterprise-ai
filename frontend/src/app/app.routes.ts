import { Routes } from '@angular/router';
import { AgentWorkspaceComponent } from './components/agent-workspace/agent-workspace.component';
import { SettingsComponent } from './components/settings/settings.component';

export const routes: Routes = [
  { path: '', component: AgentWorkspaceComponent },
  { path: 'settings', component: SettingsComponent },
  { path: '**', redirectTo: '' }
];