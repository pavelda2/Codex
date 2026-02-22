import { Component, OnInit, inject, signal } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { RecipeApiService, RecipeImage } from '../../recipe-api.service'
import { RecipeStateService } from '../../recipe-state.service'
import { RecipePreviewComponent } from '../../components/recipe-preview/recipe-preview.component'

@Component({
  selector: 'app-recipe-detail',
  standalone: true,
  imports: [RecipePreviewComponent],
  templateUrl: './recipe-detail.component.html',
  styleUrl: './recipe-detail.component.scss',
})
export class RecipeDetailComponent implements OnInit {
  readonly state = inject(RecipeStateService)
  readonly api = inject(RecipeApiService)
  readonly images = signal<RecipeImage[]>([])
  readonly selectedImageId = signal<string | null>(null)
  readonly galleryOpen = signal(false)

  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')
    if (!id) {
      await this.router.navigateByUrl('/recipes')
      return
    }

    if (this.state.recipes().length === 0) {
      await this.state.refresh()
    }

    this.state.openDetail(id)
    await this.loadImages(id)
  }

  async edit(): Promise<void> {
    this.state.startEditSelected()
    const id = this.state.selectedRecipeId()
    if (id) {
      await this.router.navigate(['/recipes', id, 'edit'])
    }
  }

  async startCooking(): Promise<void> {
    const id = this.state.selectedRecipeId()
    if (id) {
      await this.router.navigate(['/recipes', id, 'cook'])
    }
  }

  async remove(): Promise<void> {
    const ok = await this.state.deleteSelected()
    if (ok) {
      await this.router.navigateByUrl('/recipes')
    }
  }

  selectImage(imageId: string): void {
    this.selectedImageId.set(imageId)
  }

  openGallery(imageId: string): void {
    this.selectedImageId.set(imageId)
    this.galleryOpen.set(true)
  }

  closeGallery(): void {
    this.galleryOpen.set(false)
  }

  activeImage(): RecipeImage | null {
    const selected = this.selectedImageId()
    const images = this.images()
    if (!selected) {
      return images[0] ?? null
    }

    return images.find((image) => image.id === selected) ?? images[0] ?? null
  }


  private pickPrimaryImageId(images: RecipeImage[], primaryImageId?: string): string | null {
    if (!primaryImageId) {
      return images[0]?.id ?? null
    }

    return images.find((image) => image.id === primaryImageId)?.id ?? images[0]?.id ?? null
  }

  private async loadImages(recipeId: string): Promise<void> {
    const recipe = this.state.recipes().find((item) => item.id === recipeId)
    const cached = recipe?.image_thumbs
      .map((thumb) => this.api.getCachedRecipeImage(recipeId, thumb.id))
      .filter((item): item is RecipeImage => item !== null)

    const recipePrimary = recipe?.primary_image_id

    if (cached && cached.length > 0) {
      this.images.set(cached)
      this.selectedImageId.set(this.pickPrimaryImageId(cached, recipePrimary))
    }

    const full = await this.api.listRecipeImages(recipeId)
    this.images.set(full)
    this.selectedImageId.set(this.pickPrimaryImageId(full, recipePrimary))
  }
}
