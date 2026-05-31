import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './services/auth.interceptor'; 
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { environment } from '../environments/environment';

const providers = [
  provideRouter(routes),
  provideHttpClient(withInterceptors([authInterceptor]))
];

// Only initialize Firebase if a valid API key is provided in environment.
if (environment.firebase && environment.firebase.apiKey) {
  providers.push(provideFirebaseApp(() => initializeApp(environment.firebase)));
  providers.push(provideAuth(() => getAuth()));
}

export const appConfig: ApplicationConfig = {
  providers: providers
};