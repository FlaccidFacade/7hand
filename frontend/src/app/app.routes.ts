import { Routes } from '@angular/router';
import { Privacy } from './components/privacy/privacy';
import { Registration } from './components/registration/registration';

export const routes: Routes = [
  { path: 'register', component: Registration },
  { path: 'privacy', component: Privacy },
  { path: '', pathMatch: 'full', redirectTo: 'register' }
];
