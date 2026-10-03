/**
 * W2-S1 — Source Unit Extraction (two-tier model).
 *
 * The deterministic, additive replacement for the brittle heading-only body split
 * (`plan.ts` `splitBodyChunks`, whose `chunks.length === 0` early-return is the live
 * R1 root cause: a heading-less brief body collapses to zero segments, silently).
 *
 * Two tiers (Contract 1, OFFSCRIPT-V3-CONTRACTS-RESOLUTION.md):
 *   - Tier 1 (declared / hard): each `must-include` entry is a unit.
 *   - Tier 2 (structural / soft): body segments split on ANY recognised boundary —
 *     a heading, a bold lead-in, or a blank-line block — never a single hardcoded
 *     marker. A heading-less body degrades to coarse blank-line blocks (or one
 *     coarse segment), and **never** to zero segments for non-empty input.
 *
 * SCOPE: extraction only. This module does NOT bind units to consumers (W2-S2),
 * does NOT account/emit signals (W2-S3/S4), and touches nothing in the scoring /
 * freeze / loop / authority / delivery / headline path. Pure functions only.
 */

export type SourceUnitTier = 1 | 2;
export type SourceUnitKind = 'must-include' | 'heading' | 'bold-leadin' | 'blank-block';

export interface SourceUnit {
  tier: SourceUnitTier;
  kind: SourceUnitKind;
  /** stable slug for later binding/attribution (W2-S2), derived from the label. */
  slug: string;
  /** the unit's human label (must-include text / heading text / bold term / first line). */
  label: string;
  /** the unit's verbatim content (the segment text incl. its lead line). */
  content: string;
}

/** Slugify to a stable id (deterministic). Mirrors the planner's slug shape. */
function toSlug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'unit'
  );
}

// ── Boundary recognisers ──────────────────────────────────────────────────────
// A markdown heading: # / ## / ### followed by text.
const HEADING_RE = /^#{1,3}\s+\S/;
// A bold lead-in: a line whose first content (after an optional - / • bullet) is
// **…**. `*` is excluded as a bullet to avoid colliding with the bold markers.
const BOLD_LEADIN_RE = /^\s*(?:[-•]\s+)?\*\*[^*\n]+\*\*/;

function isHeading(line: string): boolean {
  return HEADING_RE.test(line);
}
function isBoldLeadin(line: string): boolean {
  return BOLD_LEADIN_RE.test(line);
}

/** Heading label: strip leading #, then enumerators / circled numbers / bullets. */
function headingLabel(line: string): string {
  return line
    .replace(/^#{1,3}\s+/, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/^[①-⑳]\s*/, '')
    .replace(/^[-*•]\s*/, '')
    .trim();
}

/** Bold lead-in label: the text inside the first **…**, trailing colon stripped. */
function boldLabel(line: string): string {
  const m = /\*\*([^*\n]+)\*\*/.exec(line);
  const inner = m ? m[1] : line;
  return inner.replace(/:\s*$/, '').trim();
}

/** First non-empty line of a block, as its label (truncated for slug sanity). */
function firstLineLabel(block: string): string {
  const first = block.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  return first.slice(0, 80);
}

/** Build a Tier-2 blank-block unit from a verbatim block. */
function blankBlockUnit(block: string): SourceUnit {
  const label = firstLineLabel(block);
  return { tier: 2, kind: 'blank-block', slug: toSlug(label), label, content: block };
}

/**
 * Blank-line block segmentation: split on one-or-more blank lines. A body with no
 * blank lines yields exactly ONE coarse block (the whole text) — never zero for
 * non-empty input. This is the R1 floor.
 */
function blankBlocks(text: string): SourceUnit[] {
  return text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
    .map(blankBlockUnit);
}

/**
 * Tier 1 — one unit per must-include entry, faithful to the source text.
 */
export function extractMustIncludeUnits(mustInclude: readonly string[]): SourceUnit[] {
  return mustInclude.map((entry) => ({
    tier: 1,
    kind: 'must-include',
    slug: toSlug(entry),
    label: entry,
    content: entry,
  }));
}

/**
 * Tier 2 — multi-boundary body segmentation. Boundaries are headings AND bold
 * lead-ins; preamble before the first boundary is preserved as a leading
 * blank-block (never dropped). With no boundaries at all, falls back to blank-line
 * blocks, and finally to one coarse segment — so a non-empty body always yields
 * ≥ 1 segment, and an empty/whitespace body yields zero (legitimately nothing).
 */
export function segmentBody(body: string): SourceUnit[] {
  const text = body.replace(/\r\n/g, '\n');
  if (!text.trim()) return [];

  const lines = text.split('\n');
  const boundaries: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isHeading(lines[i]) || isBoldLeadin(lines[i])) boundaries.push(i);
  }

  // No heading / bold boundary → blank-line blocks (or one coarse segment).
  if (boundaries.length === 0) return blankBlocks(text);

  const segs: SourceUnit[] = [];

  // Preamble before the first boundary — preserved, never dropped (the old bug).
  const firstB = boundaries[0];
  if (firstB > 0) {
    const pre = lines.slice(0, firstB).join('\n').trim();
    if (pre) segs.push(...blankBlocks(pre));
  }

  // Each boundary opens a segment that runs until the next boundary.
  for (let bi = 0; bi < boundaries.length; bi++) {
    const start = boundaries[bi];
    const end = bi + 1 < boundaries.length ? boundaries[bi + 1] : lines.length;
    const lead = lines[start];
    const kind: SourceUnitKind = isHeading(lead) ? 'heading' : 'bold-leadin';
    const label = kind === 'heading' ? headingLabel(lead) : boldLabel(lead);
    const content = lines.slice(start, end).join('\n').trim();
    segs.push({ tier: 2, kind, slug: toSlug(label), label, content });
  }

  return segs;
}

/**
 * Combined two-tier extraction from the brief's source fields. Structural param
 * (not the `Brief` type) keeps this module decoupled. Pure.
 */
export function extractSourceUnits(brief: {
  mustInclude: readonly string[];
  body: string;
}): { tier1: SourceUnit[]; tier2: SourceUnit[] } {
  return {
    tier1: extractMustIncludeUnits(brief.mustInclude),
    tier2: segmentBody(brief.body),
  };
}
