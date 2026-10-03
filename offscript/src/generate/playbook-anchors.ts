import type { Archetype } from '../archetype.js';

/**
 * archetype → `SECTION_INTELLIGENCE.md` §3.N anchor.
 *
 * The `Archetype` enum is derived from SECTION_INTELLIGENCE.md Part 3 verbatim
 * (see archetype.ts), and the §3 headings line up 1:1 in order — 20 archetypes
 * ↔ 20 `### 3.N` sections. This table is that binding, made executable: it lets
 * the generate author resolve a section's own governance excerpt and thread it
 * into the AuthoringRequest (`generate/author.ts`). Keyed by `Record<Archetype,…>`
 * so tsc fails the build if an archetype ever lacks an anchor — the same total-table
 * convention archetype.ts documents.
 *
 * See docs/internals/OFFSCRIPT-V2-C2-SECTION-INTELLIGENCE-WIRING.md.
 */
export const ARCHETYPE_PLAYBOOK_ANCHOR: Record<Archetype, string> = {
  hero: '§3.1',
  'sub-hero': '§3.2',
  'logo-bar': '§3.3',
  'feature-grid': '§3.4',
  'feature-spotlight': '§3.5',
  process: '§3.6',
  metrics: '§3.7',
  testimonial: '§3.8',
  'testimonial-wall': '§3.9',
  'case-study': '§3.10',
  pricing: '§3.11',
  'plan-comparison': '§3.12',
  faq: '§3.13',
  'cta-banner': '§3.14',
  footer: '§3.15',
  editorial: '§3.16',
  founder: '§3.17',
  integrations: '§3.18',
  contact: '§3.19',
  resources: '§3.20',
};

/**
 * The §3.N anchor for an archetype, or `undefined` for a non-website archetype.
 * `PlanItem.archetype` is `Archetype | string` (collateral archetypes arrive as
 * plain strings); a `Record` index on an unknown key yields `undefined` at runtime,
 * which is exactly the cross-track contract — collateral never has a website anchor.
 */
export function playbookAnchorFor(archetype: Archetype | string): string | undefined {
  return ARCHETYPE_PLAYBOOK_ANCHOR[archetype as Archetype];
}
