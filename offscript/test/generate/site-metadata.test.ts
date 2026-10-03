/**
 * Project-owned site metadata — the fully project-owned <head> the website deliverable ships (title /
 * description / OG / Twitter / icons / JSON-LD), resolved from the Brief and never house-defaulted.
 * (Formerly co-located with the Trust Model v2 white-label sanitation tests; that governance layer was
 * removed, leaving metadata as a pure rendering transformation.)
 */
import { describe, it, expect } from 'vitest';
import {
  resolveMetadata,
  buildMetadataTags,
  applySiteMetadata,
  type SiteMetadata,
} from '../../src/generate/site-metadata.js';
import { stubBrief, type Brief } from '../../src/generate/brief.js';

const brief = (over: Partial<Brief> = {}): Brief => ({ ...stubBrief('website'), ...over });

describe('site-metadata — fully project-owned head (never Example Brand)', () => {
  it('resolves title/description/siteName from the brief, never Example Brand', () => {
    const m = resolveMetadata({}, brief({ oneLiner: 'Close the books in days', brand: 'Helix' }));
    expect(m.title).toBe('Close the books in days');
    expect(m.siteName).toBe('Helix');
    expect(JSON.stringify(m)).not.toMatch(/example-brand/i);
  });

  it('emits SEO + OG + Twitter + icons + JSON-LD only for present fields', () => {
    const meta: SiteMetadata = {
      title: 'Helix', description: 'Automated close', canonicalUrl: 'https://helix.example',
      themeColor: '#0b2b1b', ogImage: 'https://helix.example/og.png', favicon: '/favicon.ico',
      organization: { name: 'Helix, Inc.', url: 'https://helix.example' },
    };
    const tags = buildMetadataTags(meta, brief()).join('\n');
    expect(tags).toContain('<link rel="canonical" href="https://helix.example">');
    expect(tags).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(tags).toContain('"@type":"Organization"');
    expect(tags).not.toMatch(/example-brand/i);
  });

  it('injects the head block, substitutes title, and is idempotent', () => {
    const page = '<!doctype html><html><head><title>Untitled</title></head><body>x</body></html>';
    const once = applySiteMetadata(page, { client: 'helix', brief: brief({ oneLiner: 'Close in days' }), meta: { description: 'd' } });
    expect(once).toContain('<title>Close in days</title>');
    expect(once).toContain('<!--wl-meta-->');
    const twice = applySiteMetadata(once, { client: 'helix', brief: brief({ oneLiner: 'Close in days' }), meta: { description: 'd' } });
    expect(twice).toBe(once);
  });
});
