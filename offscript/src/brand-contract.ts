/**
 * Brand Contract — the aliasing layer between SECTION_INTELLIGENCE.md's
 * project-invariant slot vocabulary (`--accent`, `--surface-0`, …) and a
 * brand kit's actual token names (`--cr-brand-blue`, `--cr-bg`, …).
 *
 * Rails reference slots; this module resolves slots to active kit tokens.
 * Brand-kit ground truth is never mutated.
 *
 * Spec: docs/superpowers/plans/2026-05-28-offscript-brand-contract-aliasing.md
 *
 * Public surface:
 *   - loadBrandContract(path)      — read JSON from disk (null if absent)
 *   - writeBrandContract(path, c)  — deterministic, idempotent write
 *   - deriveBrandContract(css)     — auto-derive from colors_and_type.css
 *   - resolveSlot(ctx, slot)       — null-tolerant slot lookup
 *
 * The shared types (BrandContract, SlotMapping) live on operator.ts so that
 * OperatorContext.brandContract can reference them without a circular import;
 * this module re-exports them for convenience.
 */

import * as fs from 'node:fs';
import { loadTokensFromCss } from './tokens.js';
import { parseHex, type Rgb } from './color.js';
import type { BrandContract, SlotMapping } from './operator.js';

export type { BrandContract, SlotMapping } from './operator.js';

/** Result of resolving a slot — includes the kit-side value when known. */
export interface ResolvedSlot {
  token: string;
  value?: string;
  confidence: 'human' | 'auto' | 'hybrid';
}

/** The fixed slot vocabulary (verbatim from SECTION_INTELLIGENCE.md §1.1). */
export const SLOT_VOCABULARY = [
  '--accent',
  '--accent-2',
  '--accent-soft',
  '--surface-0',
  '--surface-1',
  '--surface-2',
  '--surface-3',
  '--ink-1',
  '--ink-2',
  '--ink-3',
  '--line',
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--shadow-1',
  '--shadow-2',
  '--shadow-3',
  '--font-display',
  '--font-text',
  '--type-scale',
  '--type-base',
  '--space-scale',
  '--section-y',
  '--motion-fast',
  '--motion-med',
  '--motion-slow',
  '--motion-ease',
] as const;

// ───────────────────────── load / write ─────────────────────────

/**
 * Read a brand-contract.json from disk. Returns null if the file does not
 * exist; throws on malformed JSON or shape mismatch (so a typo doesn't
 * silently degrade to "no contract").
 */
export function loadBrandContract(filePath: string): BrandContract | null {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (!isBrandContract(parsed)) {
    throw new Error(`loadBrandContract: ${filePath} is not a valid BrandContract`);
  }
  return parsed;
}

/**
 * Write a BrandContract to disk deterministically. Mirrors overlay.ts's
 * writeIfChanged pattern: if the on-disk content is already byte-identical,
 * the file is left untouched (mtime is not bumped).
 *
 * `generatedAt` is treated as a stamp, not part of identity — if every
 * other field matches the existing file (same slots, same subject, same
 * unmappedReason), the existing `generatedAt` is preserved so the
 * round-trip stays a true no-op. This mirrors `writeOverlay`'s
 * `decidedAt` preservation rule. Returns the path.
 */
export function writeBrandContract(filePath: string, contract: BrandContract): string {
  let toWrite = contract;
  if (fs.existsSync(filePath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
      if (isBrandContract(existing) && isContentEqualIgnoringGeneratedAt(existing, contract)) {
        toWrite = { ...contract, generatedAt: existing.generatedAt };
      }
    } catch {
      // malformed existing file — fall through and overwrite with the new content
    }
  }
  const content = stableStringify(toWrite);
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf8');
    if (existing === content) return filePath;
  }
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

/** Byte-equal serialization with `generatedAt` cleared on both sides. */
function isContentEqualIgnoringGeneratedAt(a: BrandContract, b: BrandContract): boolean {
  const stamp = '__';
  return stableStringify({ ...a, generatedAt: stamp }) === stableStringify({ ...b, generatedAt: stamp });
}

/** Stable JSON: top-level keys sorted; `slots` and `unmappedReason` sorted; 2-space indent; trailing newline. */
function stableStringify(contract: BrandContract): string {
  const slots: Record<string, SlotMapping | null> = {};
  for (const k of Object.keys(contract.slots).sort()) {
    const v = contract.slots[k];
    slots[k] = v === null ? null : { token: v.token, confidence: v.confidence };
  }
  const ordered: Record<string, unknown> = {
    schemaVersion: contract.schemaVersion,
    subject: contract.subject,
    generatedAt: contract.generatedAt,
    decidedBy: contract.decidedBy,
    slots,
  };
  if (contract.unmappedReason !== undefined) {
    const reason: Record<string, string> = {};
    for (const k of Object.keys(contract.unmappedReason).sort()) {
      reason[k] = contract.unmappedReason[k];
    }
    ordered.unmappedReason = reason;
  }
  return JSON.stringify(ordered, null, 2) + '\n';
}

function isSlotMapping(v: unknown): v is SlotMapping {
  if (v === null || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.token === 'string' &&
    (o.confidence === 'human' || o.confidence === 'auto' || o.confidence === 'hybrid')
  );
}

function isBrandContract(v: unknown): v is BrandContract {
  if (v === null || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (o.schemaVersion !== 1) return false;
  if (typeof o.subject !== 'string') return false;
  if (typeof o.generatedAt !== 'string') return false;
  if (o.decidedBy !== 'human' && o.decidedBy !== 'auto' && o.decidedBy !== 'hybrid') return false;
  if (o.slots === null || typeof o.slots !== 'object') return false;
  for (const v of Object.values(o.slots as Record<string, unknown>)) {
    if (v !== null && !isSlotMapping(v)) return false;
  }
  if (o.unmappedReason !== undefined) {
    if (o.unmappedReason === null || typeof o.unmappedReason !== 'object') return false;
    for (const v of Object.values(o.unmappedReason as Record<string, unknown>)) {
      if (typeof v !== 'string') return false;
    }
  }
  return true;
}

// ───────────────────────── resolve ─────────────────────────

/**
 * Resolve a slot name to its mapped kit token. Tolerant: returns null if the
 * contract is undefined, the slot isn't declared, or the slot is explicitly
 * null. Callers must handle null (warn, not crash).
 *
 * If `tokens` is supplied (e.g., from `ctx.tokens.customProps`), the resolved
 * kit-side value is attached when found — convenience for rails that need
 * the actual value, not just the name.
 */
export function resolveSlot(
  contract: BrandContract | undefined,
  slot: string,
  tokens?: Map<string, string>,
): ResolvedSlot | null {
  if (!contract) return null;
  const mapping = contract.slots[slot];
  if (!mapping) return null;
  const out: ResolvedSlot = { token: mapping.token, confidence: mapping.confidence };
  if (tokens) {
    const value = tokens.get(mapping.token);
    if (value !== undefined) out.value = value;
  }
  return out;
}

// ───────────────────────── derive ─────────────────────────

interface Hsl {
  h: number; // 0..360
  s: number; // 0..1
  l: number; // 0..1
}

function rgbToHsl(c: Rgb): Hsl {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h, s, l };
}

function colorFromValue(value: string): { rgb: Rgb; hsl: Hsl } | undefined {
  const rgb = parseHex(value);
  if (!rgb) return undefined;
  return { rgb, hsl: rgbToHsl(rgb) };
}

function parsePx(value: string): number | undefined {
  const m = /^(-?\d+(?:\.\d+)?)px$/i.exec(value.trim());
  return m ? parseFloat(m[1]) : undefined;
}

/**
 * Auto-derive a BrandContract from a brand-kit colors_and_type.css. Heuristics
 * are conservative (per spec) — anything unmatched stays null with an
 * `unmappedReason`. Every mapping carries `confidence: 'auto'`; humans flip to
 * `'human'` after review.
 *
 * `subject` defaults to 'auto'; pass an explicit subject if you have one
 * (e.g., the kit directory's basename).
 */
export function deriveBrandContract(
  kitTokensCss: string,
  opts: { subject?: string; now?: () => Date } = {},
): BrandContract {
  const model = loadTokensFromCss(kitTokensCss);
  const props = model.customProps;
  const subject = opts.subject ?? 'auto';
  const generatedAt = (opts.now?.() ?? new Date()).toISOString();

  const slots: Record<string, SlotMapping | null> = {};
  const unmappedReason: Record<string, string> = {};

  const colorEntries: Array<{ name: string; value: string; rgb: Rgb; hsl: Hsl }> = [];
  for (const [name, value] of props) {
    const c = colorFromValue(value);
    if (c) colorEntries.push({ name, value, rgb: c.rgb, hsl: c.hsl });
  }

  // ─ Accent: first brand-named token that's saturated AND not too dark / pale
  //   (s ≥ 0.4, l ∈ [0.3, 0.7]). A dark wordmark colour (e.g. CR's indigo, l ≈ 0.27)
  //   is a brand colour but not the primary action accent.
  const accentCandidate = colorEntries.find(
    (e) => /brand/i.test(e.name) && e.hsl.s >= 0.4 && e.hsl.l >= 0.3 && e.hsl.l <= 0.7,
  );
  if (accentCandidate) {
    slots['--accent'] = { token: accentCandidate.name, confidence: 'auto' };
  } else {
    slots['--accent'] = null;
    unmappedReason['--accent'] = 'auto-derivation could not match';
  }

  // ─ Accent-2: a brand-named saturated token whose HUE differs from --accent by > 30°
  //   (so different shades of the same hue don't count). Lightness unrestricted —
  //   a deeper wordmark accent is a legitimate second hue.
  const accent2Candidate = accentCandidate
    ? colorEntries.find((e) => {
        if (e.name === accentCandidate.name) return false;
        if (!/brand/i.test(e.name)) return false;
        if (e.hsl.s < 0.4) return false;
        const dh = Math.abs(e.hsl.h - accentCandidate.hsl.h);
        const circularDh = Math.min(dh, 360 - dh);
        return circularDh > 30;
      })
    : undefined;
  if (accent2Candidate) {
    slots['--accent-2'] = { token: accent2Candidate.name, confidence: 'auto' };
  } else {
    slots['--accent-2'] = null;
    unmappedReason['--accent-2'] = 'auto-derivation could not match';
  }

  // ─ Accent-soft: a brand-name token whose value is high-lightness tint (l ≥ 0.85, h within 30deg of --accent).
  if (accentCandidate) {
    const tint = colorEntries.find((e) => {
      if (e.name === accentCandidate.name) return false;
      if (!/brand/i.test(e.name)) return false;
      if (e.hsl.l < 0.85) return false;
      const dh = Math.abs(e.hsl.h - accentCandidate.hsl.h);
      const circularDh = Math.min(dh, 360 - dh);
      return circularDh <= 30;
    });
    if (tint) slots['--accent-soft'] = { token: tint.name, confidence: 'auto' };
    else {
      slots['--accent-soft'] = null;
      unmappedReason['--accent-soft'] = 'auto-derivation could not match';
    }
  } else {
    slots['--accent-soft'] = null;
    unmappedReason['--accent-soft'] = 'auto-derivation could not match';
  }

  // ─ Surface-0: token whose value is pure white.
  const white = colorEntries.find((e) => /^#f{3}(f{3})?$/i.test(e.value.replace(/\s/g, '')));
  if (white) slots['--surface-0'] = { token: white.name, confidence: 'auto' };
  else {
    slots['--surface-0'] = null;
    unmappedReason['--surface-0'] = 'auto-derivation could not match';
  }

  // ─ Surface-1, -2: warm / off-white surface tokens. Lightness ≥ 0.94 alone is enough
  //   at this brightness HSL "saturation" is misleading (a warm white like #FCFAF7
  //   has s ≈ 0.44 because the channels barely differ at near-1.0 max). Exclude pure
  //   white and brand-prefixed tokens (those are accent tints, not surfaces).
  const offWhites = colorEntries.filter(
    (e) =>
      e.name !== white?.name &&
      e.hsl.l >= 0.94 &&
      !/brand/i.test(e.name),
  );
  if (offWhites[0]) slots['--surface-1'] = { token: offWhites[0].name, confidence: 'auto' };
  else {
    slots['--surface-1'] = null;
    unmappedReason['--surface-1'] = 'auto-derivation could not match';
  }
  if (offWhites[1]) slots['--surface-2'] = { token: offWhites[1].name, confidence: 'auto' };
  else {
    slots['--surface-2'] = null;
    unmappedReason['--surface-2'] = 'auto-derivation could not match';
  }
  // ─ Surface-3 (rare emphasis): no reliable heuristic — leave null.
  slots['--surface-3'] = null;
  unmappedReason['--surface-3'] = 'no overlay shadow defined; derive at page level if a modal lands';

  // ─ Ink-1: token whose NAME contains "fg" AND value lightness ≤ 0.3 AND saturation ≤ 0.1.
  const ink1 = colorEntries.find(
    (e) => /(^|-)fg(-|$)/i.test(e.name) && e.hsl.l <= 0.3 && e.hsl.s <= 0.1,
  );
  if (ink1) slots['--ink-1'] = { token: ink1.name, confidence: 'auto' };
  else {
    slots['--ink-1'] = null;
    unmappedReason['--ink-1'] = 'auto-derivation could not match';
  }

  // ─ Ink-2, -3: next `fg`-named tokens (l ≤ 0.5, s ≤ 0.1) in source order, distinct from ink-1.
  const inks = colorEntries.filter(
    (e) =>
      e.name !== ink1?.name &&
      /(^|-)fg(-|$)/i.test(e.name) &&
      e.hsl.l <= 0.5 &&
      e.hsl.s <= 0.1,
  );
  if (inks[0]) slots['--ink-2'] = { token: inks[0].name, confidence: 'auto' };
  else {
    slots['--ink-2'] = null;
    unmappedReason['--ink-2'] = 'auto-derivation could not match';
  }
  if (inks[1]) slots['--ink-3'] = { token: inks[1].name, confidence: 'auto' };
  else {
    slots['--ink-3'] = null;
    unmappedReason['--ink-3'] = 'auto-derivation could not match';
  }

  // ─ Line: token whose NAME contains "line" AND value is a grey near #dadada (l ≈ 0.85, s ≤ 0.1).
  const line = colorEntries.find(
    (e) => /line/i.test(e.name) && e.hsl.l >= 0.75 && e.hsl.l <= 0.95 && e.hsl.s <= 0.1,
  );
  if (line) slots['--line'] = { token: line.name, confidence: 'auto' };
  else {
    slots['--line'] = null;
    unmappedReason['--line'] = 'auto-derivation could not match';
  }

  // ─ Radius-sm / -md / -lg: the three smallest distinct radius values (by px) from --*radius* tokens.
  const radii: Array<{ name: string; px: number }> = [];
  for (const [name, value] of props) {
    if (!/radius/i.test(name)) continue;
    const px = parsePx(value);
    if (px !== undefined) radii.push({ name, px });
  }
  // Sort by px ascending, then by source-order via the original Map iteration (stable).
  const radiiSorted = [...radii].sort((a, b) => a.px - b.px);
  // Pick three with distinct px values.
  const radiusSlots: string[] = [];
  const seenPx = new Set<number>();
  for (const r of radiiSorted) {
    if (seenPx.has(r.px)) continue;
    seenPx.add(r.px);
    radiusSlots.push(r.name);
    if (radiusSlots.length === 3) break;
  }
  const radiusNames = ['--radius-sm', '--radius-md', '--radius-lg'];
  for (let i = 0; i < 3; i++) {
    if (radiusSlots[i]) slots[radiusNames[i]] = { token: radiusSlots[i], confidence: 'auto' };
    else {
      slots[radiusNames[i]] = null;
      unmappedReason[radiusNames[i]] = 'auto-derivation could not match';
    }
  }

  // ─ Shadows: --shadow-1 / -2 from --*shadow* tokens in source order (no value introspection).
  const shadowNames: string[] = [];
  for (const name of props.keys()) {
    if (/shadow/i.test(name)) shadowNames.push(name);
  }
  if (shadowNames[0]) slots['--shadow-1'] = { token: shadowNames[0], confidence: 'auto' };
  else {
    slots['--shadow-1'] = null;
    unmappedReason['--shadow-1'] = 'auto-derivation could not match';
  }
  if (shadowNames[1]) slots['--shadow-2'] = { token: shadowNames[1], confidence: 'auto' };
  else {
    slots['--shadow-2'] = null;
    unmappedReason['--shadow-2'] = 'auto-derivation could not match';
  }
  slots['--shadow-3'] = null;
  unmappedReason['--shadow-3'] = 'no overlay shadow defined; derive at page level if a modal lands';

  // ─ Fonts: --*font* tokens. Display = the one whose NAME contains "display"; text = "body"/"text".
  const fontEntries: string[] = [];
  for (const name of props.keys()) {
    if (/font/i.test(name)) fontEntries.push(name);
  }
  const displayFont = fontEntries.find((n) => /display/i.test(n));
  if (displayFont) slots['--font-display'] = { token: displayFont, confidence: 'auto' };
  else {
    slots['--font-display'] = null;
    unmappedReason['--font-display'] = 'auto-derivation could not match';
  }
  const textFont = fontEntries.find((n) => /body|text/i.test(n));
  if (textFont) slots['--font-text'] = { token: textFont, confidence: 'auto' };
  else {
    slots['--font-text'] = null;
    unmappedReason['--font-text'] = 'auto-derivation could not match';
  }

  // ─ The remaining slots (type-scale, type-base, space-scale, section-y, motion-*) have no
  //   v1 heuristic — left null with reason.
  for (const slot of ['--type-scale', '--type-base', '--space-scale', '--section-y']) {
    slots[slot] = null;
    unmappedReason[slot] = 'auto-derivation could not match';
  }
  for (const slot of ['--motion-fast', '--motion-med', '--motion-slow', '--motion-ease']) {
    slots[slot] = null;
    unmappedReason[slot] = 'kit has no motion tokens; CSS defaults used at use sites';
  }

  return {
    schemaVersion: 1,
    subject,
    generatedAt,
    decidedBy: 'auto',
    slots,
    unmappedReason,
  };
}
