import { Routes } from '@angular/router';
import { authGuard, noAuthGuard } from './services/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent), canActivate: [noAuthGuard] },
  { path: 'onboarding', loadComponent: () => import('./components/settings/settings.component').then(m => m.SettingsComponent), canActivate: [authGuard], data: { isOnboarding: true } },
  { path: 'workspace', loadComponent: () => import('./components/agent-workspace/agent-workspace.component').then(m => m.AgentWorkspaceComponent), canActivate: [authGuard] },
  { path: 'settings', loadComponent: () => import('./components/settings/settings.component').then(m => m.SettingsComponent), canActivate: [authGuard], data: { isOnboarding: false } },
  { path: 'landing', loadComponent: () => import('./components/landing/landing.component').then(m => m.LandingComponent) },
  { path: 'profile', loadComponent: () => import('./components/profile/profile.component').then(m => m.ProfileComponent), canActivate: [authGuard] },
  { path: 'documents', loadComponent: () => import('./components/documents/documents.component').then(m => m.DocumentsComponent), canActivate: [authGuard] },
  { path: '', redirectTo: '/landing', pathMatch: 'full' },
  { path: '**', redirectTo: '/landing' }
];