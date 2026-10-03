import type { SourceUnit } from './source-units.js';

/**
 * W2-S2 — Source Unit → Consumer Binding.
 *
 * The deterministic, planner-owned, explicit-and-inspectable binding of extracted
 * source units (W2-S1) to consumers (plan items). It produces a `BindingResult`
 * recording EVERY unit's disposition, so no unit can disappear silently:
 *
 *   - bound     — the unit reached a consumer (Tier-2 segment matched an item, or
 *                 a Tier-1 must-include whose seeded consumer survives in the plan).
 *   - unmatched — a Tier-2 body segment that found no consumer (surfaced, not dropped).
 *   - unused    — a Tier-1 must-include with no surviving consumer (e.g. trimmed).
 *
 * SCOPE (Contract 2): this module DECLARES bindings as DATA only. It emits NO
 * AuthoritySignals, owns NO failures, and never touches the ledger / headline /
 * scoring. Fidelity accounting + Failure emission are W2-S3/S4 (owner:
 * `source-fidelity`). The planner is the binding owner and the signal-free producer
 * of this data (W2-FIDELITY-FAILURE-OWNERSHIP.md, invariant i).
 *
 * The Tier-2 matcher mirrors the prior `attachBriefContent` semantics exactly
 * (slug-equality → archetype-equality → unique-substring) so heading-based briefs
 * bind identically; the difference is that it runs over W2-S1's multi-boundary
 * units (so heading-less / preamble bodies now bind) and records explicit
 * dispositions instead of silently skipping.
 */

export type UnitDisposition = 'bound' | 'unmatched' | 'unused';

export interface UnitBinding {
  unitSlug: string;
  tier: 1 | 2;
  kind: SourceUnit['kind'];
  disposition: UnitDisposition;
  /** the consumer this unit bound to (present iff disposition === 'bound'). */
  consumerId?: string;
}

export interface ConsumerGrounding {
  consumerId: string;
  /** true iff the consumer has ANY bound source grounding (body content or a bound must-include). */
  grounded: boolean;
  /** the unit slugs bound to this consumer. */
  boundUnitSlugs: string[];
}

export interface BindingResult {
  /** one entry per extracted unit (Tier-1 + Tier-2), each with a disposition. */
  bindings: UnitBinding[];
  /** one entry per consumer, with its grounding state. */
  consumers: ConsumerGrounding[];
}

/** Minimal consumer shape (decoupled from PlanItem). */
export interface BindConsumer {
  id: string;
  intent: string;
  archetype: string;
}

export interface BindOutput {
  result: BindingResult;
  /** consumerId → the bound Tier-2 segment content to attach (item.content). */
  contentByConsumer: Map<string, string>;
}

/** Slugify to a stable id (matches the planner / source-units slug shape). */
function toSlug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'unit'
  );
}

/** Slug of the text after the first colon (for `archetype: intent` must-include forms). */
function afterColonSlug(label: string): string {
  const i = label.indexOf(':');
  return i > 0 ? toSlug(label.slice(i + 1)) : '';
}

/**
 * Stop words dropped before token-overlap comparison — connectives and generic
 * framing verbs/prepositions that carry no discriminating meaning. Kept small and
 * deterministic; the goal is to compare the *content* nouns/verbs of two labels.
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'with', 'across',
  'how', 'your', 'our', 'is', 'are', 'that', 'this', 'as', 'at', 'by', 'from',
  'into', 'via', 'per', 'we', 'you', 'it', 'its', 'their', 'them',
]);

/**
 * Deterministic significant-token set of a label: lowercase, split on non-alphanumeric,
 * drop stop words and 1–2 char tokens, and normalise a trailing plural `s` (len > 3)
 * so `cost`≡`costs`, `operation`≡`operations`. Pure; no locale dependence.
 */
function significantTokens(label: string): Set<string> {
  const out = new Set<string>();
  for (const raw of label.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3) continue;
    if (STOP_WORDS.has(raw)) continue;
    const norm = raw.length > 3 && raw.endsWith('s') ? raw.slice(0, -1) : raw;
    out.add(norm);
  }
  return out;
}

function sharedTokenCount(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n += 1;
  return n;
}

/**
 * Tier-4 token-overlap fallback (W50). Among the still-unconsumed Tier-2 segments,
 * find the one whose significant-token set best overlaps the consumer's intent.
 * A candidate is only eligible when the overlap is *strong* — ≥ 2 shared significant
 * tokens AND ≥ 50% coverage of the smaller token set — which rejects incidental
 * single-word overlaps. Returns the unique strong best index, or -1 when there is
 * none OR when the strongest score is tied across ≥ 2 segments (abstain, so the
 * segment stays `unmatched` and the G2 fail-loud path is preserved — never a guess).
 */
function tokenOverlapBestIndex(
  intent: string,
  tier2: readonly SourceUnit[],
  consumed: ReadonlySet<number>,
): number {
  const intentTokens = significantTokens(intent);
  if (intentTokens.size === 0) return -1;
  let bestScore = 0;
  let bestIdx = -1;
  let tiedAtBest = false;
  for (let i = 0; i < tier2.length; i++) {
    if (consumed.has(i)) continue;
    const segTokens = significantTokens(tier2[i].label);
    const shared = sharedTokenCount(intentTokens, segTokens);
    if (shared === 0) continue;
    const smaller = Math.min(intentTokens.size, segTokens.size);
    const strong = shared >= 2 && smaller > 0 && shared * 2 >= smaller; // shared/smaller >= 0.5, integer-only
    if (!strong) continue;
    if (shared > bestScore) {
      bestScore = shared;
      bestIdx = i;
      tiedAtBest = false;
    } else if (shared === bestScore) {
      tiedAtBest = true;
    }
  }
  return tiedAtBest ? -1 : bestIdx;
}

/**
 * Bind extracted units to consumers. Deterministic; pure; emits no signals.
 * `inferArchetype` is injected by the planner (its `mustIncludeToArchetype`) so this
 * module reproduces the archetype-tier match without coupling to plan.ts.
 */
export function bindSourceUnits(
  units: { tier1: SourceUnit[]; tier2: SourceUnit[] },
  consumers: readonly BindConsumer[],
  inferArchetype: (label: string) => string,
): BindOutput {
  const contentByConsumer = new Map<string, string>();
  const bindings: UnitBinding[] = [];

  // ── Tier-2 body segments: 3-tier matcher (slug → archetype → unique-substring) ──
  const consumed = new Set<number>(); // index into units.tier2
  const tier2Owner = new Map<number, string>(); // tier2 index → consumerId
  // consumerId → bound tier-2 unit slug (for grounding)
  const tier2BySlugForConsumer = new Map<string, string>();

  for (const c of consumers) {
    const intentSlug = toSlug(c.intent);
    let idx = units.tier2.findIndex((u, i) => !consumed.has(i) && u.slug === intentSlug);
    if (idx === -1) {
      idx = units.tier2.findIndex(
        (u, i) => !consumed.has(i) && inferArchetype(u.label) === c.archetype,
      );
    }
    if (idx === -1) {
      const candidates: number[] = [];
      for (let i = 0; i < units.tier2.length; i++) {
        if (consumed.has(i)) continue;
        const us = units.tier2[i].slug;
        if (us && (intentSlug.includes(us) || us.includes(intentSlug))) candidates.push(i);
      }
      if (candidates.length === 1) idx = candidates[0];
    }
    if (idx === -1) {
      // Tier 4 — strong token-overlap fallback (W50). Binds heading-wording drift
      // (e.g. must-include "Coordinating logistics operations" ↔ heading "How agents
      // coordinate logistics operations"); abstains on ties to preserve fail-loud.
      idx = tokenOverlapBestIndex(c.intent, units.tier2, consumed);
    }
    if (idx !== -1) {
      consumed.add(idx);
      tier2Owner.set(idx, c.id);
      contentByConsumer.set(c.id, units.tier2[idx].content);
      tier2BySlugForConsumer.set(c.id, units.tier2[idx].slug);
    }
  }

  for (let i = 0; i < units.tier2.length; i++) {
    const u = units.tier2[i];
    const ownerId = tier2Owner.get(i);
    bindings.push({
      unitSlug: u.slug,
      tier: 2,
      kind: u.kind,
      disposition: ownerId ? 'bound' : 'unmatched',
      ...(ownerId ? { consumerId: ownerId } : {}),
    });
  }

  // ── Tier-1 must-include units: bound iff a consumer carries its intent ──────────
  // consumerId → bound tier-1 unit slugs (for grounding)
  const tier1ForConsumer = new Map<string, string[]>();
  for (const u of units.tier1) {
    const a = u.slug;
    const b = afterColonSlug(u.label);
    const owner = consumers.find((c) => {
      const cs = toSlug(c.intent);
      return cs === a || (b !== '' && cs === b);
    });
    if (owner) {
      const list = tier1ForConsumer.get(owner.id) ?? [];
      list.push(u.slug);
      tier1ForConsumer.set(owner.id, list);
    }
    bindings.push({
      unitSlug: u.slug,
      tier: 1,
      kind: u.kind,
      disposition: owner ? 'bound' : 'unused',
      ...(owner ? { consumerId: owner.id } : {}),
    });
  }

  // ── Consumer grounding ──────────────────────────────────────────────────────
  const consumerGrounding: ConsumerGrounding[] = consumers.map((c) => {
    const t1 = tier1ForConsumer.get(c.id) ?? [];
    const t2 = tier2BySlugForConsumer.get(c.id);
    const boundUnitSlugs = [...t1, ...(t2 ? [t2] : [])];
    return {
      consumerId: c.id,
      grounded: boundUnitSlugs.length > 0,
      boundUnitSlugs,
    };
  });

  return {
    result: { bindings, consumers: consumerGrounding },
    contentByConsumer,
  };
}
