/**
 * W3-S2 — Intent Readiness Floor.
 *
 * A PURE, deterministic verdict over a replayed IntentBrief. Two objective checks
 * (W3-S2-CONTRACT-RECONCILIATION.md):
 *   - emptiness floor (U-CAT-STRUCT/U-NONEMPTY): the FIVE floor categories
 *     {oneThing, why, how, constraints, antiPatterns} are non-empty (trim-length > 0);
 *     WHAT is supporting — never emptiness-gated.
 *   - form-literal absence (U-FORM-NARROW): no authority-class form token anywhere —
 *     a color literal (#hex / rgb()/hsl()) or a number bound to a CSS/print LENGTH unit
 *     (the unit list is governance, src/paths.ts formTermsPath). Percentages, bare counts,
 *     named colors, visual adjectives, and component/layout nouns are NOT flagged.
 *
 * DATA ONLY. This module returns a structured verdict (U-VERDICT-SHAPE) and:
 *   - emits NO AuthoritySignal (no import of authority.ts),
 *   - calls NO ledger (no import of signal-delivery.ts),
 *   - builds NO headline (no import of run-headline.ts / source-fidelity.ts),
 *   - performs NO vagueness judgment (that is W3-S5),
 *   - performs NO consumption (W3-S4) and NO runtime branching.
 * The verdict is inert until W3-S3 surfaces it. Absent intent → not-ready (missingArtifact),
 * the D-U1 verdict; malformed intent never reaches here (W3-S1 throws at load).
 *
 * `evaluateReadiness` is pure (the unit lexicon is injected) and never throws.
 * `loadFormTerms` is the FAIL-LOUD governance loader (mirrors composition-md /
 * website-numerics): missing/empty governance throws — load-bearing config.
 */

import { readFileSync, existsSync } from 'node:fs';
import type { IntentBrief } from './intent-brief.js';

/** The structured readiness verdict (U-VERDICT-SHAPE) — pure data for W3-S3 to surface. */
export interface ReadinessVerdict {
  /** true iff no missing floor category and no form overstep (and the artifact exists). */
  ready: boolean;
  /** true iff the IntentBrief was absent (undefined) — the D-U1 missing-intent case. */
  missingArtifact: boolean;
  /** floor categories found empty (subset of the five; in canonical order). */
  missingCategories: string[];
  /** the authority-class form tokens found (color literals / length-unit numbers). */
  formOversteps: string[];
}

/** The five emptiness-gated floor categories, in canonical order (U-CAT-STRUCT). */
const FLOOR_CATEGORIES: ReadonlyArray<keyof IntentBrief> = [
  'oneThing',
  'why',
  'how',
  'constraints',
  'antiPatterns',
];

/** Every category whose text is scanned for form literals (incl. the ungated WHAT). */
const SCANNED_CATEGORIES: ReadonlyArray<keyof IntentBrief> = [
  'oneThing',
  'what',
  'why',
  'how',
  'constraints',
  'antiPatterns',
];

/**
 * Color literals — CSS-spec PATTERNS (not a tunable lexicon, so code-resident):
 *   - #hex with 3–8 hex digits (so "#1" is NOT a color), not part of a longer hex run;
 *   - rgb()/rgba()/hsl()/hsla() functional notation.
 */
const COLOR_LITERAL_RE = /#[0-9a-fA-F]{3,8}(?![0-9a-fA-F])|\b(?:rgba?|hsla?)\s*\(/g;

/** Build the length-unit overstep regex from the governance unit list (longest-first). */
function lengthUnitRegex(units: readonly string[]): RegExp {
  const alts = [...units].sort((a, b) => b.length - a.length).map(escapeRe).join('|');
  // A number (optionally decimal) immediately followed by a length unit, with no trailing
  // letter (so "2emu" / "16pxel" do not match). Leading \b keeps it number-anchored.
  return new RegExp(String.raw`\b\d+(?:\.\d+)?(?:${alts})(?![a-zA-Z])`, 'g');
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Collect all authority-class form tokens (color literals + length-unit numbers). */
function scanFormOversteps(text: string, units: readonly string[]): string[] {
  const hits: string[] = [];
  for (const m of text.matchAll(COLOR_LITERAL_RE)) hits.push(m[0]);
  for (const m of text.matchAll(lengthUnitRegex(units))) hits.push(m[0]);
  // De-dup, preserve first-seen order.
  return [...new Set(hits)];
}

/**
 * Compute the readiness verdict for an IntentBrief (or its absence). PURE: never throws;
 * identical input → identical verdict. `units` is the governance length-unit lexicon,
 * injected so this stays disk-free and testable headless.
 */
export function evaluateReadiness(
  intentBrief: IntentBrief | undefined,
  units: readonly string[],
): ReadinessVerdict {
  if (!intentBrief) {
    return { ready: false, missingArtifact: true, missingCategories: [], formOversteps: [] };
  }

  const missingCategories = FLOOR_CATEGORIES.filter(
    (key) => (intentBrief[key] as string).trim().length === 0,
  ) as string[];

  const allText = SCANNED_CATEGORIES.map((key) => intentBrief[key] as string).join('\n');
  const formOversteps = scanFormOversteps(allText, units);

  return {
    ready: missingCategories.length === 0 && formOversteps.length === 0,
    missingArtifact: false,
    missingCategories,
    formOversteps,
  };
}

/**
 * FAIL-LOUD governance loader for the length-unit lexicon. Reads the markdown list at
 * `filePath` (src/paths.ts formTermsPath) and returns the unit tokens. Throws when the
 * file is missing or yields no units — load-bearing governance must never silently empty
 * (mirrors composition-md / website-numerics). Pure beyond the single read.
 */
export function loadFormTerms(filePath: string): string[] {
  if (!existsSync(filePath)) {
    throw new Error(
      `intent-readiness: form-terms governance not found at ${filePath}. ` +
        `The authority-class length-unit lexicon is load-bearing for the readiness floor.`,
    );
  }
  const raw = readFileSync(filePath, 'utf8');
  const units: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    // Markdown list items: "- px" / "* `rem`" — single lowercase token, optional backticks.
    const m = /^\s*[-*]\s+`?([a-z]+)`?\s*$/.exec(line);
    if (m) units.push(m[1]);
  }
  if (units.length === 0) {
    throw new Error(
      `intent-readiness: form-terms governance at ${filePath} lists no length units.`,
    );
  }
  return units;
}
