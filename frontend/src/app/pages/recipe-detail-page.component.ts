import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RecipeApiService } from '../recipe-api.service';
import { RecipeStateService } from '../recipe-state.service';

@Component({
  selector: 'app-recipe-detail-page',
  standalone: true,
  template: `
    <section class="screen detail-screen">
      @if (state.selectedParsed()) {
        <article class="recipe-card printable-recipe">
          <h2>{{ state.selectedParsed()!.title }}</h2>

          @for (section of state.selectedParsed()!.ingredientSections; track section.title) {
            <div class="block">
              <h3>{{ section.title }}</h3>
              <ul>
                @for (item of section.items; track item) {
                  <li>{{ item.amount ? item.amount + (item.unit ? ' ' + item.unit : '') + ' ' : '' }}{{ item.name }}</li>
                }
              </ul>
            </div>
          }

          @if (state.selectedParsed()!.steps.length) {
            <div class="block">
              <h3>Steps</h3>
              <ol>
                @for (step of state.selectedParsed()!.steps; track step) {
                  <li>{{ step }}</li>
                }
              </ol>
            </div>
          }
        </article>

        <div class="detail-actions no-print">
          <button type="button" class="ghost" (click)="edit()" [disabled]="!api.canWrite()">Edit</button>
          <button type="button" class="danger" (click)="remove()" [disabled]="!api.canWrite() || state.deleting()">
            {{ state.deleting() ? 'Deleting' : 'Delete' }}
          </button>
          <button type="button" class="ghost" (click)="state.print()">Print</button>
        </div>
      } @else {
        <p>Recipe not found</p>
      }
    </section>
  `,
})
export class RecipeDetailPageComponent implements OnInit {
  readonly state = inject(RecipeStateService);
  readonly api = inject(RecipeApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      await this.router.navigateByUrl('/recipes');
      return;
    }

    if (this.state.recipes().length === 0) {
      await this.state.refresh();
    }

    this.state.openDetail(id);
  }

  async edit(): Promise<void> {
    this.state.startEditSelected();
    const id = this.state.selectedRecipeId();
    if (id) {
      await this.router.navigate(['/recipes', id, 'edit']);
    }
  }

  async remove(): Promise<void> {
    const ok = await this.state.deleteSelected();
    if (ok) {
      await this.router.navigateByUrl('/recipes');
    }
  }
}
