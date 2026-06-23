import { HttpInterceptorFn, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { inject }    from '@angular/core';
import { Router }    from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth/auth.service';

// Rutas que NUNCA deben llevar token ni disparar logout en 401
const PUBLIC_URLS = ['/auth/login', '/auth/register'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  const token = auth.getToken();

  // 1. Solo adjuntar token si existe y no es null/undefined
  const authReq = (token && token !== 'null' && token !== 'undefined')
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {

      if (err.status === 401) {
        const isPublicRoute = PUBLIC_URLS.some(url => req.url.includes(url));
        const isLogoutCall  = req.url.includes('/auth/logout');

        // Solo forzar logout si:
        // - No es una ruta pública (login/register)
        // - No es el mismo endpoint de logout (evita loop)
        // - Hay un token guardado (sesión activa que expiró)
        if (!isPublicRoute && !isLogoutCall && auth.isLogged()) {
          auth.clearSession();           // limpiar sin llamar al API
          router.navigate(['/login']);
        }
      }

      return throwError(() => err);
    }),
  );
};