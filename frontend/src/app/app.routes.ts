import { Routes } from '@angular/router';
import { Privacy } from './components/privacy/privacy';
import { Registration } from './components/registration/registration';
import { Lobby } from './components/lobby/lobby';

export const routes: Routes = [
  { path: 'register', component: Registration },
  { path: 'privacy', component: Privacy },
  { path: 'lobby/:id', component: Lobby },
  { path: '', pathMatch: 'full', redirectTo: 'register' }
];
