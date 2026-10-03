/**
 * W3-S4 — Intent Consumption (planner-side, deterministic).
 *
 * The pure consumer that turns the Intent Brief's HOW (register / mood / pace) into a
 * deterministic re-ordering of a collateral page's EXISTING composition candidates — the
 * single, frozen proof site (W3-S4-CONTRACT-RECONCILIATION.md, D8). It does NOT generate
 * compositions, invent types, touch content, or reach the author: it only re-orders
 * candidates the planner already has, so the planner's unchanged anti-monotony pick lands
 * on an intent-preferred layout when one is available.
 *
 * Doctrine: this is the deterministic layer consuming a deterministic governance lexicon
 * (`intent-composition-map.md`) — NO LLM, NO semantic interpretation, NO hardcoded taste
 * (the cue→composition table is design-team governance, loaded fail-loud, like form-terms).
 * Consumption is proven by a single-variable differential on plan().items[].composition.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { qualityStandardsDir } from '../paths.js';

/** One governance rule: a HOW cue word → its preferred composition NAME(s), in order. */
export interface CompositionPreferenceRule {
  /** lowercase cue word, matched whole-word + case-insensitive against IntentBrief.how. */
  cue: string;
  /** preferred composition leading-labels (e.g. 'STATEMENT-LED'), in preference order. */
  names: string[];
}

/** Governance path for the intent→composition lexicon (sibling of form-terms.md). */
export function intentCompositionMapPath(): string {
  return join(qualityStandardsDir(), 'intent-composition-map.md');
}

/**
 * FAIL-LOUD governance loader for the cue→composition lexicon. Parses list items of the
 * form `- <cue> → <NAME>[, <NAME> …]` (ASCII `->` also accepted). Throws when the file is
 * missing or yields no rules — load-bearing governance must never silently empty (mirrors
 * intent-readiness.loadFormTerms). Pure beyond the single read.
 */
export function loadIntentCompositionMap(filePath: string): CompositionPreferenceRule[] {
  if (!existsSync(filePath)) {
    throw new Error(
      `intent-consumption: composition map governance not found at ${filePath}. ` +
        `The HOW→composition lexicon is load-bearing for intent consumption.`,
    );
  }
  const raw = readFileSync(filePath, 'utf8');
  const rules: CompositionPreferenceRule[] = [];
  for (const line of raw.split(/\r?\n/)) {
    // `- <cue> → <NAME>, <NAME>` — the arrow is `→` or `->`.
    const m = /^\s*[-*]\s+([a-z][a-z0-9-]*)\s*(?:→|->)\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    const cue = m[1].toLowerCase();
    const names = m[2]
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (names.length > 0) rules.push({ cue, names });
  }
  if (rules.length === 0) {
    throw new Error(
      `intent-consumption: composition map at ${filePath} lists no cue→composition rules.`,
    );
  }
  return rules;
}

/**
 * Resolve the ordered preferred composition NAMES implied by a HOW string. PURE: collects
 * the names of every rule whose cue appears as a whole-word (case-insensitive) in `how`,
 * de-duplicated, in rule order then name order. An empty/absent `how`, or one with no listed
 * cue, yields `[]` (→ a no-op reorder → the baseline selection stands).
 */
export function compositionPreferenceFor(
  how: string | undefined,
  rules: readonly CompositionPreferenceRule[],
): string[] {
  if (!how || how.trim().length === 0) return [];
  const haystack = how.toLowerCase();
  const out: string[] = [];
  const seen = new Set<string>();
  for (const rule of rules) {
    const cueRe = new RegExp(`\\b${escapeRe(rule.cue)}\\b`);
    if (!cueRe.test(haystack)) continue;
    for (const name of rule.names) {
      const key = name.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(name);
      }
    }
  }
  return out;
}

/**
 * Re-order composition candidates so any whose leading label matches a preferred NAME come
 * first (in preference order), with all remaining candidates following in their ORIGINAL
 * order. PURE and stable; returns a NEW array. An empty preference list is identity (same
 * order) — so the baseline anti-monotony pick is byte-identical when intent is absent or
 * carries no governed cue.
 */
export function reorderCandidatesByPreference(
  candidates: readonly string[],
  preferredNames: readonly string[],
): string[] {
  if (preferredNames.length === 0) return [...candidates];
  const wanted = preferredNames.map((n) => n.toUpperCase());
  const preferred: string[] = [];
  // Preferred-first, in preference order; within a name, in candidate order.
  for (const want of wanted) {
    for (const c of candidates) {
      if (leadingLabel(c) === want && !preferred.includes(c)) preferred.push(c);
    }
  }
  const rest = candidates.filter((c) => !preferred.includes(c));
  return [...preferred, ...rest];
}

/** The leading label of a composition string — the text before the first em/en/hyphen dash. */
function leadingLabel(composition: string): string {
  return composition.split(/\s[—–-]\s/)[0].trim().toUpperCase();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
