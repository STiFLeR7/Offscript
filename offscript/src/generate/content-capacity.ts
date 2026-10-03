/**
 * P24 — Content Contract v2 Foundation: Content Capacity (transport only).
 *
 * Makes the P23-designed, OPTIONAL W17 body section `## Content Capacity` machine-readable as a
 * typed, immutable, deterministically-cached model — WITHOUT any consumer. Mirrors the W18/W20
 * loader+provider architecture exactly (`../knowledge/semantic-body.ts`,
 * `./semantic-author-context.ts`): one parser, one immutable model, one provider, one digest, one
 * per-slug cache with a fail-loud mid-run digest-mismatch guard.
 *
 * Each `## Content Capacity` line declares one named content slot a component accepts:
 *   `- <slot-name>: <shape>, <required|optional>, <min>-<max>` (or a bare `<n>` for an exact count,
 *   e.g. `required, 1` — the exact syntax P23 §5.1's own worked example uses).
 *
 * Boundary (load-bearing, per docs/internals/P23-CONTENT-CONTRACT-V2-ARCHITECTURE.md §5.3):
 *  - NOT a runtime type change beyond one optional `PlanItem.contentCapacity?` transport field
 *    (see plan.ts) — no change to Brief, DesignContext, or AuthoringRequest.
 *  - NOT a planner change — mustIncludeToArchetype/attachBriefContent/bindSourceUnits are untouched.
 *  - NOT a renderer or Author change — nothing reads the transported field this sprint.
 *  - NOT Content Decomposition — a slot's `shape` is a closed, single-token classification of what
 *    KIND of thing a slot holds, never a decomposition of brief prose into claims/proof/metrics.
 *  - NOT an enforcement mechanism — declaration only; no capacity checking exists anywhere.
 *
 * This module does ONE markdown pass of its own: it re-parses the ALREADY-EXTRACTED
 * `## Content Capacity` section markdown (a short bullet list) into typed slots. It never re-reads
 * the file or re-scans `##` headings — that single pass is `semantic-body.ts`'s, reused verbatim via
 * `loadSemanticKnowledge`. This is a structured micro-parse of already-parsed text, the same
 * category as `mustIncludeToArchetype` parsing an already-extracted brief string — not a second
 * markdown parser.
 *
 * No reasoning. No interpretation. No embeddings. No vectors. No LLM.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ComponentSemanticKnowledge } from '../knowledge/semantic-body.js';
import { extractBody, bodyDigest, loadSemanticKnowledge } from '../knowledge/semantic-body.js';

/** The closed, P23 §5.2 nine-value shape vocabulary. A capability, never a format. */
export const CONTENT_SHAPES = [
  'heading',
  'paragraph',
  'list-item',
  'stat',
  'quote',
  'logo',
  'image',
  'cta-label',
  'link',
] as const;

export type ContentShape = (typeof CONTENT_SHAPES)[number];
const CONTENT_SHAPE_SET: ReadonlySet<string> = new Set(CONTENT_SHAPES);

export class ContentCapacityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentCapacityError';
  }
}

/** One authored content slot: what a component accepts, its shape, and its repeat bounds. */
export interface ContentCapacitySlot {
  readonly name: string;
  readonly shape: ContentShape;
  readonly required: boolean;
  readonly min: number;
  readonly max: number;
}

/** The carrier the (future) planner MAY attach to a PlanItem. Immutable. */
export interface ContentCapacity {
  readonly slots: readonly ContentCapacitySlot[];
  /**
   * P24 Foundation step 5 (digest participation) — the SAME whole-body digest the W18 loader
   * already computes (`ComponentSemanticKnowledge.digest`), not a second, section-scoped digest
   * scheme. The whole-body digest already changes whenever the Content Capacity section's text
   * changes (it is part of the body it hashes), so transport integrity is proven by reuse, not by
   * inventing a new identity mechanism.
   */
  readonly digest: string;
  readonly sourceFile: string;
}

const SLOT_LINE =
  /^-\s+([a-z][a-z0-9]*(?:-[a-z0-9]+)*):\s+([a-z-]+),\s+(required|optional),\s+(\d+)(?:-(\d+))?\s*$/;

/**
 * Parse an ALREADY-EXTRACTED `## Content Capacity` section's markdown into typed slots. Pure and
 * deterministic. Fails loud on: empty input, a malformed line (wrong shape entirely), an unknown
 * shape token, a duplicate slot name, or inverted bounds (min > max). A bare trailing count (no
 * dash) means an exact min == max == n, matching P23 §5.1's own worked example (`required, 1`).
 */
export function parseContentCapacitySlots(markdown: string, location = '<body>'): ContentCapacitySlot[] {
  const lines = markdown.split('\n').map((l) => l.trim()).filter((l) => l !== '');
  if (lines.length === 0) {
    throw new ContentCapacityError(`${location}: empty Content Capacity section — expected at least one slot line`);
  }
  const slots: ContentCapacitySlot[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const m = SLOT_LINE.exec(line);
    if (!m) {
      throw new ContentCapacityError(
        `${location}: malformed Content Capacity line '${line}' — expected ` +
          `'- <slot-name>: <shape>, <required|optional>, <min>-<max>'`,
      );
    }
    const [, name, shape, requiredWord, minStr, maxStr] = m;
    if (!CONTENT_SHAPE_SET.has(shape)) {
      throw new ContentCapacityError(
        `${location}: unknown content shape '${shape}' for slot '${name}' — only ` +
          `(${CONTENT_SHAPES.join(', ')}) are permitted`,
      );
    }
    if (seen.has(name)) {
      throw new ContentCapacityError(`${location}: duplicate content slot '${name}'`);
    }
    seen.add(name);
    const min = Number(minStr);
    const max = maxStr === undefined ? min : Number(maxStr);
    if (min > max) {
      throw new ContentCapacityError(`${location}: slot '${name}' has inverted bounds (min ${min} > max ${max})`);
    }
    slots.push(
      Object.freeze({
        name,
        shape: shape as ContentShape,
        required: requiredWord === 'required',
        min,
        max,
      }),
    );
  }
  return slots;
}

/**
 * Extract Content Capacity from an already-parsed W18 semantic body. Returns null when the body
 * has no `## Content Capacity` section — absence is a fully valid state (today's entire 96-
 * component corpus). Reuses the section markdown `semantic-body.ts` already extracted; performs no
 * additional file read or heading scan.
 */
export function extractContentCapacity(k: ComponentSemanticKnowledge): ContentCapacity | null {
  const section = k.sections.find((s) => s.name === 'Content Capacity');
  if (!section) return null;
  const slots = parseContentCapacitySlots(section.markdown, k.sourceFile);
  return Object.freeze({
    slots: Object.freeze(slots),
    digest: k.digest,
    sourceFile: k.sourceFile,
  });
}

const HAS_H2 = /^##(?!#)\s+/m;

/** A built provider over a component repository root. */
export interface ContentCapacityProvider {
  /** The Content Capacity for a component slug; null when absent (no section, or no component). */
  capacityFor(slug: string): ContentCapacity | null;
}

/** Default repository root: offscript/repository (module-relative; overridable for tests). */
export function defaultRepositoryRoot(): string {
  return fileURLToPath(new URL('../../repository', import.meta.url));
}

/**
 * Build the provider. Per-slug cache keyed on the body digest; a changed body between reads
 * (digest mismatch) fails loud rather than transporting a stale capacity — the exact guarantee
 * `createComponentKnowledgeProvider` (W20) already gives its callers.
 */
export function createContentCapacityProvider(root: string = defaultRepositoryRoot()): ContentCapacityProvider {
  const cache = new Map<string, { digest: string; capacity: ContentCapacity | null }>();
  return {
    capacityFor(slug) {
      const file = `${root}/canonical/${slug}/component.md`;
      if (!existsSync(file)) return null;
      const body = extractBody(readFileSync(file, 'utf8'), `canonical/${slug}/component.md`);
      const digest = bodyDigest(body);
      const hit = cache.get(slug);
      if (hit) {
        if (hit.digest !== digest) {
          throw new ContentCapacityError(`content-capacity: digest mismatch for '${slug}' (body changed mid-run)`);
        }
        return hit.capacity;
      }
      const capacity = HAS_H2.test(body) ? extractContentCapacity(loadSemanticKnowledge(file, root)) : null;
      cache.set(slug, { digest, capacity });
      return capacity;
    },
  };
}
