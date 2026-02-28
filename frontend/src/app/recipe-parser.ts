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
const FRACTION_CHARS = '¼½¾⅓⅔⅛⅜⅝⅞'
const AMOUNT_PATTERN = new RegExp(
  `^(?:\\d+(?:[.,]\\d+)?(?:\\s*[-/]\\s*\\d+(?:[.,]\\d+)?)?|[${FRACTION_CHARS}](?:\\s*[-/]\\s*\\d+(?:[.,]\\d+)?)?|\\d+(?:[.,]\\d+)?\\s+[${FRACTION_CHARS}])`
)
const UNIT_PATTERN = /^(?:g|kg|mg|ml|l|dcl|cl|ks?|strouž(?:ek|ky|ků)|špetk(?:a|y|u|ou)|lž(?:íce|ic|ící|íc|ícemi|ička|ičky|iček|ičce|ičkou)|hrn(?:ek|ku|ky|ků)|hrníč(?:ek|ku|ky|ků)|balen(?:í|im?)|plátek|plátky|plátků|kostka|kostky|kostek|svazek|svazky|svazků|snítka|snítky|snítek|plechovka|půllitr|půllitru)\b/i
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
    if (isSectionTitle(line)) {
      if (currentSection) {
        sections.push(currentSection);
      }

      currentSection = { title: normalizeSectionTitle(line), items: [] };
      continue;
    }

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
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections.filter((section) => section.items.length > 0);
}

function isIngredientLine(line: string): boolean {
  return !isSectionTitle(line);
}

function isSectionTitle(line: string): boolean {
  return /:$/.test(line.trim());
}

function normalizeSectionTitle(line: string): string {
  return line.replace(/:$/, '').trim();
}

function parseIngredientLine(line: string): Ingredient {
  const raw = line.replace(BULLET_PATTERN, '').trim();
  const noteSlices: Array<{ start: number; value: string }> = [];

  const bracketNoteMatch = raw.match(/\(([^)]+)\)\s*$/);
  if (bracketNoteMatch && bracketNoteMatch.index !== undefined) {
    noteSlices.push({
      start: bracketNoteMatch.index,
      value: bracketNoteMatch[1].trim(),
    });
  }

  const dashNoteMatch = raw.match(/\s-\s*(.+)$/);
  if (dashNoteMatch?.index !== undefined) {
    const dashNote = dashNoteMatch[1].trim();
    if (dashNote) {
      noteSlices.push({ start: dashNoteMatch.index, value: dashNote });
    }
  }

  const commaIndex = findNoteCommaIndex(raw);
  if (commaIndex >= 0) {
    const commaNote = raw.slice(commaIndex + 1).trim();
    if (commaNote) {
      noteSlices.push({ start: commaIndex, value: commaNote });
    }
  }

  const earliestNoteStart = noteSlices.reduce((earliest, slice) => Math.min(earliest, slice.start), raw.length);
  const coreText = raw.slice(0, earliestNoteStart).trim();

  const { amount, unit, name } = splitAmountUnitAndName(coreText);

  const notes = noteSlices.map((slice) => slice.value).filter(Boolean);

  return {
    raw,
    amount,
    unit,
    name,
    note: notes.length > 0 ? notes.join('; ') : undefined,
  };
}


function findNoteCommaIndex(text: string): number {
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== ',') {
      continue;
    }

    const previousChar = index > 0 ? text[index - 1] : '';
    const nextChar = index + 1 < text.length ? text[index + 1] : '';

    if (/\d/.test(previousChar) && /\d/.test(nextChar)) {
      continue;
    }

    return index;
  }

  return -1;
}

function splitAmountUnitAndName(text: string): Pick<Ingredient, 'amount' | 'unit' | 'name'> {
  let remaining = text.trim();

  const amountMatch = remaining.match(AMOUNT_PATTERN);
  const amountValue = amountMatch?.[0]?.trim();
  const amount = normalizeAmount(amountValue);
  if (amountValue) {
    remaining = remaining.slice(amountValue.length).trim();
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

function normalizeAmount(amount?: string): string | undefined {
  if (!amount) {
    return undefined
  }

  return amount.replace(/\s+/g, ' ').trim()
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
