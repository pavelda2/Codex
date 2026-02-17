export type Ingredient = {
  raw: string;
  amount?: string;
  unit?: string;
  name: string;
  note?: string;
};

export type IngredientSection = {
  title: string;
  items: Ingredient[];
};

export type ParserWarningCode = 'IMPLICIT_SECTION' | 'UNSPECIFIED_AMOUNT';

export type ParserWarning = {
  code: ParserWarningCode;
  message: string;
  line: string;
};

export type ParsedRecipe = {
  title: string;
  ingredientSections: IngredientSection[];
  steps: string[];
  warnings: ParserWarning[];
};

const STEP_HINTS = ['postup', 'kroky', 'příprava'];
const BULLET_PATTERN = /^[\-–•*]\s*/;
const AMOUNT_PATTERN = /^(\d+(?:[.,]\d+)?)(?:\s*[-/]\s*\d+(?:[.,]\d+)?)?/;
const UNIT_PATTERN = /^(g|kg|mg|ml|l|ks|stroužky?|špetka|špetky|lžíce|lžička|hrnek|hrnky|balení)\b/i;
const UNSPECIFIED_STARTS = ['trochu', 'dle', 'podle', 'špetka', 'několik', 'pár'];

export function parseRecipe(rawText: string): ParsedRecipe {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim());
  const warnings: ParserWarning[] = [];

  const title = extractTitle(lines);
  const titleIndex = findTitleIndex(lines);
  const stepsIndex = findStepStartIndex(lines);
  const ingredientLines = lines.slice(titleIndex + 1, stepsIndex >= 0 ? stepsIndex : lines.length);
  const stepLines = stepsIndex >= 0 ? lines.slice(stepsIndex + 1) : [];

  return {
    title,
    ingredientSections: parseIngredientSections(ingredientLines, warnings),
    steps: parseSteps(stepLines),
    warnings,
  };
}

function findTitleIndex(lines: string[]): number {
  return lines.findIndex((line) => line.length > 0);
}

function extractTitle(lines: string[]): string {
  const index = findTitleIndex(lines);
  if (index === -1) {
    return 'Bez názvu';
  }

  return lines[index].replace(/^#+\s*/, '');
}

function findStepStartIndex(lines: string[]): number {
  return lines.findIndex((line) => STEP_HINTS.some((hint) => line.toLowerCase() === hint || line.toLowerCase() === `${hint}:`));
}

function parseIngredientSections(lines: string[], warnings: ParserWarning[]): IngredientSection[] {
  const nonEmptyLines = lines.filter(Boolean);
  if (nonEmptyLines.length === 0) {
    return [];
  }

  const sections: IngredientSection[] = [];
  let currentSection: IngredientSection | null = null;

  for (const line of nonEmptyLines) {
    if (isIngredientLine(line)) {
      if (!currentSection) {
        currentSection = { title: 'Suroviny', items: [] };
        warnings.push({
          code: 'IMPLICIT_SECTION',
          message: 'Suroviny byly nalezeny bez sekce, byla použita implicitní sekce „Suroviny“.',
          line,
        });
      }

      const ingredient = parseIngredientLine(line);
      if (ingredient.amount === undefined && startsWithUnspecifiedAmount(ingredient.name)) {
        warnings.push({
          code: 'UNSPECIFIED_AMOUNT',
          message: `Neurčité množství u položky „${ingredient.raw}“.`,
          line,
        });
      }

      currentSection.items.push(ingredient);
      continue;
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    currentSection = { title: normalizeSectionTitle(line), items: [] };
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections.filter((section) => section.items.length > 0);
}

function isIngredientLine(line: string): boolean {
  return BULLET_PATTERN.test(line);
}

function normalizeSectionTitle(line: string): string {
  return line.replace(/:$/, '').trim();
}

function parseIngredientLine(line: string): Ingredient {
  const raw = line.replace(BULLET_PATTERN, '').trim();
  const [beforeDash, afterDash] = raw.split(/\s+-\s+/, 2);
  const parenthesizedNoteMatch = beforeDash.match(/\(([^)]+)\)\s*$/);
  const coreText = parenthesizedNoteMatch
    ? beforeDash.slice(0, beforeDash.length - parenthesizedNoteMatch[0].length).trim()
    : beforeDash.trim();

  const { amount, unit, name } = splitAmountUnitAndName(coreText);

  const notes: string[] = [];
  if (parenthesizedNoteMatch) {
    notes.push(parenthesizedNoteMatch[1].trim());
  }
  if (afterDash) {
    notes.push(afterDash.trim());
  }

  return {
    raw,
    amount,
    unit,
    name,
    note: notes.length > 0 ? notes.join('; ') : undefined,
  };
}

function splitAmountUnitAndName(text: string): Pick<Ingredient, 'amount' | 'unit' | 'name'> {
  let remaining = text.trim();

  const amountMatch = remaining.match(AMOUNT_PATTERN);
  const amount = amountMatch?.[0]?.trim();
  if (amount) {
    remaining = remaining.slice(amount.length).trim();
  }

  const unitMatch = remaining.match(UNIT_PATTERN);
  const unit = unitMatch?.[0]?.trim();
  if (unit) {
    remaining = remaining.slice(unit.length).trim();
  }

  return {
    amount,
    unit,
    name: remaining || text.trim(),
  };
}

function startsWithUnspecifiedAmount(value: string): boolean {
  const lowered = value.toLowerCase();
  return UNSPECIFIED_STARTS.some((prefix) => lowered.startsWith(prefix));
}

function parseSteps(lines: string[]): string[] {
  return lines
    .filter(Boolean)
    .map((line) => line.replace(/^\d+[.)]\s*/, '').replace(BULLET_PATTERN, '').trim())
    .filter(Boolean);
}
