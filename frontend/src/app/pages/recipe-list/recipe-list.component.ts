import { Component, OnInit, inject } from '@angular/core'
import { Router } from '@angular/router'
import { RecipeImageThumb } from '../../recipe-api.service'
import { RecipeStateService } from '../../recipe-state.service'

@Component({
  selector: 'app-recipe-list',
  standalone: true,
  templateUrl: './recipe-list.component.html',
  styleUrl: './recipe-list.component.scss',
})
export class RecipeListComponent implements OnInit {
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
