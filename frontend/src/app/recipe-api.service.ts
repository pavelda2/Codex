import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';

export type Recipe = {
  id: number;
  raw_text: string;
  updated_at?: string;
};

const STORAGE_KEY = 'recipes.v1';

@Injectable({ providedIn: 'root' })
export class RecipeApiService {
  private readonly apiBase = environment.apiBase;
  private readonly useMockApi = environment.useMockApi;

  async listRecipes(): Promise<Recipe[]> {
    if (this.useMockApi) {
      return this.listMockRecipes();
    }

    const res = await fetch(`${this.apiBase}/recipes`);
    if (!res.ok) {
      throw new Error('Nepodařilo se načíst recepty.');
    }

    const body = (await res.json()) as { data: Recipe[] };
    return body.data;
  }

  async createRecipe(rawText: string): Promise<Recipe> {
    if (this.useMockApi) {
      return this.createMockRecipe(rawText);
    }

    const res = await fetch(`${this.apiBase}/recipes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText }),
    });

    if (!res.ok) {
      throw new Error('Uložení receptu selhalo.');
    }

    const body = (await res.json()) as { data: Recipe };
    return body.data;
  }

  private listMockRecipes(): Recipe[] {
    const items = this.loadMockStore();
    return items.sort((a, b) => (a.updated_at ?? '').localeCompare(b.updated_at ?? '')).reverse();
  }

  private createMockRecipe(rawText: string): Recipe {
    const items = this.loadMockStore();
    const nextId = items.length > 0 ? Math.max(...items.map((item) => item.id)) + 1 : 1;

    const recipe: Recipe = {
      id: nextId,
      raw_text: rawText.trim(),
      updated_at: new Date().toISOString(),
    };

    items.push(recipe);
    this.saveMockStore(items);

    return recipe;
  }

  private loadMockStore(): Recipe[] {
    if (typeof window === 'undefined') {
      return [];
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as Recipe[];
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter((item) => typeof item.id === 'number' && typeof item.raw_text === 'string');
    } catch {
      return [];
    }
  }

  private saveMockStore(items: Recipe[]): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}
