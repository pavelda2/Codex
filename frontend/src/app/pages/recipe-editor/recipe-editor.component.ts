import { Component, OnInit, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { RecipeApiService, RecipeImage } from '../../recipe-api.service'
import { RecipeStateService } from '../../recipe-state.service'
import { RecipePreviewComponent } from '../../components/recipe-preview/recipe-preview.component'
import { processRecipeImageFile } from '../../image-processing'

type EditableImage = {
  id: string
  thumbDataUrl: string
  fullDataUrl: string
  mimeType: string
  width: number
  height: number
}

type EditorTab = 'content' | 'images'

@Component({
  selector: 'app-recipe-editor',
  standalone: true,
  imports: [FormsModule, RecipePreviewComponent],
  templateUrl: './recipe-editor.component.html',
  styleUrl: './recipe-editor.component.scss',
})
export class RecipeEditorComponent implements OnInit {
  readonly state = inject(RecipeStateService)
  readonly api = inject(RecipeApiService)
  readonly images = signal<EditableImage[]>([])
  readonly activeTab = signal<EditorTab>('content')
  readonly primaryImageId = signal<string | null>(null)

  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')

    if (!id) {
      this.state.startAdd()
      return
    }

    if (this.state.recipes().length === 0) {
      await this.state.refresh()
    }

    this.state.openDetail(id)
    this.state.startEditSelected()
    await this.loadImages(id)
  }

  setTab(tab: EditorTab): void {
    this.activeTab.set(tab)
  }

  setPrimaryImage(imageId: string): void {
    this.primaryImageId.set(imageId)
  }

  isPrimaryImage(imageId: string): boolean {
    return this.primaryImageId() === imageId
  }

  async save(): Promise<void> {
    const recipeId = await this.state.saveSelected()
    if (!recipeId) {
      return
    }

    try {
      await this.syncImages(recipeId)
      await this.state.refresh()
      await this.router.navigateByUrl('/recipes')
    } catch (error) {
      this.state.error.set((error as Error).message)
    }
  }

  async addImages(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const files = Array.from(input.files ?? [])

    for (const file of files) {
      const processed = await processRecipeImageFile(file)
      this.images.update((current) => [
        ...current,
        {
          id: processed.id,
          thumbDataUrl: processed.thumbDataUrl,
          fullDataUrl: processed.fullDataUrl,
          mimeType: processed.mimeType,
          width: processed.width,
          height: processed.height,
        },
      ])

      if (!this.primaryImageId()) {
        this.primaryImageId.set(processed.id)
      }
    }

    input.value = ''
  }

  async replaceImage(imageId: string, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) {
      return
    }

    const processed = await processRecipeImageFile(file)
    this.images.update((current) =>
      current.map((image) =>
        image.id === imageId
          ? {
              ...image,
              thumbDataUrl: processed.thumbDataUrl,
              fullDataUrl: processed.fullDataUrl,
              mimeType: processed.mimeType,
              width: processed.width,
              height: processed.height,
            }
          : image,
      ),
    )

    input.value = ''
  }

  removeImage(imageId: string): void {
    this.images.update((current) => current.filter((image) => image.id !== imageId))

    if (this.primaryImageId() !== imageId) {
      return
    }

    const nextPrimary = this.images()[0]?.id ?? null
    this.primaryImageId.set(nextPrimary)
  }

  private async loadImages(recipeId: string): Promise<void> {
    const recipeImages = await this.api.listRecipeImages(recipeId)
    this.images.set(recipeImages.map((image) => this.fromApiImage(image)))

    const recipe = this.state.recipes().find((item) => item.id === recipeId)
    const primary = recipe?.primary_image_id
    const hasPrimary = primary ? recipeImages.some((item) => item.id === primary) : false
    this.primaryImageId.set(hasPrimary ? primary ?? null : recipeImages[0]?.id ?? null)
  }

  private fromApiImage(image: RecipeImage): EditableImage {
    return {
      id: image.id,
      thumbDataUrl: image.data_url,
      fullDataUrl: image.full_data_url,
      mimeType: image.mime_type,
      width: image.width,
      height: image.height,
    }
  }

  private async syncImages(recipeId: string): Promise<void> {
    const existing = await this.api.listRecipeImages(recipeId)
    const keepIds = new Set(this.images().map((image) => image.id))

    for (const image of existing) {
      if (!keepIds.has(image.id)) {
        await this.api.deleteRecipeImage(recipeId, image.id)
      }
    }

    for (const image of this.images()) {
      await this.api.upsertRecipeImage(recipeId, {
        id: image.id,
        data_url: image.thumbDataUrl,
        full_data_url: image.fullDataUrl,
        mime_type: image.mimeType,
        width: image.width,
        height: image.height,
      })
    }

    const validPrimary = this.primaryImageId() && keepIds.has(this.primaryImageId() ?? '') ? this.primaryImageId() : null

    await this.api.saveRecipeImageMeta(
      recipeId,
      this.images().map((image) => ({
        id: image.id,
        data_url: image.thumbDataUrl,
      })),
      validPrimary,
    )
  }
}
