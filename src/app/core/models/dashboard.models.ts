// ============================================================
// TATUA · Dashboard Interfaces
// ============================================================

export type BookingState =
  | 'pending'
  | 'awaiting_payment'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'rescheduled'
  | 'cancelled'
  | 'no_show';

export const STATE_LABEL: Record<BookingState, string> = {
  pending:          'Solicitud enviada',
  awaiting_payment: 'Esperando anticipo',
  confirmed:        'Confirmada',
  in_progress:      'En curso',
  completed:        'Realizada',
  rescheduled:      'Reprogramada',
  cancelled:        'Cancelada',
  no_show:          'No asistió',
};

export const STATE_COLOR: Record<BookingState, string> = {
  pending:          '#F39C12',
  awaiting_payment: '#E67E22',
  confirmed:        '#2ECC71',
  in_progress:      '#3498DB',
  completed:        '#27AE60',
  rescheduled:      '#9B59B6',
  cancelled:        '#E74C3C',
  no_show:          '#95A5A6',
};

export interface BookingClient {
  id:       number;
  name:     string;
  whatsapp: string;
  email:    string | null;
}

export interface BookingLookup {
  id:   number;
  name: string;
}

export interface BookingPayment {
  id:          number;
  kind:        'deposit' | 'balance' | 'full';
  amount:      number;
  is_verified: boolean;
  receipt_url: string | null;
  created_at:  string;
  method:      BookingLookup;
}

export interface Booking {
  id:              number;
  booking_number:  string;
  state:           BookingState;
  client_id:       number;
  type_id:         number;
  description:     string | null;
  booked_date:     string | null;
  start_time:      string | null;
  estimated_price: number | null;
  deposit_percent: number;
  deposit_amount:  number | null;
  final_price:     number | null;
  artist_notes:    string | null;
  created_at:      string;

  // includes
  client?:   BookingClient;
  type?:     BookingLookup;
  style?:    BookingLookup | null;
  zone?:     BookingLookup | null;
  size?:     BookingLookup | null;
  payments?: BookingPayment[];
}

export interface DashboardKpis {
  todayBookings:    number;
  pendingBookings:  number;
  pendingPayments:  number;
  monthRevenue:     number;
  newClients:       number;
  confirmedToday:   number;
}

export interface CalendarDay {
  date:  string;
  state: 'available' | 'busy' | 'blocked' | 'unavailable';
}