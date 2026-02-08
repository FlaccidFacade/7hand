import { Routes } from '@angular/router';
import { Privacy } from './components/privacy/privacy';
import { Registration } from './components/registration/registration';
import { Lobby } from './components/lobby/lobby';
import { CardDemo } from './components/card-demo/card-demo.component';

export const routes: Routes = [
  { path: 'register', component: Registration },
  { path: 'privacy', component: Privacy },
  { path: 'lobby/:id', component: Lobby },
  { path: 'card-demo', component: CardDemo },
  { path: '', pathMatch: 'full', redirectTo: 'register' }
];
