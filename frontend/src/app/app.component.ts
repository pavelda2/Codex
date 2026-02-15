import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ParsedRecipe, parseRecipe } from './recipe-parser';
import { Recipe, RecipeApiService } from './recipe-api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly api = inject(RecipeApiService);

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

  readonly recipes = signal<Recipe[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');

  readonly parsed = computed(() => parseRecipe(this.rawText()));

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  async saveRecipe(): Promise<void> {
    this.saving.set(true);
    this.error.set('');

    try {
      await this.api.createRecipe(this.rawText());
      await this.refresh();
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async loadRecipe(recipe: Recipe): Promise<void> {
    this.rawText.set(recipe.raw_text);
  }

  parsedFromRaw(rawText: string): ParsedRecipe {
    return parseRecipe(rawText);
  }

  private async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const data = await this.api.listRecipes();
      this.recipes.set(data);
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
}
