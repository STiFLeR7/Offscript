/**
 * W85 — the ONE canonical Archetype → v2 `serves` intent contract.
 *
 * Before this sprint, `catalog.ts` (`ARCHETYPE_TO_SERVES`, feeding the fragment picker /
 * `selectCandidates`) and `website-composition.ts` (`ARCHETYPE_INTENT`, feeding the composition
 * router / `candidatesFor`) each declared their OWN copy of this table, kept "coherent" only by
 * a hand-maintained convention (five separate code comments restating "so the router's
 * componentVariant and the pasted fragmentId agree"). They had already drifted on `case-study`:
 * catalog.ts said `social-proof`, website-composition.ts said `testimonials` — the router and
 * the picker silently authored from different component families for the same section. See
 * SPRINT-W84-POST-RELEASE-ARCHITECTURE-INVENTORY.md §3.1 (the finding) and
 * SPRINT-W85-SELECTOR-CONTRACT-UNIFICATION.md (this fix).
 *
 * `case-study` is now `testimonials`, grounded in the corpus's OWN governance frontmatter
 * (`repository/canonical/*\/component.md`, `semantics.specializes`): `case-carousel` —
 * literally "case study carousel" — specializes `concept:role:testimonials-case-studies` (the
 * family named "testimonials-case-studies"), while `results-proof` specializes
 * `concept:role:social-proof-logos` (marks/logos as proof, not customer narrative voice — W38's
 * "mark not voice" boundary). `testimonials` is also the only value of the two that resolves
 * across the FULL coordinated intent vocabulary: it has a FAMILY_RULES entry
 * (`website-composition.ts`) and a direct §B skeleton fallback (`compose-md.ts`'s
 * `NAME_TO_INTENT`); `social-proof` has neither, which is itself evidence it was never the
 * intended value — just an independently-typed second copy that silently diverged.
 *
 * Every consumer imports THIS table (or a re-export of it) — never redeclares it. The
 * `test/generate/archetype-contract.test.ts` structural guard fails the suite if a second
 * `Record<Archetype, string>` literal ever reappears anywhere in `src/generate`.
 */
import type { Archetype } from '../archetype.js';

/**
 * Closed Archetype (20) → COMPOSITION.md `serves` intent vocabulary. `Record<Archetype, …>` so
 * tsc fails the build if an archetype ever lacks an intent (mirrors the closed-enum invariant
 * `archetype.ts` documents). Adding an archetype is a coordinated planning decision — see
 * `archetype.ts`'s "New archetypes need a coordinated change across…" list, which names this
 * module as the archetype→serves entry.
 */
export const ARCHETYPE_SERVES: Record<Archetype, string> = {
  hero: 'hero',
  'sub-hero': 'hero',
  'logo-bar': 'logos',
  'feature-grid': 'feature',
  'feature-spotlight': 'feature',
  process: 'process',
  metrics: 'stats',
  testimonial: 'testimonials',
  'testimonial-wall': 'testimonials',
  'case-study': 'testimonials',
  pricing: 'pricing',
  'plan-comparison': 'comparison',
  faq: 'faq',
  'cta-banner': 'cta',
  footer: 'footer',
  editorial: 'value-prop',
  founder: 'team',
  integrations: 'integrations',
  contact: 'contact',
  resources: 'resources',
};

/**
 * The best-fit check — the STRUCTURAL first key of website selection ranking, shared by the
 * composition router (`website-composition.ts`) and the fragment picker (`catalog.ts`).
 *
 * Before this sprint each file wrote its own copy of `x.serves[0] === target`; the
 * `selector-contract-unification.test.ts` (W85) regression test names exactly this comparison
 * "the concrete, provable regression signal" for future drift between the two selectors — it
 * was correct in both places, but nothing made them structurally the SAME implementation.
 *
 * `target` omitted ⇒ always true (no discrimination) — matches both callers' pre-existing "No
 * effect when target is omitted" contract.
 */
export function isBestFit(servesFirst: string | undefined, target: string | undefined): boolean {
  return target === undefined || servesFirst === target;
}
