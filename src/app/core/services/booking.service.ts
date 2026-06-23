import { Injectable, signal } from '@angular/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { ApiService } from './api/api.service';
import { ENDPOINTS } from './api/endpoints';
import {
  Booking,
  CreateBookingDto,
  ArtistCalendar,
  CatalogItem,
  TattooSize,
} from '../models/booking.models';

@Injectable({
  providedIn: 'root'
})
export class BookingService {

  // ── Loading / error state visible to components ─────────────
  isLoading  = signal(false);
  errorMsg   = signal<string | null>(null);
  lastBooking = signal<Booking | null>(null);

  constructor(private api: ApiService) {}

  // ── POST /bookings ────────────────────────────────────────────
  createBooking(dto: CreateBookingDto): Observable<Booking> {
    this.isLoading.set(true);
    this.errorMsg.set(null);

    return this.api.post<Booking>(ENDPOINTS.bookings.create, dto).pipe(
      tap((booking) => {
        this.lastBooking.set(booking);
        this.isLoading.set(false);
      }),
      catchError((err) => {
        this.isLoading.set(false);
        const msg = err?.error?.error ?? 'Error al crear la cita. Intenta de nuevo.';
        this.errorMsg.set(msg);
        return throwError(() => err);
      }),
    );
  }

  // ── GET /artists/:id/availability/calendar?year=&month= ───────
  getCalendar(artistId: number, year: number, month: number): Observable<ArtistCalendar> {
    return this.api.get<ArtistCalendar>(
      ENDPOINTS.availability.calendar(artistId),
      { year: String(year), month: String(month) },
    );
  }

  // ── GET /bookings?artist_id= ──────────────────────────────────
  getArtistBookings(artistId: number, state?: string): Observable<Booking[]> {
    const params: Record<string, string> = { artist_id: String(artistId) };
    if (state) params['state'] = state;
    return this.api.get<Booking[]>(ENDPOINTS.bookings.list, params);
  }

  // ── PATCH /bookings/:id/state ─────────────────────────────────
  changeState(bookingId: number, state: string, note?: string): Observable<unknown> {
    return this.api.patch(ENDPOINTS.bookings.changeState(bookingId), { state, note });
  }

  // ── Catalogs ──────────────────────────────────────────────────
  getTattooTypes(): Observable<CatalogItem[]> {
    return this.api.get<CatalogItem[]>(ENDPOINTS.catalogs.tattooTypes);
  }

  getBodyZones(): Observable<CatalogItem[]> {
    return this.api.get<CatalogItem[]>(ENDPOINTS.catalogs.bodyZones);
  }

  getTattooSizes(): Observable<TattooSize[]> {
    return this.api.get<TattooSize[]>(ENDPOINTS.catalogs.tattooSizes);
  }

  getPaymentMethods(): Observable<CatalogItem[]> {
    return this.api.get<CatalogItem[]>(ENDPOINTS.catalogs.paymentMethods);
  }
}