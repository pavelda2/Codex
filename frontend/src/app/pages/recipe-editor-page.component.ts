import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RecipeApiService } from '../recipe-api.service';
import { RecipeStateService } from '../recipe-state.service';

@Component({
  selector: 'app-recipe-editor-page',
  standalone: true,
  imports: [FormsModule],
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

      <article class="recipe-card preview-card">
        <h2>{{ state.parsed().title }}</h2>

        @for (section of state.parsed().ingredientSections; track section.title) {
          <div class="block">
            <h3>{{ section.title }}</h3>
            <ul>
              @for (item of section.items; track item) {
                <li>{{ item.amount ? item.amount + (item.unit ? ' ' + item.unit : '') + ' ' : '' }}{{ item.name }}</li>
              }
            </ul>
          </div>
        }

        @if (state.parsed().warnings.length) {
          <div class="block parser-warnings">
            <h3>Warnings</h3>
            <ul>
              @for (warning of state.parsed().warnings; track warning.message) {
                <li>{{ warning.message }}</li>
              }
            </ul>
          </div>
        }

        @if (state.parsed().steps.length) {
          <div class="block">
            <h3>Steps</h3>
            <ol>
              @for (step of state.parsed().steps; track step) {
                <li>{{ step }}</li>
              }
            </ol>
          </div>
        }
      </article>
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
