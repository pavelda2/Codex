import { Injectable, computed, inject, signal } from '@angular/core';
import { ParsedRecipe, parseRecipe } from './recipe-parser';
import { Recipe, RecipeApiService } from './recipe-api.service';

@Injectable({ providedIn: 'root' })
export class RecipeStateService {
  private readonly api = inject(RecipeApiService);

  readonly recipes = signal<Recipe[]>([]);
  readonly selectedRecipeId = signal<string | null>(null);
  readonly rawText = signal('');
  readonly searchQuery = signal('');

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly error = signal('');

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

  readonly searchResults = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();

    if (!query) {
      return [] as Recipe[];
    }

    return this.recipes().filter((recipe) => {
      const parsed = parseRecipe(recipe.raw_text);
      return parsed.title.toLowerCase().includes(query) || recipe.raw_text.toLowerCase().includes(query);
    });
  });

  async refresh(): Promise<void> {
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

  openDetail(id: string): void {
    this.selectedRecipeId.set(id);
  }

  startAdd(): void {
    this.selectedRecipeId.set(null);
    this.rawText.set('');
    this.error.set('');
  }

  startEditSelected(): void {
    const recipe = this.selectedRecipe();
    if (!recipe) {
      return;
    }

    this.selectedRecipeId.set(recipe.id);
    this.rawText.set(recipe.raw_text);
    this.error.set('');
  }

  async saveSelected(): Promise<boolean> {
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
      return true;
    } catch (error) {
      this.error.set((error as Error).message);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  async deleteSelected(): Promise<boolean> {
    const recipeId = this.selectedRecipeId();
    if (!recipeId) {
      return false;
    }

    this.deleting.set(true);
    this.error.set('');

    try {
      await this.api.deleteRecipe(recipeId);
      this.selectedRecipeId.set(null);
      await this.refresh();
      return true;
    } catch (error) {
      this.error.set((error as Error).message);
      return false;
    } finally {
      this.deleting.set(false);
    }
  }

  print(): void {
    window.print();
  }

  parsedFromRaw(rawText: string): ParsedRecipe {
    return parseRecipe(rawText);
  }
}
