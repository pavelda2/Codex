import { Component, OnInit, computed, inject, signal } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { RecipeApiService, RecipeImage } from '../../recipe-api.service'
import { RecipeStateService } from '../../recipe-state.service'
import { Ingredient } from '../../recipe-parser'

type PortionPreset = '1x' | '2x' | '3x' | 'custom'

type QuickFact = {
  icon: string
  label: string
  value: string
}

@Component({
  selector: 'app-recipe-detail',
  standalone: true,
  templateUrl: './recipe-detail.component.html',
  styleUrl: './recipe-detail.component.scss',
})
export class RecipeDetailComponent implements OnInit {
  readonly state = inject(RecipeStateService)
  readonly api = inject(RecipeApiService)
  readonly images = signal<RecipeImage[]>([])
  readonly selectedImageId = signal<string | null>(null)
  readonly galleryOpen = signal(false)
  readonly portionPreset = signal<PortionPreset>('1x')
  readonly customMultiplier = signal('1')

  readonly subtitle = computed(() => {
    const recipe = this.state.selectedParsed()
    if (!recipe) {
      return ''
    }

    return `${recipe.ingredientSections.length} ingredient sections • ${recipe.steps.length} cooking steps`
  })

  readonly ingredientMultiplier = computed(() => {
    const preset = this.portionPreset()
    if (preset !== 'custom') {
      return Number.parseInt(preset, 10)
    }

    const parsed = Number.parseFloat(this.customMultiplier().replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 1
    }

    return Math.min(parsed, 12)
  })

  readonly quickFacts = computed<QuickFact[]>(() => {
    const recipe = this.state.selectedParsed()
    if (!recipe) {
      return []
    }

    const ingredientCount = recipe.ingredientSections.reduce((total, section) => total + section.items.length, 0)
    const estimatedMinutes = Math.max(15, recipe.steps.length * 8 + ingredientCount * 2)
    const calories = Math.round((240 + ingredientCount * 45) * this.ingredientMultiplier())

    return [
      { icon: 'icon-time', label: 'Time', value: `${estimatedMinutes} min` },
      {
        icon: 'icon-difficulty',
        label: 'Difficulty',
        value: recipe.steps.length > 7 ? 'Advanced' : recipe.steps.length > 4 ? 'Medium' : 'Easy',
      },
      { icon: 'icon-servings', label: 'Servings', value: `${Math.max(2, Math.ceil((ingredientCount / 4) * this.ingredientMultiplier()))}` },
      { icon: 'icon-calories', label: 'Calories', value: `${calories} kcal` },
    ]
  })

  readonly recipeTags = computed(() => {
    const recipe = this.state.selectedParsed()
    if (!recipe) {
      return []
    }

    const allText = [
      recipe.title,
      ...recipe.ingredientSections.flatMap((section) => section.items.map((item) => item.raw)),
      ...recipe.steps,
    ]
      .join(' ')
      .toLowerCase()

    return [
      this.hasAny(allText, ['vegan', 'tofu', 'lentils', 'chickpea']) ? 'vegan' : '',
      this.quickFacts().find((fact) => fact.label === 'Time')?.value.includes('min') && Number.parseInt(this.quickFacts()[0]?.value ?? '0', 10) <= 30
        ? 'quick'
        : '',
      this.hasAny(allText, ['gluten free', 'bez lepku']) ? 'gluten-free' : '',
      this.hasAny(allText, ['knedl', 'paprika', 'guláš']) ? 'Czech cuisine' : '',
      this.quickFacts().find((fact) => fact.label === 'Difficulty')?.value === 'Easy' ? 'beginner-friendly' : '',
    ].filter(Boolean)
  })

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

  setPortionPreset(preset: PortionPreset): void {
    this.portionPreset.set(preset)
  }

  updateCustomMultiplier(value: string): void {
    this.customMultiplier.set(value)
    this.portionPreset.set('custom')
  }

  ingredientAmountLabel(item: Ingredient): string {
    if (!item.amount) {
      return ''
    }

    const scaledAmount = scaleAmountText(item.amount, this.ingredientMultiplier())
    return `${scaledAmount}${item.unit ? ` ${item.unit}` : ''}`
  }

  async shareRecipe(): Promise<void> {
    const recipe = this.state.selectedParsed()
    if (!recipe) {
      return
    }

    if (navigator.share) {
      await navigator.share({
        title: recipe.title,
        text: this.subtitle(),
        url: window.location.href,
      })
      return
    }

    await navigator.clipboard.writeText(window.location.href)
  }

  bookmarkRecipe(): void {
    const recipeId = this.state.selectedRecipeId()
    if (!recipeId) {
      return
    }

    localStorage.setItem(`recipe-bookmark:${recipeId}`, new Date().toISOString())
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

  private hasAny(text: string, terms: string[]): boolean {
    return terms.some((term) => text.includes(term))
  }
}

function scaleAmountText(amount: string, multiplier: number): string {
  if (multiplier === 1) {
    return amount
  }

  return amount.replace(/\d+(?:[.,]\d+)?/g, (chunk) => {
    const parsed = Number.parseFloat(chunk.replace(',', '.'))
    if (!Number.isFinite(parsed)) {
      return chunk
    }

    return trimFloat(parsed * multiplier)
  })
}

function trimFloat(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '')
}
