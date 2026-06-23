import { Injectable, signal } from '@angular/core';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { ApiService }  from '../../core/services/api/api.service';
import { ENDPOINTS }   from '../../core/services/api/endpoints';

export interface CreatePaymentDto {
  booking_id:   number;
  method_id:    number;
  kind:         'deposit' | 'balance' | 'full';
  amount:       number;
  receipt_url?: string;   // URL after upload
  external_ref?: string;  // bank transaction reference
  notes?:       string;
}

export interface Payment {
  id:           number;
  booking_id:   number;
  method_id:    number;
  kind:         string;
  amount:       number;
  receipt_url:  string | null;
  is_verified:  boolean;
  created_at:   string;
  method:       { id: number; name: string; detail: string };
  booking:      { id: number; booking_number: string; state: string };
}

@Injectable({ providedIn: 'root' })
export class PaymentService {

  isLoading = signal(false);
  errorMsg  = signal<string | null>(null);

  constructor(private api: ApiService) {}

  // POST /payments
  createPayment(dto: CreatePaymentDto): Observable<Payment> {
    this.isLoading.set(true);
    this.errorMsg.set(null);

    return this.api.post<Payment>(ENDPOINTS.payments.create, dto).pipe(
      tap(() => this.isLoading.set(false)),
      catchError(err => {
        this.isLoading.set(false);
        this.errorMsg.set(err?.error?.error ?? 'Error al registrar el pago.');
        return throwError(() => err);
      }),
    );
  }

  // GET /payments?booking_id=
  getByBooking(bookingId: number): Observable<Payment[]> {
    return this.api.get<Payment[]>(ENDPOINTS.payments.list, {
      booking_id: String(bookingId),
    });
  }

  // GET /bookings/:id  (to show booking summary to client)
  getBooking(bookingId: number): Observable<any> {
    return this.api.get<any>(ENDPOINTS.bookings.getOne(bookingId));
  }
}