/**
 * Runtime reader for COMPOSE.md §B section skeletons (audit §9-A4).
 *
 * When the composition router finds no whole variant for a section's intent, it builds a
 * grammar-shaped composition from the per-intent slot skeleton here (+ §D focal-weight model),
 * so a composed section still obeys the design grammar. FAIL-LOUD loader (composition-md.ts pattern).
 * Website-only; paths.ts + node fs only.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { designProcessesDir } from '../paths.js';

export interface Skeleton {
  /** lowercase serves-intent key, e.g. "hero", "feature". */
  intent: string;
  /** ordered slot tokens, e.g. "[headline-cluster]", "[cta-row | form-block]", "[creative-panel]?". */
  slots: string[];
}

/** Map the §B bullet display names → the router's serves-intent vocabulary (ARCHETYPE_INTENT). */
const NAME_TO_INTENT: Record<string, string> = {
  hero: 'hero',
  feature: 'feature',
  'stats / outcomes': 'stats',
  'social proof': 'logos',
  comparison: 'comparison',
  process: 'process',
  pricing: 'pricing',
  faq: 'faq',
  cta: 'cta',
  contact: 'contact',
  team: 'team',
  resources: 'resources',
  testimonials: 'testimonials',
};

/** serves-intents with no own §B bullet → nearest skeleton. */
const INTENT_ALIAS: Record<string, string> = {
  'value-prop': 'feature',
  integrations: 'logos',
  footer: 'cta',
};

const MIN_SKELETONS = 10;

/** Parse the §B "- **Name** — `[slot]` + `[slot]?` …" bullet lines. */
export function parseSkeletons(md: string): Skeleton[] {
  const out: Skeleton[] = [];
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(/^\s*-\s+\*\*(.+?)\*\*\s*[—-]\s*(.+)$/);
    if (!m) continue;
    const name = m[1].trim().toLowerCase();
    const intent = NAME_TO_INTENT[name];
    if (!intent) continue;
    // capture an optional `?` whether it sits inside or just outside the backticks
    const slots = [...m[2].matchAll(/`([^`]+)`(\??)/g)].map((x) => (x[1].trim() + x[2]));
    if (slots.length) out.push({ intent, slots });
  }
  return out;
}

/** The skeleton for a serves-intent (direct, then alias). undefined if neither maps. */
export function skeletonForIntent(intent: string, skeletons: Skeleton[]): Skeleton | undefined {
  const direct = skeletons.find((s) => s.intent === intent);
  if (direct) return direct;
  const alias = INTENT_ALIAS[intent];
  return alias ? skeletons.find((s) => s.intent === alias) : undefined;
}

/** Absolute path to COMPOSE.md. */
export function composeMdPath(): string {
  return join(designProcessesDir('website'), 'component-governance', 'COMPOSE.md');
}

/** Load + parse COMPOSE.md §B. FAIL-LOUD: throws on missing file / too few skeletons. */
export function loadComposeSkeletons(): Skeleton[] {
  const path = composeMdPath();
  if (!existsSync(path)) throw new Error(`loadComposeSkeletons: COMPOSE.md not found at ${path}.`);
  const sk = parseSkeletons(readFileSync(path, 'utf8'));
  if (sk.length < MIN_SKELETONS) {
    throw new Error(
      `loadComposeSkeletons: parsed only ${sk.length} skeletons from ${path} (expected ≥ ${MIN_SKELETONS}). ` +
        `The §B bullet shape likely changed — fix COMPOSE.md or compose-md.ts.`,
    );
  }
  return sk;
}
