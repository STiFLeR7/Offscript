/**
 * Sprint W16 — Goals 2 + 3: brief-aware website component selection.
 *
 * THE PROBLEM (POST-W15-PRODUCTION-QUALITY-ROOT-CAUSE.md §5/§8): website fragment selection keys on a
 * single token (archetype → one `serves`) and breaks the remaining tie by CATALOG ORDER with an empty
 * recency map — so every brief picks the same first-in-catalog variant per role (e.g. `hero-bento` for
 * every hero). The component index also exposes only structural metadata, so there is nothing to select
 * ON beyond the role.
 *
 * THE FIX (additive, deterministic, no governance rewrite):
 *  - Goal 3 — `fragmentAffinities` derives a small set of SELECTION-RELEVANT character tags from a
 *    FragmentEntry's EXISTING metadata (layout / interaction / blocks / serves / surface). No new
 *    authored files, no COMPOSITION.md/projection change — it enriches how existing metadata is USED.
 *  - Goal 2 — `briefSelectionProfile` derives a WEIGHTED character profile from the brief text (the
 *    richer signal already in the brief); `fragmentBriefScore` scores a candidate against it. The
 *    planner feeds this score into pickFragment to break the equal-structural tie INTENTIONALLY by
 *    brief character instead of catalog order — so different briefs diversify to different variants.
 *
 * Pure + deterministic. Website-only (collateral is untouched). Gated by the caller: only applied when
 * governed reasoning is enabled, so the disabled default stays byte-identical (catalog-order tiebreak).
 */
/**
 * The structural metadata both a catalog FragmentEntry and a COMPOSITION CompositionRow satisfy — the
 * fields fragmentAffinities reads. `surface` is a string on CompositionRow and a string[] on
 * FragmentEntry, so it is accepted either way and normalized internally.
 */
export interface VariantMeta {
  readonly serves: readonly string[];
  readonly surface: string | readonly string[];
  readonly layout: readonly string[];
  readonly interaction: readonly string[];
  readonly blocks: readonly string[];
}

/** The selection-relevant character axes (closed vocabulary — a bounded lookup, not open judgment). */
export type SelectionAffinity =
  | 'proof-dense'        // numbers/tiles carry the argument
  | 'cards-proof'        // calm cards-under-hero / card-grid proof
  | 'product-demo'       // a product you toggle / see a state of (developer/API/screenshot)
  | 'conversational'     // a chat/ambient/intent-capture product (lead-capture surface)
  | 'interactive-demo'   // broad: any interactive/integrating product surface
  | 'process-flow'       // a sequence / how-it-works / pipeline
  | 'comparison'         // us-vs-them / plan matrix / decision-stage
  | 'quote-voice'        // testimonials / customer stories
  | 'logo-trust'         // trust marquee / investor wall
  | 'media-rich'         // screenshots / live views / creative panels
  | 'narrative';         // long-form scroll storytelling

// ── Goal 3: derive a fragment's affinities from its EXISTING metadata ──────────
const has = (xs: readonly string[], ...needles: string[]): boolean =>
  xs.some((x) => needles.some((n) => x.includes(n)));

/**
 * Derive the selection-relevant character tags for a fragment from its existing metadata.
 * Pure mapping over layout / interaction / blocks / serves / surface — no I/O, deterministic.
 */
export function fragmentAffinities(entry: VariantMeta): Set<SelectionAffinity> {
  const a = new Set<SelectionAffinity>();
  const { layout, interaction, blocks, serves } = entry;
  const surface = typeof entry.surface === 'string' ? [entry.surface] : entry.surface;

  if (has(blocks, 'bento-tiles', 'stat-block', 'stat-row') || has(serves, 'stats', 'outcomes', 'social-proof')) {
    a.add('proof-dense');
  }
  if (has(layout, 'n-up-card-grid') && has(blocks, 'creative-panel', 'card-grid')) a.add('cards-proof');
  if (has(interaction, 'toggle', 'tabs', 'form') || has(blocks, 'toggle-control', 'tab-bar', 'form-block')) {
    a.add('interactive-demo');
  }
  // product-demo: a "see/try a product state" surface — a toggle/control, not a chat. (hero-actions)
  if (has(interaction, 'toggle') || has(blocks, 'toggle-control')) a.add('product-demo');
  // conversational / lead-capture: a real input surface — a form / intent-capture chat. (hero-agent)
  if (has(blocks, 'form-block', 'tab-bar') || has(serves, 'contact')) a.add('conversational');
  if (has(serves, 'process') || has(blocks, 'step-rail')) a.add('process-flow');
  if (has(layout, 'table-matrix') || has(serves, 'comparison')) a.add('comparison');
  if (has(blocks, 'quote-card') || has(serves, 'testimonials')) a.add('quote-voice');
  if (has(blocks, 'logo-row') || has(serves, 'logos')) a.add('logo-trust');
  if (has(blocks, 'media-frame', 'creative-panel')) a.add('media-rich');
  if (has(interaction, 'sticky-scroll') || has(layout, 'sticky-aside+stack', 'sticky')) a.add('narrative');
  if (surface.length === 0) { /* no-op; surface reserved for future axes */ }
  return a;
}

// ── Goal 2: derive a brief's weighted character profile ───────────────────────
/** The minimal brief shape this module reads (the generate-path Brief satisfies it). */
export interface BriefTextSource {
  readonly oneLiner?: string;
  readonly audience?: string;
  readonly goals?: readonly string[];
  readonly mustInclude?: readonly string[];
  readonly body?: string;
  readonly tone?: string;
}

/** Cue lexicon per affinity — bounded keyword sets (mirrors plan.ts's closed-vocabulary approach). */
const CUES: Record<SelectionAffinity, RegExp> = {
  'proof-dense': /\b(metric|metrics|uptime|throughput|downtime|yield|oee|roi|settlement|accuracy|results?|proof|numbers?|benchmark|%|percent)\b/gi,
  'cards-proof': /\b(credibility|track record|portfolio|customers? love|proof points?)\b/gi,
  // product-demo: a developer/product-state surface the reader toggles, integrates, or sees a screenshot of.
  'product-demo': /\b(api|apis|sdk|sdks|sandbox|developer|developers|engineer|engineers|toggle|self[-\s]?serve|playground|webhook|screenshot|product (state|tour|demo))\b/gi,
  // conversational: a chat/ambient/voice/intent-capture product (a real input/dialog surface).
  conversational: /\b(conversation|conversational|listens?|ambient|voice|chat|assistant|co-?pilot|\bagent\b|agents|dialog\w*|intent[-\s]?capture)\b/gi,
  // interactive-demo: broad interactive/integrating surface (kept light; product-demo/conversational are the sharp ones).
  'interactive-demo': /\b(interactive|integrat\w*|docs|documentation|try it|automat\w*)\b/gi,
  'process-flow': /\b(step|steps|how it works|connect|normalize|workflow|pipeline|process|sequence|onboarding|hand[-\s]?off|three steps)\b/gi,
  comparison: /\b(versus|vs\.?|compare|comparison|instead of|alternative to|migrate from|replace[s]?)\b/gi,
  'quote-voice': /\b(testimonial|testimonials|customer stor\w*|case stud\w*|what .{0,30}leaders? saw|quotes?\b|reviews?\b)\b/gi,
  'logo-trust': /\b(trusted by|logos?|backed by|investors?|customers? include|brands?\b)\b/gi,
  'media-rich': /\b(screenshot|dashboard|live view|visibility|see every|product (state|tour|ui)|interface|visual\w*)\b/gi,
  narrative: /\b(story|manifesto|journey|narrative|believe|mission|why we)\b/gi,
};

function countMatches(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? m.length : 0;
}

/**
 * Derive the brief's weighted character profile: affinity → number of brief-text cue hits. The weight
 * is the evidence count, so a brief that is dominantly about (say) a developer API outweighs a faint
 * proof mention. An empty/characterless brief yields an empty profile (all-zero → caller falls back to
 * the catalog-order tiebreak, byte-identical).
 */
export function briefSelectionProfile(brief: BriefTextSource): Map<SelectionAffinity, number> {
  const text = [
    brief.oneLiner ?? '',
    brief.audience ?? '',
    ...(brief.goals ?? []),
    ...(brief.mustInclude ?? []),
    brief.tone ?? '',
    brief.body ?? '',
  ].join('\n');
  const profile = new Map<SelectionAffinity, number>();
  for (const key of Object.keys(CUES) as SelectionAffinity[]) {
    const n = countMatches(text, CUES[key]);
    if (n > 0) profile.set(key, n);
  }
  return profile;
}

/**
 * Score a candidate fragment against the brief profile: the summed brief weight of every affinity the
 * fragment carries. Higher = better fit for THIS brief's character. 0 when the fragment matches none of
 * the brief's character (the caller then keeps the deterministic catalog-order fallback).
 */
export function fragmentBriefScore(entry: VariantMeta, profile: ReadonlyMap<SelectionAffinity, number>): number {
  let score = 0;
  for (const aff of fragmentAffinities(entry)) score += profile.get(aff) ?? 0;
  return score;
}
