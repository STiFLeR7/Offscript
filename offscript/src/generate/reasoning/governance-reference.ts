/**
 * Sprint W83 — Track-Neutral Governance Reference Resolution.
 *
 * Shared by every id-referencing Governance Model consumer (today: progression's
 * encounterSequence, mechanism's requiredMechanisms) so cross-track reference resolution has
 * exactly ONE implementation. See SPRINT-W83-TRACK-NEUTRAL-GOVERNANCE-REFERENCES.md and the
 * root-cause investigation, SPRINT-W82-PROGRESSION-CONSUMPTION-ROOT-CAUSE.md.
 *
 * The problem this closes (W82): a governance pack is authored ONCE per client, track-
 * independent, but each track's planner used to assign its OWN section ids for the SAME brief
 * content. W83 makes those ids coincide for brief-derived content (`plan.ts`'s
 * `governanceReferenceIdFor`, attached as `PlanItem.governanceReferenceId`). One residual class
 * of reference remains legitimately track-scoped: a track's own STRUCTURAL DEFAULT sections
 * (today: only website's floor-padding, `WEBSITE_DEFAULT_SECTION_IDS`), which have no
 * brief-derived identity and no counterpart on any other track by construction.
 *
 * Resolution classifies every reference into exactly one of three buckets:
 *   - present    — resolves to an item in the CURRENT track's plan. Used for ordering/binding.
 *   - elsewhere  — a recognized structural-default identity belonging to a DIFFERENT track (not
 *                  the one currently generating) — legitimately absent here, NOT an error.
 *   - unresolved — neither. This is the ONLY case a consumer may fail loud on ("unknown
 *                  reference") — the same fail-loud guarantee W6/W7 always had, just now scoped
 *                  to genuine unknowns rather than every cross-track naming difference.
 *
 * The "elsewhere" registry is closed, static, and never inferred: it is built once from each
 * track's OWN already-existing structural-default id list (today: only website's). Adding a
 * future track's own defaults (e.g. deck) means adding ONE entry to TRACK_STRUCTURAL_DEFAULTS —
 * never touching a consumer. No client-specific logic anywhere in this module.
 */
import type { Track } from '../../paths.js';
import { WEBSITE_DEFAULT_SECTION_IDS } from '../plan.js';

/**
 * Per-track closed sets of non-brief-derived structural-default section identities. Extend this
 * map (not the consumers) when a future track gains its own structural defaults. Empty for
 * collateral (no floor-padding, by design) and deck (blocked, no plan builder exists yet).
 */
const TRACK_STRUCTURAL_DEFAULTS: Readonly<Record<Track, ReadonlySet<string>>> = {
  website: WEBSITE_DEFAULT_SECTION_IDS,
  collateral: new Set(),
  deck: new Set(),
};

export interface GovernanceReferenceResolution {
  /** ids that resolve to an item in the CURRENT track's plan, in original reference order. */
  readonly present: readonly string[];
  /** ids recognized as another track's structural default — excluded, not an error. */
  readonly elsewhere: ReadonlySet<string>;
  /** ids that are neither — the only case a consumer may fail loud on, in original order. */
  readonly unresolved: readonly string[];
}

/**
 * Classify a list of governance-authored id references against the CURRENT track's plan
 * identities. Pure, deterministic, no client-specific logic — the same function every
 * id-referencing consumer calls. Does not mutate `ids` or `planIdSet`.
 */
export function resolveGovernanceReferences(
  ids: readonly string[],
  currentTrack: Track,
  planIdSet: ReadonlySet<string>,
): GovernanceReferenceResolution {
  const present: string[] = [];
  const elsewhere = new Set<string>();
  const unresolved: string[] = [];
  for (const id of ids) {
    if (planIdSet.has(id)) {
      present.push(id);
      continue;
    }
    const isStructuralDefaultElsewhere = (Object.keys(TRACK_STRUCTURAL_DEFAULTS) as Track[]).some(
      (track) => track !== currentTrack && TRACK_STRUCTURAL_DEFAULTS[track].has(id),
    );
    if (isStructuralDefaultElsewhere) {
      elsewhere.add(id);
      continue;
    }
    unresolved.push(id);
  }
  return { present, elsewhere, unresolved };
}
