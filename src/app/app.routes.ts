import type { Routes } from '@angular/router';
import type { DashboardComponent } from './features/dashboard/dashboard.component';
import type { SettingsComponent } from './features/settings/settings.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    title: 'Dashboard',
    loadComponent: (): Promise<typeof DashboardComponent> =>
      import('./features/dashboard/dashboard.component').then(
        (module: { DashboardComponent: typeof DashboardComponent }): typeof DashboardComponent =>
          module.DashboardComponent,
      ),
  },
  {
    path: 'settings',
    title: 'Settings',
    loadComponent: (): Promise<typeof SettingsComponent> =>
      import('./features/settings/settings.component').then(
        (module: { SettingsComponent: typeof SettingsComponent }): typeof SettingsComponent =>
          module.SettingsComponent,
      ),
  },
  { path: '**', redirectTo: 'dashboard' },
];
