import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RecipeStateService } from '../recipe-state.service';

@Component({
  selector: 'app-recipe-list-page',
  standalone: true,
  template: `
    <section class="screen list-screen">
      @if (state.loading()) {
        <p>Loading</p>
      } @else if (state.filteredRecipes().length === 0) {
        <p>No recipes</p>
      } @else {
        <ul class="recipe-list">
          @for (recipe of state.filteredRecipes(); track recipe.id) {
            <li>
              <button type="button" class="recipe-item" (click)="open(recipe.id)">
                {{ state.parsedFromRaw(recipe.raw_text).title }}
              </button>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class RecipeListPageComponent implements OnInit {
  readonly state = inject(RecipeStateService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    if (this.state.recipes().length === 0) {
      await this.state.refresh();
    }
  }

  async open(id: string): Promise<void> {
    this.state.openDetail(id);
    await this.router.navigate(['/recipes', id]);
  }
}
