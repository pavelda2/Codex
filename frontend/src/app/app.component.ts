import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ParsedRecipe, parseRecipe } from './recipe-parser';
import { Recipe, RecipeApiService } from './recipe-api.service';

type Page = 'home' | 'list' | 'detail' | 'editor';

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

  readonly page = signal<Page>('home');
  readonly searchQuery = signal('');

  readonly rawText = signal('');
  readonly selectedRecipeId = signal<string | null>(null);

  readonly recipes = signal<Recipe[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly authBusy = signal(false);
  readonly error = signal('');

  readonly isEditing = computed(() => this.selectedRecipeId() !== null);
  readonly parsed = computed(() => parseRecipe(this.rawText()));

  readonly selectedRecipe = computed(() => {
    const id = this.selectedRecipeId();
    if (!id) {
      return null;
    }

    return this.recipes().find((recipe) => recipe.id === id) ?? null;
  });

  readonly selectedParsed = computed(() => {
    const recipe = this.selectedRecipe();
    return recipe ? parseRecipe(recipe.raw_text) : null;
  });

  readonly filteredRecipes = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const items = this.recipes();

    if (!query) {
      return items;
    }

    return items.filter((recipe) => {
      const parsed = parseRecipe(recipe.raw_text);
      return parsed.title.toLowerCase().includes(query) || recipe.raw_text.toLowerCase().includes(query);
    });
  });

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
      this.goTo('home');
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
      this.page.set('home');
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.authBusy.set(false);
    }
  }

  goTo(nextPage: Page): void {
    this.page.set(nextPage);
  }

  openDetail(recipe: Recipe): void {
    this.selectedRecipeId.set(recipe.id);
    this.page.set('detail');
  }

  openAddRecipe(): void {
    this.selectedRecipeId.set(null);
    this.rawText.set('');
    this.page.set('editor');
  }

  openEditSelected(): void {
    const recipe = this.selectedRecipe();
    if (!recipe) {
      return;
    }

    this.selectedRecipeId.set(recipe.id);
    this.rawText.set(recipe.raw_text);
    this.page.set('editor');
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
      this.page.set('list');
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.saving.set(false);
    }
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
      await this.refresh();
      this.page.set('list');
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.deleting.set(false);
    }
  }

  parsedFromRaw(rawText: string): ParsedRecipe {
    return parseRecipe(rawText);
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
        if (this.page() === 'detail') {
          this.page.set('list');
        }
      }
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
}
