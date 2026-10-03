import { describe, it, expect, vi } from 'vitest';
import { parseHtml } from '../../src/working-rep.js';
import { websiteCompositionLimits } from '../../src/operators/website-composition-limits.js';

// Dedicated file: its own mock makes loadCompositionCatalog THROW (fail-loud loader),
// so we can assert the validate-time DEGRADE-to-warning path without a crash. Kept apart
// from the main spec because vi.mock hoists per file — a throwing factory here is cleaner
// than flipping a shared flag.
vi.mock('../../src/generate/composition-md.js', async (orig) => {
  const actual = await orig<typeof import('../../src/generate/composition-md.js')>();
  return {
    ...actual,
    loadCompositionCatalog: () => {
      throw new Error('COMPOSITION.md not found (simulated)');
    },
  };
});

function tree(...sections: string[]) {
  return parseHtml(`<html><body><div id="root">${sections.join('')}</div></body></html>`);
}
const sec = (slug: string, surface = 'base') =>
  `<section id="${slug}" data-cr-component="${slug}" data-cr-surface="${surface}"></section>`;

const ctx = { params: {} } as any;

describe('website-composition-limits — catalog-unavailable degrade path', () => {
  it('returns exactly one warning (no crash, no escalations) when the loader throws', () => {
    // Sections that WOULD violate maxPerPage if the catalog had loaded — proving the
    // degrade short-circuits before any limit check.
    const f = websiteCompositionLimits.detect(tree(sec('feature-trio'), sec('feature-trio')), ctx);
    expect(f).toHaveLength(1);
    expect(f[0].outcome).toBe('warning');
    expect(f[0].id).toContain('catalog-unavailable');
    expect(f.some((x) => x.outcome === 'escalated')).toBe(false);
  });
});
