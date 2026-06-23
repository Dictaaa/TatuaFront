import { Component, signal, inject } from '@angular/core';
import { CommonModule }   from '@angular/common';
import { FormsModule }    from '@angular/forms';
import { RouterModule }   from '@angular/router';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService }    from '../../../../core/services/auth/auth.service';

@Component({
  selector:    'app-login',
  standalone:  true,
  imports:     [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrls:   ['./login.scss'],
})
export class Login {

  private auth   = inject(AuthService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);

  form = { slug: '', password: '' };

  isLoading = signal(false);
  errorMsg  = signal<string | null>(null);
  showPass  = signal(false);

  submit(): void {
    if (!this.form.slug || !this.form.password) {
      this.errorMsg.set('Por favor completa todos los campos.');
      return;
    }

    this.isLoading.set(true);
    this.errorMsg.set(null);

    this.auth.login(this.form).subscribe({
      next: () => {
        this.isLoading.set(false);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err?.error?.error ?? 'Credenciales incorrectas. Intenta de nuevo.';
        this.errorMsg.set(msg);
      },
    });
  }

  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') this.submit();
  }
}