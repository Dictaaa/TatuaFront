import { inject }         from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { Router }        from '@angular/router';
import { AuthService }   from '../services/auth/auth.service';

// ── publicGuard — blocks logged-in users from /login ─────────
// Usage in routes:  canActivate: [publicGuard]
export const publicGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLogged()) return true;

  router.navigate(['/dashboard']);
  return false;
};