import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RecipeApiService } from '../../recipe-api.service';
import { RecipeStateService } from '../../recipe-state.service';
import { RecipePreviewComponent } from '../../components/recipe-preview/recipe-preview.component';

@Component({
  selector: 'app-recipe-detail',
  standalone: true,
  imports: [RecipePreviewComponent],
  templateUrl: './recipe-detail.component.html',
  styleUrl: './recipe-detail.component.scss',
})
export class RecipeDetailComponent implements OnInit {
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
