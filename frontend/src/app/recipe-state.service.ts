import { Injectable, computed, inject, signal } from '@angular/core'
import { ParsedRecipe, parseRecipe } from './recipe-parser'
import { Recipe, RecipeApiService } from './recipe-api.service'

type SearchSectionMatch = {
  label: string
  text: string
}

export type RecipeSearchResult = {
  recipe: Recipe
  titleHtml: string
  contentHtml: string
}

@Injectable({ providedIn: 'root' })
export class RecipeStateService {
  private readonly api = inject(RecipeApiService)

  readonly recipes = signal<Recipe[]>([])
  readonly selectedRecipeId = signal<string | null>(null)
  readonly rawText = signal('')
  readonly searchQuery = signal('')

  readonly loading = signal(false)
  readonly saving = signal(false)
  readonly deleting = signal(false)
  readonly error = signal('')

  readonly parsed = computed(() => parseRecipe(this.rawText()))

  readonly selectedRecipe = computed(() => {
    const id = this.selectedRecipeId()
    if (!id) {
      return null
    }

    return this.recipes().find((recipe) => recipe.id === id) ?? null
  })

  readonly selectedParsed = computed(() => {
    const recipe = this.selectedRecipe()
    return recipe ? parseRecipe(recipe.raw_text) : null
  })

  readonly searchResults = computed(() => {
    const query = this.searchQuery().trim()

    if (!query) {
      return [] as RecipeSearchResult[]
    }

    const queryTerms = tokenize(query)

    const matches = this.recipes().map((recipe) => {
      const parsed = parseRecipe(recipe.raw_text)
      const contentSections = collectSearchableSections(parsed)
      const titleMatch = scoreTextMatch(parsed.title, queryTerms)

      const contentScored = contentSections
        .map((section) => ({
          ...section,
          score: scoreTextMatch(section.text, queryTerms),
        }))
        .filter((section) => section.score > 0)
        .sort((left, right) => right.score - left.score)

      const totalScore = titleMatch > 0 ? titleMatch + 200 : contentScored[0]?.score ?? 0

      return {
        recipe,
        parsed,
        titleMatch,
        bestContent: contentScored[0],
        totalScore,
      }
    })

    return matches
      .filter((item) => item.totalScore > 0)
      .sort((left, right) => {
        if (left.titleMatch > 0 && right.titleMatch === 0) {
          return -1
        }

        if (left.titleMatch === 0 && right.titleMatch > 0) {
          return 1
        }

        return right.totalScore - left.totalScore
      })
      .map((item) => ({
        recipe: item.recipe,
        titleHtml: highlightText(item.parsed.title, queryTerms),
        contentHtml: item.bestContent
          ? `<span class="match-label">${item.bestContent.label}:</span> ${highlightText(item.bestContent.text, queryTerms)}`
          : '',
      }))
  })

  async refresh(): Promise<void> {
    this.loading.set(true)
    this.error.set('')

    try {
      const data = await this.api.listRecipes()
      this.recipes.set(data)

      const selectedId = this.selectedRecipeId()
      if (selectedId && !data.some((item) => item.id === selectedId)) {
        this.selectedRecipeId.set(null)
      }
    } catch (error) {
      this.error.set((error as Error).message)
    } finally {
      this.loading.set(false)
    }
  }

  openDetail(id: string): void {
    this.selectedRecipeId.set(id)
  }

  startAdd(): void {
    this.selectedRecipeId.set(null)
    this.rawText.set('')
    this.error.set('')
  }

  startEditSelected(): void {
    const recipe = this.selectedRecipe()
    if (!recipe) {
      return
    }

    this.selectedRecipeId.set(recipe.id)
    this.rawText.set(recipe.raw_text)
    this.error.set('')
  }

  async saveSelected(): Promise<boolean> {
    this.saving.set(true)
    this.error.set('')

    try {
      const recipeId = this.selectedRecipeId()

      if (recipeId) {
        await this.api.updateRecipe(recipeId, this.rawText())
      } else {
        await this.api.createRecipe(this.rawText())
      }

      await this.refresh()
      return true
    } catch (error) {
      this.error.set((error as Error).message)
      return false
    } finally {
      this.saving.set(false)
    }
  }

  async deleteSelected(): Promise<boolean> {
    const recipeId = this.selectedRecipeId()
    if (!recipeId) {
      return false
    }

    this.deleting.set(true)
    this.error.set('')

    try {
      await this.api.deleteRecipe(recipeId)
      this.selectedRecipeId.set(null)
      await this.refresh()
      return true
    } catch (error) {
      this.error.set((error as Error).message)
      return false
    } finally {
      this.deleting.set(false)
    }
  }

  print(): void {
    window.print()
  }

  parsedFromRaw(rawText: string): ParsedRecipe {
    return parseRecipe(rawText)
  }
}

function collectSearchableSections(parsed: ParsedRecipe): SearchSectionMatch[] {
  const ingredientSections = parsed.ingredientSections.flatMap((section) =>
    section.items.map((ingredient) => ({
      label: section.title,
      text: ingredient.raw,
    }))
  )

  const steps = parsed.steps.map((step, index) => ({
    label: `Krok ${index + 1}`,
    text: step,
  }))

  return [...ingredientSections, ...steps]
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((part) => part.length > 0)
}

function scoreTextMatch(text: string, queryTerms: string[]): number {
  if (queryTerms.length === 0) {
    return 0
  }

  const textLower = text.toLowerCase()
  const textTokens = tokenize(text)

  let totalScore = 0

  for (const term of queryTerms) {
    if (textLower.includes(term)) {
      totalScore += 10
      continue
    }

    const fuzzyHit = textTokens.some((token) => isFuzzyMatch(token, term))
    if (fuzzyHit) {
      totalScore += 6
    }
  }

  return totalScore
}

function isFuzzyMatch(token: string, term: string): boolean {
  if (!token || !term) {
    return false
  }

  const distance = levenshteinDistance(token, term)
  const maxLength = Math.max(token.length, term.length)

  if (maxLength <= 4) {
    return distance <= 1
  }

  return distance <= 2
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0
  }

  if (left.length === 0) {
    return right.length
  }

  if (right.length === 0) {
    return left.length
  }

  const previousRow = new Array(right.length + 1).fill(0)
  const currentRow = new Array(right.length + 1).fill(0)

  for (let index = 0; index <= right.length; index += 1) {
    previousRow[index] = index
  }

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    currentRow[0] = leftIndex

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      currentRow[rightIndex] = Math.min(
        currentRow[rightIndex - 1] + 1,
        previousRow[rightIndex] + 1,
        previousRow[rightIndex - 1] + substitutionCost
      )
    }

    for (let index = 0; index <= right.length; index += 1) {
      previousRow[index] = currentRow[index]
    }
  }

  return previousRow[right.length]
}

function highlightText(text: string, queryTerms: string[]): string {
  if (queryTerms.length === 0) {
    return escapeHtml(text)
  }

  const escapedText = escapeHtml(text)
  const uniqueTerms = Array.from(new Set(queryTerms)).sort((left, right) => right.length - left.length)
  let highlighted = escapedText

  for (const term of uniqueTerms) {
    if (!term) {
      continue
    }

    const regex = new RegExp(`(${escapeRegExp(term)})`, 'giu')
    highlighted = highlighted.replace(regex, '<mark>$1</mark>')
  }

  return highlighted
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
