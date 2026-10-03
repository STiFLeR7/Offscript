import { describe, it, expect } from 'vitest';
import { authorDocument } from '../src/generate/author.js';
import type { Author, AuthoringRequest } from '../src/generate/authoring-seam.js';
import { buildContext } from '../src/generate/context.js';
import { plan } from '../src/generate/plan.js';

// Scripted double: emits NO imagery (the production scripted author's behavior).
const scripted: Author = {
  async author(req: AuthoringRequest) {
    return `<div id="${req.item.anchor.id}"><h2>x</h2><p>y</p></div>`;
  },
};

describe('collateral interiors stay photo-free', () => {
  it('the cover selector is the only photographic background; no interior <img> photos', async () => {
    const context = buildContext('example-brand', 'collateral');
    const p = plan(context);
    const { html } = await authorDocument(p, context, scripted);

    // Cover photo present (engine-painted).
    expect(html).toMatch(/\.cr-page--dark\.cr-page--bleed\s*\{[^}]*data:image\/jpeg/s);

    // No <img> photo anywhere in the body.
    expect(html).not.toMatch(/<img[^>]+\.(?:jpg|jpeg|png|webp)/i);

    // The ONLY data:image/jpeg occurrences are the cover (no interior jpeg backgrounds).
    const jpegHits = (html.match(/data:image\/jpeg/g) ?? []).length;
    expect(jpegHits).toBe(1);
  });
});
