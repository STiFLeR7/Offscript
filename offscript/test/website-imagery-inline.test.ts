import { describe, it, expect } from 'vitest';
import { authorDocument } from '../src/generate/author.js';
import type { Author, AuthoringRequest } from '../src/generate/authoring-seam.js';
import { buildContext } from '../src/generate/context.js';
import { plan } from '../src/generate/plan.js';

// An author double that emits ONE governance-relative image ref on the first section,
// and an inert band on every other section.
let first = true;
const imageryAuthor: Author = {
  async author(req: AuthoringRequest): Promise<string> {
    const id = req.item.anchor.id;
    if (first) {
      first = false;
      return `<section id="${id}" class="cr-band"><img src="backgrounds/hero-bg-night.jpg" alt="hero"></section>`;
    }
    return `<section id="${id}" class="cr-band"><h2>x</h2></section>`;
  },
};

describe('website imagery is inlined to a data-URI', () => {
  it('rewrites an author-requested governance image to base64', async () => {
    first = true;
    const context = buildContext('example-brand', 'website');
    const p = plan(context);
    const { html, warnings } = await authorDocument(p, context, imageryAuthor);
    expect(html).toContain('data:image/jpeg;base64,');
    expect(html).not.toContain('src="backgrounds/hero-bg-night.jpg"');
    expect(warnings.filter((w) => w.includes('hero-bg-night'))).toHaveLength(0);
  });
});
