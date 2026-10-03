import type { Root, Element } from 'hast';
import type { Operator, Finding, OperatorContext } from '../operator.js';
import { visitElements } from '../working-rep.js';
import { loadCompositionCatalog, type CompositionRow } from '../generate/composition-md.js';

/**
 * Tier-1 website rail: website-composition-limits (audit §9 B1).
 *
 * Enforces COMPOSITION.md's own per-component {limits} as ESCALATING findings, so a clean
 * `ratio 1.0` finally certifies composition discipline on website (mirrors collateral's
 * adjacency/geometry escalation). Measures the ARTIFACT: each section root carries a
 * `data-cr-component` (+ `data-cr-surface`) stamp written by the composition router /
 * minimalFragment and instructed in the author contract — so an LLM author that DEVIATES
 * from its assigned variant is caught, not just the plan's intent.
 *
 * Limits source is the runtime-parsed catalog (single source of truth). The loader is
 * fail-loud at PLAN time; here, at validate time, a load failure DEGRADES to one warning
 * (never crash inspection of an already-built artifact).
 *
 * Website-only: registered in defaultRegistry(), never collateralRegistry().
 */

interface Stamped {
  slug: string;
  surface?: string;
}

function attr(el: Element, key: 'dataCrComponent' | 'dataCrSurface'): string | undefined {
  const v = el.properties?.[key];
  return typeof v === 'string' && v !== '' ? v : undefined;
}

function detectLimits(tree: Root): Finding[] {
  let catalog: CompositionRow[];
  try {
    // No cache: re-read per run keeps plan-time and validate-time reads consistent; the catalog is tiny — never add a module cache.
    catalog = loadCompositionCatalog();
  } catch (e) {
    return [
      {
        id: 'website-composition-limits:catalog-unavailable',
        description: `COMPOSITION.md could not be loaded (${
          e instanceof Error ? e.message : String(e)
        }) — {limits} not enforced this run.`,
        outcome: 'warning',
      },
    ];
  }
  const bySlug = new Map(catalog.map((r) => [r.slug, r]));

  const sections: Stamped[] = [];
  visitElements(tree, (el) => {
    const slug = attr(el, 'dataCrComponent');
    if (slug) sections.push({ slug, surface: attr(el, 'dataCrSurface') });
  });
  if (sections.length === 0) return [];

  const findings: Finding[] = [];
  const total = sections.length;

  // maxPerPage + minBands — per distinct slug used.
  const count = new Map<string, number>();
  for (const s of sections) count.set(s.slug, (count.get(s.slug) ?? 0) + 1);
  for (const [slug, n] of count) {
    const lim = bySlug.get(slug)?.limits;
    if (!lim) continue;
    if (lim.maxPerPage != null && n > lim.maxPerPage) {
      findings.push({
        id: `website-composition-limits:${slug}:maxPerPage`,
        description: `"${slug}" appears ${n}× — its {maxPerPage:${lim.maxPerPage}} allows at most ${lim.maxPerPage} per page.`,
        outcome: 'escalated',
      });
    }
    if (lim.minBands != null && total < lim.minBands) {
      findings.push({
        id: `website-composition-limits:${slug}:minBands`,
        description: `"${slug}" needs a page of ≥${lim.minBands} sections ({minBands:${lim.minBands}}); this page has ${total}.`,
        outcome: 'escalated',
      });
    }
  }

  // Adjacency — for each section, test its OWN limits against both neighbours.
  // Assumes a flat list of section-root stamps (pre-order index i±1 = DOM siblings); a nested stamped section would misread as adjacent (cannot occur today — only section roots are stamped).
  for (let i = 0; i < sections.length; i++) {
    const lim = bySlug.get(sections[i].slug)?.limits;
    if (!lim || (!lim.avoidAdjacent && !lim.avoidAdjacentSurface)) continue;
    for (const j of [i - 1, i + 1]) {
      if (j < 0 || j >= sections.length) continue;
      const nb = sections[j];
      if (lim.avoidAdjacent) {
        const nbServes = bySlug.get(nb.slug)?.serves ?? [];
        if (nbServes.includes(lim.avoidAdjacent)) {
          findings.push({
            id: `website-composition-limits:${sections[i].slug}:avoidAdjacent:${i}:${j}`,
            description: `"${sections[i].slug}" sits next to "${nb.slug}", which serves "${lim.avoidAdjacent}" — its {avoidAdjacent:${lim.avoidAdjacent}} forbids that.`,
            outcome: 'escalated',
          });
        }
      }
      if (lim.avoidAdjacentSurface && nb.surface === lim.avoidAdjacentSurface) {
        findings.push({
          id: `website-composition-limits:${sections[i].slug}:avoidAdjacentSurface:${i}:${j}`,
          description: `"${sections[i].slug}" sits next to a "${nb.surface}"-surface band — its {avoidAdjacentSurface:${lim.avoidAdjacentSurface}} forbids that.`,
          outcome: 'escalated',
        });
      }
    }
  }

  return findings;
}

export const websiteCompositionLimits: Operator = {
  name: 'website-composition-limits',
  tier: 1,
  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    return detectLimits(tree);
  },
  apply(tree: Root, _ctx: OperatorContext): Finding[] {
    return detectLimits(tree);
  },
};
