import { parse as parseYaml } from 'yaml';

export interface RecipeEntry {
  operator: string;
  params: Record<string, unknown>;
}

export interface Recipe {
  operators: RecipeEntry[];
}

interface RawEntry {
  operator: string;
  params?: Record<string, unknown>;
}

/** Extract the single ```yaml fenced block from a rulebook markdown and parse it into a recipe. */
export function parseRecipe(rulebookMd: string): Recipe {
  const match = rulebookMd.match(/```yaml\s*([\s\S]*?)```/);
  if (!match) return { operators: [] };
  const data = parseYaml(match[1]) as { operators?: RawEntry[] } | null;
  const raw = data?.operators ?? [];
  return {
    operators: raw.map((e) => ({ operator: e.operator, params: e.params ?? {} })),
  };
}
