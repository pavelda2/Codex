import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { RecipeApiService } from './recipe-api.service';
import { RecipeStateService } from './recipe-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly router = inject(Router);
  private readonly api = inject(RecipeApiService);
  readonly state = inject(RecipeStateService);

  readonly user = this.api.user;
  readonly authLoading = this.api.authLoading;
  readonly canWrite = this.api.canWrite;

  readonly authBusy = signal(false);

  constructor() {
    effect(() => {
      if (!this.authLoading() && !this.user()) {
        void this.router.navigateByUrl('/login');
      }
    });
  }

  async signOut(): Promise<void> {
    this.authBusy.set(true);
    this.state.error.set('');

    try {
      await this.api.signOut();
      this.state.selectedRecipeId.set(null);
      this.state.recipes.set([]);
      await this.router.navigateByUrl('/login');
    } catch (error) {
      this.state.error.set((error as Error).message);
    } finally {
      this.authBusy.set(false);
    }
  }

  startAdd(): void {
    this.state.startAdd();
  }
}
