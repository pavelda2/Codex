import { Component, OnInit, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { RecipeImageThumb } from '../../recipe-api.service'
import { RecipeStateService } from '../../recipe-state.service'

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  readonly state = inject(RecipeStateService)
  private readonly router = inject(Router)

  async ngOnInit(): Promise<void> {
    if (this.state.recipes().length === 0) {
      await this.state.refresh()
    }
  }

  async open(id: string): Promise<void> {
    this.state.openDetail(id)
    await this.router.navigate(['/recipes', id])
  }

  firstThumb(thumbs: RecipeImageThumb[]): string | null {
    return thumbs[0]?.data_url ?? null
  }
}
