/**
 * W2-S3 — Source Fidelity Accounting.
 *
 * The 100%-coverage accounting layer over the W2-S2 binding. It answers the eight
 * fidelity questions for a plan, as DATA:
 *
 *   units      — which source units were extracted / bound / unmatched / unused
 *   consumers  — which consumers are grounded / ungrounded, and BY WHAT
 *                (brief binding vs source-document fill)
 *
 * SCOPE (Contract 2, W2-FIDELITY-FAILURE-OWNERSHIP.md): this stage ACCOUNTS only.
 * It emits NO AuthoritySignals, owns NO failures, and never touches the ledger /
 * headline / scoring / freeze. Fidelity Failure emission + ledger + headline are
 * W2-S4 (owner `source-fidelity`). This module produces the inspectable record
 * W2-S4 reads to decide what to surface — "Produced → Bound → Accounted", nothing
 * more.
 *
 * Carry-forward closed (W2-S2): source-DOCUMENT grounding participates. The binding
 * only knows brief-side grounding (Tier-1 must-include + Tier-2 body). A collateral
 * page filled by `attachSourceContent` (the declared source doc) is grounded too —
 * its consumer id is passed in `sourceGroundedConsumerIds`, so it is attributed
 * `groundedBy: 'source-doc'` and never appears authored-from-void. Brief grounding
 * takes precedence when a consumer has both.
 */

import type { BindingResult, UnitDisposition } from './source-binding.js';
import type { SourceUnitKind } from './source-units.js';

/** How a consumer obtained its source grounding (or that it has none). */
export type GroundingSource = 'brief' | 'source-doc' | 'none';

/** One extracted unit's place in the accounting (1:1 with a binding entry). */
export interface UnitAccount {
  unitSlug: string;
  tier: 1 | 2;
  kind: SourceUnitKind;
  disposition: UnitDisposition;
  /** the consumer this unit bound to (present iff disposition === 'bound'). */
  consumerId?: string;
}

/** One consumer's grounding account. */
export interface ConsumerAccount {
  consumerId: string;
  grounded: boolean;
  groundedBy: GroundingSource;
  /** unit slugs bound to this consumer by the binding (brief side). */
  boundUnitSlugs: string[];
}

/**
 * Complete fidelity accounting for one plan. `units` + `consumers` are the full
 * records; the *Slugs / *Ids arrays are pre-derived rollups so W2-S4 can read
 * lost-unit / unbound-segment / void-consumer directly, without re-traversing
 * planner state.
 */
export interface SourceAccounting {
  units: UnitAccount[];
  consumers: ConsumerAccount[];
  /** count of extracted units (=== units.length). */
  extractedCount: number;
  /** units that reached a consumer. */
  boundUnitSlugs: string[];
  /** Tier-2 body segments that matched no consumer (unbound segments). */
  unmatchedUnitSlugs: string[];
  /** Tier-1 declared units with no surviving consumer (lost units). */
  unusedUnitSlugs: string[];
  /** consumers with any grounding (brief or source-doc). */
  groundedConsumerIds: string[];
  /** consumers with NO grounding (void consumers). */
  ungroundedConsumerIds: string[];
  /** consumers grounded by brief binding. */
  briefGroundedConsumerIds: string[];
  /** consumers grounded only by the declared source document. */
  sourceDocGroundedConsumerIds: string[];
}

/**
 * Build the complete fidelity accounting for a plan's binding.
 *
 * `sourceGroundedConsumerIds` — consumer ids that the source-document fill
 * (`attachSourceContent`) grounded. Brief grounding (from the binding) wins when a
 * consumer appears in both. Defaults to none (e.g. the website path has no
 * source-doc). Pure; deterministic; emits nothing.
 */
export function buildSourceAccounting(
  binding: BindingResult,
  sourceGroundedConsumerIds: readonly string[] = [],
): SourceAccounting {
  const sourceSet = new Set(sourceGroundedConsumerIds);

  const units: UnitAccount[] = binding.bindings.map((b) => ({
    unitSlug: b.unitSlug,
    tier: b.tier,
    kind: b.kind,
    disposition: b.disposition,
    ...(b.consumerId ? { consumerId: b.consumerId } : {}),
  }));

  const consumers: ConsumerAccount[] = binding.consumers.map((c) => {
    const briefGrounded = c.grounded; // the binding's grounding is brief-side
    const sourceGrounded = !briefGrounded && sourceSet.has(c.consumerId);
    const groundedBy: GroundingSource = briefGrounded
      ? 'brief'
      : sourceGrounded
        ? 'source-doc'
        : 'none';
    return {
      consumerId: c.consumerId,
      grounded: groundedBy !== 'none',
      groundedBy,
      boundUnitSlugs: c.boundUnitSlugs,
    };
  });

  const slugsWhere = (d: UnitDisposition): string[] =>
    units.filter((u) => u.disposition === d).map((u) => u.unitSlug);
  const idsWhere = (pred: (c: ConsumerAccount) => boolean): string[] =>
    consumers.filter(pred).map((c) => c.consumerId);

  return {
    units,
    consumers,
    extractedCount: units.length,
    boundUnitSlugs: slugsWhere('bound'),
    unmatchedUnitSlugs: slugsWhere('unmatched'),
    unusedUnitSlugs: slugsWhere('unused'),
    groundedConsumerIds: idsWhere((c) => c.grounded),
    ungroundedConsumerIds: idsWhere((c) => !c.grounded),
    briefGroundedConsumerIds: idsWhere((c) => c.groundedBy === 'brief'),
    sourceDocGroundedConsumerIds: idsWhere((c) => c.groundedBy === 'source-doc'),
  };
}
