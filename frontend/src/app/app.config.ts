import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // Maneja errores globales del navegador y habilita el router de la aplicación.
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes)
  ]
};
