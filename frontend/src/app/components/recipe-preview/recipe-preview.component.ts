import { Component, input } from '@angular/core';
import { ParsedRecipe } from '../../recipe-parser';

@Component({
  selector: 'app-recipe-preview',
  standalone: true,
  templateUrl: './recipe-preview.component.html',
  styleUrl: './recipe-preview.component.scss',
})
export class RecipePreviewComponent {
  readonly parsed = input<ParsedRecipe | null>(null);
  readonly showWarnings = input(false);
}
