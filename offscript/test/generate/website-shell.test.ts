/**
 * WS4 (EA-018 / EA-019) — the production website shell.
 *
 * The shell is the chrome host WS6 (`assembleWebsitePage`) pastes reconstructed bands into.
 * These tests pin the contract WS6 depends on (the exact PASTE_MARKER, a `<title>` to
 * substitute, a `../colors_and_type.css` link to rewrite, a `</body>` for the behaviour
 * inline) and prove a real WS3b band assembles into the shell end-to-end (WS4 → WS6).
 */

import { describe, it, expect } from 'vitest';
import { websiteShell, WEBSITE_PASTE_MARKER } from '../../src/generate/website-shell.js';
import { assembleWebsitePage, type WebsiteBand } from '../../src/generate/website-assembly.js';
import { reconstructBandForSlug } from '../../src/generate/reconstruct-band.js';

describe('website-shell — WS4 shell contract (what WS6 assembleWebsitePage depends on)', () => {
  it('carries the exact paste marker WS6 replaces', () => {
    expect(websiteShell()).toContain(WEBSITE_PASTE_MARKER);
  });

  it('links the surviving brand sheet via ../ (so WS6 rewrites it to working-dir ./)', () => {
    expect(websiteShell()).toContain('<link rel="stylesheet" href="../colors_and_type.css">');
  });

  it('has a <title> for WS6 to substitute and a </body> for the behaviour inline', () => {
    expect(websiteShell()).toMatch(/<title>[\s\S]*?<\/title>/i);
    expect(websiteShell()).toContain('</body>');
  });

  it('loads Lucide and carries no own @font-face (the linked sheet owns fonts)', () => {
    const shell = websiteShell();
    expect(shell).toContain('lucide');
    expect(shell).not.toContain('@font-face');
  });

  it('is deterministic — repeated calls are byte-identical', () => {
    expect(websiteShell()).toBe(websiteShell());
  });
});

describe('website-shell — WS4 → WS6 contract (a reconstructed band assembles into the shell)', () => {
  it('assembleWebsitePage pastes an anchored band into the shell and rewrites the sheet link', () => {
    const band: WebsiteBand = {
      html: reconstructBandForSlug('hero-actions'),
      slug: 'hero-actions',
      id: 'hero',
      archetype: 'hero',
    };
    const page = assembleWebsitePage({
      bands: [band],
      curationComment: '',
      shell: websiteShell(),
      title: 'Acme',
      behaviourScript: 'window.__cr=1',
    });
    expect(page).not.toContain(WEBSITE_PASTE_MARKER); // marker consumed
    expect(page).toContain('<div data-crf="hero-actions" id="hero" data-archetype="hero">');
    expect(page).toContain('href="colors_and_type.css"'); // ../ rewritten to ./
    expect(page).not.toContain('../colors_and_type.css');
    expect(page).toContain('<title>Acme</title>'); // title substituted
    expect(page).toContain('<script>window.__cr=1</script>'); // behaviour inlined
  });
});
