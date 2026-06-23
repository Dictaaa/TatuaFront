import { Injectable, signal } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { ApiService } from './api/api.service';
import { ENDPOINTS } from './api/endpoints';
import {
  Booking, BookingState,
  DashboardKpis, CalendarDay,
} from '../models/dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {

  isLoading = signal(false);

  constructor(private api: ApiService) {}

  // ── GET /bookings?artist_id= ──────────────────────────────
  getBookings(artistId: number, params: Record<string,string> = {}): Observable<Booking[]> {
    return this.api.get<Booking[]>(ENDPOINTS.bookings.list, {
      artist_id: String(artistId),
      ...params,
    });
  }

  // ── GET /bookings/:id ─────────────────────────────────────
  getBooking(id: number): Observable<Booking> {
    return this.api.get<Booking>(ENDPOINTS.bookings.getOne(id));
  }

  // ── PATCH /bookings/:id/state ─────────────────────────────
  changeState(id: number, state: BookingState, note?: string): Observable<unknown> {
    return this.api.patch(ENDPOINTS.bookings.changeState(id), { state, note });
  }

  // ── PUT /bookings/:id  (update artist_notes / price) ─────
  updateBooking(id: number, data: Partial<Booking>): Observable<Booking> {
    return this.api.put<Booking>(ENDPOINTS.bookings.update(id), data);
  }

  // ── PATCH /payments/:id/verify ────────────────────────────
  verifyPayment(paymentId: number): Observable<unknown> {
    return this.api.patch(ENDPOINTS.payments.verify(paymentId));
  }

  // ── GET calendar ──────────────────────────────────────────
  getCalendar(artistId: number, year: number, month: number): Observable<CalendarDay[]> {
    return this.api.get<{ days: CalendarDay[] }>(
      ENDPOINTS.availability.calendar(artistId),
      { year: String(year), month: String(month) },
    ).pipe(map(r => r.days));
  }

  // ── Compute KPIs from bookings list ──────────────────────
  computeKpis(bookings: Booking[]): DashboardKpis {
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7); // 'YYYY-MM'

    const todayBookings   = bookings.filter(b => b.booked_date === today).length;
    const confirmedToday  = bookings.filter(b => b.booked_date === today && b.state === 'confirmed').length;
    const pendingBookings = bookings.filter(b => b.state === 'pending').length;
    const pendingPayments = bookings.filter(b => b.state === 'awaiting_payment').length;

    const monthRevenue = bookings
      .filter(b => b.state === 'completed' && b.created_at?.startsWith(thisMonth))
      .reduce((sum, b) => sum + (b.final_price ?? b.deposit_amount ?? 0), 0);

    // Unique clients this month
    const monthClients = new Set(
      bookings
        .filter(b => b.created_at?.startsWith(thisMonth))
        .map(b => b.client_id)
    ).size;

    return {
      todayBookings,
      confirmedToday,
      pendingBookings,
      pendingPayments,
      monthRevenue,
      newClients: monthClients,
    };
  }
}