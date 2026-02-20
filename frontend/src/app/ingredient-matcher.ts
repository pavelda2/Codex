export type IngredientMatchInput = {
  original: string
  item: string
}

export type TextSequenceToken = {
  type: 'text'
  value: string
}

export type IngredientSequenceToken = {
  type: 'ingredient'
  value: string
  ingredient: string
  amount: string | null
  original: string
}

export type SequenceToken = TextSequenceToken | IngredientSequenceToken

type PreparedIngredient = IngredientMatchInput & {
  normalized: string
  stemmed: string
  amount: string | null
}

type WordToken = {
  value: string
  segmentIndex: number
}

type SegmentToken = {
  value: string
  isWord: boolean
}

type CandidateMatch = {
  ingredient: PreparedIngredient
  startWord: number
  endWord: number
  segmentStart: number
  segmentEnd: number
  score: number
}

const amountPattern = /^(\d+(?:[.,]\d+)?(?:\s*[-/]\s*\d+(?:[.,]\d+)?)?|\d+\/\d+)(?:\s*(?:kg|g|mg|ml|l|ks|stroužky?|stroužek|špetka|špetky|lžíce|lžička|hrnek|hrnky|balení))?/i
const maxNgramSize = 4
const threshold = 0.42

export function matchIngredientsSequence(ingredients: IngredientMatchInput[], stepsText: string): SequenceToken[] {
  if (!stepsText) {
    return []
  }

  const segments = splitSegments(stepsText)
  const words = collectWordTokens(segments)
  if (words.length === 0 || ingredients.length === 0) {
    return [{ type: 'text', value: stepsText }]
  }

  const prepared = ingredients
    .map(prepareIngredient)
    .filter((ingredient) => ingredient.normalized.length > 0)

  const matches = findMatches(words, prepared)
  return buildSequenceTokens(segments, matches)
}

function splitSegments(text: string): SegmentToken[] {
  const segments: SegmentToken[] = []
  let cursor = 0
  const wordRegex = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu

  for (const match of text.matchAll(wordRegex)) {
    const found = match[0]
    const start = match.index ?? 0
    if (start > cursor) {
      segments.push({ value: text.slice(cursor, start), isWord: false })
    }

    segments.push({ value: found, isWord: true })
    cursor = start + found.length
  }

  if (cursor < text.length) {
    segments.push({ value: text.slice(cursor), isWord: false })
  }

  return segments
}

function collectWordTokens(segments: SegmentToken[]): WordToken[] {
  return segments.flatMap((segment, segmentIndex) =>
    segment.isWord ? [{ value: segment.value, segmentIndex }] : []
  )
}

function prepareIngredient(ingredient: IngredientMatchInput): PreparedIngredient {
  return {
    ...ingredient,
    normalized: normalize(ingredient.item),
    stemmed: stemText(ingredient.item),
    amount: extractAmount(ingredient.original),
  }
}

function findMatches(words: WordToken[], ingredients: PreparedIngredient[]): CandidateMatch[] {
  const resolvedMatches: CandidateMatch[] = []

  let wordIndex = 0
  while (wordIndex < words.length) {
    const best = bestMatchAt(words, wordIndex, ingredients)
    if (!best) {
      wordIndex += 1
      continue
    }

    resolvedMatches.push(best)
    wordIndex = best.endWord + 1
  }

  return resolvedMatches
}

function bestMatchAt(words: WordToken[], startWord: number, ingredients: PreparedIngredient[]): CandidateMatch | null {
  const maxSize = Math.min(maxNgramSize, words.length - startWord)
  let best: CandidateMatch | null = null

  for (let size = maxSize; size >= 1; size -= 1) {
    const endWord = startWord + size - 1
    const phraseWords = words.slice(startWord, endWord + 1).map((word) => word.value)
    const normalized = normalize(phraseWords.join(' '))
    if (!normalized) {
      continue
    }

    const stemmed = stemText(phraseWords.join(' '))

    for (const ingredient of ingredients) {
      if (shouldSkipAmountLikePhrase(normalized, ingredient.normalized)) {
        continue
      }

      const score = fuzzyScore(normalized, stemmed, ingredient)
      if (score > threshold) {
        continue
      }

      const candidate: CandidateMatch = {
        ingredient,
        startWord,
        endWord,
        segmentStart: words[startWord].segmentIndex,
        segmentEnd: words[endWord].segmentIndex,
        score,
      }

      if (!best || isBetterMatch(candidate, best)) {
        best = candidate
      }
    }
  }

  return best
}

function shouldSkipAmountLikePhrase(phrase: string, ingredient: string): boolean {
  const phraseWords = phrase.split(' ').filter(Boolean)
  const ingredientWords = ingredient.split(' ').filter(Boolean)
  if (phraseWords.length <= ingredientWords.length) {
    return false
  }

  const hasNumber = phraseWords.some((word) => /\d/.test(word))
  return hasNumber
}

function fuzzyScore(normalized: string, stemmed: string, ingredient: PreparedIngredient): number {
  const normalizedDistance = normalizedLevenshtein(normalized, ingredient.normalized)
  const stemmedDistance = normalizedLevenshtein(stemmed, ingredient.stemmed)
  const combined = Math.min(normalizedDistance, stemmedDistance)

  if (normalized === ingredient.normalized || stemmed === ingredient.stemmed) {
    return combined * 0.6
  }

  return combined
}

function normalizedLevenshtein(source: string, target: string): number {
  if (source === target) {
    return 0
  }

  const longest = Math.max(source.length, target.length)
  if (longest === 0) {
    return 0
  }

  return levenshtein(source, target) / longest
}

function levenshtein(source: string, target: string): number {
  const matrix: number[][] = Array.from({ length: source.length + 1 }, () => Array<number>(target.length + 1).fill(0))

  for (let i = 0; i <= source.length; i += 1) {
    matrix[i][0] = i
  }

  for (let j = 0; j <= target.length; j += 1) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= source.length; i += 1) {
    for (let j = 1; j <= target.length; j += 1) {
      const substitutionCost = source[i - 1] === target[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + substitutionCost
      )
    }
  }

  return matrix[source.length][target.length]
}

function isBetterMatch(next: CandidateMatch, current: CandidateMatch): boolean {
  const nextLength = next.endWord - next.startWord
  const currentLength = current.endWord - current.startWord
  if (nextLength !== currentLength) {
    return nextLength > currentLength
  }

  return next.score < current.score
}

function buildSequenceTokens(segments: SegmentToken[], matches: CandidateMatch[]): SequenceToken[] {
  if (matches.length === 0) {
    return [{ type: 'text', value: segments.map((segment) => segment.value).join('') }]
  }

  const sequence: SequenceToken[] = []
  let cursor = 0

  for (const match of matches) {
    if (cursor < match.segmentStart) {
      const textPart = segments
        .slice(cursor, match.segmentStart)
        .map((segment) => segment.value)
        .join('')

      if (textPart) {
        sequence.push({ type: 'text', value: textPart })
      }
    }

    const value = segments
      .slice(match.segmentStart, match.segmentEnd + 1)
      .map((segment) => segment.value)
      .join('')

    sequence.push({
      type: 'ingredient',
      value,
      ingredient: match.ingredient.item,
      amount: match.ingredient.amount,
      original: match.ingredient.original,
    })

    cursor = match.segmentEnd + 1
  }

  if (cursor < segments.length) {
    const suffix = segments
      .slice(cursor)
      .map((segment) => segment.value)
      .join('')

    if (suffix) {
      sequence.push({ type: 'text', value: suffix })
    }
  }

  return sequence
}

function extractAmount(original: string): string | null {
  const trimmed = original.trim()
  const matched = trimmed.match(amountPattern)
  return matched?.[0]?.trim() ?? null
}

function stemText(value: string): string {
  return normalize(value)
    .split(' ')
    .filter(Boolean)
    .map(czechLikeStem)
    .join(' ')
}

function czechLikeStem(word: string): string {
  const suffixes = [
    'atech',
    'ětem',
    'atům',
    'ovat',
    'ového',
    'ovému',
    'ými',
    'ami',
    'emi',
    'ovi',
    'ové',
    'ého',
    'ému',
    'ách',
    'ích',
    'ami',
    'emi',
    'ou',
    'ům',
    'em',
    'ěm',
    'ům',
    'mi',
    'ce',
    'ci',
    'ku',
    'ka',
    'ky',
    'ek',
    'ice',
    'ici',
    'iku',
    'ika',
    'iky',
    'í',
    'y',
  ]

  for (const suffix of suffixes) {
    if (word.length <= 3) {
      return word
    }

    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      return word.slice(0, -suffix.length)
    }
  }

  return word
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
