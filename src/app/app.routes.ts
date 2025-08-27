import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./graph-page/graph-page.component').then((m) => m.GraphPageComponent),
  },
];
