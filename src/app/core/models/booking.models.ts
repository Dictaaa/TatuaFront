// ============================================================
// TATUA · Booking Interfaces
// Match the shape returned by the Node/Sequelize API
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

export type PaymentKind = 'deposit' | 'balance' | 'full';

// ── POST /bookings  request body ─────────────────────────────
export interface CreateBookingDto {
  // client info (upserted by backend)
  client_name:     string;
  client_whatsapp: string;
  client_email?:   string;

  // booking details
  artist_id:     number;
  type_id:       number;
  style_id?:     number;
  zone_id?:      number;
  size_id?:      number;
  description?:  string;
  reference_url?: string;
  booked_date?:  string;   // 'YYYY-MM-DD'
}

// ── API response shapes ───────────────────────────────────────
export interface BookingArtist {
  id:       number;
  name:     string;
  slug:     string;
  whatsapp: string;
}

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

export interface Booking {
  id:              number;
  booking_number:  string;
  state:           BookingState;
  artist_id:       number;
  client_id:       number;
  type_id:         number;
  style_id:        number | null;
  zone_id:         number | null;
  size_id:         number | null;
  description:     string | null;
  reference_url:   string | null;
  booked_date:     string | null;
  start_time:      string | null;
  estimated_price: number | null;
  deposit_percent: number;
  deposit_amount:  number | null;
  final_price:     number | null;
  created_at:      string;
  updated_at:      string;

  // includes
  artist?: BookingArtist;
  client?: BookingClient;
  type?:   BookingLookup;
  style?:  BookingLookup | null;
  zone?:   BookingLookup | null;
  size?:   BookingLookup | null;
}

// ── Calendar response ─────────────────────────────────────────
export type CalendarDayState = 'available' | 'busy' | 'blocked' | 'unavailable';

export interface CalendarDay {
  date:  string;            // 'YYYY-MM-DD'
  state: CalendarDayState;
}

export interface ArtistCalendar {
  artist_id: number;
  year:      number;
  month:     number;
  days:      CalendarDay[];
}

// ── Catalog items ─────────────────────────────────────────────
export interface CatalogItem {
  id:        number;
  name:      string;
  is_active: boolean;
}

export interface TattooSize extends CatalogItem {
  description: string | null;
}

// ── Form state used in home.ts ────────────────────────────────
export interface BookingFormState {
  type:        string;
  type_id:     number | null;
  name:        string;
  whatsapp:    string;
  email:       string;
  zone:        string;
  zone_id:     number | null;
  size:        string;
  size_id:     number | null;
  description: string;
  date:        number | null;    // day of month selected
  payment:     string;
}