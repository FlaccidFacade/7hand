import { Routes } from '@angular/router';
import { Privacy } from './components/privacy/privacy';

export const routes: Routes = [
  { path: 'privacy', component: Privacy },
  { path: '', pathMatch: 'full', redirectTo: '' }
];
