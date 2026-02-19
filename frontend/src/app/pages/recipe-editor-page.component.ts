import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RecipeApiService } from '../recipe-api.service';
import { RecipeStateService } from '../recipe-state.service';
import { RecipePreviewComponent } from '../components/recipe-preview/recipe-preview.component';

@Component({
  selector: 'app-recipe-editor-page',
  standalone: true,
  imports: [FormsModule, RecipePreviewComponent],
  template: `
    <section class="screen editor-screen">
      <textarea
        [ngModel]="state.rawText()"
        (ngModelChange)="state.rawText.set($event)"
        rows="16"
        placeholder="Recipe"
        [disabled]="!api.canWrite()"
      ></textarea>

      <div class="editor-actions">
        <button type="button" (click)="save()" [disabled]="state.saving() || !api.canWrite()">
          {{ state.saving() ? 'Saving' : 'Save' }}
        </button>
      </div>

      <div class="preview-card">
        <app-recipe-preview [parsed]="state.parsed()" [showWarnings]="true" />
      </div>
    </section>
  `,
})
export class RecipeEditorPageComponent implements OnInit {
  readonly state = inject(RecipeStateService);
  readonly api = inject(RecipeApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.state.startAdd();
      return;
    }

    if (this.state.recipes().length === 0) {
      await this.state.refresh();
    }

    this.state.openDetail(id);
    this.state.startEditSelected();
  }

  async save(): Promise<void> {
    const ok = await this.state.saveSelected();
    if (ok) {
      await this.router.navigateByUrl('/recipes');
    }
  }
}
