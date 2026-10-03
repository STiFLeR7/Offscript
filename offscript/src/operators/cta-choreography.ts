import type { Root, Element, ElementContent } from 'hast';
import type { Operator, Finding, OperatorContext } from '../operator.js';
import { enumerateSections } from './archetype-tag.js';

/**
 * Tier-1 rail: cta-choreography (M2 Group B, SECTION_INTELLIGENCE.md §2.4).
 *
 * "The page has one primary CTA — repeated, not multiplied … Count primary
 * CTAs per viewport. The number is always 0 or 1. Never 2." Two primary-weight
 * buttons competing in the same frame make the visitor freeze (the §3.1 hero
 * anti-pattern "two primary CTAs side by side" and the §6.6 "CTA roulette").
 *
 * v1 simplification (same shape as motion-budget): we cannot tell a
 * viewport-equivalent without rendering, so each SECTION is treated as one
 * viewport-equivalent. Within a section we count primary-weight CTAs; two or
 * more is the violation.
 *
 * Severity is archetype-anchored (this is what makes it Tier-1, not Tier-0):
 *  - In a HERO, multiple primary CTAs is a structural composition defect that a
 *    systematic rewrite shouldn't silently pick a winner for — it ESCALATES to
 *    a frozen bespoke decision (which CTA is primary is a design call).
 *  - Mid-page, multiple primary CTAs is a WARNING (demote the secondaries).
 *  - 0 or 1 primary CTA → clear.
 *
 * A CTA candidate is a <button> or an <a> styled as a button (class matching
 * btn / button / cta). A candidate is PRIMARY unless it carries a lower-weight
 * modifier (secondary / ghost / outline / tertiary / link / text / subtle /
 * muted) — those are the subordinate CTAs §2.4 explicitly allows.
 *
 * NAV EXEMPTION: a CTA inside nav chrome is persistent navigation (e.g. a header
 * "Let's talk" / "Sign up" pill or its mobile-drawer duplicate), NOT a section
 * conversion CTA competing in the frame — so it is not counted. The house
 * composition puts the nav INSIDE the hero (the nav is not a standalone section),
 * so without this a hero's nav-CTA + its own primary CTA would false-escalate every
 * page. Nav chrome = the semantic <nav>, a `role="navigation"` container, OR the
 * house mobile affordances `data-nav-drawer` / `data-nav-toggle` (the drawer is
 * commonly hoisted to a SIBLING of <nav>, outside it — see isNavChrome). The anchor
 * is the element/affordance attrs (not a class name, which is gameable); two genuine
 * primary CTAs in the hero BODY are still caught.
 *
 * Reads `ctx.archetypeModel` (populated by archetype-tag). Per the seam
 * contract, no model → the rail no-ops with a single warning.
 *
 * Spec: M2 charter §4 Task 3; SECTION_INTELLIGENCE.md §2.4, §3.1, §6.6.
 */

const SECONDARY_MODIFIER = /secondary|ghost|outline|tertiary|\blink\b|text-link|subtle|muted|\bquiet\b/;
const CTA_CLASS = /\bbtn\b|button|\bcta\b/;

export const ctaChoreography: Operator = {
  name: 'cta-choreography',
  tier: 1,

  detect(tree: Root, ctx: OperatorContext): Finding[] {
    if (!ctx.archetypeModel) {
      return [
        {
          id: 'cta-choreography:no-archetype-model',
          description:
            'archetype model not available on context (run archetype-tag first) — cta-choreography skipped',
          outcome: 'warning',
        },
      ];
    }

    const findings: Finding[] = [];
    for (const { id, el } of enumerateSections(tree, ctx)) {
      const assignment = ctx.archetypeModel.get(id);
      const archetype = assignment?.archetype;
      const primaries = countPrimaryCtas(el);
      if (primaries < 2) continue;

      if (archetype === 'hero') {
        findings.push({
          id: `cta-choreography:hero-multi-cta:${id}`,
          description: `hero section "${id}" has ${primaries} primary-weight CTAs competing in one frame (§2.4: never 2; §3.1 anti-pattern) — which is primary is a design call; escalated for a bespoke decision`,
          outcome: 'escalated',
        });
      } else {
        findings.push({
          id: `cta-choreography:multi-cta:${id}`,
          description: `section "${id}"${archetype ? ` (${archetype})` : ''} has ${primaries} primary-weight CTAs in one viewport-equivalent (§2.4: 0 or 1, never 2) — demote the secondaries to ghost / link weight`,
          outcome: 'warning',
        });
      }
    }
    return findings;
  },

  apply(tree: Root, ctx: OperatorContext): Finding[] {
    // Advisory rail — detect only (no auto-remediation; severity is a design call).
    return this.detect(tree, ctx);
  },
};

/** Count primary-weight CTAs within a section subtree. */
function countPrimaryCtas(section: Element): number {
  let count = 0;
  walk(section, (el) => {
    if (!isCtaCandidate(el)) return;
    if (!isSecondary(el)) count++;
  });
  return count;
}

/** A <button>, or an <a> styled as a button (class btn / button / cta). */
function isCtaCandidate(el: Element): boolean {
  if (el.tagName === 'button') return true;
  if (el.tagName !== 'a') return false;
  return CTA_CLASS.test(classOf(el));
}

/** Does this CTA carry a lower-weight modifier class (secondary / ghost / …)? */
function isSecondary(el: Element): boolean {
  return SECONDARY_MODIFIER.test(classOf(el));
}

function classOf(el: Element): string {
  const cls = el.properties?.className;
  if (Array.isArray(cls)) return cls.filter((c) => typeof c === 'string').join(' ').toLowerCase();
  if (typeof cls === 'string') return cls.toLowerCase();
  return '';
}

function walk(el: Element, fn: (el: Element) => void): void {
  for (const child of el.children as ElementContent[]) {
    if (child.type !== 'element') continue;
    // Navigation chrome is exempt: a CTA inside the nav is a persistent nav
    // affordance, not a section conversion CTA. Skip the whole subtree so the
    // nav-CTA (mandated inside the hero by house composition) never counts as a
    // competing primary. CTAs in the section BODY (outside nav chrome) still count.
    if (isNavChrome(child)) continue;
    fn(child);
    walk(child, fn);
  }
}

/**
 * Nav chrome = the semantic <nav>, OR a `role="navigation"` container, OR the
 * house mobile-nav affordances (`data-nav-drawer` / `data-nav-toggle`). The
 * mobile drawer is commonly position-hoisted to a SIBLING of <nav> (not nested),
 * so anchoring only on the <nav> tag would let the drawer's duplicate nav pill
 * count as a competing hero CTA — the false hero-multi-cta escalation. These attrs
 * are structural affordance markers (what the behaviour layer wires), not gameable
 * styling classes, so they are a safe anchor.
 */
function isNavChrome(el: Element): boolean {
  if (el.tagName === 'nav') return true;
  const p = el.properties ?? {};
  if (typeof p.role === 'string' && p.role.toLowerCase() === 'navigation') return true;
  return 'dataNavDrawer' in p || 'dataNavToggle' in p;
}
