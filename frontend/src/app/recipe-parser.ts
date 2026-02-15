export type IngredientSection = {
  title: string;
  items: string[];
};

export type ParsedRecipe = {
  title: string;
  ingredientSections: IngredientSection[];
  steps: string[];
};

const INGREDIENT_HINTS = ['ingredience', 'suroviny'];
const STEP_HINTS = ['postup', 'kroky', 'příprava'];

export function parseRecipe(rawText: string): ParsedRecipe {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim());

  const title = extractTitle(lines);
  const ingredientsIndex = findLineIndex(lines, INGREDIENT_HINTS);
  const stepsIndex = findLineIndex(lines, STEP_HINTS);

  const ingredientLines = sliceSection(lines, ingredientsIndex, stepsIndex);
  const stepLines = sliceSection(lines, stepsIndex, lines.length);

  return {
    title,
    ingredientSections: parseIngredientSections(ingredientLines),
    steps: parseSteps(stepLines),
  };
}

function extractTitle(lines: string[]): string {
  const firstContent = lines.find((line) => line.length > 0);
  return firstContent ? firstContent.replace(/^#+\s*/, '') : 'Bez názvu';
}

function findLineIndex(lines: string[], hints: string[]): number {
  return lines.findIndex((line) => hints.some((hint) => line.toLowerCase().startsWith(hint)));
}

function sliceSection(lines: string[], start: number, end: number): string[] {
  if (start < 0) {
    return [];
  }

  return lines.slice(start + 1, end > start ? end : lines.length).filter(Boolean);
}

function parseIngredientSections(lines: string[]): IngredientSection[] {
  if (lines.length === 0) {
    return [];
  }

  const sections: IngredientSection[] = [];
  let current: IngredientSection = { title: 'Ingredience', items: [] };

  for (const line of lines) {
    if (line.endsWith(':') && !line.startsWith('-') && !line.match(/^\d+[.)]/)) {
      if (current.items.length > 0 || current.title !== 'Ingredience') {
        sections.push(current);
      }
      current = { title: line.slice(0, -1), items: [] };
      continue;
    }

    current.items.push(line.replace(/^[-*]\s*/, ''));
  }

  if (current.items.length > 0 || current.title !== 'Ingredience') {
    sections.push(current);
  }

  return sections;
}

function parseSteps(lines: string[]): string[] {
  if (lines.length === 0) {
    return [];
  }

  return lines.map((line) => line.replace(/^\d+[.)]\s*/, '')).filter(Boolean);
}
