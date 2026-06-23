import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule }  from '@angular/common';
import { FormsModule }   from '@angular/forms';
import { RouterModule }  from '@angular/router';
import { Router }        from '@angular/router';
import { AuthService }   from '../../../../core/services/auth/auth.service';
import { ApiService }    from '../../../../core/services/api/api.service';
import { ENDPOINTS }     from '../../../../core/services/api/endpoints';

interface City    { id: number; name: string; }
interface Style   { id: number; name: string; }

// ── Step data types ───────────────────────────────────────────
interface Step1 {
  name:     string;
  slug:     string;
  handle:   string;
  city_id:  number;
  whatsapp: string;
  email:    string;
  password: string;
  confirm:  string;
}

interface Step2 {
  bio:       string;
  tagline:   string;
  year_started: number | null;
  instagram: string;
  facebook:  string;
  tiktok:    string;
  styleIds:  number[];
}

interface Step3 {
  heroFile:       File | null;
  heroPreview:    string | null;
  portfolioFiles: { file: File; preview: string; title: string }[];
}

const TATTOO_TYPES = [
  'Realismo','Blackwork','Fine Line','Old School',
  'Neotradicional','Minimalista','Lettering','Color',
  'Cover Up','Geométrico','Acuarela','Retrato',
];

// ── Component ─────────────────────────────────────────────────
@Component({
  selector:    'app-register',
  standalone:  true,
  imports:     [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrls:   ['./register.scss'],
})
export class Register implements OnInit {

  private auth   = inject(AuthService);
  private api    = inject(ApiService);
  private router = inject(Router);

  // ── Steps
  currentStep = signal(1);
  readonly totalSteps = 4;

  // ── Catalog data
  cities  = signal<City[]>([]);
  styles  = signal<Style[]>([]);

  // Fallback styles if API fails
  readonly fallbackStyles = TATTOO_TYPES.map((n, i) => ({ id: i + 1, name: n }));

  // ── Form data per step
  step1: Step1 = {
    name: '', slug: '', handle: '', city_id: 0,
    whatsapp: '', email: '', password: '', confirm: '',
  };

  step2: Step2 = {
    bio: '', tagline: '', year_started: null,
    instagram: '', facebook: '', tiktok: '',
    styleIds: [],
  };

  step3: Step3 = {
    heroFile: null, heroPreview: null,
    portfolioFiles: [],
  };

  // ── UI state
  isLoading  = signal(false);
  errorMsg   = signal<string | null>(null);
  showPass   = signal(false);
  dragOver   = signal(false);
  dragOverPort = signal(false);

  // ── Registered artist id (after step 1 submit)
  private registeredId: number | null = null;
  private registeredToken: string | null = null;

  // ── Lifecycle ──────────────────────────────────────────────
  ngOnInit(): void {
    this.api.get<City[]>('/cities').subscribe({
      next:  c => this.cities.set(c),
      error: () => {},
    });
    this.api.get<Style[]>(ENDPOINTS.catalogs.tattooStyles).subscribe({
      next:  s => this.styles.set(s),
      error: () => this.styles.set(this.fallbackStyles),
    });
  }

  // ── Step navigation ────────────────────────────────────────
  nextStep(): void {
    this.errorMsg.set(null);
    if (this.currentStep() === 1) {
      const err = this.validateStep1();
      if (err) { this.errorMsg.set(err); return; }
      // Submit step 1 — creates the artist account
      this.submitStep1();
    } else if (this.currentStep() === 2) {
      this.submitStep2();
    } else if (this.currentStep() === 3) {
      this.submitStep3();
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) this.currentStep.update(s => s - 1);
  }

  skipStep(): void {
    if (this.currentStep() < this.totalSteps) {
      this.currentStep.update(s => s + 1);
    }
  }

  // ── Step 1: Account ────────────────────────────────────────
  private validateStep1(): string | null {
    if (!this.step1.name.trim())     return 'El nombre artístico es obligatorio.';
    if (!this.step1.slug.trim())     return 'El slug es obligatorio.';
    if (!this.step1.city_id)         return 'Selecciona tu ciudad.';
    if (!this.step1.whatsapp.trim()) return 'El WhatsApp es obligatorio.';
    if (!this.step1.email.trim())    return 'El correo es obligatorio.';
    if (this.step1.password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (this.step1.password !== this.step1.confirm) return 'Las contraseñas no coinciden.';
    return null;
  }

  private submitStep1(): void {
    this.isLoading.set(true);
    const { confirm, ...dto } = this.step1;

    this.auth.register({
      ...dto,
      city_id: +dto.city_id,
      handle:  dto.handle || `@${dto.slug}`,
    }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.registeredId    = res.artist.id;
        this.registeredToken = res.token;
        this.currentStep.set(2);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMsg.set(err?.error?.error ?? 'Error al crear la cuenta.');
      },
    });
  }

  // ── Step 2: Profile info ───────────────────────────────────
  private submitStep2(): void {
    if (!this.registeredId) { this.currentStep.set(1); return; }
    this.isLoading.set(true);

    const payload: any = {
      bio:          this.step2.bio        || null,
      tagline:      this.step2.tagline    || null,
      year_started: this.step2.year_started || null,
      instagram:    this.step2.instagram  || null,
      facebook:     this.step2.facebook   || null,
      tiktok:       this.step2.tiktok     || null,
    };

    this.api.put(`${ENDPOINTS.artists.update(this.registeredId!)}`, payload).subscribe({
      next: () => {
        this.isLoading.set(false);
        // Save styles (many-to-many) if any selected
        if (this.step2.styleIds.length > 0) {
          this.saveStyles().then(() => this.currentStep.set(3));
        } else {
          this.currentStep.set(3);
        }
      },
      error: () => {
        this.isLoading.set(false);
        // Non-blocking — continue anyway
        this.currentStep.set(3);
      },
    });
  }

  private async saveStyles(): Promise<void> {
    // POST each style association
    const promises = this.step2.styleIds.map(id =>
      this.api.post(`/artists/${this.registeredId}/styles`, { style_id: id })
        .toPromise().catch(() => {})
    );
    await Promise.allSettled(promises);
  }

  // ── Step 3: Images ─────────────────────────────────────────
  private submitStep3(): void {
    if (!this.step3.heroFile && this.step3.portfolioFiles.length === 0) {
      // No images — skip to done
      this.currentStep.set(4);
      return;
    }

    this.isLoading.set(true);
    const uploads: Promise<void>[] = [];

    // Upload hero image
    if (this.step3.heroFile) {
      const fd = new FormData();
      fd.append('image', this.step3.heroFile);
      uploads.push(
        this.api.post<any>('/upload/hero', fd).toPromise().catch(() => {})
      );
    }

    // Upload portfolio images
    this.step3.portfolioFiles.forEach(item => {
      const fd = new FormData();
      fd.append('image', item.file);
      if (item.title) fd.append('title', item.title);
      uploads.push(
        this.api.post<any>('/upload/portfolio', fd).toPromise().catch(() => {})
      );
    });

    Promise.allSettled(uploads).then(() => {
      this.isLoading.set(false);
      this.currentStep.set(4);
    });
  }

  // ── Style toggle ───────────────────────────────────────────
  toggleStyle(id: number): void {
    const ids = this.step2.styleIds;
    const idx = ids.indexOf(id);
    if (idx === -1) {
      if (ids.length < 5) this.step2.styleIds = [...ids, id];
    } else {
      this.step2.styleIds = ids.filter(i => i !== id);
    }
  }

  isStyleSelected(id: number): boolean {
    return this.step2.styleIds.includes(id);
  }

  // ── Slug auto-generation ───────────────────────────────────
  onNameChange(): void {
    this.step1.slug   = this.step1.name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    this.step1.handle = `@${this.step1.slug}`;
  }

  // ── Hero image ─────────────────────────────────────────────
  onHeroChange(event: Event): void {
    const f = (event.target as HTMLInputElement).files?.[0];
    if (f) this.setHero(f);
  }

  onHeroDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const f = event.dataTransfer?.files[0];
    if (f) this.setHero(f);
  }

  private setHero(file: File): void {
    if (!file.type.startsWith('image/')) return;
    this.step3.heroFile = file;
    const reader = new FileReader();
    reader.onload = e => this.step3.heroPreview = e.target?.result as string;
    reader.readAsDataURL(file);
  }

  removeHero(): void {
    this.step3.heroFile    = null;
    this.step3.heroPreview = null;
  }

  // ── Portfolio images ───────────────────────────────────────
  onPortfolioChange(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (files) Array.from(files).forEach(f => this.addPortfolioFile(f));
  }

  onPortfolioDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOverPort.set(false);
    const files = event.dataTransfer?.files;
    if (files) Array.from(files).forEach(f => this.addPortfolioFile(f));
  }

  private addPortfolioFile(file: File): void {
    if (!file.type.startsWith('image/')) return;
    if (this.step3.portfolioFiles.length >= 9) return; // max 9 images
    const reader = new FileReader();
    reader.onload = e => {
      this.step3.portfolioFiles = [
        ...this.step3.portfolioFiles,
        { file, preview: e.target?.result as string, title: '' },
      ];
    };
    reader.readAsDataURL(file);
  }

  removePortfolio(index: number): void {
    this.step3.portfolioFiles = this.step3.portfolioFiles.filter((_, i) => i !== index);
  }

  updatePortfolioTitle(index: number, title: string): void {
    this.step3.portfolioFiles = this.step3.portfolioFiles.map((item, i) =>
      i === index ? { ...item, title } : item
    );
  }

  // ── Go to dashboard ────────────────────────────────────────
  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  // ── Helpers ────────────────────────────────────────────────
  get currentYear(): number { return new Date().getFullYear(); }
  get yearOptions(): number[] {
    return Array.from({ length: 30 }, (_, i) => this.currentYear - i);
  }

  get stepPercent(): number {
    return ((this.currentStep() - 1) / (this.totalSteps - 1)) * 100;
  }

  trackByIdx(i: number): number { return i; }
  trackById(_: number, item: { id: number }): number { return item.id; }
}