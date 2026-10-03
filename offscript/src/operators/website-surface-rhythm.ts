import type { Root, Element } from 'hast';
import type { Operator, Finding, OperatorContext } from '../operator.js';
import { visitElements } from '../working-rep.js';
import * as websiteNumerics from '../generate/website-numerics.js';

/**
 * Tier-1 website rail: website-surface-rhythm (Fix B, audit Issue 3 keystone).
 *
 * Detect-only. Routing already happened by validate time, so this rail cannot re-route —
 * it MEASURES the artifact: every section root carries a `data-cr-surface` stamp
 * (website-composition.ts steeringString). A page with >= minBandsForRhythm bands and NO
 * contrast/figure band is flat ("generic" — audit Issue 3) and ESCALATES.
 *
 * Threshold from governance (numerics.md) via the website-numerics loader; on a load
 * failure it degrades to a baked fallback + one warning (never crashes inspection).
 *
 * Website-only: registered in defaultRegistry(), never collateral/deckRegistry().
 */

export const DEFAULT_MIN_BANDS_FOR_RHYTHM = 4;

export function resolveSurfaceRhythmThreshold(): { minBands: number; warning: Finding | null } {
  try {
    return { minBands: websiteNumerics.loadWebsiteNumerics().minBandsForRhythm, warning: null };
  } catch (e) {
    return {
      minBands: DEFAULT_MIN_BANDS_FOR_RHYTHM,
      warning: {
        id: 'website-surface-rhythm:numerics-fallback',
        description:
          `website numerics unavailable (${e instanceof Error ? e.message : String(e)}) — ` +
          `using baked minBandsForRhythm=${DEFAULT_MIN_BANDS_FOR_RHYTHM}.`,
        outcome: 'warning',
      },
    };
  }
}

function surfaceOf(el: Element): string | undefined {
  const v = el.properties?.dataCrSurface;
  return typeof v === 'string' && v !== '' ? v : undefined;
}

function detectRhythm(tree: Root): Finding[] {
  const { minBands, warning } = resolveSurfaceRhythmThreshold();
  const surfaces: string[] = [];
  visitElements(tree, (el) => {
    const s = surfaceOf(el);
    if (s) surfaces.push(s);
  });
  const findings: Finding[] = warning ? [warning] : [];
  if (surfaces.length < minBands) return findings;
  if (surfaces.some((s) => s === 'contrast' || s === 'figure')) return findings;
  findings.push({
    id: 'website-surface-rhythm:no-contrast-or-figure',
    description:
      `page has ${surfaces.length} stamped bands (>=${minBands}) but no contrast/figure band — ` +
      `surface rhythm is flat (audit Issue 3 "generic").`,
    outcome: 'escalated',
  });
  return findings;
}

export const websiteSurfaceRhythm: Operator = {
  name: 'website-surface-rhythm',
  tier: 1,
  detect(tree: Root, _ctx: OperatorContext): Finding[] {
    return detectRhythm(tree);
  },
  apply(tree: Root, _ctx: OperatorContext): Finding[] {
    return detectRhythm(tree);
  },
};
