import { Routes } from '@angular/router';
import { authGuard }   from './core/guards/auth-guard';
import { publicGuard } from './core/guards/public-guard';

export const routes: Routes = [

  // ── "/" → Landing general TATUA (directorio de artistas) ─
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/landing/pages/landing/landing')
        .then(m => m.Landing),
  },
  {
    path: 'home',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/home/pages/home/home')
        .then(m => m.Home),
  },

  // ── Auth ──────────────────────────────────────────────────
  {
    path: 'login',
    canActivate: [publicGuard],
    loadComponent: () =>
      import('./features/auth/pages/login/login')
        .then(m => m.Login),
  },
  {
    path: 'register',
    canActivate: [publicGuard],
    loadComponent: () =>
      import('./features/auth/pages/register/register')
        .then(m => m.Register),
  },

  // ── Dashboard ─────────────────────────────────────────────
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard/dashboard')
        .then(m => m.Dashboard),
  },

  // ── Confirmar pago ────────────────────────────────────────
  {
    path: 'confirmar-pago',
    loadComponent: () =>
      import('./features/booking-confirm/pages/booking-confirm/booking-confirm')
        .then(m => m.BookingConfirm),
  },

  // ── Perfil del artista → tatua.co/josetatto ───────────────
  // SIEMPRE al final — captura cualquier :slug no definido arriba
  {
    path: ':slug',
    loadComponent: () =>
      import('./features/artist-profile/pages/artist-profile/artist-profile')
        .then(m => m.ArtistProfile),
  },

  { path: '**', redirectTo: '' },
];