import { inject }         from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { Router }        from '@angular/router';
import { AuthService }     from '../services/auth/auth.service';

// ── authGuard — requires a valid token ────────────────────────
// Usage in routes:  canActivate: [authGuard]
export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isLogged()) return true;

  router.navigate(['/login'], {
    queryParams: { returnUrl: router.url },
  });
  return false;
};