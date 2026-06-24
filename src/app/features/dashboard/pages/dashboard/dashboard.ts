import {
  Component, OnInit, OnDestroy,
  signal, computed, inject, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser }  from '@angular/common';
import { CommonModule }        from '@angular/common';
import { FormsModule }         from '@angular/forms';
import { RouterModule }        from '@angular/router';
import { DashboardService }    from '../../../../core/services/dashboard.service';
import { ApiService }          from '../../../../core/services/api/api.service';
import { AuthService }         from '../../../../core/services/auth/auth.service';
import { ENDPOINTS }           from '../../../../core/services/api/endpoints';
import {
  Booking, BookingState,
  STATE_LABEL, STATE_COLOR,
  DashboardKpis, CalendarDay,
} from '../../../../core/models/dashboard.models';

// ── Types ─────────────────────────────────────────────────────
type DashSection = 'overview' | 'bookings' | 'calendar' | 'payments' | 'services' | 'portfolio' | 'payment-methods' | 'profile';

export interface ServiceItem {
  id:            number | null;  // null = new (not saved yet)
  name:          string;
  description:   string;
  price_from:    number | null;
  is_quote_only: boolean;
  badge:         string;
  sort_order:    number;
  is_active:     boolean;
  isDirty?:      boolean;        // unsaved changes
}

export interface PaymentMethodItem {
  id:        number | null;
  name:      string;
  detail:    string;
  is_active: boolean;
  isDirty?:  boolean;
}


export interface ArtistProfile {
  name:         string;
  handle:       string;
  slug:         string;
  bio:          string;
  tagline:      string;
  whatsapp:     string;
  instagram:    string;
  facebook:     string;
  tiktok:       string;
  year_started: number | null;
  city_id:      number | null;
  hero_image_url: string | null;
}

export interface PortfolioItem {
  id:             number | null;
  image_url:      string;
  title:          string;
  duration_hours: number | null;
  sort_order:     number;
  is_active:      boolean;
  isNew?:         boolean;       // uploaded this session
  file?:          File;
  preview?:       string;
}

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const DOW = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

const MAX_PORTFOLIO = 9;

// ── Component ─────────────────────────────────────────────────
@Component({
  selector:    'app-dashboard',
  standalone:  true,
  imports:     [CommonModule, FormsModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrls:   ['./dashboard.scss'],
})
export class Dashboard implements OnInit, OnDestroy {

  private platform = inject(PLATFORM_ID);
  private svc      = inject(DashboardService);
  private api      = inject(ApiService);
  private auth     = inject(AuthService);

  // ── Artist — from auth service
  get artist() {
    const a = this.auth.artist();
    return a ?? { id: 1, name: 'Jose Tatto', handle: '@josetatto', slug: 'josetatto' };
  }

  // ── Navigation
  activeSection = signal<DashSection>('overview');
  sidebarOpen   = signal(false);

  // ── Bookings data
  allBookings  = signal<Booking[]>([]);
  kpis         = signal<DashboardKpis>({
    todayBookings: 0, confirmedToday: 0,
    pendingBookings: 0, pendingPayments: 0,
    monthRevenue: 0, newClients: 0,
  });

  filterState  = signal<BookingState | ''>('');
  filterDate   = signal('');
  searchQuery  = signal('');

  filteredBookings = computed(() => {
    let list = this.allBookings();
    const state = this.filterState();
    const date  = this.filterDate();
    const q     = this.searchQuery().toLowerCase();
    if (state) list = list.filter(b => b.state === state);
    if (date)  list = list.filter(b => b.booked_date === date);
    if (q)     list = list.filter(b =>
      b.booking_number.toLowerCase().includes(q) ||
      b.client?.name.toLowerCase().includes(q)   ||
      b.client?.whatsapp.includes(q)
    );
    return list.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });

  todayBookings = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.allBookings().filter(b =>
      b.booked_date === today && !['cancelled','no_show'].includes(b.state)
    );
  });

  pendingPaymentsList = computed(() =>
    this.allBookings().filter(b => b.state === 'awaiting_payment')
  );

  // ── Booking detail
  selectedBooking = signal<Booking | null>(null);
  detailOpen      = signal(false);
  editNotes       = signal('');
  editPrice       = signal<number | null>(null);
  actionLoading   = signal<number | null>(null);

  // ── Calendar
  calYear  = signal(new Date().getFullYear());
  calMonth = signal(new Date().getMonth());
  calDays  = signal<CalendarDay[]>([]);

  calMonthLabel = computed(() => `${MONTHS[this.calMonth()]} ${this.calYear()}`);

  calCells = computed(() => {
    const y = this.calYear(), m = this.calMonth();
    const firstDow  = new Date(y, m, 1).getDay();
    const totalDays = new Date(y, m + 1, 0).getDate();
    const dayMap    = new Map(this.calDays().map(d => [d.date, d.state]));
    const cells: { day: number | null; date: string; state: string }[] = [];
    for (let i = 0; i < firstDow; i++) cells.push({ day: null, date: '', state: '' });
    for (let d = 1; d <= totalDays; d++) {
      const date = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cells.push({ day: d, date, state: dayMap.get(date) ?? 'unavailable' });
    }
    return cells;
  });

  // ── Services ──────────────────────────────────────────────
  services      = signal<ServiceItem[]>([]);
  servicesLoading = signal(false);
  servicesSaving  = signal(false);

  // ── Portfolio ─────────────────────────────────────────────
  portfolio       = signal<PortfolioItem[]>([]);
  portfolioLoading = signal(false);
  portfolioSaving  = signal(false);
  dragOverPort    = signal(false);

  readonly maxPortfolio = MAX_PORTFOLIO;

  // ── Payment Methods ───────────────────────────────────────
  paymentMethods = signal<PaymentMethodItem[]>([]);
  pmLoading      = signal(false);
  pmSaving       = signal(false);

  // ── Artist Profile ────────────────────────────────────────
  profileForm    = signal<ArtistProfile>({
    name: '', handle: '', slug: '', bio: '', tagline: '',
    whatsapp: '', instagram: '', facebook: '', tiktok: '',
    year_started: null, city_id: null, hero_image_url: null,
  });
  profileLoading  = signal(false);
  profileSaving   = signal(false);
  profileDirty    = signal(false);
  cities          = signal<{ id: number; name: string }[]>([]);
  heroFile        = signal<File | null>(null);
  heroPreview     = signal<string | null>(null);
  // pmLoading      = signal(false);
  // pmSaving       = signal(false);

  get portfolioCount(): number { return this.portfolio().length; }
  get portfolioFull():  boolean { return this.portfolioCount >= MAX_PORTFOLIO; }

  // ── Toast
  toast = signal<{ title: string; msg: string; kind: 'success'|'error' } | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Expose helpers
  readonly stateLabel = STATE_LABEL;
  readonly stateColor = STATE_COLOR;
  readonly months     = MONTHS;
  readonly dow        = DOW;
  readonly allStates: BookingState[] = [
    'pending','awaiting_payment','confirmed',
    'in_progress','completed','rescheduled','cancelled','no_show',
  ];

  // ── Lifecycle ──────────────────────────────────────────────
  ngOnInit(): void {
    this.loadBookings();
    this.loadCalendar();
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  // ── Navigation ─────────────────────────────────────────────
  goTo(section: DashSection): void {
    this.activeSection.set(section);
    this.sidebarOpen.set(false);
    if (section === 'services'        && this.services().length       === 0) this.loadServices();
    if (section === 'portfolio'       && this.portfolio().length      === 0) this.loadPortfolio();
    if (section === 'payment-methods' && this.paymentMethods().length === 0) this.loadPaymentMethods();
    if (section === 'profile') this.loadProfile();
  }

  // ── Bookings ───────────────────────────────────────────────
  loadBookings(): void {
    this.svc.getBookings(this.artist.id).subscribe({
      next: (list) => { this.allBookings.set(list); this.kpis.set(this.svc.computeKpis(list)); },
      error: () => this.showToast('Error', 'No se pudieron cargar las citas.', 'error'),
    });
  }

  loadCalendar(): void {
    this.svc.getCalendar(this.artist.id, this.calYear(), this.calMonth() + 1).subscribe({
      next:  days => this.calDays.set(days),
      error: () => {},
    });
  }

  prevMonth(): void {
    if (this.calMonth() === 0) { this.calMonth.set(11); this.calYear.update(y => y - 1); }
    else this.calMonth.update(m => m - 1);
    this.loadCalendar();
  }

  nextMonth(): void {
    if (this.calMonth() === 11) { this.calMonth.set(0); this.calYear.update(y => y + 1); }
    else this.calMonth.update(m => m + 1);
    this.loadCalendar();
  }

  openDetail(b: Booking): void {
    this.selectedBooking.set(b);
    this.editNotes.set(b.artist_notes ?? '');
    this.editPrice.set(b.estimated_price);
    this.detailOpen.set(true);
  }

  closeDetail(): void { this.detailOpen.set(false); this.selectedBooking.set(null); }

  saveNotes(): void {
    const b = this.selectedBooking();
    if (!b) return;
    this.svc.updateBooking(b.id, {
      artist_notes:    this.editNotes(),
      estimated_price: this.editPrice() ?? undefined,
      deposit_amount:  this.editPrice() ? (this.editPrice()! * b.deposit_percent) / 100 : undefined,
    }).subscribe({
      next: (updated) => {
        this.updateLocal(updated);
        this.selectedBooking.set(updated);
        this.showToast('Guardado', 'Notas y precio actualizados.', 'success');
      },
      error: () => this.showToast('Error', 'No se pudo guardar.', 'error'),
    });
  }

  confirmBooking(b: Booking):  void { this.setAction(b.id, 'confirmed'); }
  rejectBooking(b: Booking):   void { this.setAction(b.id, 'cancelled', 'Rechazado por el artista'); }
  markInProgress(b: Booking):  void { this.setAction(b.id, 'in_progress'); }
  markCompleted(b: Booking):   void { this.setAction(b.id, 'completed'); }

  private setAction(id: number, state: BookingState, note?: string): void {
    this.actionLoading.set(id);
    this.svc.changeState(id, state, note).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.allBookings.update(list => list.map(b => b.id === id ? { ...b, state } : b));
        this.kpis.set(this.svc.computeKpis(this.allBookings()));
        if (this.selectedBooking()?.id === id) this.selectedBooking.update(b => b ? { ...b, state } : b);
        this.showToast('Estado actualizado', STATE_LABEL[state], 'success');
      },
      error: () => { this.actionLoading.set(null); this.showToast('Error', 'No se pudo cambiar el estado.', 'error'); },
    });
  }

  verifyPayment(paymentId: number, bookingId: number): void {
    this.svc.verifyPayment(paymentId).subscribe({
      next: () => {
        this.allBookings.update(list => list.map(b => b.id === bookingId ? { ...b, state: 'confirmed' as BookingState } : b));
        this.kpis.set(this.svc.computeKpis(this.allBookings()));
        this.showToast('Pago verificado', 'La cita fue confirmada automáticamente.', 'success');
        this.loadBookings();
      },
      error: () => this.showToast('Error', 'No se pudo verificar el pago.', 'error'),
    });
  }

  openWhatsapp(b: Booking): void {
    if (!isPlatformBrowser(this.platform)) return;
    const msg = encodeURIComponent(`Hola ${b.client?.name ?? 'Cliente'}! Te escribo sobre tu cita ${b.booking_number} en TATUA. `);
    window.open(`https://wa.me/${b.client?.whatsapp ?? ''}?text=${msg}`, '_blank');
  }

  // ── SERVICES ───────────────────────────────────────────────

  loadServices(): void {
    this.servicesLoading.set(true);
    this.api.get<any[]>(`/artists/${this.artist.id}/services`).subscribe({
      next: (list) => {
        this.services.set(list.map(s => ({
          id:            s.id,
          name:          s.name,
          description:   s.description ?? '',
          price_from:    s.price_from   ?? null,
          is_quote_only: s.is_quote_only ?? false,
          badge:         s.badge        ?? 'Desde',
          sort_order:    s.sort_order   ?? 0,
          is_active:     s.is_active    ?? true,
        })));
        this.servicesLoading.set(false);
      },
      error: () => { this.servicesLoading.set(false); },
    });
  }

  addService(): void {
    const newService: ServiceItem = {
      id: null, name: '', description: '',
      price_from: null, is_quote_only: false,
      badge: 'Desde', sort_order: this.services().length,
      is_active: true, isDirty: true,
    };
    this.services.update(list => [...list, newService]);
  }

  markDirty(index: number): void {
    this.services.update(list =>
      list.map((s, i) => i === index ? { ...s, isDirty: true } : s)
    );
  }

  toggleQuote(index: number): void {
    this.services.update(list =>
      list.map((s, i) => i === index
        ? { ...s, is_quote_only: !s.is_quote_only, price_from: !s.is_quote_only ? null : s.price_from, isDirty: true }
        : s
      )
    );
  }

  removeService(index: number): void {
    const svc = this.services()[index];
    if (svc.id) {
      // Soft delete via API
      this.api.put(`${ENDPOINTS.artists.update(svc.id)}`, { is_active: false }).subscribe({
        next: () => this.services.update(list => list.filter((_, i) => i !== index)),
        error: () => this.showToast('Error', 'No se pudo eliminar el servicio.', 'error'),
      });
    } else {
      // Not saved yet — just remove from list
      this.services.update(list => list.filter((_, i) => i !== index));
    }
  }

  saveServices(): void {
    const dirty = this.services().filter(s => s.isDirty);
    if (dirty.length === 0) { this.showToast('Sin cambios', 'No hay cambios que guardar.', 'success'); return; }

    this.servicesSaving.set(true);
    const artistId = this.artist.id;

    const saves = dirty.map(s => {
      const payload = {
        artist_id:     artistId,
        name:          s.name,
        description:   s.description || null,
        price_from:    s.is_quote_only ? null : (s.price_from ?? null),
        is_quote_only: s.is_quote_only,
        badge:         s.badge || 'Desde',
        sort_order:    s.sort_order,
        is_active:     s.is_active,
      };
      if (s.id) {
        return this.api.put(`/services/${s.id}`, payload).toPromise();
      } else {
        return this.api.post<any>('/services', payload).toPromise()
          .then((created: any) => {
            this.services.update(list =>
              list.map(item => item === s ? { ...item, id: created.id, isDirty: false } : item)
            );
          });
      }
    });

    Promise.allSettled(saves).then(results => {
      this.servicesSaving.set(false);
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed === 0) {
        this.services.update(list => list.map(s => ({ ...s, isDirty: false })));
        this.showToast('Guardado', 'Servicios actualizados correctamente.', 'success');
      } else {
        this.showToast('Error parcial', `${failed} servicio(s) no se pudieron guardar.`, 'error');
      }
    });
  }

  // ── PORTFOLIO ──────────────────────────────────────────────

  loadPortfolio(): void {
    this.portfolioLoading.set(true);
    this.api.get<any[]>(`/artists/${this.artist.id}/portfolio`).subscribe({
      next: (list) => {
        this.portfolio.set(list.slice(0, MAX_PORTFOLIO).map(p => ({
          id:             p.id,
          image_url:      p.image_url,
          title:          p.title ?? '',
          duration_hours: p.duration_hours ?? null,
          sort_order:     p.sort_order ?? 0,
          is_active:      p.is_active ?? true,
        })));
        this.portfolioLoading.set(false);
      },
      error: () => { this.portfolioLoading.set(false); },
    });
  }

  onPortfolioFiles(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (files) Array.from(files).forEach(f => this.addPortfolioFile(f));
    (event.target as HTMLInputElement).value = '';
  }

  onPortfolioDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOverPort.set(false);
    const files = event.dataTransfer?.files;
    if (files) Array.from(files).forEach(f => this.addPortfolioFile(f));
  }

  private addPortfolioFile(file: File): void {
    if (!file.type.startsWith('image/')) return;
    if (this.portfolioFull) {
      this.showToast('Límite alcanzado', `Máximo ${MAX_PORTFOLIO} trabajos en el portafolio.`, 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      this.portfolio.update(list => [...list, {
        id: null, image_url: '', title: '',
        duration_hours: null, sort_order: list.length,
        is_active: true, isNew: true,
        file, preview: e.target?.result as string,
      }]);
    };
    reader.readAsDataURL(file);
  }

  updatePortfolioTitle(index: number, title: string): void {
    this.portfolio.update(list => list.map((p, i) => i === index ? { ...p, title } : p));
  }

  updatePortfolioDuration(index: number, hours: string): void {
    this.portfolio.update(list =>
      list.map((p, i) => i === index ? { ...p, duration_hours: hours ? +hours : null } : p)
    );
  }

  removePortfolio(index: number): void {
    const item = this.portfolio()[index];
    if (item.id) {
      this.api.delete(`/upload/portfolio/${item.id}`).subscribe({
        next: () => this.portfolio.update(list => list.filter((_, i) => i !== index)),
        error: () => this.showToast('Error', 'No se pudo eliminar la imagen.', 'error'),
      });
    } else {
      this.portfolio.update(list => list.filter((_, i) => i !== index));
    }
  }

  savePortfolio(): void {
    const newItems = this.portfolio().filter(p => p.isNew && p.file);
    if (newItems.length === 0) {
      this.showToast('Sin cambios', 'No hay imágenes nuevas que subir.', 'success');
      return;
    }

    this.portfolioSaving.set(true);

    const uploads = newItems.map(item => {
      const fd = new FormData();
      fd.append('image', item.file!);
      if (item.title) fd.append('title', item.title);
      if (item.duration_hours != null) fd.append('duration_hours', String(item.duration_hours));
      return this.api.post<any>('/upload/portfolio', fd).toPromise()
        .then((created: any) => {
          // Replace the local preview item with the saved one
          this.portfolio.update(list =>
            list.map(p => p === item
              ? { ...p, id: created.id, image_url: created.image_url, isNew: false, file: undefined, preview: undefined }
              : p
            )
          );
        });
    });

    Promise.allSettled(uploads).then(results => {
      this.portfolioSaving.set(false);
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed === 0) {
        this.showToast('Guardado', `${newItems.length} imagen(es) subida(s) correctamente.`, 'success');
      } else {
        this.showToast('Error parcial', `${failed} imagen(es) no se pudieron subir.`, 'error');
      }
    });
  }


  // ── PAYMENT METHODS ────────────────────────────────────────

  loadPaymentMethods(): void {
    this.pmLoading.set(true);
    this.api.get<any[]>('/payment-methods', { artist_id: String(this.artist.id) }).subscribe({
      next: (list) => {
        // Only show artist-specific methods (artist_id !== null)
        this.paymentMethods.set(
          list
            .filter((m: any) => m.artist_id === this.artist.id)
            .map((m: any) => ({
              id:        m.id,
              name:      m.name,
              detail:    m.detail ?? '',
              is_active: m.is_active,
            }))
        );
        this.pmLoading.set(false);
      },
      error: () => { this.pmLoading.set(false); },
    });
  }

  addPaymentMethod(): void {
    this.paymentMethods.update(list => [
      ...list,
      { id: null, name: 'Nequi', detail: '', is_active: true, isDirty: true },
    ]);
  }

  markPmDirty(index: number): void {
    this.paymentMethods.update(list =>
      list.map((m, i) => i === index ? { ...m, isDirty: true } : m)
    );
  }

  removePaymentMethod(index: number): void {
    const m = this.paymentMethods()[index];
    if (m.id) {
      this.api.delete(`/payment-methods/${m.id}`).subscribe({
        next:  () => this.paymentMethods.update(list => list.filter((_, i) => i !== index)),
        error: () => this.showToast('Error', 'No se pudo eliminar.', 'error'),
      });
    } else {
      this.paymentMethods.update(list => list.filter((_, i) => i !== index));
    }
  }

  savePaymentMethods(): void {
    const dirty = this.paymentMethods().filter(m => m.isDirty);
    if (dirty.length === 0) return;

    this.pmSaving.set(true);

    const saves = dirty.map(m => {
      const payload = { name: m.name, detail: m.detail };
      if (m.id) {
        return this.api.put(`/payment-methods/${m.id}`, payload).toPromise();
      } else {
        return this.api.post<any>('/payment-methods', payload).toPromise()
          .then((created: any) => {
            this.paymentMethods.update(list =>
              list.map(item => item === m ? { ...item, id: created.id, isDirty: false } : item)
            );
          });
      }
    });

    Promise.allSettled(saves).then(results => {
      this.pmSaving.set(false);
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed === 0) {
        this.paymentMethods.update(list => list.map(m => ({ ...m, isDirty: false })));
        this.showToast('Guardado', 'Métodos de pago actualizados.', 'success');
      } else {
        this.showToast('Error', 'Algunos métodos no se pudieron guardar.', 'error');
      }
    });
  }


  // ── PROFILE ────────────────────────────────────────────────

  loadProfile(): void {
    this.profileLoading.set(true);
    this.api.get<any>(`/artists/${this.artist.id}`).subscribe({
      next: (data) => {
        this.profileForm.set({
          name:           data.name          ?? '',
          handle:         data.handle        ?? '',
          slug:           data.slug          ?? '',
          bio:            data.bio           ?? '',
          tagline:        data.tagline       ?? '',
          whatsapp:       data.whatsapp      ?? '',
          instagram:      data.instagram     ?? '',
          facebook:       data.facebook      ?? '',
          tiktok:         data.tiktok        ?? '',
          year_started:   data.year_started  ?? null,
          city_id:        data.city_id       ?? null,
          hero_image_url: data.hero_image_url ?? null,
        });
        this.profileLoading.set(false);
      },
      error: () => {
        this.profileLoading.set(false);
        this.showToast('Error', 'No se pudo cargar el perfil.', 'error');
      },
    });

    // Load cities if not loaded yet
    if (this.cities().length === 0) {
      this.api.get<any[]>('/cities').subscribe({
        next:  c => this.cities.set(c),
        error: () => {},
      });
    }
  }

  updateProfile(field: keyof ArtistProfile, value: any): void {
    this.profileForm.update(f => ({ ...f, [field]: value }));
    this.profileDirty.set(true);
  }

  saveProfile(): void {
    this.profileSaving.set(true);
    const form = this.profileForm();

    this.api.put<any>(`/artists/${this.artist.id}`, {
      name:         form.name        || undefined,
      handle:       form.handle      || undefined,
      bio:          form.bio         || null,
      tagline:      form.tagline     || null,
      whatsapp:     form.whatsapp    || null,
      instagram:    form.instagram   || null,
      facebook:     form.facebook    || null,
      tiktok:       form.tiktok      || null,
      year_started: form.year_started || null,
      city_id:      form.city_id     || undefined,
    }).subscribe({
      next: () => {
        this.profileSaving.set(false);
        this.profileDirty.set(false);
        this.showToast('Guardado', 'Perfil actualizado correctamente.', 'success');
      },
      error: () => {
        this.profileSaving.set(false);
        this.showToast('Error', 'No se pudo guardar el perfil.', 'error');
      },
    });
  }

  onHeroChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    this.heroFile.set(file);
    const reader = new FileReader();
    reader.onload = e => this.heroPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  uploadHero(): void {
    const file = this.heroFile();
    if (!file) return;
    this.profileSaving.set(true);
    const fd = new FormData();
    fd.append('image', file);
    this.api.post<any>('/upload/hero', fd).subscribe({
      next: (res) => {
        this.profileSaving.set(false);
        this.profileForm.update(f => ({ ...f, hero_image_url: res.hero_image_url }));
        this.heroFile.set(null);
        this.heroPreview.set(null);
        this.showToast('Foto actualizada', 'La imagen de fondo fue subida.', 'success');
      },
      error: () => {
        this.profileSaving.set(false);
        this.showToast('Error', 'No se pudo subir la imagen.', 'error');
      },
    });
  }

  removeHeroPreview(): void {
    this.heroFile.set(null);
    this.heroPreview.set(null);
  }

  get currentYear(): number { return new Date().getFullYear(); }
  get yearOptions(): number[] {
    return Array.from({ length: 30 }, (_, i) => this.currentYear - i);
  }

  logout(): void {
    this.auth.logout();
  }

  // ── Helpers ────────────────────────────────────────────────
  private updateLocal(updated: Booking): void {
    this.allBookings.update(list => list.map(b => b.id === updated.id ? updated : b));
  }

  private showToast(title: string, msg: string, kind: 'success'|'error'): void {
    this.toast.set({ title, msg, kind });
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4_500);
  }

  formatCOP(value: number | null): string {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 }).format(value);
  }

  formatDate(date: string | null): string {
    if (!date) return '—';
    const [y,m,d] = date.split('-');
    return `${d} ${MONTHS[parseInt(m)-1]} ${y}`;
  }

  canConfirm(b: Booking):    boolean { return b.state === 'awaiting_payment'; }
  canReject(b: Booking):     boolean { return ['pending','awaiting_payment'].includes(b.state); }
  canComplete(b: Booking):   boolean { return b.state === 'in_progress'; }
  canInProgress(b: Booking): boolean { return b.state === 'confirmed'; }
  isActioning(id: number):   boolean { return this.actionLoading() === id; }

  trackById(_: number, b: { id: number|null }): number|null { return b.id; }
  trackByIdx(i: number): number { return i; }

  get todayStr():     string { return new Date().toISOString().split('T')[0]; }
  get pendingCount(): number { return this.allBookings().filter(b => b.state === 'pending').length; }
  get paymentCount(): number { return this.allBookings().filter(b => b.state === 'awaiting_payment').length; }
}