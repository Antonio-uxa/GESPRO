import { Routes } from '@angular/router';
// La app usa un solo componente raíz y cambia de modo por estado interno.
import { AppComponent } from './app';

export const routes: Routes = [
  // Las rutas solo seleccionan el modo visible; no separan pantallas distintas.
  { path: '', redirectTo: 'analista', pathMatch: 'full' },
  { path: 'admin', component: AppComponent },
  { path: 'analista', component: AppComponent },
  { path: '**', redirectTo: 'analista' }
]; 