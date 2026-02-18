import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RecipeApiService } from '../../recipe-api.service';
import { RecipeStateService } from '../../recipe-state.service';

@Component({
  selector: 'app-recipe-editor',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './recipe-editor.component.html',
  styleUrl: './recipe-editor.component.scss',
})
export class RecipeEditorComponent implements OnInit {
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
