import {
  Component, OnInit, OnDestroy,
  signal, computed, inject, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser }   from '@angular/common';
import { CommonModule }         from '@angular/common';
import { RouterModule }         from '@angular/router';
import { FormsModule }          from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin }             from 'rxjs';

import { BookingService }       from '../../../../core/services/booking.service';
import { ApiService }           from '../../../../core/services/api/api.service';
import {
  CatalogItem,
  TattooSize,
  CalendarDay,
  BookingFormState,
} from '../../../../core/models/booking.models';

// ── Types ─────────────────────────────────────────────────────
export interface ArtistProfile {
  id:          number;
  slug:        string;
  name:        string;
  handle:      string;
  city:        string;
  specialty:   string[];
  tagline:     string;
  bio:         string;
  heroImage:   string;
  since:       number;
  totalWorks:  number;
  rating:      number;
  instagram:   string;
  whatsapp:    string;
  styles:      StyleCard[];
  portfolio:   PortfolioItem[];
  services:    ServiceItem[];
  reviews:     Review[];
}

export interface StyleCard    { name: string; emoji: string; desc: string; }
export interface PortfolioItem{ id: number; title: string; style: string; duration: string; emoji: string; }
export interface ServiceItem  { name: string; desc: string; from: string; badge: string; }
export interface Review       { name: string; rating: number; text: string; date: string; initials: string; }

// ── Calendar helpers ──────────────────────────────────────────
const MONTHS   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DOW      = ['D','L','M','M','J','V','S'];

const MOCK_ARTIST: ArtistProfile = {
  id: 1, slug: 'josetatto', name: 'Jose Tatto', handle: '@josetatto',
  city: 'Bogotá, Colombia', specialty: ['Realismo','Blackwork','Fine Line'],
  tagline: 'Arte que permanece.\nHistorias grabadas en piel.',
  bio: 'Llevo más de 10 años convirtiendo ideas en obras permanentes. Me especializo en realismo de alta fidelidad y blackwork con influencias geométricas.',
  heroImage: '', since: 2014, totalWorks: 1240, rating: 4.97,
  instagram: 'josetatto', whatsapp: '573116755857',
  styles: [
    { name:'Realismo',  emoji:'◉', desc:'Fotografía en piel. Sombreados que engañan al ojo.' },
    { name:'Blackwork', emoji:'◼', desc:'Tinta negra pura. Geometría y contraste.'          },
    { name:'Fine Line', emoji:'✦', desc:'Trazos delicados. Elegancia en cada línea.'         },
  ],
  portfolio: [
    { id:1, title:'León Negro',       style:'Blackwork', duration:'4h',   emoji:'🦁' },
    { id:2, title:'Retrato Realista', style:'Realismo',  duration:'8h',   emoji:'👁️' },
    { id:3, title:'Geométrico',       style:'Blackwork', duration:'3h',   emoji:'◆'  },
    { id:4, title:'Rosa Fine Line',   style:'Fine Line', duration:'2h',   emoji:'🌹' },
    { id:5, title:'Mariposa',         style:'Fine Line', duration:'1.5h', emoji:'🦋' },
    { id:6, title:'Mandala',          style:'Blackwork', duration:'6h',   emoji:'◎'  },
  ],
  services: [
    { name:'Tatuaje pequeño', desc:'Hasta 5 cm. Flash o diseño simple.',    from:'$150.000', badge:'Desde'      },
    { name:'Tatuaje mediano', desc:'5 a 15 cm. Diseño con detalle medio.',  from:'$350.000', badge:'Desde'      },
    { name:'Tatuaje grande',  desc:'Más de 15 cm o tiempo extendido.',      from:'Cotización',badge:'Personalizado'},
    { name:'Full sleeve',     desc:'Brazo completo. Sesiones múltiples.',   from:'Cotización',badge:'Proyecto'   },
  ],
  reviews: [
    { name:'Camila R.',  rating:5, text:'El realismo del retrato quedó perfecto. 100% recomendado.', date:'Mar 2025', initials:'CR' },
    { name:'Julián M.',  rating:5, text:'El blackwork geométrico superó mis expectativas. Preciso y profesional.', date:'Ene 2025', initials:'JM' },
    { name:'Sofía P.',   rating:5, text:'Mi primer tatuaje. No pudo haber sido mejor experiencia.', date:'Feb 2025', initials:'SP' },
  ],
};

// ── Component ─────────────────────────────────────────────────
@Component({
  selector:    'app-home',
  standalone:  true,
  imports:     [CommonModule, RouterModule, FormsModule],
  templateUrl: './home.html',
  styleUrls:   ['./home.scss'],
})
export class Home implements OnInit, OnDestroy {

  private platform       = inject(PLATFORM_ID);
  private route          = inject(ActivatedRoute);
  private router         = inject(Router);
  private bookingService = inject(BookingService);
  private api            = inject(ApiService);

  // ── Artist data
  artist = signal<ArtistProfile>(MOCK_ARTIST);

  // ── Portfolio filter
  activeStyle = signal<string>('Todos');

  filteredPortfolio = computed(() => {
    const s = this.activeStyle();
    return s === 'Todos'
      ? this.artist().portfolio
      : this.artist().portfolio.filter(i => i.style === s);
  });

  get portfolioStyles(): string[] {
    return ['Todos', ...new Set(this.artist().portfolio.map(p => p.style))];
  }

  yearsActive = computed(() => new Date().getFullYear() - this.artist().since);

  // ── Catalogs loaded from API
  tattooTypesApi  = signal<CatalogItem[]>([]);
  bodyZonesApi    = signal<CatalogItem[]>([]);
  tattooSizesApi  = signal<TattooSize[]>([]);
  paymentMethodsApi = signal<CatalogItem[]>([]);

  // ── Static fallbacks used in template (override with API data)
  get tattooTypes(): { label: string; icon: string; id: number }[] {
    const api = this.tattooTypesApi();
    if (api.length) {
      return api.map(t => ({ id: t.id, label: t.name, icon: '✦' }));
    }
    return [
      { id:1, label:'Diseño personalizado', icon:'✦' },
      { id:2, label:'Flash Tattoo',         icon:'✧' },
      { id:3, label:'Cover Up',             icon:'◈' },
      { id:4, label:'Retrato',              icon:'◉' },
      { id:5, label:'Lettering',            icon:'◎' },
      { id:6, label:'Otro',                 icon:'◇' },
    ];
  }

  get bodyZones(): string[] {
    const api = this.bodyZonesApi();
    return api.length
      ? api.map(z => z.name)
      : ['Brazo','Antebrazo','Pierna','Muslo','Espalda','Pecho','Costillas','Cuello','Mano','Pie','Otro'];
  }

  get sizes(): string[] {
    const api = this.tattooSizesApi();
    return api.length
      ? api.map(s => s.name)
      : ['Pequeño (< 5cm)','Mediano (5–15cm)','Grande (> 15cm)','Full sleeve / body'];
  }

  get payments(): { id: string; label: string; detail: string }[] {
    const api = this.paymentMethodsApi();
    return api.length
      ? api.map(m => ({ id: String(m.id), label: m.name, detail: '' }))
      : [
          { id:'bancolombia', label:'Bancolombia',  detail:'Ahorros · 678-000099-64' },
          { id:'nequi',       label:'Nequi',        detail:'311 675 5857' },
          { id:'daviplata',   label:'Daviplata',    detail:'311 675 5857' },
          { id:'datafono',    label:'Datáfono',     detail:'En el estudio' },
        ];
  }

  // ── Booking state
  currentStep  = signal(0);
  bookingOpen  = signal(false);

  form: BookingFormState = {
    type:'', type_id: null,
    name:'', whatsapp:'', email:'',
    zone:'', zone_id: null,
    size:'', size_id: null,
    description:'', date: null,
    payment: '',
  };

  // Expose service loading/error to template
  get isSubmitting(): boolean { return this.bookingService.isLoading(); }
  get submitError():  string | null { return this.bookingService.errorMsg(); }

  // ── Calendar
  calYear   = signal(new Date().getFullYear());
  calMonth  = signal(new Date().getMonth());
  calApiDays = signal<CalendarDay[]>([]);   // loaded from API

  calMonthLabel = computed(() => `${MONTHS[this.calMonth()]} ${this.calYear()}`);

  // Busy days from API, fallback to static list
  private get busyDaysSet(): Set<number> {
    const apiDays = this.calApiDays();
    if (apiDays.length) {
      return new Set(
        apiDays
          .filter(d => d.state === 'busy' || d.state === 'blocked')
          .map(d => parseInt(d.date.split('-')[2], 10))
      );
    }
    return new Set([3, 7, 12, 18, 22, 25, 28]);
  }

  calCells = computed(() => {
    const y = this.calYear(), m = this.calMonth();
    const firstDow  = new Date(y, m, 1).getDay();
    const totalDays = new Date(y, m + 1, 0).getDate();
    const busy      = this.busyDaysSet;

    // Today at midnight local time for accurate comparison
    const now       = new Date();
    const todayY    = now.getFullYear();
    const todayM    = now.getMonth();
    const todayD    = now.getDate();

    const cells: { day: number | null; busy: boolean; past: boolean; today: boolean }[] = [];

    for (let i = 0; i < firstDow; i++) {
      cells.push({ day: null, busy: false, past: false, today: false });
    }
    for (let d = 1; d <= totalDays; d++) {
      const isPast  = y < todayY
                   || (y === todayY && m < todayM)
                   || (y === todayY && m === todayM && d < todayD);
      const isToday = y === todayY && m === todayM && d === todayD;
      cells.push({ day: d, busy: busy.has(d), past: isPast, today: isToday });
    }
    return cells;
  });

  // ── Lightbox
  lightboxItem = signal<PortfolioItem | null>(null);

  // ── Toast
  toastData = signal<{ title: string; msg: string } | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Nav scroll
  navScrolled = signal(false);
  private scrollHandler = () => this.navScrolled.set(window.scrollY > 60);

  // ── Lifecycle ──────────────────────────────────────────────
  ngOnInit(): void {
    if (!isPlatformBrowser(this.platform)) return;

    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    this.initScrollReveal();
    this.loadCatalogs();
    this.loadCalendar();

    // In production, load artist from route:
    // const slug = this.route.snapshot.paramMap.get('slug');
    // this.api.get(ENDPOINTS.artists.bySlug(slug!)).subscribe(a => this.artist.set(a as any));
  }

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platform)) return;
    window.removeEventListener('scroll', this.scrollHandler);
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  // ── Load catalogs from API ────────────────────────────────
  private loadCatalogs(): void {
    forkJoin({
      types:   this.bookingService.getTattooTypes(),
      zones:   this.bookingService.getBodyZones(),
      sizes:   this.bookingService.getTattooSizes(),
      methods: this.bookingService.getPaymentMethods(),
    }).subscribe({
      next: ({ types, zones, sizes, methods }) => {
        this.tattooTypesApi.set(types);
        this.bodyZonesApi.set(zones);
        this.tattooSizesApi.set(sizes);
        this.paymentMethodsApi.set(methods);
        // Set default payment
        if (methods.length) this.form.payment = String(methods[0].id);
      },
      error: () => { /* fallback to static data already in getters */ },
    });
  }

  // ── Load calendar availability from API ───────────────────
  private loadCalendar(): void {
    const artistId = this.artist().id;
    const year     = this.calYear();
    const month    = this.calMonth() + 1; // API expects 1-based month

    this.bookingService.getCalendar(artistId, year, month).subscribe({
      next:  (cal) => this.calApiDays.set(cal.days),
      error: () => { /* fallback to static busy days */ },
    });
  }

  // ── Scroll reveal ─────────────────────────────────────────
  private initScrollReveal(): void {
    const io = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      }),
      { threshold: 0.12, rootMargin: '0px 0px -48px 0px' },
    );
    setTimeout(() => {
      document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale')
        .forEach(el => io.observe(el));
    }, 100);
  }

  // ── Portfolio ─────────────────────────────────────────────
  setStyle(s: string): void { this.activeStyle.set(s); }
  openLightbox(item: PortfolioItem): void { this.lightboxItem.set(item); }
  closeLightbox(): void { this.lightboxItem.set(null); }

  // ── Booking panel ─────────────────────────────────────────
  openBooking(): void {
    this.bookingOpen.set(true);
    this.currentStep.set(0);
    this.bookingService.errorMsg.set(null);
    if (isPlatformBrowser(this.platform)) document.body.style.overflow = 'hidden';
  }

  closeBooking(): void {
    this.bookingOpen.set(false);
    if (isPlatformBrowser(this.platform)) document.body.style.overflow = '';
  }

  nextStep(): void {
    if (this.currentStep() < 3) this.currentStep.update(s => s + 1);
  }

  prevStep(): void {
    if (this.currentStep() > 0) this.currentStep.update(s => s - 1);
  }

  goStep(n: number): void { this.currentStep.set(n); }

  selectType(label: string, id: number): void {
    this.form.type    = label;
    this.form.type_id = id;
  }

  selectPayment(id: string): void { this.form.payment = id; }

  pickDay(d: number): void {
    const now    = new Date();
    const isPast = this.calYear() < now.getFullYear()
                || (this.calYear() === now.getFullYear() && this.calMonth() < now.getMonth())
                || (this.calYear() === now.getFullYear() && this.calMonth() === now.getMonth() && d < now.getDate());
    if (!isPast) this.form.date = d;
  }

  prevMonth(): void {
    const now = new Date();
    // Block going before the current month
    if (this.calYear() === now.getFullYear() && this.calMonth() === now.getMonth()) return;
    if (this.calMonth() === 0) { this.calMonth.set(11); this.calYear.update(y => y - 1); }
    else this.calMonth.update(m => m - 1);
    this.form.date = null;
    this.loadCalendar();
  }

  nextMonth(): void {
    if (this.calMonth() === 11) { this.calMonth.set(0); this.calYear.update(y => y + 1); }
    else this.calMonth.update(m => m + 1);
    this.form.date = null;
    this.loadCalendar();
  }

  // ── Submit booking to API ─────────────────────────────────
  sendBooking(): void {
    if (!this.form.type_id) {
      this.showToast('Faltan datos', 'Por favor selecciona el tipo de tatuaje.');
      return;
    }

    const booked_date = this.form.date
      ? `${this.calYear()}-${String(this.calMonth() + 1).padStart(2,'0')}-${String(this.form.date).padStart(2,'0')}`
      : undefined;

    // Find zone_id and size_id from catalog
    const zone   = this.bodyZonesApi().find(z => z.name === this.form.zone);
    const size   = this.tattooSizesApi().find(s => s.name === this.form.size);

    this.bookingService.createBooking({
      client_name:     this.form.name,
      client_whatsapp: this.form.whatsapp,
      client_email:    this.form.email || undefined,
      artist_id:       this.artist().id,
      type_id:         this.form.type_id,
      zone_id:         zone?.id,
      size_id:         size?.id,
      description:     this.form.description || undefined,
      booked_date,
    }).subscribe({
      next: (booking) => {
        this.closeBooking();
        this.resetForm();
        // Redirect to payment page with booking id
        this.sendWhatsappNotification(booking.booking_number);
        this.router.navigate(['/confirmar-pago'], {
          queryParams: { booking: booking.id },
        });
      },
      error: () => {
        // errorMsg already set by service
      },
    });
  }

  // ── Also send WhatsApp notification after API booking ────
  private sendWhatsappNotification(bookingNumber: string): void {
    if (!isPlatformBrowser(this.platform)) return;
    const a   = this.artist();
    const f   = this.form;
    const date = f.date
      ? `${f.date} de ${MONTHS[this.calMonth()]} ${this.calYear()}`
      : 'Por definir';

    const msg = encodeURIComponent(
      `¡Hola ${a.name}! Acabo de reservar una cita en TATUA 🎨\n\n` +
      `*Número:* ${bookingNumber}\n` +
      `*Tipo:* ${f.type}\n` +
      `*Nombre:* ${f.name}\n` +
      `*Zona:* ${f.zone}\n` +
      `*Tamaño:* ${f.size}\n` +
      `*Fecha deseada:* ${date}\n` +
      `*Descripción:* ${f.description || '—'}\n\n` +
      `Enviado desde tatua.co/${a.slug}`
    );
    window.open(`https://wa.me/${a.whatsapp}?text=${msg}`, '_blank');
  }

  private resetForm(): void {
    this.form = {
      type:'', type_id: null,
      name:'', whatsapp:'', email:'',
      zone:'', zone_id: null,
      size:'', size_id: null,
      description:'', date: null,
      payment: this.paymentMethodsApi().length ? String(this.paymentMethodsApi()[0].id) : '',
    };
    this.currentStep.set(0);
  }

  // ── Toast ─────────────────────────────────────────────────
  private showToast(title: string, msg: string): void {
    this.toastData.set({ title, msg });
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastData.set(null), 6_000);
  }

  // ── Utils ─────────────────────────────────────────────────
  trackByIdx(i: number): number { return i; }
  scrollTo(id: string): void { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }

  get dowLabels():  string[]  { return DOW; }
  get monthNames(): string[]  { return MONTHS; }
  get starArray():  number[]  { return [1,2,3,4,5]; }
}