/**
 * P42 — Website Brand-Owned Regions (transport only, zero consumers).
 *
 * P41 found that the website Stage-3 seam (`assembleWebsiteBySelection` → `authorImpl.author`)
 * edits Example Brand's own vendored exemplar fragments IN PLACE, and that a small, stable set of
 * elements inside those fragments are Example Brand's own house identity (a logo mark, a copyright
 * line, a company-name mention) rather than reusable structure. Nothing today lets an author
 * (or any future consumer) tell the two apart.
 *
 * This module is the smallest possible foundation for that distinction: a typed, hand-authored,
 * frozen declaration of which regions in which fragments are brand-owned, keyed by the same
 * `fragmentId` (slug) `loadFragmentHtml`/`exemplarSectionPath` already use. It is TRANSPORT
 * ONLY — no author, prompt, rail, or pipeline stage reads it. Wiring a consumer (an author-
 * contract instruction, a BrandKit-substitution hook) is deliberately out of scope; this sprint
 * only proves the shape holds and transcribes the P41 evidence into it.
 *
 * Deliberately NOT a runtime parser: no file reads, no HTML parsing, no selection logic — plain,
 * literal, hand-authored TypeScript data. `brand-owned-regions.test.ts` checks it against the
 * corpus on disk (fragmentId existence only, never content).
 */

export type BrandOwnedRegionKind =
  | 'logo'
  | 'legalCopy'
  | 'voiceCopy'
  | 'exampleProductName'
  | 'navLink';

export interface BrandOwnedRegion {
  kind: BrandOwnedRegionKind;
  /** CSS selector when the element is addressably classed. Omit when none exists. */
  selector?: string;
  /** A literal, locatable substring — required when no selector exists (bare text/links). */
  textAnchor?: string;
  /** One-line human-readable note for a future author/consumer. */
  description: string;
}

export interface FragmentBrandOwnership {
  /** Matches the catalog slug (`component-<fragmentId>.html`). */
  fragmentId: string;
  regions: BrandOwnedRegion[];
}

function region(r: BrandOwnedRegion): BrandOwnedRegion {
  if (!r.selector && !r.textAnchor) {
    throw new Error(`brand-owned-regions: "${r.description}" has neither a selector nor a textAnchor.`);
  }
  return r;
}

/**
 * P41/P42 evidence, transcribed from the vendored exemplar corpus
 * (resources/design_processes/website/exemplars/sections/component-<fragmentId>.html).
 * Hand-authored, not derived — extending or correcting an entry means re-reading the source
 * file, the same discipline W23 used for its family-*.md corpus.
 *
 * Third-party trust marks (Slack/Asana/Notion logos in hero-bento/hero-actions' `.hb-logos`/
 * `.ha-logos` rows) are deliberately EXCLUDED — they are generic, reusable structure, not
 * Example Brand identity.
 */
export const BRAND_OWNED_REGIONS: readonly FragmentBrandOwnership[] = [
  {
    fragmentId: 'hero-bento',
    regions: [
      region({ kind: 'logo', selector: '.hb-logo', description: 'Nav wordmark (logo-color.svg, alt="Example Brand")' }),
    ],
  },
  {
    fragmentId: 'hero-actions',
    regions: [region({ kind: 'logo', selector: '.ha-logo', description: 'Nav wordmark (logo-color.svg)' })],
  },
  {
    fragmentId: 'hero-agent',
    regions: [region({ kind: 'logo', selector: '.ha-logo', description: 'Nav wordmark (logo-color.svg)' })],
  },
  {
    fragmentId: 'hero-lending',
    regions: [
      region({ kind: 'logo', selector: '.hnav-logo', description: 'Nav wordmark (logo-color.svg)' }),
      region({ kind: 'logo', selector: '.ui-logo', description: 'In-product UI mockup wordmark (logo-color.svg)' }),
    ],
  },
  {
    fragmentId: 'nav',
    regions: [region({ kind: 'logo', selector: '.nav-logo', description: 'Nav wordmark (logo-white.svg)' })],
  },
  {
    fragmentId: 'footer-cta',
    regions: [
      region({ kind: 'logo', selector: '.fc-brand-logo', description: 'Footer wordmark (logo-color.svg)' }),
      region({
        kind: 'voiceCopy',
        selector: '.fc-fine',
        description: 'Newsletter disclaimer names Example Brand by name',
      }),
      region({
        kind: 'legalCopy',
        selector: '.fc-copy',
        description: 'Copyright line: "© 2026 Example Brand. All rights reserved."',
      }),
    ],
  },
  {
    fragmentId: 'footer-dark',
    regions: [
      region({ kind: 'logo', selector: '.fm-logo', description: 'Footer wordmark (logo-white.svg)' }),
      region({
        kind: 'voiceCopy',
        selector: '.fm-headline',
        description: 'Headline opens "Discover how Example Brand can help you…"',
      }),
      region({ kind: 'navLink', textAnchor: 'Why Example Brand?', description: 'Bare footer link, no distinguishing class' }),
      region({
        kind: 'legalCopy',
        selector: '.fm-copy',
        description: 'Copyright line: "© Copyright 2026 Example Brand.com"',
      }),
    ],
  },
  {
    fragmentId: 'footer-orbit',
    regions: [
      region({ kind: 'logo', textAnchor: 'assets/logo-white.svg', description: 'Footer wordmark, unclassed <img>' }),
      region({
        kind: 'legalCopy',
        selector: '.fo-copy',
        description: 'Copyright line: "© Copyright 2026 Example Brand, Inc. All rights reserved."',
      }),
    ],
  },
  {
    fragmentId: 'book-demo',
    regions: [region({ kind: 'logo', selector: '.l-logo', description: 'Panel wordmark (logo-color.svg)' })],
  },
  {
    fragmentId: 'get-started',
    regions: [region({ kind: 'logo', selector: '.gs-rail-logo', description: 'Rail wordmark (logo-white.svg)' })],
  },
  {
    fragmentId: 'divider-horizon',
    regions: [region({ kind: 'logo', textAnchor: 'assets/logo-white.svg', description: 'Unclassed <img> wordmark' })],
  },
  {
    fragmentId: 'latest-news',
    regions: [
      region({
        kind: 'logo',
        selector: '.logo-cr',
        description: 'Byline wordmark, appears twice (two news items attributed to Example Brand)',
      }),
    ],
  },
  {
    fragmentId: 'resources-insights',
    regions: [
      region({
        kind: 'logo',
        selector: '.tg-logo img',
        description: 'Byline wordmark inside the "Example Brand | <partner>" attribution pair',
      }),
    ],
  },
  {
    fragmentId: 'comparison',
    regions: [
      region({
        kind: 'exampleProductName',
        textAnchor: 'Example Brand APA',
        description: "The worked example's own column header — names the example product, not structural",
      }),
    ],
  },
];

/** Lookup by fragmentId; undefined when the fragment carries no known brand-owned region. */
export function brandOwnedRegionsFor(fragmentId: string): readonly BrandOwnedRegion[] | undefined {
  return BRAND_OWNED_REGIONS.find((f) => f.fragmentId === fragmentId)?.regions;
}
