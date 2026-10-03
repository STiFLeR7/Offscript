/**
 * Stage 2 (website) — the composition router (audit §9 A2 + A1).
 *
 * Routes each website section's archetype → a COMPOSITION.md `Serves` candidate, rotates
 * among equals (anti-monotony, last-N memory), respects {limits} at selection time, and
 * writes the per-section recipe onto each PlanItem:
 *   - composition       → the `## Assigned composition` steering string (A2)
 *   - componentVariant  → the bare slug (stamped into markup for the B1 rail)
 *   - surfaceRole       → the variant surface
 *   - sectionGuidance   → the `## Section intelligence` excerpt (A1)
 *
 * Deterministic (catalog order + index rotation; no randomness). Website-only — the
 * collateral/deck plan paths never call this, and every field it sets is optional.
 */

import type { PlanItem } from './types.js';
import type { CompositionRow, CompositionLimits } from './composition-md.js';
import type { Archetype } from '../archetype.js';
import { loadComposeSkeletons, skeletonForIntent, type Skeleton } from './compose-md.js';
import { roleTermsForArchetype, type SemanticSelection } from './semantic-selection.js';
import { applyFamilyKnowledge, type FamilySelection } from './family-selection.js';
import { applyMissionAudience, type MissionAudienceSelection } from './mission-audience.js';
import { band, keepMax, keepMaxFloorExclude, terminal } from './selection-policy.js';
import { websiteVisualDiscoveryTieBreak } from './website-visual-discovery.js';
import { ARCHETYPE_SERVES as ARCHETYPE_INTENT, isBestFit } from './archetype-contract.js';

/**
 * Family Job/Rules one-liner per serves-intent (distilled from components.md's 17 families).
 * Every value ARCHETYPE_INTENT can emit MUST have a row here (guidanceString falls back to ''
 * otherwise).
 */
const FAMILY_RULES: Record<string, string> = {
  hero: '**Hero** — first screen: state ONE promise + ONE primary action; lead with the claim, not the chrome.',
  feature: '**Feature / value-prop** — explain a capability or value; proof over adjectives; peers get equal weight.',
  'value-prop': '**Value-prop / editorial** — one idea, stated with scale and air; a manifesto moment, not a grid.',
  process: '**Process / how-it-works** — show workability as a clear sequence; one step reads as one step.',
  integrations: '**Integrations** — signal ecosystem fit; marks/logos as evidence, not decoration.',
  comparison: '**Comparison** — weigh options factor-by-factor; status-quo neutral, our column accented.',
  pricing: '**Pricing** — make cost clear and low-anxiety; parallel plans, one primary path.',
  logos: '**Social proof / logos** — borrowed credibility; marks only, quiet and even.',
  stats: '**Stats / outcomes** — proof via checkable numbers; the numerals ARE the argument.',
  testimonials: '**Testimonials / case studies** — human-voice proof; real quotes, attributed, never invented.',
  team: '**Team / about** — credibility of the people behind the offering; faces and roles, not fluff.',
  resources: '**Resources / insights** — demonstrate substance and offer depth; a scannable shelf.',
  faq: '**FAQ** — anticipate and answer real doubts; one question per row, plainspoken.',
  cta: '**Call-to-action (closing)** — convert earned trust into a single next step; one imperative.',
  contact: '**Contact / lead form** — capture intent at low friction; ask for the minimum.',
  footer: '**Footer** — close the page and orient the reader who reached the end; wayfinding, not a second hero.',
};

/** The candidate rows for an archetype (section rows whose serves includes the mapped intent). */
export function candidatesFor(archetype: string, catalog: CompositionRow[]): CompositionRow[] {
  const intent = ARCHETYPE_INTENT[archetype as Archetype];
  if (!intent) return [];
  return catalog.filter((r) => r.serves.includes(intent));
}

/** A row is hero-family iff it can serve the hero intent (the COMPOSITION.md Hero rows). */
function isHeroFamily(row: CompositionRow): boolean {
  return row.serves.includes('hero');
}

/** A row is rhythm-eligible iff its surface is contrast or figure (catalog-derived, not slug). */
function isRhythmEligible(row: CompositionRow): boolean {
  return row.surface === 'contrast' || row.surface === 'figure';
}

function limitsNote(limits: CompositionLimits): string {
  const parts: string[] = [];
  if (limits.maxPerPage != null) parts.push(`max ${limits.maxPerPage} per page`);
  if (limits.minBands != null) parts.push(`only on pages with ≥${limits.minBands} sections`);
  if (limits.avoidAdjacent) parts.push(`never adjacent to a ${limits.avoidAdjacent} band`);
  if (limits.avoidAdjacentSurface)
    parts.push(`never adjacent to a ${limits.avoidAdjacentSurface}-surface band`);
  return parts.length ? ` Limits: ${parts.join('; ')}.` : '';
}

function steeringString(row: CompositionRow): string {
  const layout = row.layout[0] ?? 'section';
  return (
    `Build a \`${row.name}\` (${layout}, ${row.surface} surface). ${row.direction} ` +
    `Stamp \`data-cr-component="${row.slug}"\` and \`data-cr-surface="${row.surface}"\` on the ` +
    `section root element (the engine and the composition-limits rail read these).`
  ).trim();
}

function guidanceString(intent: string | undefined, row: CompositionRow): string {
  const family = (intent && FAMILY_RULES[intent]) || '';
  return (
    `${family}\n` +
    `Chosen variant **${row.slug}** — blocks: ${row.blocks.join(', ') || '(none listed)'}.` +
    limitsNote(row.limits)
  ).trim();
}

/** True iff `row` may be placed at this position without breaking a deterministic limit. */
function limitsOk(
  row: CompositionRow,
  prev: PlanItem | undefined,
  totalBands: number,
  slugCount: Map<string, number>,
  bySlug: Map<string, CompositionRow>,
): boolean {
  const lim = row.limits;
  if (lim.maxPerPage != null && (slugCount.get(row.slug) ?? 0) >= lim.maxPerPage) return false;
  if (lim.minBands != null && totalBands < lim.minBands) return false;
  if (prev) {
    const prevServes = prev.componentVariant
      ? bySlug.get(prev.componentVariant)?.serves ?? []
      : [];
    if (lim.avoidAdjacent && prevServes.includes(lim.avoidAdjacent)) return false;
    if (lim.avoidAdjacentSurface && prev.surfaceRole === lim.avoidAdjacentSurface) return false;
  }
  return true;
}

/** A4: build a grammar-shaped composition from a §B slot skeleton when no whole variant fits. */
function skeletonComposition(intent: string | undefined, skeletons: Skeleton[]): { composition: string; guidance: string } | null {
  if (!intent) return null;
  const sk = skeletonForIntent(intent, skeletons);
  if (!sk) return null;
  const slots = sk.slots.join(' + ');
  const composition =
    `Compose this section from the COMPOSE §B "${sk.intent}" skeleton — slots: ${slots}. ` +
    `Fill each slot from any donor block; obey the focal-weight model (COMPOSE §D): exactly ONE ` +
    `FOCAL block (largest scale, the single accent), the rest SUPPORT or AMBIENT. One surface per band.`;
  // family rule keyed on the router intent (what the section IS); the note names sk.intent
  // (what it was composed FROM) — for an aliased intent these differ, deliberately.
  const guidance = (FAMILY_RULES[intent] ?? '') + `\nNo whole variant fit — composed from the §B "${sk.intent}" skeleton.`;
  return { composition: composition.trim(), guidance: guidance.trim() };
}

/**
 * W50 Track 3.5 — one record of a presentation-cadence adjustment. Data only; the durable,
 * explainable trail for why a section's surface changed. Structural intent is NEVER changed —
 * only the visual surface band (and, as its vehicle, the within-intent variant).
 */
export interface RhythmAdjustment {
  /** index of the adjusted section in the plan (order is never changed). */
  sectionIndex: number;
  /** the section's stable anchor id. */
  anchorId: string;
  /** the section's archetype — UNCHANGED by the adjustment (recorded for the trail). */
  archetype: string;
  beforeSurface: string;
  afterSurface: string;
  beforeVariant: string;
  afterVariant: string;
  /** human-readable rationale. */
  reason: string;
}

/**
 * Assign each website section its composition recipe. Mutates `items` in place; pushes a
 * warning for any archetype with no catalog candidate (left unrouted, never crashes).
 *
 * `rhythmCadence` (W50 Track 3, default off ⇒ byte-identical) runs a presentation-cadence pass
 * AFTER routing + the B-2 guarantee: where two adjacent same-archetype sections share a surface,
 * it re-picks the later one to a WITHIN-INTENT variant of a DIFFERENT surface — identical
 * information, better visual rhythm. It never changes archetype, section role, order, or count;
 * only the surface band (and its carrier variant). Each change is recorded in `rhythmAudit`.
 */
export function assignWebsiteCompositions(
  items: PlanItem[],
  catalog: CompositionRow[],
  warnings: string[],
  skeletons: Skeleton[] = loadComposeSkeletons(),
  briefScore?: (row: CompositionRow) => number,
  semantic?: SemanticSelection,
  family?: FamilySelection,
  mission?: MissionAudienceSelection,
  w16BandDelta = 0,
  rhythmCadence = false,
  rhythmAudit?: RhythmAdjustment[],
): void {
  const WINDOW = 3;
  const recent: string[] = [];
  const useCount = new Map<string, number>();
  const slugCount = new Map<string, number>();
  const bySlug = new Map(catalog.map((r) => [r.slug, r]));
  let heroFamilyUsed = 0;

  items.forEach((item, i) => {
    const archetype = String(item.archetype);
    const intent = ARCHETYPE_INTENT[archetype as Archetype];
    let cands = candidatesFor(archetype, catalog);
    const isHeroSection = intent === 'hero';
    if (!isHeroSection) {
      cands = cands.filter((r) => !isHeroFamily(r)); // non-hero band may never wear a hero variant
    } else if (heroFamilyUsed >= 1) {
      cands = cands.filter((r) => !isHeroFamily(r)); // cap hero-family to one per page
    }
    if (cands.length === 0) {
      const skel = skeletonComposition(intent, skeletons);
      if (skel) {
        item.composition = skel.composition;
        item.sectionGuidance = skel.guidance;
        warnings.push(
          `Offscript website-composition: no COMPOSITION.md variant for archetype "${archetype}"` +
            (intent ? ` (intent "${intent}")` : '') +
            ` — section "${item.anchor.id}" composed from the COMPOSE §B skeleton (A4 fallback).`,
        );
      } else {
        warnings.push(
          `Offscript website-composition: no COMPOSITION.md candidate and no §B skeleton for archetype "${archetype}"` +
            (intent ? ` (intent "${intent}")` : ' (no intent mapping)') +
            ` — section "${item.anchor.id}" left unrouted (no per-section recipe forwarded).`,
        );
      }
      return;
    }
    const prev = i > 0 ? items[i - 1] : undefined;

    let pool = cands.filter((r) => limitsOk(r, prev, items.length, slugCount, bySlug));
    if (pool.length === 0) pool = cands;

    // W16 Goal 2 — brief-aware narrowing (only when a brief scorer is supplied / governance enabled).
    // FIRST honour best-fit (serves[0] === intent) exactly as pickFragment does — so brief affinity can
    // never elevate a merely-secondary-serving variant (e.g. a cta row that also lists `hero`) above a
    // primary one. Then, within the best-fit set, keep the highest brief-affinity candidates before the
    // existing anti-monotony rotation. Omitted scorer ⇒ pool unchanged ⇒ byte-identical (disabled).
    let scoredPool = pool;
    if (briefScore) {
      const bestFit = pool.filter((r) => isBestFit(r.serves[0], intent));
      const base = bestFit.length > 0 ? bestFit : pool;
      // W33 Soft-Band Cascade (W32 §6.3) — the ONLY behavioural change: the W16 stage
      // narrows to the tolerance band `keep score >= max − δ` instead of the exact
      // maximum. δ=0 ≡ exact-max (`best > 0 ? filter(===best) : base`, since brief
      // scores are non-negative integers) ⇒ byte-identical default; δ≥1 keeps near-tie
      // candidates alive for the W19/W24/W30 stages below. Floor-protected (never empties).
      scoredPool = band(base, (r) => briefScore(r), w16BandDelta);
    }

    // W19 — semantic FINAL discriminator (after best-fit + brief). Drop effectively-excluded
    // candidates (avoid-when) unless that empties the pool, then keep the highest semantic score.
    // A candidate with no semantic body scores 0 (no opinion); all-zero ⇒ pool unchanged ⇒
    // byte-identical. Absent scorer ⇒ skipped entirely.
    if (semantic && scoredPool.length > 1) {
      const ctx = {
        briefTerms: semantic.briefTerms,
        precedingRoleTerms: prev ? roleTermsForArchetype(String(prev.archetype)) : undefined,
      };
      const verdicts = new Map(scoredPool.map((r) => [r.slug, semantic.consumer.scoreFor(r.slug, ctx)]));
      scoredPool = keepMaxFloorExclude(
        scoredPool,
        (r) => verdicts.get(r.slug)?.score ?? 0,
        (r) => verdicts.get(r.slug)?.excluded ?? false,
      );
    }

    // W24 — FAMILY discriminator, AFTER best-fit + brief + W19 component semantics (the SECONDARY
    // discriminator). Narrows the still-tied pool by the candidate's canonical family knowledge:
    // drop effectively-excluded families unless that empties the pool, then keep the highest family
    // score. A candidate whose family has no opinion scores 0 ⇒ all-zero leaves the pool unchanged.
    // Absent scorer ⇒ skipped entirely (byte-identical).
    if (family && scoredPool.length > 1) {
      const ctx = {
        briefTerms: family.briefTerms,
        precedingRoleTerms: prev ? roleTermsForArchetype(String(prev.archetype)) : undefined,
      };
      scoredPool = applyFamilyKnowledge(scoredPool, (r) => family.consumer.scoreFor(r.slug, ctx));
    }

    // W30 — MISSION/AUDIENCE, the FINAL quality discriminator, AFTER best-fit + brief + W19 + W24.
    // Narrows the still-tied pool to the candidates whose derived mission/audience profile best fits
    // THIS brief. No exclusion: a zero-overlap candidate scores 0 and stays; an all-equal pool is
    // returned unchanged. Absent scorer ⇒ skipped entirely (byte-identical).
    if (mission && scoredPool.length > 1) {
      const ctx = { briefProfile: mission.briefProfile };
      scoredPool = applyMissionAudience(scoredPool, (r) => mission.consumer.scoreFor(r.slug, ctx));
    }

    // W72 — Website Visual Discovery, the FINAL late-stage discriminator, AFTER best-fit + brief +
    // W19 + W24 + W30. Consumes ONLY the item's own already-transported `visualDiscovery` (W70) —
    // no new evidence, no widening (scoredPool is the same pool every stage above already narrowed).
    // Absent transport, or `archetypeFit: true` (agreement) ⇒ tieBreak is undefined ⇒ skipped
    // entirely (byte-identical). When present, prefer candidates whose OWN `serves` also lists the
    // family the bound content reads as; an all-zero pool (no candidate multi-serves that family)
    // is left unchanged — this never removes the sole/structurally-superior candidate.
    const visualTieBreak = websiteVisualDiscoveryTieBreak(item.visualDiscovery);
    if (visualTieBreak && scoredPool.length > 1) {
      scoredPool = keepMax(scoredPool, (r) => visualTieBreak(r.serves));
    }

    const chosen =
      terminal(scoredPool, {
        inRecentWindow: (r) => recent.includes(r.slug),
        useCount: (r) => useCount.get(r.slug) ?? 0,
      }) ?? scoredPool[0];

    item.componentVariant = chosen.slug;
    item.surfaceRole = chosen.surface;
    item.composition = steeringString(chosen);
    item.sectionGuidance = guidanceString(intent, chosen);
    if (isHeroFamily(chosen)) heroFamilyUsed += 1;

    slugCount.set(chosen.slug, (slugCount.get(chosen.slug) ?? 0) + 1);
    useCount.set(chosen.slug, (useCount.get(chosen.slug) ?? 0) + 1);
    recent.push(chosen.slug);
    if (recent.length > WINDOW) recent.shift();
  });

  // B-2 page-level surface-rhythm guarantee (spec §3.2). If no band is contrast/figure,
  // deterministically promote the EARLIEST eligible non-hero/non-footer section.
  const hasRhythm = items.some(
    (it) => it.surfaceRole === 'contrast' || it.surfaceRole === 'figure',
  );
  if (!hasRhythm) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.componentVariant) continue; // only already-routed sections
      const ownIntent = ARCHETYPE_INTENT[String(it.archetype) as Archetype];
      if (ownIntent === 'hero' || ownIntent === 'footer') continue; // never the hero/footer beat
      const prev = i > 0 ? items[i - 1] : undefined;
      const rhythmCands = candidatesFor(String(it.archetype), catalog)
        .filter(isRhythmEligible)
        .filter((r) => limitsOk(r, prev, items.length, slugCount, bySlug));
      if (rhythmCands.length === 0) continue;
      const promoted =
        terminal(rhythmCands, {
          inRecentWindow: (r) => recent.includes(r.slug),
          useCount: (r) => useCount.get(r.slug) ?? 0,
        }) ?? rhythmCands[0];
      it.componentVariant = promoted.slug;
      it.surfaceRole = promoted.surface;
      it.composition = steeringString(promoted);
      it.sectionGuidance = guidanceString(ownIntent, promoted);
      slugCount.set(promoted.slug, (slugCount.get(promoted.slug) ?? 0) + 1);
      useCount.set(promoted.slug, (useCount.get(promoted.slug) ?? 0) + 1);
      break; // one promotion is enough
    }
  }

  // ── W50 Track 3 — presentation cadence (surface-only; identical information) ─────────────
  // Where two ADJACENT same-archetype sections share a surface, re-pick the later one to a
  // within-intent variant of a DIFFERENT surface — breaking a monotonous run (Feature/Feature/
  // Feature/Feature → alternating surfaces) without touching archetype/role/order/count. Walks
  // forward so each decision reads the (possibly just-adjusted) previous surface, yielding a
  // deterministic ABAB alternation. Abstains (no change) when no alternate-surface variant fits —
  // it never invents rhythm. Default off ⇒ this block never runs ⇒ byte-identical.
  if (rhythmCadence) {
    for (let i = 1; i < items.length; i++) {
      const cur = items[i];
      const prev = items[i - 1];
      if (!cur.componentVariant || !prev.componentVariant) continue; // only routed pairs
      if (String(cur.archetype) !== String(prev.archetype)) continue; // same-archetype run only
      if (cur.surfaceRole !== prev.surfaceRole) continue; // already breathes → leave it
      const ownIntent = ARCHETYPE_INTENT[String(cur.archetype) as Archetype];
      if (ownIntent === 'hero' || ownIntent === 'footer') continue; // never the hero/footer beat
      const alt = candidatesFor(String(cur.archetype), catalog)
        .filter((r) => r.surface !== cur.surfaceRole) // MUST change the surface band
        .filter((r) => limitsOk(r, prev, items.length, slugCount, bySlug));
      if (alt.length === 0) continue; // no safe alternate surface → abstain (never invent rhythm)
      const promoted =
        terminal(alt, {
          inRecentWindow: (r) => recent.includes(r.slug),
          useCount: (r) => useCount.get(r.slug) ?? 0,
        }) ?? alt[0];
      rhythmAudit?.push({
        sectionIndex: i,
        anchorId: cur.anchor.id,
        archetype: String(cur.archetype),
        beforeSurface: cur.surfaceRole ?? '',
        afterSurface: promoted.surface,
        beforeVariant: cur.componentVariant ?? '',
        afterVariant: promoted.slug,
        reason:
          'cadence: broke adjacent same-surface repetition — structural intent unchanged, surface changed only',
      });
      cur.componentVariant = promoted.slug;
      cur.surfaceRole = promoted.surface;
      cur.composition = steeringString(promoted);
      cur.sectionGuidance = guidanceString(ownIntent, promoted);
      slugCount.set(promoted.slug, (slugCount.get(promoted.slug) ?? 0) + 1);
      useCount.set(promoted.slug, (useCount.get(promoted.slug) ?? 0) + 1);
      recent.push(promoted.slug);
      if (recent.length > WINDOW) recent.shift();
    }
  }
}
