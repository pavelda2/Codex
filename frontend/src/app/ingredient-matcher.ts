import Fuse from 'fuse.js'
import { CzechStemmer } from 'snowball-stemmer.jsx/dest/czech-stemmer.common'

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

type SearchCandidate = {
  ingredient: PreparedIngredient
  normalized: string
  stemmed: string
}

const amountPattern = /^(\d+(?:[.,]\d+)?(?:\s*[-/]\s*\d+(?:[.,]\d+)?)?|\d+\/\d+)(?:\s*(?:kg|g|mg|ml|l|ks|stroužky?|stroužek|špetka|špetky|lžíce|lžička|hrnek|hrnky|balení))?/i
const maxNgramSize = 4
const threshold = 0.4
const czechStemmer = new CzechStemmer()

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
  const searchIndex = buildSearchIndex(ingredients)

  let wordIndex = 0
  while (wordIndex < words.length) {
    const best = bestMatchAt(words, wordIndex, searchIndex)
    if (!best) {
      wordIndex += 1
      continue
    }

    resolvedMatches.push(best)
    wordIndex = best.endWord + 1
  }

  return resolvedMatches
}

function buildSearchIndex(ingredients: PreparedIngredient[]): Fuse<SearchCandidate> {
  return new Fuse(
    ingredients.map((ingredient) => ({
      ingredient,
      normalized: ingredient.normalized,
      stemmed: ingredient.stemmed,
    })),
    {
      includeScore: true,
      shouldSort: true,
      ignoreLocation: true,
      threshold,
      keys: [
        { name: 'normalized', weight: 0.6 },
        { name: 'stemmed', weight: 0.4 },
      ],
    }
  )
}

function bestMatchAt(words: WordToken[], startWord: number, searchIndex: Fuse<SearchCandidate>): CandidateMatch | null {
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

    const results = searchIndex.search({ normalized, stemmed }, { limit: 3 })
    for (const result of results) {
      const ingredient = result.item.ingredient
      if (shouldSkipAmountLikePhrase(normalized, ingredient.normalized)) {
        continue
      }

      const score = result.score ?? 1
      const candidate: CandidateMatch = {
        ingredient,
        startWord,
        endWord,
        segmentStart: words[startWord].segmentIndex,
        segmentEnd: words[endWord].segmentIndex,
        score: applyExactMatchBonus(score, normalized, stemmed, ingredient),
      }

      if (!best || isBetterMatch(candidate, best)) {
        best = candidate
      }
    }
  }

  return best
}

function applyExactMatchBonus(score: number, normalized: string, stemmed: string, ingredient: PreparedIngredient): number {
  if (normalized === ingredient.normalized || stemmed === ingredient.stemmed) {
    return score * 0.6
  }

  return score
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
    .map((word) => stemWord(word))
    .join(' ')
}

function stemWord(word: string): string {
  czechStemmer.setCurrent(word)
  czechStemmer.stem()
  return czechStemmer.getCurrent()
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
