import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ── Private helpers ─────────────────────────────────────────

  private url(endpoint: string): string {
    return `${this.baseUrl}${endpoint}`;
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('tatua_token');
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  // ── Public HTTP methods ──────────────────────────────────────

  get<T>(endpoint: string, params?: Record<string, string>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          httpParams = httpParams.set(k, v);
        }
      });
    }
    return this.http.get<T>(this.url(endpoint), {
      headers: this.authHeaders(),
      params: httpParams,
    });
  }

  post<T>(endpoint: string, body: unknown = {}): Observable<T> {
    return this.http.post<T>(this.url(endpoint), body, {
      headers: this.authHeaders(),
    });
  }

  put<T>(endpoint: string, body: unknown = {}): Observable<T> {
    return this.http.put<T>(this.url(endpoint), body, {
      headers: this.authHeaders(),
    });
  }

  patch<T>(endpoint: string, body: unknown = {}): Observable<T> {
    return this.http.patch<T>(this.url(endpoint), body, {
      headers: this.authHeaders(),
    });
  }

  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(this.url(endpoint), {
      headers: this.authHeaders(),
    });
  }
}