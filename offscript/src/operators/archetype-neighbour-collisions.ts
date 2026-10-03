import type { Root } from 'hast';
import type { Operator, Finding, OperatorContext } from '../operator.js';
import type { Archetype } from '../archetype.js';

/**
 * Tier-1 rail: archetype-neighbour-collisions (M2 Group B,
 * SECTION_INTELLIGENCE.md §7.3 + §3.x "Forbidden neighbours" + §6.5).
 *
 * The §7.3 section-pairing matrix says which archetypes flow well together
 * (✓), which need a buffer (~), and which collide (✗). Row = section coming
 * first; column = section that follows. This rail walks each ADJACENT pair in
 * page order and flags:
 *   - ✗ collisions  → warning ("reorder or separate")
 *   - ~ buffers     → warning ("insert a contrasting section between them")
 *   - ✓ flows       → clear
 *
 * Both are WARNINGS (advisory page-composition guidance): the fix is a reorder
 * or an inserted section, a design decision — not a mechanical rewrite, and not
 * a single frozen element. This anchors on the archetype CATEGORY of a section
 * pair (Tier-1), reading the order from `ctx.archetypeModel` (insertion order =
 * page order). Per the seam contract, no model → no-op with a single warning.
 *
 * Archetypes outside the §7.3 matrix (sub-hero, editorial, founder,
 * integrations, contact, resources) carry no verdict and are skipped as neutral
 * neighbours.
 * testimonial-wall maps onto Test (the matrix's single testimonial column).
 * Footer has a column ("Foot") but no row — it is terminal, so a footer as the
 * first member of a pair yields no verdict.
 *
 * Spec: M2 charter §4 Task 6; SECTION_INTELLIGENCE.md §7.3, §3.x, §6.5.
 */

type MatrixKey =
  | 'Hero'
  | 'Logo'
  | 'Grid'
  | 'Spot'
  | 'Proc'
  | 'Metr'
  | 'Test'
  | 'Case'
  | 'Pric'
  | 'Comp'
  | 'FAQ'
  | 'CTA'
  | 'Foot';

type Verdict = '+' | '~' | 'x';

/** Column order of the §7.3 matrix (row strings below are read against this). */
const COLS: MatrixKey[] = [
  'Hero',
  'Logo',
  'Grid',
  'Spot',
  'Proc',
  'Metr',
  'Test',
  'Case',
  'Pric',
  'Comp',
  'FAQ',
  'CTA',
  'Foot',
];

/**
 * The §7.3 pairing matrix, transcribed verbatim. Each row string is the 13
 * column verdicts (✓→+, ~→~, ✗→x) in COLS order. Footer has no row (terminal).
 */
const ROWS: Record<Exclude<MatrixKey, 'Foot'>, string> = {
  //     Hero Logo Grid Spot Proc Metr Test Case Pric Comp FAQ  CTA  Foot
  Hero: 'x    +    +    +    ~    +    ~    ~    x    x    x    x    x',
  Logo: 'x    x    +    +    +    +    +    +    ~    ~    ~    +    +',
  Grid: 'x    +    x    +    +    +    +    +    ~    ~    +    +    +',
  Spot: 'x    ~    +    +    +    +    +    +    ~    ~    +    +    +',
  Proc: 'x    ~    +    +    x    +    +    +    +    +    +    +    +',
  Metr: 'x    ~    +    +    +    x    +    +    +    +    +    +    +',
  Test: 'x    ~    +    +    +    +    ~    +    +    +    +    +    +',
  Case: 'x    ~    +    +    +    +    +    ~    +    +    +    +    +',
  Pric: 'x    x    ~    ~    ~    ~    +    +    x    +    +    +    +',
  Comp: 'x    x    x    x    x    x    +    +    +    x    +    +    +',
  FAQ: 'x    x    x    x    x    x    +    ~    +    +    x    +    +',
  CTA: 'x    x    x    x    x    x    ~    ~    +    +    +    x    +',
};

const PAIRING: Partial<Record<MatrixKey, Record<MatrixKey, Verdict>>> = buildPairing();

function buildPairing(): Partial<Record<MatrixKey, Record<MatrixKey, Verdict>>> {
  const out: Partial<Record<MatrixKey, Record<MatrixKey, Verdict>>> = {};
  for (const [row, str] of Object.entries(ROWS) as Array<[MatrixKey, string]>) {
    const cells = str.trim().split(/\s+/) as Verdict[];
    const record = {} as Record<MatrixKey, Verdict>;
    COLS.forEach((col, i) => {
      record[col] = cells[i];
    });
    out[row] = record;
  }
  return out;
}

const MATRIX_KEY: Record<Archetype, MatrixKey | null> = {
  hero: 'Hero',
  'sub-hero': null,
  'logo-bar': 'Logo',
  'feature-grid': 'Grid',
  'feature-spotlight': 'Spot',
  process: 'Proc',
  metrics: 'Metr',
  testimonial: 'Test',
  'testimonial-wall': 'Test',
  'case-study': 'Case',
  pricing: 'Pric',
  'plan-comparison': 'Comp',
  faq: 'FAQ',
  'cta-banner': 'CTA',
  footer: 'Foot',
  editorial: null,
  founder: null,
  integrations: null,
  // contact / resources are outside the §7.3 pairing matrix (which predates them)
  // → neutral neighbours, like sub-hero / editorial / founder / integrations. No
  // fabricated verdict; the rail skips pairs that touch them.
  contact: null,
  resources: null,
};

export const archetypeNeighbourCollisions: Operator = {
  name: 'archetype-neighbour-collisions',
  tier: 1,

  detect(_tree: Root, ctx: OperatorContext): Finding[] {
    if (!ctx.archetypeModel) {
      return [
        {
          id: 'archetype-neighbour-collisions:no-archetype-model',
          description:
            'archetype model not available on context (run archetype-tag first) — archetype-neighbour-collisions skipped',
          outcome: 'warning',
        },
      ];
    }

    const seq: Array<{ id: string; archetype: Archetype }> = [];
    for (const [id, a] of ctx.archetypeModel) seq.push({ id, archetype: a.archetype });

    const findings: Finding[] = [];
    for (let i = 1; i < seq.length; i++) {
      const prev = seq[i - 1];
      const cur = seq[i];
      const rowKey = MATRIX_KEY[prev.archetype];
      const colKey = MATRIX_KEY[cur.archetype];
      if (!rowKey || !colKey) continue; // archetype outside the matrix → neutral
      const row = PAIRING[rowKey];
      if (!row) continue; // e.g. footer-first (terminal) → no row
      const verdict = row[colKey];

      if (verdict === 'x') {
        findings.push({
          id: `archetype-neighbour-collisions:collide:${prev.id}->${cur.id}`,
          description: `"${prev.id}" (${prev.archetype}) → "${cur.id}" (${cur.archetype}) collide (✗ in the §7.3 pairing matrix) — reorder or separate them`,
          outcome: 'escalated',
        });
      } else if (verdict === '~') {
        findings.push({
          id: `archetype-neighbour-collisions:buffer:${prev.id}->${cur.id}`,
          description: `"${prev.id}" (${prev.archetype}) → "${cur.id}" (${cur.archetype}) need a buffer (~ in the §7.3 pairing matrix) — insert a contrasting section between them`,
          outcome: 'warning',
        });
      }
    }
    return findings;
  },

  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};
