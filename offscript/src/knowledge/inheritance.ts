/**
 * PKG-2 — Canonical Repository Knowledge Layer: INHERITANCE resolution + validators.
 *
 * Ratified by RKA ADR §3/§8 and EP-1 §3 / EP-2 PKG-2. This module reads the canonical
 * variant→family bridge that already exists in the repository — the "Variant appendix"
 * of `component-governance/components.md` (Family | Variant | Distinguishing angle) —
 * and exposes:
 *   • the family/variant inheritance model (variant inherits its family's role),
 *   • resolution (variant → owning family),
 *   • the ownership/inheritance INVARIANT validators (one owner per fact, one altitude
 *     per fact, no orphan, no cycle, downward-only), fail-loud.
 *
 * It is READ-ONLY over governance and UNCONSUMED by the generate path — it establishes
 * the foundation PKG-3 (projection) will read. It owns inheritance + its validation
 * only; it never touches planner, projection, author, runtime, scoring, or generation.
 *
 * Growth-safe by construction: families and variants are PARSED from the canonical
 * source (never enumerated in code), so a new variant/family added to components.md
 * participates with zero code change here. A `raw` override on the parser lets callers
 * (and tests) feed alternative canonical text to prove that growth-safety.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { designProcessesDir, type Track } from '../paths.js';
import { resolveSourceAltitude, type Altitude } from './altitudes.js';

/** One realized variant and the family it inherits from. */
export interface VariantEntry {
  readonly variant: string;
  readonly family: string;
  /** The variant-owned differentiation (the only thing a variant owns — RKA §3). */
  readonly angle: string;
}

/** The parsed canonical family/variant model from one track's components.md. */
export interface FamilyModel {
  /** Distinct families, in first-appearance order, as labelled by the variant bridge. */
  readonly families: string[];
  /** Every realized variant with its owning family. */
  readonly variants: VariantEntry[];
  /** Fast variant → family lookup. */
  readonly variantToFamily: ReadonlyMap<string, string>;
  /** The family `##` headings (the role catalogue), for label reconciliation only. */
  readonly headingFamilies: string[];
}

const COMPONENTS_MD = 'component-governance/components.md';

function componentsPath(track: Track): string {
  return join(designProcessesDir(track), COMPONENTS_MD);
}

const META_HEADINGS = [
  'how to read',
  'universal rules',
  'the test',
  'variant appendix',
];

/** A markdown table data row: `| a | b | c |` → ['a','b','c'] (trimmed). Null if not a row. */
function tableCells(line: string): string[] | null {
  const t = line.trim();
  if (!t.startsWith('|')) return null;
  const cells = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  return cells;
}

/**
 * Parse a track's components.md into the canonical family/variant model. Reads the
 * real file by default; pass `raw` to parse alternative canonical text (growth-safety
 * tests). Fail-loud when the file is missing or the Variant appendix is absent — the
 * inheritance bridge is load-bearing and its absence is never silently tolerated.
 */
export function parseFamilyModel(track: Track = 'website', raw?: string): FamilyModel {
  let text: string;
  if (raw !== undefined) {
    text = raw;
  } else {
    const path = componentsPath(track);
    if (!existsSync(path)) {
      throw new Error(`parseFamilyModel: canonical components.md not found at ${path}`);
    }
    text = readFileSync(path, 'utf8');
  }

  const lines = text.split(/\r?\n/);

  // Role-catalogue family headings (## …), excluding the meta headings.
  const headingFamilies: string[] = [];
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const name = m[1];
    if (META_HEADINGS.some((meta) => name.toLowerCase().startsWith(meta))) continue;
    headingFamilies.push(name);
  }

  // The variant appendix bridge: everything after the "## Variant appendix" heading.
  const appendixIdx = lines.findIndex((l) => /^##\s+Variant appendix/i.test(l));
  if (appendixIdx === -1) {
    throw new Error(
      `parseFamilyModel(${track}): no "Variant appendix" found in components.md — ` +
        `the variant→family inheritance bridge is required.`,
    );
  }

  const variants: VariantEntry[] = [];
  const families: string[] = [];
  const seenFamily = new Set<string>();
  for (const line of lines.slice(appendixIdx + 1)) {
    const cells = tableCells(line);
    if (!cells || cells.length < 3) continue;
    const [family, variant, angle] = cells;
    // Skip header + separator rows.
    if (/^family$/i.test(family) && /^variant$/i.test(variant)) continue;
    if (/^-+$/.test(family)) continue;
    if (!family || !variant) continue;
    variants.push({ variant, family, angle: angle ?? '' });
    if (!seenFamily.has(family)) {
      seenFamily.add(family);
      families.push(family);
    }
  }

  const variantToFamily = new Map<string, string>();
  for (const v of variants) variantToFamily.set(v.variant, v.family);

  return { families, variants, variantToFamily, headingFamilies };
}

/** Resolve a variant to its owning family, or throw if it has no canonical family (orphan). */
export function resolveFamily(variant: string, model: FamilyModel): string {
  const family = model.variantToFamily.get(variant);
  if (family === undefined) {
    throw new Error(`resolveFamily: variant "${variant}" has no owning family (orphan).`);
  }
  return family;
}

/** A single ownership/inheritance invariant violation. */
export interface OwnershipViolation {
  readonly kind:
    | 'duplicate-variant' // one fact, two owners
    | 'variant-is-family' // a name owned at two altitudes
    | 'empty-field' // malformed bridge row
    | 'self-family'; // a variant that is its own family (cycle)
  readonly detail: string;
}

/**
 * Validate the ownership + inheritance invariants over a parsed model. Returns the
 * (empty when clean) violation list; `assertCanonicalKnowledge` is the fail-loud
 * wrapper. Invariants enforced:
 *   • one owner per fact   — no variant appears under two families;
 *   • one altitude per fact — no name is both a variant and a family;
 *   • no orphan / empty     — every bridge row has a family and a variant;
 *   • no cycle              — a variant is never its own family.
 * (Downward-only inheritance is structural — it is guaranteed by the altitude order
 * in altitudes.ts; a variant only ever resolves UP to a family.)
 */
export function validateOwnership(model: FamilyModel): OwnershipViolation[] {
  const violations: OwnershipViolation[] = [];
  const families = new Set(model.families);

  const variantOwners = new Map<string, Set<string>>();
  for (const v of model.variants) {
    if (!v.variant || !v.family) {
      violations.push({ kind: 'empty-field', detail: `row {variant:"${v.variant}", family:"${v.family}"}` });
      continue;
    }
    if (v.variant === v.family) {
      violations.push({ kind: 'self-family', detail: `"${v.variant}" is its own family` });
    }
    if (!variantOwners.has(v.variant)) variantOwners.set(v.variant, new Set());
    variantOwners.get(v.variant)!.add(v.family);
  }

  for (const [variant, owners] of variantOwners) {
    if (owners.size > 1) {
      violations.push({
        kind: 'duplicate-variant',
        detail: `variant "${variant}" owned by {${[...owners].join(', ')}} — must have exactly one family`,
      });
    }
  }

  for (const variant of variantOwners.keys()) {
    if (families.has(variant)) {
      violations.push({
        kind: 'variant-is-family',
        detail: `"${variant}" is both a variant and a family — one altitude per fact`,
      });
    }
  }

  return violations;
}

/**
 * Heading-vs-appendix family label drift, reported but NEVER failed: a family named
 * in the variant bridge whose label is not an exact `##` heading. This surfaces
 * benign governance label inconsistencies (e.g. "Call-to-action" vs the heading
 * "Call-to-action (closing)") without modifying governance — observation only.
 */
export function reconcileFamilyLabels(model: FamilyModel): string[] {
  const headings = new Set(model.headingFamilies);
  return model.families.filter((f) => !headings.has(f));
}

/** A canonical-knowledge validation report (one track). */
export interface KnowledgeReport {
  readonly track: Track;
  readonly familyCount: number;
  readonly variantCount: number;
  readonly violations: OwnershipViolation[];
  readonly labelDiscrepancies: string[];
  /** Altitude assigned to each canonical knowledge source, by location (ownership map). */
  readonly sourceAltitudes: ReadonlyArray<{ source: string; altitude: Altitude | undefined }>;
}

/** The canonical knowledge sources whose altitude ownership PKG-2 asserts (by location). */
function canonicalSources(track: Track): string[] {
  const cg = join(designProcessesDir(track), 'component-governance');
  const rb = join(designProcessesDir(track), 'rulebooks');
  return [
    join(cg, 'components.md'),
    join(cg, 'COMPOSITION.md'),
    join(cg, 'COMPOSE.md'),
    join(cg, 'COMPOSITION-REASONING.md'),
    join(rb, 'numerics.md'),
    join(designProcessesDir(track), 'PHILOSOPHY.md'),
    join(designProcessesDir(track), 'colors_and_type.css'),
  ];
}

/**
 * Build the read-only canonical-knowledge report for a track: ownership altitudes,
 * inheritance counts, hard-invariant violations, and (non-fatal) label drift.
 */
export function buildKnowledgeReport(track: Track = 'website'): KnowledgeReport {
  const model = parseFamilyModel(track);
  return {
    track,
    familyCount: model.families.length,
    variantCount: model.variants.length,
    violations: validateOwnership(model),
    labelDiscrepancies: reconcileFamilyLabels(model),
    sourceAltitudes: canonicalSources(track).map((source) => ({
      source,
      altitude: resolveSourceAltitude(source),
    })),
  };
}

/**
 * Fail-loud canonical-knowledge gate: throws if any ownership/inheritance invariant
 * is violated for the track. Label discrepancies are NOT failures (governance is
 * human-authored and not PKG-2's to change). This is the PKG-2 ownership+inheritance
 * validation entrypoint — unconsumed by generation, run by the validators/tests.
 */
export function assertCanonicalKnowledge(track: Track = 'website'): KnowledgeReport {
  const report = buildKnowledgeReport(track);
  if (report.violations.length > 0) {
    const lines = report.violations.map((v) => `  [${v.kind}] ${v.detail}`).join('\n');
    throw new Error(
      `assertCanonicalKnowledge(${track}): ${report.violations.length} ownership/inheritance ` +
        `violation(s):\n${lines}`,
    );
  }
  return report;
}
