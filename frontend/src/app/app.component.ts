import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ParsedRecipe, parseRecipe } from './recipe-parser';
import { Recipe, RecipeApiService } from './recipe-api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly api = inject(RecipeApiService);

  readonly user = this.api.user;
  readonly authLoading = this.api.authLoading;
  readonly canWrite = this.api.canWrite;

  readonly rawText = signal(`# Rajčatové těstoviny
Ingredience:
Na omáčku:
- 400 g rajčat
- 2 stroužky česneku
Na těstoviny:
- 250 g špaget

Postup:
1. Uvař těstoviny dle návodu.
2. Rajčata podus s česnekem.
3. Smíchej a podávej.`);

  readonly selectedRecipeId = signal<string | null>(null);
  readonly recipes = signal<Recipe[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly authBusy = signal(false);
  readonly previewVisible = signal(true);
  readonly error = signal('');

  readonly isEditing = computed(() => this.selectedRecipeId() !== null);
  readonly parsed = computed(() => parseRecipe(this.rawText()));

  async ngOnInit(): Promise<void> {
    const waitForAuth = new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (!this.authLoading()) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });

    await waitForAuth;

    if (this.user()) {
      await this.refresh();
    }
  }

  async signIn(): Promise<void> {
    this.authBusy.set(true);
    this.error.set('');

    try {
      await this.api.signInWithGoogle();
      await this.refresh();
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.authBusy.set(false);
    }
  }

  async signOut(): Promise<void> {
    this.authBusy.set(true);
    this.error.set('');

    try {
      await this.api.signOut();
      this.selectedRecipeId.set(null);
      this.recipes.set([]);
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.authBusy.set(false);
    }
  }

  async saveRecipe(): Promise<void> {
    this.saving.set(true);
    this.error.set('');

    try {
      const recipeId = this.selectedRecipeId();

      if (recipeId) {
        await this.api.updateRecipe(recipeId, this.rawText());
      } else {
        await this.api.createRecipe(this.rawText());
      }

      await this.refresh();
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  loadRecipe(recipe: Recipe): void {
    this.selectedRecipeId.set(recipe.id);
    this.rawText.set(recipe.raw_text);
  }

  startNewRecipe(): void {
    this.selectedRecipeId.set(null);
    this.rawText.set('');
    this.error.set('');
  }

  async deleteSelectedRecipe(): Promise<void> {
    const recipeId = this.selectedRecipeId();
    if (!recipeId) {
      return;
    }

    this.deleting.set(true);
    this.error.set('');

    try {
      await this.api.deleteRecipe(recipeId);
      this.selectedRecipeId.set(null);
      this.rawText.set('');
      await this.refresh();
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.deleting.set(false);
    }
  }

  parsedFromRaw(rawText: string): ParsedRecipe {
    return parseRecipe(rawText);
  }

  togglePreview(): void {
    this.previewVisible.update((visible) => !visible);
  }

  printRecipe(): void {
    window.print();
  }

  private async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const data = await this.api.listRecipes();
      this.recipes.set(data);

      const selectedId = this.selectedRecipeId();
      if (selectedId && !data.some((item) => item.id === selectedId)) {
        this.selectedRecipeId.set(null);
      }
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
}
