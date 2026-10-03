import { describe, it, expect } from 'vitest';
import {
  parseCompositionCatalog,
  parseLimits,
  loadCompositionCatalog,
} from '../../src/generate/composition-md.js';

// A minimal fixture mirroring COMPOSITION.md's real table shape.
const FIXTURE = `
# Component Composition Index

Some preamble prose.

| Component | File | Cat | Layout | Surface | Interaction | Serves | Blocks | Direction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hero · bento | \`preview/component-hero-bento.html\` | section | centered-stack, asymmetric-bento | base | reveal-only | hero, feature | nav-bar, headline-cluster, bento-tiles | Product hero with a feature-tile bento. |
| Feature trio | \`preview/component-feature-trio.html\` | section | n-up-card-grid | base | reveal-only | feature, value-prop | headline-cluster, card-grid | 3-up equal cards. {maxPerPage:1} |
| Feature stack | \`preview/component-feature-stack.html\` | section | accordion+creative | base | sticky-scroll | feature | headline-cluster, creative-panel | Cinematic pinned deck; long pages only. {maxPerPage:1; minBands:5} |
| Stat cards | \`preview/component-stat-cards.html\` | section | n-up-card-grid | contrast | count-up | stats, feature | stat-block, card-grid | Contrast proof band. {avoidAdjacentSurface:contrast} |
| Feature bento | \`preview/component-feature-bento.html\` | section | asymmetric-bento | base | reveal-only | feature, stats | bento-tiles | Feature+stat hybrid. {avoidAdjacent:stats} |
| CTA orbit | \`preview/component-cta-orbit.html\` | section | two-col-text+creative | contrast, figure | reveal-only | cta, contact | headline-cluster, cta-row | Decorated close. {maxPerPage:1} |
| Button | \`preview/component-button.html\` | atom | atom | base | static | nav | cta-row | A standalone button. |

Trailing prose after the table.
`;

describe('parseLimits', () => {
  it('parses each limit kind and a two-limit cell', () => {
    expect(parseLimits('text {maxPerPage:1}')).toEqual({ maxPerPage: 1 });
    expect(parseLimits('{avoidAdjacent:stats}')).toEqual({ avoidAdjacent: 'stats' });
    expect(parseLimits('{avoidAdjacentSurface:contrast}')).toEqual({
      avoidAdjacentSurface: 'contrast',
    });
    expect(parseLimits('x {maxPerPage:1; minBands:5}')).toEqual({ maxPerPage: 1, minBands: 5 });
    expect(parseLimits('no annotations here')).toEqual({});
  });

  it('drops a non-finite numeric limit (NaN not stored)', () => {
    expect(parseLimits('{maxPerPage:x}')).toEqual({});
    expect(parseLimits('{minBands:nope}')).toEqual({});
  });
});

describe('parseCompositionCatalog', () => {
  const rows = parseCompositionCatalog(FIXTURE);

  it('parses section rows and skips atoms', () => {
    const slugs = rows.map((r) => r.slug);
    expect(slugs).toContain('hero-bento');
    expect(slugs).toContain('feature-trio');
    expect(slugs).not.toContain('button'); // atom skipped
  });

  it('maps cells by header name', () => {
    const trio = rows.find((r) => r.slug === 'feature-trio')!;
    expect(trio.name).toBe('Feature trio');
    expect(trio.cat).toBe('section');
    expect(trio.surface).toBe('base');
    expect(trio.serves).toEqual(['feature', 'value-prop']);
    expect(trio.blocks).toEqual(['headline-cluster', 'card-grid']);
    expect(trio.layout).toEqual(['n-up-card-grid']);
    expect(trio.direction).toContain('3-up equal cards');
    expect(trio.direction).not.toContain('{'); // limits stripped from prose
  });

  it('extracts limits into the limits object', () => {
    const byslug = Object.fromEntries(rows.map((r) => [r.slug, r.limits]));
    expect(byslug['feature-trio']).toEqual({ maxPerPage: 1 });
    expect(byslug['feature-stack']).toEqual({ maxPerPage: 1, minBands: 5 });
    expect(byslug['stat-cards']).toEqual({ avoidAdjacentSurface: 'contrast' });
    expect(byslug['feature-bento']).toEqual({ avoidAdjacent: 'stats' });
    expect(byslug['hero-bento']).toEqual({});
  });

  it('takes the primary (first) token from a multi-value surface cell', () => {
    const orbit = rows.find((r) => r.slug === 'cta-orbit')!;
    expect(orbit.surface).toBe('contrast'); // "contrast, figure" → primary token
  });

  it('returns [] when no catalog table is present', () => {
    expect(parseCompositionCatalog('# Doc\n\nNo table here.')).toEqual([]);
  });
});

describe('loadCompositionCatalog (real governance — fail-loud guard)', () => {
  const rows = loadCompositionCatalog();

  it('parses a healthy number of real section rows', () => {
    expect(rows.length).toBeGreaterThanOrEqual(30);
  });

  it('carries the 9 known {limits} components', () => {
    const limited = new Set(
      rows.filter((r) => Object.keys(r.limits).length > 0).map((r) => r.slug),
    );
    for (const slug of [
      'feature-trio',
      'feature-bento',
      'feature-stack',
      'sticky-cards',
      'mission-reveal',
      'stat-cards',
      'pricing',
      'cta-orbit',
    ]) {
      expect(limited.has(slug)).toBe(true);
    }
  });
});
