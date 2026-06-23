import {
  Component, OnInit, signal, inject, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser }  from '@angular/common';
import { CommonModule }        from '@angular/common';
import { FormsModule }         from '@angular/forms';
import { RouterModule }        from '@angular/router';
import { ActivatedRoute }      from '@angular/router';
import { PaymentService }      from '../../../../core/services/payment.service';
import { ApiService }          from '../../../../core/services/api/api.service';
import { ENDPOINTS }           from '../../../../core/services/api/endpoints';

// Payment method display info
interface PayMethod {
  id:     number;
  name:   string;
  detail: string;
  icon:   string;
}

const MONTHS = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
];

@Component({
  selector:    'app-booking-confirm',
  standalone:  true,
  imports:     [CommonModule, FormsModule, RouterModule],
  templateUrl: './booking-confirm.html',
  styleUrls:   ['./booking-confirm.scss'],
})
export class BookingConfirm implements OnInit {

  private route    = inject(ActivatedRoute);
  private svc      = inject(PaymentService);
  private api      = inject(ApiService);
  private platform = inject(PLATFORM_ID);

  // ── State ─────────────────────────────────────────────────
  bookingId     = signal<number | null>(null);
  booking       = signal<any | null>(null);
  payMethods    = signal<PayMethod[]>([]);

  step = signal<'form' | 'success'>('form');

  // Form
  selectedMethod = signal<number | null>(null);
  externalRef    = signal('');
  notes          = signal('');
  receiptFile    = signal<File | null>(null);
  receiptPreview = signal<string | null>(null);

  // UI state
  isLoading    = signal(false);
  errorMsg     = signal<string | null>(null);
  dragOver     = signal(false);

  // ── Lifecycle ──────────────────────────────────────────────
  ngOnInit(): void {
    // Booking ID comes from query param: /confirmar-pago?booking=123
    const id = this.route.snapshot.queryParamMap.get('booking');
    if (id) {
      this.bookingId.set(+id);
      this.loadBooking(+id);
    }
    this.loadPaymentMethods();
  }

  // ── Loaders ───────────────────────────────────────────────
  private loadBooking(id: number): void {
    this.svc.getBooking(id).subscribe({
      next:  b   => this.booking.set(b),
      error: ()  => this.errorMsg.set('No se encontró la cita. Verifica el enlace.'),
    });
  }

  private loadPaymentMethods(): void {
    this.api.get<any[]>(ENDPOINTS.catalogs.paymentMethods).subscribe({
      next: methods => this.payMethods.set(
        methods.map(m => ({
          id:     m.id,
          name:   m.name,
          detail: m.detail ?? '',
          icon:   this.methodIcon(m.name),
        }))
      ),
      error: () => {
        // Fallback hardcoded methods
        this.payMethods.set([
          { id:1, name:'Bancolombia',  detail:'Ahorros · 678-000099-64',  icon:'🏦' },
          { id:2, name:'Nequi',        detail:'311 675 5857',              icon:'📱' },
          { id:3, name:'Daviplata',    detail:'311 675 5857',              icon:'📱' },
          { id:4, name:'Datáfono',     detail:'Pago en el estudio',        icon:'💳' },
        ]);
      },
    });
  }

  private methodIcon(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('bancolombia'))  return '🏦';
    if (n.includes('nequi'))        return '📱';
    if (n.includes('daviplata'))    return '📱';
    if (n.includes('datáfono') || n.includes('datafono') || n.includes('tarjeta')) return '💳';
    return '💰';
  }

  // ── File handling ─────────────────────────────────────────
  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.setFile(input.files[0]);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.setFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(): void { this.dragOver.set(false); }

  private setFile(file: File): void {
    const allowed = ['image/jpeg','image/png','image/webp','application/pdf'];
    if (!allowed.includes(file.type)) {
      this.errorMsg.set('Solo se permiten imágenes (JPG, PNG, WEBP) o PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.errorMsg.set('El archivo no puede superar 10 MB.');
      return;
    }
    this.receiptFile.set(file);
    this.errorMsg.set(null);

    // Preview for images
    if (file.type.startsWith('image/') && isPlatformBrowser(this.platform)) {
      const reader = new FileReader();
      reader.onload = e => this.receiptPreview.set(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      this.receiptPreview.set(null);
    }
  }

  removeFile(): void {
    this.receiptFile.set(null);
    this.receiptPreview.set(null);
  }

  // ── Submit ────────────────────────────────────────────────
  submit(): void {
    const booking = this.booking();
    const method  = this.selectedMethod();

    if (!booking)  { this.errorMsg.set('No se encontró la cita.'); return; }
    if (!method)   { this.errorMsg.set('Selecciona un método de pago.'); return; }

    this.isLoading.set(true);
    this.errorMsg.set(null);

    // In production: upload file to S3/Cloudinary first, then send URL
    // Here we send metadata and note that receipt should be attached
    const depositAmount = booking.deposit_amount
      ?? (booking.estimated_price * (booking.deposit_percent ?? 50)) / 100;

    this.svc.createPayment({
      booking_id:   booking.id,
      method_id:    method,
      kind:         'deposit',
      amount:       depositAmount ?? 0,
      external_ref: this.externalRef() || undefined,
      notes:        this.notes() || undefined,
      receipt_url:  this.receiptPreview() || undefined, // replace with real URL
    }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.step.set('success');
        this.sendWhatsappConfirmation();
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  // ── After success: notify artist via WhatsApp ─────────────
  private sendWhatsappConfirmation(): void {
    if (!isPlatformBrowser(this.platform)) return;
    const b = this.booking();
    if (!b?.artist?.whatsapp) return;

    const method = this.payMethods().find(m => m.id === this.selectedMethod());
    const msg = encodeURIComponent(
      `Hola! Acabo de enviar el comprobante de pago para mi cita ${b.booking_number} en TATUA.\n\n` +
      `*Método:* ${method?.name ?? '—'}\n` +
      `*Referencia:* ${this.externalRef() || 'Ver comprobante adjunto'}\n\n` +
      `Quedo pendiente de la confirmación. ¡Gracias!`
    );
    window.open(`https://wa.me/${b.artist.whatsapp}?text=${msg}`, '_blank');
  }

  // ── Helpers ───────────────────────────────────────────────
  get depositAmount(): number {
    const b = this.booking();
    if (!b) return 0;
    if (b.deposit_amount) return b.deposit_amount;
    if (b.estimated_price && b.deposit_percent) {
      return (b.estimated_price * b.deposit_percent) / 100;
    }
    return 0;
  }

  formatCOP(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', minimumFractionDigits: 0,
    }).format(value);
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Por definir';
    const [y, m, d] = dateStr.split('-');
    return `${+d} de ${MONTHS[+m - 1]} de ${y}`;
  }

  get bookingNumberShort(): string {
    return this.booking()?.booking_number ?? '—';
  }
}