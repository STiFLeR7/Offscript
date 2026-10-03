/**
 * The synchronization orchestrator (W1 §7): design/website (+ the website-scoped slice of
 * governance) → resources/design_processes/website, one-way, deterministic, idempotent,
 * preserve-aware. `planSync` is pure (fs-free, fully unit-testable); `runSync` is the thin
 * fs-touching boundary, dry-run capable.
 *
 * Runs at merge time only — never imported by anything under offscript/src/generate (confirmed:
 * this package has zero dependency on the engine, and nothing in the engine depends on it).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { planFlatten, planSectionLibrarySections } from './flatten.js';
import { transformCompositionMd, transformComponentsMd } from './transform.js';
import { classifyExistingTargetFiles, type ClassifyResult } from './preserve.js';

export interface SyncOptions {
  /** Absolute path to design/website (the sync source root). */
  readonly sourceRoot: string;
  /** Absolute path to resources/design_processes/website (the sync target root). */
  readonly targetRoot: string;
  /** Compute the plan and report it without writing anything. Default false. */
  readonly dryRun?: boolean;
}

export interface SyncResult extends ClassifyResult {
  /** Target-relative paths written this run (created or overwritten), sorted. */
  readonly written: string[];
  /** Subset of `written` whose content had the File-cell / Variant-id transform applied. */
  readonly transformed: string[];
  /** Source-relative paths deliberately excluded (FLATTEN_RULES `to: null`). */
  readonly excludedSource: string[];
  /** Source-relative paths matching NO rule — always empty on success; a non-empty list means
   *  the source tree grew a shape this sync doesn't know about, and runSync throws on it. */
  readonly unmappedSource: string[];
  readonly dryRun: boolean;
}

interface WriteEntry {
  readonly sourceRelPath: string;
  readonly transform?: 'composition' | 'components';
}

interface SyncPlan {
  readonly writes: Map<string, WriteEntry>; // targetRelPath -> source + optional transform
  readonly excludedSource: string[];
  readonly unmappedSource: string[];
}

const COMPOSITION_MD_TARGET = 'component-governance/COMPOSITION.md';
const COMPONENTS_MD_TARGET = 'component-governance/components.md';

/** Pure planning: source-relative file lists in, the full write-plan out. No fs, no order-dependence. */
export function planSync(sourceRelPaths: readonly string[]): SyncPlan {
  const sectionFiles = sourceRelPaths.filter((p) => p.startsWith('section-library/sections/'));
  const genericFiles = sourceRelPaths.filter((p) => !p.startsWith('section-library/sections/'));

  const generic = planFlatten(genericFiles);
  const sections = planSectionLibrarySections(sectionFiles);

  const writes = new Map<string, WriteEntry>();
  const excludedSource: string[] = [];
  const unmappedSource: string[] = [];

  for (const [sourceRel, targetRel] of generic) {
    if (targetRel === null) {
      excludedSource.push(sourceRel);
      continue;
    }
    const transform =
      targetRel === COMPOSITION_MD_TARGET ? 'composition' : targetRel === COMPONENTS_MD_TARGET ? 'components' : undefined;
    writes.set(targetRel, { sourceRelPath: sourceRel, transform });
  }
  for (const [sourceRel, targetRel] of sections) {
    writes.set(targetRel, { sourceRelPath: sourceRel });
  }

  for (const p of genericFiles) if (!generic.has(p)) unmappedSource.push(p);
  // every section-library/sections/<name>.html matches planSectionLibrarySections by construction
  // (same regex FLATTEN_RULES would otherwise need); nothing from that subset can be unmapped.

  return { writes, excludedSource: excludedSource.sort(), unmappedSource: unmappedSource.sort() };
}

function walk(root: string, dir = root, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) walk(root, abs, out);
    else if (entry.isFile()) out.push(relative(root, abs).split('\\').join('/'));
  }
  return out;
}

function applyTransform(kind: 'composition' | 'components' | undefined, text: string): string {
  if (kind === 'composition') return transformCompositionMd(text);
  if (kind === 'components') return transformComponentsMd(text);
  return text;
}

/** Run the sync against real directories. Reads design/website + the existing target; in
 *  non-dry-run mode, writes the computed target state. Fails loud on any unmapped source file —
 *  a broken/incomplete mapping must surface, never silently drop content. */
export function runSync(options: SyncOptions): SyncResult {
  const { sourceRoot, targetRoot, dryRun = false } = options;

  const sourceFiles = existsSync(sourceRoot) ? walk(sourceRoot) : [];
  const plan = planSync(sourceFiles);

  if (plan.unmappedSource.length > 0) {
    throw new Error(
      `runSync: ${plan.unmappedSource.length} source file(s) matched no FLATTEN_RULES entry — ` +
        `refusing to silently drop them:\n${plan.unmappedSource.map((p) => `  ${p}`).join('\n')}`,
    );
  }

  const existingTargetFiles = existsSync(targetRoot) ? walk(targetRoot) : [];
  const writtenRelPaths = new Set(plan.writes.keys());
  const classify = classifyExistingTargetFiles(existingTargetFiles, writtenRelPaths);

  const written: string[] = [];
  const transformed: string[] = [];

  for (const [targetRel, entry] of plan.writes) {
    const sourceAbs = join(sourceRoot, entry.sourceRelPath);
    const targetAbs = join(targetRoot, targetRel);
    written.push(targetRel);
    if (entry.transform) transformed.push(targetRel);

    if (dryRun) continue;

    const isText = entry.transform !== undefined;
    if (isText) {
      const text = readFileSync(sourceAbs, 'utf8');
      const out = applyTransform(entry.transform, text);
      mkdirSync(dirname(targetAbs), { recursive: true });
      writeFileSync(targetAbs, out, 'utf8');
    } else {
      const buf = readFileSync(sourceAbs);
      mkdirSync(dirname(targetAbs), { recursive: true });
      writeFileSync(targetAbs, buf);
    }
  }

  return {
    written: written.sort(),
    transformed: transformed.sort(),
    overwritten: classify.overwritten.sort(),
    preserved: classify.preserved.sort(),
    unaccounted: classify.unaccounted.sort(),
    excludedSource: plan.excludedSource,
    unmappedSource: plan.unmappedSource,
    dryRun,
  };
}
