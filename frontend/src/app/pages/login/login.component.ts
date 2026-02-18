import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RecipeApiService } from '../../recipe-api.service';
import { RecipeStateService } from '../../recipe-state.service';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly api = inject(RecipeApiService);
  private readonly state = inject(RecipeStateService);
  private readonly router = inject(Router);

  authBusy = false;

  async signIn(): Promise<void> {
    this.authBusy = true;
    this.state.error.set('');

    try {
      await this.api.signInWithGoogle();
      await this.state.refresh();
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.state.error.set((error as Error).message);
    } finally {
      this.authBusy = false;
    }
  }
}
