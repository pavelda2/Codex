import { Injectable, computed, inject, signal } from '@angular/core'
import { ParsedRecipe, parseRecipe } from './recipe-parser'
import { Recipe, RecipeApiService } from './recipe-api.service'

type HighlightPart = {
  text: string
  highlighted: boolean
}

type MatchRanges = {
  exact: Array<[number, number]>
  fuzzy: Array<[number, number]>
}

export type RecipeSearchResult = {
  recipe: Recipe
  titleParts: HighlightPart[]
  contentLabel: string
  contentParts: HighlightPart[]
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
    const normalizedQuery = normalizeForSearch(query)

    if (!normalizedQuery) {
      return [] as RecipeSearchResult[]
    }

    return this.recipes()
      .map((recipe) => buildSearchResult(recipe, normalizedQuery))
      .filter((result) => result.rank > Number.NEGATIVE_INFINITY)
      .sort((left, right) => right.rank - left.rank)
      .map(({ rank, ...result }) => result)
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

  async saveSelected(): Promise<string | null> {
    this.saving.set(true)
    this.error.set('')

    try {
      const recipeId = this.selectedRecipeId()

      if (recipeId) {
        await this.api.updateRecipe(recipeId, this.rawText())
        await this.refresh()
        return recipeId
      }

      const created = await this.api.createRecipe(this.rawText())
      this.selectedRecipeId.set(created.id)
      await this.refresh()
      return created.id
    } catch (error) {
      this.error.set((error as Error).message)
      return null
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

function buildSearchResult(recipe: Recipe, normalizedQuery: string): RecipeSearchResult & { rank: number } {
  const parsed = parseRecipe(recipe.raw_text)
  const title = parsed.title.trim() || 'Untitled recipe'
  const titleRanges = collectMatchRanges(title, normalizedQuery)
  const contentSource = recipe.raw_text.replace(title, '').trim()
  const content = contentSource || recipe.raw_text
  const contentRanges = collectMatchRanges(content, normalizedQuery)

  const hasTitleMatch = titleRanges.exact.length > 0 || titleRanges.fuzzy.length > 0
  const hasContentMatch = contentRanges.exact.length > 0 || contentRanges.fuzzy.length > 0

  if (!hasTitleMatch && !hasContentMatch) {
    return {
      recipe,
      titleParts: [{ text: title, highlighted: false }],
      contentLabel: '',
      contentParts: [],
      rank: Number.NEGATIVE_INFINITY,
    }
  }

  const titleParts = rangesToParts(title, [...titleRanges.exact, ...titleRanges.fuzzy])
  const contentParts = buildContentParts(content, contentRanges)

  const titleScore = titleRanges.exact.length * 100 + titleRanges.fuzzy.length * 40
  const contentScore = contentRanges.exact.length * 10 + contentRanges.fuzzy.length * 4

  return {
    recipe,
    titleParts,
    contentLabel: hasContentMatch ? 'Recipe content' : '',
    contentParts: hasContentMatch ? contentParts : [],
    rank: titleScore + contentScore,
  }
}

function buildContentParts(content: string, ranges: MatchRanges): HighlightPart[] {
  const merged = mergeRanges([...ranges.exact, ...ranges.fuzzy])
  if (merged.length === 0) {
    return rangesToParts(content.slice(0, 90), [])
  }

  const [start, end] = merged[0]
  const previewStart = Math.max(0, start - 30)
  const previewEnd = Math.min(content.length, end + 50)
  const preview = content.slice(previewStart, previewEnd)
  const offsetRanges = merged
    .filter(([rangeStart]) => rangeStart < previewEnd)
    .map(([rangeStart, rangeEnd]) => [Math.max(0, rangeStart - previewStart), Math.min(preview.length, rangeEnd - previewStart)] as [number, number])
    .filter(([rangeStart, rangeEnd]) => rangeStart < rangeEnd)

  const parts = rangesToParts(preview, offsetRanges)
  if (previewStart > 0) {
    parts.unshift({ text: '…', highlighted: false })
  }
  if (previewEnd < content.length) {
    parts.push({ text: '…', highlighted: false })
  }

  return parts
}

function collectMatchRanges(text: string, normalizedQuery: string): MatchRanges {
  const exactRanges = findExactRanges(text, normalizedQuery)
  const fuzzyRanges = findFuzzyWordRanges(text, normalizedQuery, exactRanges)
  return { exact: exactRanges, fuzzy: fuzzyRanges }
}

function findExactRanges(text: string, normalizedQuery: string): Array<[number, number]> {
  if (!text || !normalizedQuery) {
    return []
  }

  const { normalized, indexMap } = mapNormalizedToOriginal(text)
  const ranges: Array<[number, number]> = []
  let searchIndex = 0

  while (searchIndex < normalized.length) {
    const matchIndex = normalized.indexOf(normalizedQuery, searchIndex)
    if (matchIndex < 0) {
      break
    }

    const start = indexMap[matchIndex]
    const endTokenIndex = matchIndex + normalizedQuery.length - 1
    const end = (indexMap[endTokenIndex] ?? start) + 1
    ranges.push([start, end])
    searchIndex = matchIndex + Math.max(1, normalizedQuery.length)
  }

  return mergeRanges(ranges)
}

function findFuzzyWordRanges(text: string, normalizedQuery: string, exactRanges: Array<[number, number]>): Array<[number, number]> {
  if (!text || !normalizedQuery) {
    return []
  }

  const words = Array.from(text.matchAll(/\p{L}[\p{L}\p{N}'-]*/gu))
  const maxDistance = Math.max(1, Math.floor(normalizedQuery.length * 0.34))

  return mergeRanges(
    words
      .map((word) => {
        const start = word.index ?? 0
        const value = word[0]
        const end = start + value.length
        const normalizedWord = normalizeForSearch(value)

        if (!normalizedWord || normalizedWord.includes(normalizedQuery)) {
          return null
        }

        if (isRangeCovered([start, end], exactRanges)) {
          return null
        }

        const distance = levenshtein(normalizedWord, normalizedQuery)
        return distance <= maxDistance ? ([start, end] as [number, number]) : null
      })
      .filter((range): range is [number, number] => range !== null),
  )
}

function rangesToParts(text: string, ranges: Array<[number, number]>): HighlightPart[] {
  const merged = mergeRanges(ranges)
  if (merged.length === 0) {
    return [{ text, highlighted: false }]
  }

  const parts: HighlightPart[] = []
  let cursor = 0

  for (const [start, end] of merged) {
    if (start > cursor) {
      parts.push({ text: text.slice(cursor, start), highlighted: false })
    }
    parts.push({ text: text.slice(start, end), highlighted: true })
    cursor = end
  }

  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), highlighted: false })
  }

  return parts.filter((part) => part.text.length > 0)
}

function mergeRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  if (ranges.length === 0) {
    return []
  }

  const sorted = [...ranges].sort((left, right) => left[0] - right[0])
  const merged: Array<[number, number]> = []

  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1]
    if (!last || start > last[1]) {
      merged.push([start, end])
      continue
    }

    last[1] = Math.max(last[1], end)
  }

  return merged
}

function isRangeCovered(range: [number, number], ranges: Array<[number, number]>): boolean {
  return ranges.some(([start, end]) => range[0] >= start && range[1] <= end)
}

function mapNormalizedToOriginal(text: string): { normalized: string; indexMap: number[] } {
  const normalizedChars: string[] = []
  const indexMap: number[] = []

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const folded = foldChar(char)
    for (const token of folded) {
      normalizedChars.push(token)
      indexMap.push(index)
    }
  }

  return {
    normalized: normalizedChars.join(''),
    indexMap,
  }
}

function normalizeForSearch(value: string): string {
  return Array.from(value)
    .flatMap((char) => foldChar(char))
    .join('')
}

function foldChar(char: string): string[] {
  return Array.from(char.normalize('NFD').toLowerCase()).filter((token) => !/\p{Mark}/u.test(token))
}

function levenshtein(source: string, target: string): number {
  if (source === target) {
    return 0
  }
  if (source.length === 0) {
    return target.length
  }
  if (target.length === 0) {
    return source.length
  }

  const previous = Array.from({ length: target.length + 1 }, (_, index) => index)

  for (let row = 1; row <= source.length; row += 1) {
    let current = row
    for (let column = 1; column <= target.length; column += 1) {
      const substitutionCost = source[row - 1] === target[column - 1] ? 0 : 1
      const insertion = current + 1
      const deletion = previous[column] + 1
      const substitution = previous[column - 1] + substitutionCost
      const next = Math.min(insertion, deletion, substitution)
      previous[column - 1] = current
      current = next
    }
    previous[target.length] = current
  }

  return previous[target.length]
}
