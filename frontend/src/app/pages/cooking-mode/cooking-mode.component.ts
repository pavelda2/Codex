import { Component, OnInit, computed, inject, signal } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import {
  IngredientMatchInput,
  SequenceToken,
  matchIngredientsSequence,
} from '../../ingredient-matcher'
import { Ingredient, ParsedRecipe } from '../../recipe-parser'
import { RecipeStateService } from '../../recipe-state.service'

type CookingProgress = {
  stepIndex: number
  startedAt: string
}

type LookupIngredient = {
  key: string
  input: IngredientMatchInput
  ingredient: Ingredient
}

@Component({
  selector: 'app-cooking-mode',
  standalone: true,
  templateUrl: './cooking-mode.component.html',
  styleUrl: './cooking-mode.component.scss',
})
export class CookingModeComponent implements OnInit {
  readonly state = inject(RecipeStateService)
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)

  readonly stepIndex = signal(-1)
  readonly showIngredients = computed(() => this.stepIndex() < 0)
  readonly parsed = computed(() => this.state.selectedParsed())
  readonly steps = computed(() => this.parsed()?.steps ?? [])
  readonly stepCount = computed(() => this.steps().length)
  readonly currentStep = computed(() => {
    const index = this.stepIndex()
    if (index < 0) {
      return ''
    }

    return this.steps()[index] ?? ''
  })

  readonly ingredientLookup = computed(() => {
    const parsed = this.parsed()
    if (!parsed) {
      return [] as LookupIngredient[]
    }

    return parsed.ingredientSections.flatMap((section) =>
      section.items.map((ingredient) => ({
        key: ingredientKey(ingredient.name, ingredient.raw),
        input: {
          original: ingredient.raw,
          item: ingredient.name,
        },
        ingredient,
      }))
    )
  })

  readonly stepTokens = computed(() => {
    const stepText = this.currentStep()
    if (!stepText) {
      return [] as SequenceToken[]
    }

    const ingredients = this.ingredientLookup().map(({ input }) => input)
    return matchIngredientsSequence(ingredients, stepText)
  })

  readonly highlightedIngredients = computed(() => {
    const lookupByKey = new Map(this.ingredientLookup().map((entry) => [entry.key, entry.ingredient]))

    return this.stepTokens()
      .flatMap((token) => (token.type === 'ingredient' ? [token] : []))
      .map((token) => lookupByKey.get(ingredientKey(token.ingredient, token.original)))
      .filter((ingredient): ingredient is Ingredient => ingredient !== undefined)
      .filter((ingredient, index, all) => all.findIndex((item) => item.raw === ingredient.raw) === index)
  })

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

    const parsed = this.state.selectedParsed()
    if (!parsed) {
      await this.router.navigate(['/recipes', id])
      return
    }

    this.stepIndex.set(-1)

    const progress = this.readProgress(id, parsed)
    if (progress === null) {
      return
    }

    const continueFromSaved = window.confirm(`Pokračovat od kroku ${progress.stepIndex + 1}?`)
    if (continueFromSaved) {
      this.stepIndex.set(progress.stepIndex)
      return
    }

    this.clearProgress(id)
  }

  previousStep(): void {
    const nextIndex = this.stepIndex() - 1
    if (nextIndex < -1) {
      return
    }

    this.stepIndex.set(nextIndex)
    this.persistProgress()
  }

  nextStep(): void {
    if (this.showIngredients()) {
      this.stepIndex.set(0)
      this.persistProgress()
      return
    }

    const nextIndex = this.stepIndex() + 1
    if (nextIndex >= this.stepCount()) {
      this.stepIndex.set(this.stepCount() - 1)
      this.persistProgress()
      return
    }

    this.stepIndex.set(nextIndex)
    this.persistProgress()
  }

  async backToDetail(): Promise<void> {
    const id = this.state.selectedRecipeId()
    if (!id) {
      await this.router.navigateByUrl('/recipes')
      return
    }

    await this.router.navigate(['/recipes', id])
  }

  private persistProgress(): void {
    const recipeId = this.state.selectedRecipeId()
    if (!recipeId) {
      return
    }

    const stepIndex = this.stepIndex()
    if (stepIndex < 0) {
      this.clearProgress(recipeId)
      return
    }

    const progress: CookingProgress = {
      stepIndex,
      startedAt: new Date().toISOString(),
    }

    localStorage.setItem(progressKey(recipeId), JSON.stringify(progress))
  }

  private readProgress(recipeId: string, parsed: ParsedRecipe): CookingProgress | null {
    const saved = localStorage.getItem(progressKey(recipeId))
    if (!saved) {
      return null
    }

    try {
      const progress = JSON.parse(saved) as CookingProgress
      if (progress.stepIndex < 0 || progress.stepIndex >= parsed.steps.length) {
        this.clearProgress(recipeId)
        return null
      }

      return progress
    } catch {
      this.clearProgress(recipeId)
      return null
    }
  }

  private clearProgress(recipeId: string): void {
    localStorage.removeItem(progressKey(recipeId))
  }
}

function progressKey(recipeId: string): string {
  return `cooking-progress:${recipeId}`
}

function ingredientKey(name: string, original: string): string {
  return `${name}:::${original}`
}
