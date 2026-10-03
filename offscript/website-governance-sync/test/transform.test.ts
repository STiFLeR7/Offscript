import { describe, expect, it } from 'vitest';
import { transformCompositionMd, transformComponentsMd } from '../src/transform.js';

describe('transformCompositionMd', () => {
  it('rewrites an unrenamed section File cell to the flat component- convention', () => {
    const md =
      '| Component | File | Cat |\n' +
      '|---|---|---|\n' +
      '| Hero · bento | `../../../section-library/sections/hero-bento.html` | section |\n';
    const out = transformCompositionMd(md);
    expect(out).toContain('`component-hero-bento.html`');
    expect(out).not.toContain('section-library');
  });

  it('rewrites a RENAMED section File cell back to its old, engine-resolvable name', () => {
    const md =
      '| Component | File | Cat |\n' +
      '|---|---|---|\n' +
      '| Feature accordion | `../../../section-library/sections/accordion-panel-right.html` | section |\n';
    const out = transformCompositionMd(md);
    expect(out).toContain('`component-feature-accordion.html`');
  });

  it('leaves every other cell in the row untouched', () => {
    const md = '| Feature trio | `../../../section-library/sections/feature-trio.html` | section | reveal-only |';
    const out = transformCompositionMd(md);
    expect(out).toBe('| Feature trio | `component-feature-trio.html` | section | reveal-only |');
  });

  it('transforms every row across multiple sub-tables, not just the first', () => {
    const md =
      '## Heroes\n' +
      '| Component | File |\n|---|---|\n' +
      '| Hero · bento | `../../../section-library/sections/hero-bento.html` |\n\n' +
      '## Features\n' +
      '| Component | File |\n|---|---|\n' +
      '| Feature trio | `../../../section-library/sections/feature-trio.html` |\n';
    const out = transformCompositionMd(md);
    expect(out).toContain('`component-hero-bento.html`');
    expect(out).toContain('`component-feature-trio.html`');
  });

  it('is idempotent — running it twice produces the same result as running it once', () => {
    const md = '| Hero · bento | `../../../section-library/sections/hero-bento.html` | section |';
    const once = transformCompositionMd(md);
    const twice = transformCompositionMd(once);
    expect(twice).toBe(once);
  });
});

describe('transformComponentsMd', () => {
  it('rewrites a renamed Variant appendix entry back to its old id, inside the appendix only', () => {
    const md =
      '## Feature\n' +
      'Some prose mentioning accordion-panel-right that must NOT be touched.\n\n' +
      '## Variant appendix\n' +
      '| Family | Variant | Distinguishing angle |\n' +
      '|---|---|---|\n' +
      '| Feature | accordion-panel-right | progressive disclosure |\n' +
      '| Feature | feature-trio | three peers |\n';
    const out = transformComponentsMd(md);
    expect(out).toContain('| Feature | feature-accordion | progressive disclosure |');
    expect(out).toContain('| Feature | feature-trio | three peers |');
    // prose above the appendix heading is untouched, even though it names a renamed id
    expect(out).toContain('Some prose mentioning accordion-panel-right that must NOT be touched.');
  });

  it('is idempotent', () => {
    const md =
      '## Variant appendix\n' +
      '| Family | Variant | Angle |\n|---|---|---|\n' +
      '| Feature | accordion-panel-right | x |\n';
    const once = transformComponentsMd(md);
    const twice = transformComponentsMd(once);
    expect(twice).toBe(once);
  });
});
