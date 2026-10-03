/**
 * Stage 4 — bounded violation-aware re-authoring loop (AP-3).
 *
 * The extracted, testable core of scripts/generate.ts's runValidateLoop. It is the
 * GENERATE-path sibling of src/actuation-governed.ts's actuatePassGoverned — the
 * harden-side governed gate-loop that already feeds `priorViolations` back to a
 * subagent and re-validates with slop/drift guards. This module mirrors that
 * governance for the CREATE step rather than reinventing it:
 *
 *   harden  (actuatePassGoverned)         generate  (runReauthorLoop)
 *   ─────────────────────────────────     ─────────────────────────────────────
 *   actuator.harden({ priorViolations })  author.author({ priorFindings })  ← seam
 *   runGate(candidate)                     validate(candidate) → perRail/score
 *   antiSlopGovernance.detect(candidate)   antiSlopGovernance.detect(candidate)  ← REUSED
 *   detectFidelityDrift(reference, cand)   detectFidelityDrift(prior, cand)      ← REUSED
 *   re-loop until both clear / maxLoops    re-author offenders until goal / MAX_PASSES
 *
 * KEY DIFFERENCE — the fidelity reference. The harden path has an immutable
 * reference.html to drift against. The generate path AUTHORS FROM SCRATCH, so there
 * is no external reference: the natural reference is the PRIOR-PASS document. The
 * drift guard then reads "the re-author dropped a section / landmark / archetype /
 * introduced new off-token colour vs the previous pass" — exactly the regression we
 * must reject when a re-author "fixes" one finding by deleting content. Same
 * detectFidelityDrift, prior-pass as the reference.
 *
 * FINDING → ITEM MAPPING (the contract boundary, stated honestly):
 *   Findings carry their site only inside the `id` string (e.g.
 *   `landmark-semantics:<section.id>`, `archetype-tag:unresolved-anchor:<id>`).
 *   mapFindingsToItems matches a DELIMITED id segment against each item's
 *   anchor.id — never a raw substring (so `hero` does not match `hero-banner`).
 *   Findings whose id embeds an item's anchor id are routed to THAT item as
 *   priorFindings. DOCUMENT-GLOBAL findings (brand-fidelity-scan,
 *   accent-saturation-budget, token-normalize, font-fidelity, contrast, lang-attr)
 *   embed no anchor id and map to no item — they still count toward the score that
 *   TRIGGERS the loop, but they are NOT item-targeted content. They remain a
 *   document-level concern deferred to the in-session LLM contract (and are exactly
 *   what keeps the scripted-path TARGET unreached — see the circular-proof notes).
 *
 * SCRIPTED-PATH DETERMINISM (hard invariant): the default scripted author ignores
 * priorFindings entirely, so on the scripted path the re-authored html is
 * byte-identical → the no-progress guard fires on pass 2 → the loop converges in
 * one pass. This module does not change that; it adds the LLM-path channel.
 */

import { parseHtml } from '../working-rep.js';
import { antiSlopGovernance } from '../operators/anti-slop-governance.js';
import { detectFidelityDrift } from '../fidelity-comparator.js';
import { buildOperatorContext } from '../operator-context.js';
import type { Finding, Operator } from '../operator.js';
import type { RunScore } from '../score.js';
import type { WroteOverlay } from '../freeze-wiring.js';
import type { AuthoringPlan, DesignContext } from './types.js';

/** The per-rail residual the validate stage exposes (subset of ValidateResult). */
export interface PerRailEntry {
  operator: Operator;
  findings: Finding[];
}

/** The slice of ValidateResult the loop core needs (decoupled for testability). */
export interface ValidateOutcome {
  score: RunScore;
  frozen: WroteOverlay[];
  perRail: PerRailEntry[];
  /**
   * Path C / P4 — the v2 CURATION GATE verdict (website only). When present and
   * `pass === false`, the page is NOT "done" no matter the ratio: validate-page.js
   * found un-curated / mis-curated bands (the gate findings are already folded into
   * `perRail` under the `curation-gate` rail, so mapFindingsToItems routes them back to
   * the offending items). Absent on the collateral path and on any outcome that did not
   * run the gate → goalMet falls back to the ratio + frozen check exactly as before
   * (backward-compatible). See src/generate/catalog-gate.ts.
   */
  gate?: { pass: boolean; errorCount: number; warningCount: number };
}

/** Re-author the whole document, optionally with per-item prior findings attached. */
export type AuthorFn = (
  findingsByItem?: Map<string, Finding[]>,
) => Promise<{ html: string; warnings: string[] }>;

/** Validate one candidate document and return score + frozen + per-rail findings. */
export type ValidateFn = (html: string) => Promise<ValidateOutcome>;

export interface ReauthorLoopOptions {
  initialHtml: string;
  plan: AuthoringPlan;
  context: DesignContext;
  author: AuthorFn;
  validate: ValidateFn;
  targetRatio: number;
  maxPasses: number;
  /** optional structured progress sink (the script wires console output here). */
  onEvent?: (event: ReauthorLoopEvent) => void;
}

export type ReauthorLoopEvent =
  | { kind: 'pass-start'; pass: number; maxPasses: number }
  | { kind: 'validated'; pass: number; score: RunScore; frozen: WroteOverlay[] }
  | { kind: 'goal-met'; pass: number; ratio: number }
  | { kind: 'max-passes'; pass: number; ratio: number; frozen: number }
  | {
      kind: 'reauthoring';
      pass: number;
      offenderIds: string[];
      itemFindingCount: number;
    }
  | { kind: 'no-progress'; pass: number }
  | {
      kind: 'guard-rejected';
      pass: number;
      slop: number;
      drift: number;
    }
  | { kind: 'advanced'; pass: number; bytes: number; warnings: string[] };

export interface ReauthorLoopResult {
  /** the final accepted html (the last validated, in-bounds candidate). */
  html: string;
  /** the final validate outcome (score that the goal/max-passes decision used). */
  finalOutcome: ValidateOutcome;
  /** number of validate passes run (1 = converged immediately / no-op). */
  passes: number;
  /** why the loop stopped. */
  stoppedBy: 'goal-met' | 'max-passes' | 'no-progress' | 'guard-rejected';
}

/**
 * Map per-rail findings to plan items by matching a DELIMITED id segment against
 * each item's anchor id. Findings whose id contains the anchor id as a
 * colon-delimited or arrow-delimited segment (`…:<anchorId>`, `…:<anchorId>:…`,
 * `…:<anchorId>->…`, `…-><anchorId>`) are routed to that item. Document-global
 * findings (no embedded anchor id) are dropped from the per-item map by design.
 *
 * Returns a Map keyed by anchor id → that item's findings (only items with ≥1
 * matched finding appear as keys).
 */
export function mapFindingsToItems(
  perRail: PerRailEntry[],
  plan: AuthoringPlan,
): Map<string, Finding[]> {
  const byItem = new Map<string, Finding[]>();
  const anchorIds = plan.items.map((i) => i.anchor.id);

  for (const { findings } of perRail) {
    for (const finding of findings) {
      // Route to EVERY item whose anchor id appears as a delimited segment. A
      // single-site finding (`landmark-semantics:<id>`) matches one item; a
      // pair-site finding (`…:<a>-><b>`, e.g. an adjacency collision) matches
      // both — both sections are offenders for that finding.
      for (const anchorId of anchorIds) {
        if (idMatchesAnchor(finding.id, anchorId)) {
          const list = byItem.get(anchorId);
          if (list) list.push(finding);
          else byItem.set(anchorId, [finding]);
        }
      }
    }
  }
  return byItem;
}

/**
 * True iff `findingId` carries `anchorId` as a whole delimited segment, not a raw
 * substring. Delimiters are the only characters finding ids use to separate site
 * descriptors: `:` (operator:site) and `->` (pair sites like adjacency findings).
 * Boundaries: start-of-string or a delimiter on the left; end-of-string or a
 * delimiter on the right. This prevents `hero` from matching `hero-banner`.
 */
function idMatchesAnchor(findingId: string, anchorId: string): boolean {
  const escaped = anchorId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // (^|:|->)  anchorId  ($|:|->)
  const re = new RegExp(`(?:^|:|->)${escaped}(?:$|:|->)`);
  return re.test(findingId);
}

/**
 * Goal: ratio at/above target AND no escalated/frozen regions AND (when a curation gate
 * verdict is present) the gate passed. The gate clause is a strict ADD — `gate` absent
 * (collateral, or a website outcome that didn't run the gate) leaves the decision at the
 * historical ratio+frozen check. A *passing* gate (`pass === true`) likewise never blocks;
 * only an explicit `pass === false` can hold a would-be goal-met page back (AP4.2).
 */
function goalMet(outcome: ValidateOutcome, targetRatio: number): boolean {
  return (
    outcome.score.systematicRatio >= targetRatio &&
    outcome.frozen.length === 0 &&
    outcome.gate?.pass !== false
  );
}

/**
 * The governance guard, mirrored from actuatePassGoverned. A re-authored
 * candidate is IN BOUNDS iff it introduces no slop and no structural drift vs the
 * PRIOR-pass document. Reuses antiSlopGovernance.detect (candidate-only) and
 * detectFidelityDrift (prior-pass as reference) directly — same operators, no
 * reinvention.
 */
export function runGenerateGovernance(
  candidateHtml: string,
  priorHtml: string,
  context: DesignContext,
): { slop: Finding[]; drift: Finding[]; inBounds: boolean } {
  // W77 — mirrors validate.ts's bridge exactly: context.tokens/context.brandContract are this
  // domain's Brand Kit transport already (W75 §2.1); context.brandKit (W76) carries none of it.
  const ctx = buildOperatorContext({
    tokens: context.tokens,
    brandContract: context.brandContract ?? undefined,
  });
  const candidate = parseHtml(candidateHtml);
  const prior = parseHtml(priorHtml);
  const slop = antiSlopGovernance.detect(candidate, ctx);
  const drift = detectFidelityDrift(prior, candidate, ctx);
  return { slop, drift, inBounds: slop.length === 0 && drift.length === 0 };
}

/**
 * The bounded re-authoring loop core. Validates the current candidate; if the goal
 * is met or passes are exhausted, stops. Otherwise maps the per-rail findings to
 * offending items, re-authors WITH those findings attached, runs the governance
 * guard against the prior-pass document, and only accepts the candidate if it is
 * in bounds and actually changed. Stops on no-progress (identical html — the
 * scripted-path 1-pass invariant), on a guard rejection, on goal-met, or on
 * max-passes.
 */
export async function runReauthorLoop(opts: ReauthorLoopOptions): Promise<ReauthorLoopResult> {
  const { plan, context, author, validate, targetRatio, maxPasses } = opts;
  const emit = opts.onEvent ?? (() => {});

  let html = opts.initialHtml;
  let outcome = await validate(html);
  let pass = 1;
  emit({ kind: 'pass-start', pass, maxPasses });
  emit({ kind: 'validated', pass, score: outcome.score, frozen: outcome.frozen });

  while (true) {
    if (goalMet(outcome, targetRatio)) {
      emit({ kind: 'goal-met', pass, ratio: outcome.score.systematicRatio });
      return { html, finalOutcome: outcome, passes: pass, stoppedBy: 'goal-met' };
    }

    if (pass >= maxPasses) {
      emit({
        kind: 'max-passes',
        pass,
        ratio: outcome.score.systematicRatio,
        frozen: outcome.frozen.length,
      });
      return { html, finalOutcome: outcome, passes: pass, stoppedBy: 'max-passes' };
    }

    // ── Map findings → offending items and re-author WITH findings attached ──────
    // NOTE on scope vs actuatePassGoverned: this re-authors the WHOLE document each
    // pass — author(findingsByItem) re-dispatches EVERY plan item — and only the
    // OFFENDING items carry priorFindings; clean items are re-authored from scratch
    // with no findings. (This differs from actuatePassGoverned, which re-hardens the
    // existing doc in place rather than regenerating it; there is no fragment-level
    // splice point on the generate path today.) Consequence: detectFidelityDrift
    // below catches STRUCTURAL regressions in non-offending sections (a dropped
    // landmark/section/page/archetype, a new off-token colour) but NOT a subtle
    // restyle or copy rewrite of a clean section — so "better, not different" is
    // enforced structurally for non-offenders, not at full per-section fidelity.
    // Tightening this (offender-only fragment splice, or a per-section guard) is a
    // future refinement for when the in-session LLM author lands.
    const findingsByItem = mapFindingsToItems(outcome.perRail, plan);
    const offenderIds = [...findingsByItem.keys()];
    const itemFindingCount = [...findingsByItem.values()].reduce((n, f) => n + f.length, 0);
    emit({ kind: 'reauthoring', pass: pass + 1, offenderIds, itemFindingCount });

    const { html: candidateHtml, warnings: candidateWarnings } = await author(findingsByItem);

    // NO-PROGRESS GUARD: identical html ⇒ stop (the deterministic scripted author
    // always lands here on pass 2 — the 1-pass-no-op invariant).
    if (candidateHtml === html) {
      emit({ kind: 'no-progress', pass: pass + 1 });
      return { html, finalOutcome: outcome, passes: pass, stoppedBy: 'no-progress' };
    }

    // ── Governance guard (mirrors actuatePassGoverned): reject a "fix" that ─────
    // introduces slop or structural drift vs the prior-pass document.
    const gov = runGenerateGovernance(candidateHtml, html, context);
    if (!gov.inBounds) {
      emit({
        kind: 'guard-rejected',
        pass: pass + 1,
        slop: gov.slop.length,
        drift: gov.drift.length,
      });
      // Reject the candidate: keep the prior-pass html + its (better) outcome, and
      // STOP. This deliberately diverges from actuatePassGoverned, which feeds its
      // slop/fidelity findings back as priorViolations and re-loops until clean or
      // maxLoops. Here a rejected re-author signals a SYSTEMATIC author problem (the
      // author traded a rail finding for new slop / dropped a section), not a
      // targeted fix worth another attempt — and the loop is already MAX_PASSES
      // bounded, so we conservatively keep the prior (in-bounds) document rather
      // than risk shipping a worse one. (Revisit if MAX_PASSES grows enough to make
      // a feed-back-and-reloop attempt worthwhile.)
      return { html, finalOutcome: outcome, passes: pass, stoppedBy: 'guard-rejected' };
    }

    // Accept the candidate, advance, and re-validate.
    html = candidateHtml;
    pass += 1;
    emit({
      kind: 'advanced',
      pass,
      bytes: Buffer.byteLength(html, 'utf8'),
      warnings: candidateWarnings,
    });
    emit({ kind: 'pass-start', pass, maxPasses });
    outcome = await validate(html);
    emit({ kind: 'validated', pass, score: outcome.score, frozen: outcome.frozen });
  }
}
