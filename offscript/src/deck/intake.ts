import { parseHtml, visitElements } from '../working-rep.js';
import { intakeCollateral } from '../collateral/intake.js';

/**
 * Deck intake — self-contain a finished 16:9 deck artifact and count its slides.
 *
 * The asset self-containment (inline linked CSS, rewrite url()/img refs to data
 * URIs) is track-agnostic, so we reuse `intakeCollateral`'s inliner and ignore
 * its `.cr-page` count — decks count `.slide` instead.
 */

/** True when the HTML looks like a deck bundle (slide-deck container or `.slide`s). */
export function isDeck(html: string): boolean {
  return (
    /\bdata-deck\b/.test(html) ||
    /class\s*=\s*["'][^"']*\bslide-deck\b/.test(html) ||
    /class\s*=\s*["'][^"']*\bslide\b/.test(html)
  );
}

function classTokens(el: { properties?: Record<string, unknown> }): string[] {
  const cls = el.properties?.className;
  if (Array.isArray(cls)) return cls.map(String);
  if (typeof cls === 'string') return cls.split(/\s+/);
  return [];
}

/** Count elements whose class list contains the exact token `slide` (not `slide-deck`). */
export function countSlides(html: string): number {
  let n = 0;
  visitElements(parseHtml(html), (el) => {
    if (classTokens(el).includes('slide')) n += 1;
  });
  return n;
}

export interface DeckIntake {
  /** self-contained HTML (linked CSS inlined, url()/img assets → data URIs). */
  selfContained: string;
  /** number of `.slide` elements (the declared slide count). */
  slideCount: number;
}

/**
 * Intake a finished deck artifact. `baseDir` is the directory the artifact's
 * relative hrefs resolve against (where the pasted file lives).
 */
export function intakeDeck(html: string, baseDir: string): DeckIntake {
  const { selfContained } = intakeCollateral(html, baseDir);
  return { selfContained, slideCount: countSlides(selfContained) };
}
