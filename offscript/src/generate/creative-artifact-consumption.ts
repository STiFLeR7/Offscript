/**
 * Sprint 5 — Creative Artifact -> Website Generation consumption boundary.
 *
 * Reads a client's Creative Artifact inventory (paired CreativeIntent + CreativeArtifact
 * records, per `offscript/creative-artifact-contract`'s own shapes) from a portable, project-
 * relative location, and selects — by deterministic lexical term-overlap, the SAME technique
 * `semantic-selection.ts` already uses for candidate scoring elsewhere in this engine — which
 * available artifact (if any) is relevant to a given PlanItem. Never a hardcoded artifact id,
 * never a hardcoded archetype/section mapping: "hero" only matches an artifact whose paired
 * intent happens to share vocabulary with the item, exactly like every other term it might
 * match on.
 *
 * Deliberately reimplements a minimal structural read of the CreativeIntent/CreativeArtifact
 * JSON shapes rather than importing `creative-artifact-contract` — mirrors this repo's own
 * established precedent (see `creative-intent-brief-adapter/src/validator/digest.ts`'s
 * documented choice to duplicate rather than cross-import a sibling package) and keeps
 * `offscript/src/` free of any dependency on the standalone Creative Generation packages, in
 * either direction.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { repoRoot, projectDir } from '../paths.js';
import { termsOf } from './semantic-selection.js';
import type { PlanItem, PlanItemCreativeArtifactRef } from './types.js';

/** The paired-intent fields a selection decision may read — a structural subset of CreativeIntent. */
export interface ArtifactInventoryIntent {
  readonly id: string;
  readonly belief: string;
  readonly feature: string;
  readonly mustInclude: readonly string[];
  readonly section?: string;
}

/** The paired-artifact fields a selection decision may read — a structural subset of CreativeArtifact. */
export interface ArtifactInventoryArtifact {
  readonly id: string;
  readonly intentDigest: string;
  readonly artifactDigest: string;
  readonly location: string;
  readonly approval: { readonly status: string; readonly source: string };
}

/** Why an artifact failed the Sprint 7 integrity check — never why it was excluded on relevance/approval. */
export type ArtifactIntegrityReason = 'missing-content' | 'digest-mismatch';

export interface ArtifactInventoryEntry {
  readonly intent: ArtifactInventoryIntent;
  readonly artifact: ArtifactInventoryArtifact;
  /** Absent = integrity-valid. Present = DISCOVERED but rejected from selection; never collapsed into "not found". */
  readonly integrityInvalid?: ArtifactIntegrityReason;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function readJsonIfShaped<T>(path: string, requiredKeys: readonly string[]): T | undefined {
  if (!existsSync(path)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined;
  const obj = parsed as Record<string, unknown>;
  for (const key of requiredKeys) {
    if (!(key in obj)) return undefined;
  }
  return parsed as T;
}

/**
 * Reads every well-formed `<dir>/<subdir>/{intent.json,artifact.json}` pair from `dir`.
 * Malformed or incomplete entries are skipped, never thrown on (mirrors the exporter's own
 * "skipped diagnostic, never a hard error" convention) — a missing/absent directory yields `[]`.
 */
export function loadArtifactInventory(dir: string): ArtifactInventoryEntry[] {
  if (!existsSync(dir)) return [];
  const entries: ArtifactInventoryEntry[] = [];
  for (const sub of readdirSync(dir, { withFileTypes: true })) {
    if (!sub.isDirectory()) continue;
    const subDir = join(dir, sub.name);
    const intent = readJsonIfShaped<ArtifactInventoryIntent>(join(subDir, 'intent.json'), [
      'id',
      'belief',
      'feature',
      'mustInclude',
    ]);
    const artifact = readJsonIfShaped<ArtifactInventoryArtifact>(join(subDir, 'artifact.json'), [
      'id',
      'intentDigest',
      'artifactDigest',
      'location',
      'approval',
    ]);
    if (!intent || !artifact) continue;
    const integrityInvalid = verifyArtifactIntegrity(artifact);
    entries.push({ intent, artifact, ...(integrityInvalid ? { integrityInvalid } : {}) });
  }
  entries.sort((a, b) => a.artifact.id.localeCompare(b.artifact.id));
  return entries;
}

/**
 * Sprint 7 — recomputes `artifactDigest` over the artifact's real content and compares it to the
 * declared value. Same sha256-hex, `sha256:`-prefixed mechanism as
 * `creative-artifact-contract/src/artifact/digest.ts`'s `computeContentDigest`, duplicated per
 * this module's own established precedent rather than cross-importing that package (see module
 * header). Deliberately never touches `intentDigest` — an artifact's content integrity is
 * independent of whether its paired intent.json was edited afterward (Phase 3).
 */
export function verifyArtifactIntegrity(artifact: ArtifactInventoryArtifact): ArtifactIntegrityReason | undefined {
  const abs = resolve(repoRoot, artifact.location);
  if (!existsSync(abs)) return 'missing-content';
  const content = readFileSync(abs, 'utf8');
  const digest = `sha256:${createHash('sha256').update(content).digest('hex')}`;
  return digest === artifact.artifactDigest ? undefined : 'digest-mismatch';
}

/** Convenience wrapper: the standard client-scoped inventory location. */
export function loadArtifactInventoryForClient(client: string): ArtifactInventoryEntry[] {
  return loadArtifactInventory(join(projectDir(client), 'creative-assets'));
}

// Both patterns require an `image/` data URI, and BG_URL_RE requires the `background-image`
// property specifically — never a bare `url(data:...)` anywhere in the document. Without this,
// a `@font-face { src: url(data:font/ttf;base64,...) }` block earlier in the document (the
// Creative Authoring layer's own `embedBrandFont` — a real, legitimate, unrelated typography fix)
// wins over the artifact's real visual, since both are just "some url(data:...) in the HTML."
// Real regression, found running the real Creative Artifact -> Website Generation flow end to
// end; see creative-artifact-consumption.test.ts's "font url() must never win" regression test.
const IMG_SRC_RE = /<img[^>]*\bsrc="(data:image\/[^"]+)"/i;
const BG_URL_RE = /background-image\s*:\s*url\((data:image\/[^)]+)\)/i;

/**
 * Extracts a ready-to-embed `data:` URI from an artifact's own self-contained HTML — the first
 * `<img src="data:image/...">`, else the first CSS `background-image: url(data:image/...)`.
 * Never throws; returns `undefined` when the artifact file doesn't resolve or carries no
 * extractable visual (a legitimate non-selection reason, not an error).
 */
export function extractArtifactVisual(entry: ArtifactInventoryEntry): string | undefined {
  return extractVisualFromLocation(entry.artifact.location);
}

/**
 * Same extraction as {@link extractArtifactVisual}, taking just the artifact's `location`
 * (a `PlanItem.creativeArtifact` reference carries no other field this needs) — the entrypoint
 * `author.ts` uses once a `PlanItem` already carries a resolved artifact reference.
 */
export function extractVisualFromLocation(location: string): string | undefined {
  const abs = resolve(repoRoot, location);
  if (!existsSync(abs)) return undefined;
  const html = readFileSync(abs, 'utf8');
  return (html.match(IMG_SRC_RE) ?? html.match(BG_URL_RE))?.[1];
}

function itemTerms(item: PlanItem): Set<string> {
  const parts = [item.intent, item.reasoning?.communicationObjective, String(item.archetype), item.governanceReferenceId];
  return termsOf(parts.filter(isNonEmptyString).join(' '));
}

function intentTerms(intent: ArtifactInventoryIntent): Set<string> {
  const parts = [intent.belief, intent.feature, intent.mustInclude.join(' '), intent.section];
  return termsOf(parts.filter(isNonEmptyString).join(' '));
}

function overlap(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

/**
 * Selects the best-matching, approved artifact for one PlanItem — deterministic lexical
 * term-overlap only (see module header). Never references a specific artifact id or a
 * hardcoded section/archetype name; every match is a byproduct of shared vocabulary between
 * `item`'s own text fields and the candidate's paired intent fields.
 */
export function selectArtifactForItem(
  item: PlanItem,
  inventory: readonly ArtifactInventoryEntry[],
  exclude: ReadonlySet<string> = new Set(),
): ArtifactInventoryEntry | undefined {
  const eligible = inventory.filter(
    (e) => e.artifact.approval.status === 'approved' && !e.integrityInvalid && !exclude.has(e.artifact.id),
  );
  if (eligible.length === 0) return undefined;
  const terms = itemTerms(item);
  let best: ArtifactInventoryEntry | undefined;
  let bestScore = 0;
  for (const entry of eligible) {
    const score = overlap(terms, intentTerms(entry.intent));
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return best;
}

/**
 * Pure, immutable: returns a NEW array of items, each optionally carrying a `creativeArtifact`
 * reference. Never mutates `items`, the inventory, or any artifact record. An artifact already
 * assigned to one item in this call is excluded from later items (first-come-first-served in
 * item order) — avoids repeating the same creative across a page, mirroring `catalog.ts`'s own
 * anti-duplicate-fragment discipline.
 */
export function assignCreativeArtifacts(
  items: readonly PlanItem[],
  inventory: readonly ArtifactInventoryEntry[],
): PlanItem[] {
  const used = new Set<string>();
  return items.map((item) => {
    const selected = selectArtifactForItem(item, inventory, used);
    if (!selected) return { ...item };
    if (extractArtifactVisual(selected) === undefined) return { ...item };
    used.add(selected.artifact.id);
    const ref: PlanItemCreativeArtifactRef = {
      id: selected.artifact.id,
      intentDigest: selected.artifact.intentDigest,
      artifactDigest: selected.artifact.artifactDigest,
      location: selected.artifact.location,
    };
    return { ...item, creativeArtifact: ref };
  });
}
