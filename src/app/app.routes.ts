import type { Routes } from '@angular/router';
import type { DashboardComponent } from './features/dashboard/dashboard.component';

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
  { path: '**', redirectTo: 'dashboard' },
];
