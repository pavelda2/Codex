import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RecipeApiService } from '../recipe-api.service';
import { RecipeStateService } from '../recipe-state.service';
import { RecipePreviewComponent } from '../components/recipe-preview/recipe-preview.component';

@Component({
  selector: 'app-recipe-detail-page',
  standalone: true,
  imports: [RecipePreviewComponent],
  template: `
    <section class="screen detail-screen">
      @if (state.selectedParsed()) {
        <div class="printable-recipe">
          <app-recipe-preview [parsed]="state.selectedParsed()" />
        </div>

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
