import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RecipeStateService } from '../../recipe-state.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  readonly state = inject(RecipeStateService);
}
