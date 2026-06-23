import { Injectable, signal, computed } from '@angular/core';
import { HttpClient }   from '@angular/common/http';
import { Router }       from '@angular/router';
import { tap }          from 'rxjs/operators';
import { Observable }   from 'rxjs';
import { environment }  from '../../../../environments/environment';
import {
  LoginDto, RegisterDto,
  AuthResponse, AuthArtist,
} from '../../models/auth.models';

const TOKEN_KEY  = 'tatua_token';
const ARTIST_KEY = 'tatua_artist';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private baseUrl = environment.apiUrl;

  private _token  = signal<string | null>(this.loadToken());
  private _artist = signal<AuthArtist | null>(this.loadArtist());

  token    = this._token.asReadonly();
  artist   = this._artist.asReadonly();
  isLogged = computed(() => {
    const t = this._token();
    return !!t && t !== 'null' && t !== 'undefined';
  });

  constructor(
    private http:   HttpClient,
    private router: Router,
  ) {}

  // ── POST /auth/login ──────────────────────────────────────
  login(dto: LoginDto): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/auth/login`, dto)
      .pipe(tap(res => this.persist(res)));
  }

  // ── POST /auth/register ───────────────────────────────────
  register(dto: RegisterDto): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/auth/register`, dto)
      .pipe(tap(res => this.persist(res)));
  }

  // ── Logout con llamada al API ─────────────────────────────
  logout(): void {
    const token = this._token();

    // Limpiar sesión local primero — evita loops si el API falla
    this.clearSession();
    this.router.navigate(['/login']);

    // Fire-and-forget al backend solo si había token válido
    if (token && token !== 'null') {
      this.http
        .post(`${this.baseUrl}/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .subscribe({ error: () => {} });
    }
  }

  // ── Limpiar sesión LOCAL sin llamar al API ─────────────────
  // Usado por el interceptor para evitar loops en 401
  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ARTIST_KEY);
    this._token.set(null);
    this._artist.set(null);
  }

  getToken(): string | null {
    return this._token();
  }

  private persist(res: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY,  res.token);
    localStorage.setItem(ARTIST_KEY, JSON.stringify(res.artist));
    this._token.set(res.token);
    this._artist.set(res.artist);
  }

  private loadToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    const t = localStorage.getItem(TOKEN_KEY);
    // Guard against "null" string stored accidentally
    return (t && t !== 'null' && t !== 'undefined') ? t : null;
  }

  private loadArtist(): AuthArtist | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(ARTIST_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}