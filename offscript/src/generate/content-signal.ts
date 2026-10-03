/**
 * WS1 — deterministic content-shape signal for a collateral page.
 *
 * Reads the page's matched content (+ intent) and tags the SHAPES present, from a
 * CLOSED keyword vocabulary (mirrors plan.ts's mustIncludeToArchetype approach — a
 * bounded lookup, not open-ended design judgment). The composition selector keys on
 * these tags. Pure + deterministic; output is sorted + de-duplicated so it is stable.
 */
import type { PlanItem } from './types.js';

export type ContentShape =
  | 'comparison' | 'stats' | 'process' | 'list' | 'checklist' | 'quote' | 'diagram' | 'spatial' | 'statement' | 'generic';

const SHAPE_CUES: Array<{ shape: ContentShape; re: RegExp }> = [
  { shape: 'comparison', re: /\bvs\.?\b|versus|before\b.*\bafter|compared?\b|trade[-\s]?off|either\b.*\bor\b/i },
  { shape: 'stats', re: /\d+\s?%|\d+\s?×|\$\d|\d+\s?(ms|s|x|gb|mb|k|m|bn|hrs?|hours?)\b/i },
  { shape: 'process', re: /→|->|⟶|\bstep\s?\d|\bworkflow\b|hand[-\s]?off|then\b.*\bthen\b|pipeline|sequence/i },
  { shape: 'checklist', re: /✓|\bchecklist\b|requirements?\b|qualif|criteria|guarantee[sd]?\b|compliance/i },
  { shape: 'quote', re: /["“][^"”]{12,}["”]|—\s?[A-Z][a-z]+|said\b|according to/i },
  { shape: 'diagram', re: /\bzones?\b|topolog|architecture|\bnode\b|\bgraph\b|relationship|cycle|flow\b/i },
  { shape: 'spatial', re: /\b(operating[-\s]model|ecosystem|isometric|layer(?:ed|s)?\s+(?:stack|system|architecture)|three\s+zones?|system\s+(?:map|architecture)|platform\s+architecture|end[-\s]to[-\s]end\s+system)\b/i },
  { shape: 'list', re: /\n\s*[-*•]\s|\b1\.\s|\bfirst\b.*\bsecond\b|three (things|ways|reasons)/i },
  { shape: 'statement', re: /\bmanifesto\b|\bbelieve\b|\bthe point\b|\bone (idea|thing)\b|\bsimply\b/i },
];

export function deriveContentSignal(item: PlanItem): ContentShape[] {
  const text = `${item.intent}\n${item.content ?? ''}`;
  const shapes = SHAPE_CUES.filter((c) => c.re.test(text)).map((c) => c.shape);
  if (shapes.length === 0) return ['generic'];
  return Array.from(new Set(shapes)).sort();
}
