/**
 * Sprint 2 — Repository Materialization (one-time / regenerable authoring tool, NOT
 * part of the Builder runtime).
 *
 * Emits the committed band-format knowledge repository under `offscript/repository/` from
 * the canonical website component-governance slice. It REUSES the already-proven PKG-2
 * canonical parser (`parseFamilyModel`, which reads the structured "Variant appendix"
 * table of resources component-governance/components.md) — there is no build-time
 * prose mining and no new adapter: this transcribes structured canonical facts into
 * authored four-band packages that the frozen Builder then consumes unchanged via the
 * Markdown adapter.
 *
 * Faithful band mapping (nothing invented — the slice carries only roles + inheritance):
 *   • family  → component asset, canonical scope, PRODUCES `concept:role:<family>`
 *               (one family owns one role — the single-producer invariant by construction);
 *   • variant → component asset, canonical scope, SPECIALIZES its family's role concept
 *               (the variant→family inheritance bridge), body = its distinguishing angle.
 *
 * Deterministic + fail-loud: stable slugs, sorted emission, the canonical/ tree and
 * vocabulary.yaml are fully rewritten each run so a removed source row removes its file.
 *
 *   npm run knowledge:materialize
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFamilyModel } from '../src/knowledge/inheritance.js';
import { loadCompositionSelection, type SelectionRow } from '../src/generate/composition-md.js';
import {
  resolveVariantFacts,
  assertCompleteVariantFacts,
  type RawSelection,
  type SelectionFacts,
} from '../src/knowledge/selection-facts.js';

const REPO_DIR = fileURLToPath(new URL('../repository', import.meta.url));
const OWNER = 'offscript-authority';
const SCOPE_IDENTITY = 'offscript';

/** Deterministic, OS-stable slug: NFC, lowercase, non-alnum → '-', trimmed. */
function slug(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** A YAML double-quoted scalar with correct escaping (JSON encoding is valid YAML). */
function q(s: string): string {
  return JSON.stringify(s.normalize('NFC'));
}

function roleConcept(family: string): string {
  return `concept:role:${slug(family)}`;
}

function familyDoc(family: string): string {
  return [
    '---',
    'schema_version: "1.0"',
    'kind: component',
    'identity:',
    `  id: ${q(`canonical::family-${slug(family)}`)}`,
    `  title: ${q(family)}`,
    'ownership:',
    `  owner: ${q(OWNER)}`,
    'scope:',
    '  class: canonical',
    `  identity: ${q(SCOPE_IDENTITY)}`,
    'governance:',
    '  authority: canonical-global',
    'semantics:',
    '  produces:',
    `    - ${q(roleConcept(family))}`,
    '---',
    '',
    `# ${family}`,
    '',
    'Abstract section family (role). Realized by one or more layout variants that',
    'specialize this role; owns the role, never a specific surface or pixel.',
    '',
  ].join('\n');
}

function variantDoc(variant: string, family: string, angle: string, facts: SelectionFacts): string {
  const lines = [
    '---',
    'schema_version: "1.0"',
    'kind: component',
    'identity:',
    `  id: ${q(`canonical::${variant}`)}`,
    `  title: ${q(variant)}`,
    'ownership:',
    `  owner: ${q(OWNER)}`,
    'scope:',
    '  class: canonical',
    `  identity: ${q(SCOPE_IDENTITY)}`,
    'governance:',
    '  authority: canonical-global',
    'semantics:',
    '  specializes:',
    `    - ${q(roleConcept(family))}`,
  ];
  // Stage-1 selection facts (authored in COMPOSITION.md): serves+surface → capabilities.satisfies,
  // limits → validation.expects. Emitted only when present (absence is meaning).
  if (facts.satisfies.length > 0) {
    lines.push('capabilities:', '  satisfies:');
    for (const t of facts.satisfies) lines.push(`    - ${q(t)}`);
  }
  if (facts.expects.length > 0) {
    lines.push('validation:', '  expects:');
    for (const t of facts.expects) lines.push(`    - ${q(t)}`);
  }
  lines.push(
    '---',
    '',
    `# ${variant}`,
    '',
    angle ? angle.normalize('NFC') : `Layout variant specializing the ${family} role.`,
    '',
  );
  return lines.join('\n');
}

function vocabularyDoc(families: string[], obligations: string[]): string {
  const concepts = [...new Set(families.map(roleConcept))].sort();
  const lines = ['concepts:'];
  for (const c of concepts) lines.push(`  - ${q(c)}`);
  // Stage-1: serves:/surface: tokens become governed obligations (capabilities.satisfies
  // validates against this set; an off-vocabulary fact fails the Builder loudly).
  if (obligations.length > 0) {
    lines.push('obligations:');
    for (const o of [...new Set(obligations)].sort()) lines.push(`  - ${q(o)}`);
  }
  lines.push('owners:', `  - ${q(OWNER)}`);
  lines.push('scope_identities:', `  - ${q(SCOPE_IDENTITY)}`);
  return lines.join('\n') + '\n';
}

function main(): void {
  const model = parseFamilyModel('website');
  if (model.families.length === 0 || model.variants.length === 0) {
    throw new Error('materialize-knowledge: canonical family/variant model is empty — refusing to emit.');
  }

  // Stage-1 authored selection facts (serves/surface/limits), keyed by variant slug.
  const selectionRows = loadCompositionSelection();
  const selection = new Map<string, RawSelection>(
    selectionRows.map((r: SelectionRow) => [r.slug, { serves: r.serves, surface: r.surface, limits: r.limits }]),
  );

  const canonicalDir = join(REPO_DIR, 'canonical');
  rmSync(canonicalDir, { recursive: true, force: true });
  mkdirSync(canonicalDir, { recursive: true });

  // Families (sorted by slug for stable output) — roles carry no selection facts.
  const families = [...model.families].sort((a, b) => slug(a).localeCompare(slug(b)));
  for (const family of families) {
    const dir = join(canonicalDir, `family-${slug(family)}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'component.md'), familyDoc(family), 'utf8');
  }

  // Variants (sorted by slug) — each must resolve to an authored COMPOSITION row (fail-loud).
  const obligations: string[] = [];
  const variants = [...model.variants].sort((a, b) => a.variant.localeCompare(b.variant));
  for (const v of variants) {
    const facts = resolveVariantFacts(v.variant, selection); // throws if unauthored
    assertCompleteVariantFacts(v.variant, facts); // serves + surface required
    obligations.push(...facts.satisfies);
    const dir = join(canonicalDir, v.variant);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'component.md'), variantDoc(v.variant, v.family, v.angle, facts), 'utf8');
  }

  writeFileSync(join(REPO_DIR, 'vocabulary.yaml'), vocabularyDoc(model.families, obligations), 'utf8');

  console.log(
    `materialized ${families.length} family + ${variants.length} variant package(s) ` +
      `(${new Set(obligations).size} selection obligations) → ${REPO_DIR}`,
  );
}

main();
