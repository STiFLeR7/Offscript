import { describe, it, expect } from 'vitest';
import { scriptedAuthor, defaultScriptedAuthor } from '../../src/generate/authoring-seam.js';
import type { AuthoringRequest } from '../../src/generate/authoring-seam.js';
import type { PlanItem } from '../../src/generate/types.js';

function websiteItem(over: Partial<PlanItem> = {}): PlanItem {
  return {
    anchor: { id: 'features', anchor: 'features' },
    archetype: 'feature-grid',
    tokenRoles: [],
    intent: 'Key capabilities',
    ...over,
  };
}

describe('A1 — minimalFragment stamps component identity (website only)', () => {
  it('stamps data-cr-component + data-cr-surface when set', async () => {
    const author = defaultScriptedAuthor();
    const html = await author.author({
      item: websiteItem({ componentVariant: 'feature-trio', surfaceRole: 'base' }),
      guidance: '',
      oneLiner: 'x',
      tone: 'y',
    } as AuthoringRequest);
    expect(html).toContain('data-cr-component="feature-trio"');
    expect(html).toContain('data-cr-surface="base"');
  });

  it('omits the stamps for a collateral-style item (no variant) — byte-identical path', async () => {
    const author = defaultScriptedAuthor();
    const html = await author.author({
      item: websiteItem({ componentVariant: undefined, surfaceRole: undefined }),
      guidance: '',
      oneLiner: 'x',
      tone: 'y',
    } as AuthoringRequest);
    expect(html).not.toContain('data-cr-component');
    expect(html).not.toContain('data-cr-surface');
  });
});

describe('A1 — guidance captured from the request', () => {
  it('the seam receives the request unchanged (sectionGuidance carrier)', async () => {
    let captured: AuthoringRequest | undefined;
    const author = scriptedAuthor((req) => {
      captured = req;
      return '<section id="features"></section>';
    });
    await author.author({
      item: websiteItem(),
      guidance: 'Chosen variant **feature-trio** — blocks: headline-cluster, card-grid.',
      oneLiner: 'x',
      tone: 'y',
    } as AuthoringRequest);
    expect(captured?.guidance).toContain('Chosen variant **feature-trio**');
  });
});
