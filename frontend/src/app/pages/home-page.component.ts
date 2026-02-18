import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RecipeStateService } from '../recipe-state.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="screen home-screen">
      <div class="search-wrap">
        <input
          type="search"
          placeholder="Search recipes"
          [ngModel]="state.searchQuery()"
          (ngModelChange)="state.searchQuery.set($event)"
        />
      </div>
    </section>
  `,
})
export class HomePageComponent {
  readonly state = inject(RecipeStateService);
}
