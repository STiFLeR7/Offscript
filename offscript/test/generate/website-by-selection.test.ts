/**
 * WS9b (EA-019 / EA-020) — constitution-by-selection ACTIVATION integration test.
 *
 * Proves the recovered website pipeline composes end-to-end over the REAL planner selection
 * (the thing the scripts/generate.ts activation wires): plan selection → WS3 reconstruction →
 * WS6 shell-rooted assembly → WS7 in-process gate. (WS8 flatten is exercised separately in
 * flatten-website.test.ts and the live e2e — it is slow/font-bound, so omitted here.)
 *
 * The scripts/generate.ts orchestrator executes on import (CLI entry), so it cannot be
 * vitest-imported; this test exercises the same exported seams it composes, on the real plan,
 * which is the regression that matters most: every SELECTED fragmentId must reconstruct (no
 * WS3 F1), and the assembled page must be gate-readable. Guarded on the website governance
 * catalog being present (skips cleanly when the engine has no website governance).
 */

import { describe, it, expect } from 'vitest';
import { buildContext } from '../../src/generate/context.js';
import { plan } from '../../src/generate/plan.js';
import { loadFragmentHtml, loadFragmentCatalog } from '../../src/generate/catalog.js';
import { assembleWebsitePage, type WebsiteBand } from '../../src/generate/website-assembly.js';
import { serializeCurationComment } from '../../src/generate/curation.js';
import { websiteShell, WEBSITE_PASTE_MARKER } from '../../src/generate/website-shell.js';
import { runValidatePageGate } from '../../src/generate/catalog-gate.js';
import { DEFAULT_CLIENT } from '../../src/paths.js';

// Skip cleanly if the website governance catalog is absent (a stripped engine export).
let catalogOk = true;
try {
  catalogOk = loadFragmentCatalog().length > 0;
} catch {
  catalogOk = false;
}

describe.skipIf(!catalogOk)('website-by-selection — WS9b activation composes on the real plan', () => {
  const ctx = buildContext(DEFAULT_CLIENT, 'website');
  const p = plan(ctx);

  it('every website plan item is SELECTED (fragmentId + ≥2 candidates)', () => {
    expect(p.items.length).toBeGreaterThan(0);
    for (const item of p.items) {
      expect(item.fragmentId, `item ${item.anchor.id} has no fragmentId`).toBeTruthy();
      expect((item.candidates ?? []).length, `item ${item.anchor.id} <2 candidates`).toBeGreaterThanOrEqual(2);
    }
  });

  it('every selected fragmentId RECONSTRUCTS to a scoped data-crf band (no WS3 F1/F2)', () => {
    for (const item of p.items) {
      const band = loadFragmentHtml(item.fragmentId!);
      expect(band, `slug ${item.fragmentId} reconstructed empty`).toContain(`data-crf="${item.fragmentId}"`);
    }
  });

  it('assembleWebsitePage builds a page with the curation comment + every band, marker consumed', () => {
    const bands: WebsiteBand[] = p.items.map((item) => ({
      html: loadFragmentHtml(item.fragmentId!),
      slug: item.fragmentId!,
      id: item.anchor.id,
      archetype: String(item.archetype),
    }));
    const page = assembleWebsitePage({
      bands,
      curationComment: serializeCurationComment(p.items),
      shell: websiteShell(ctx.brief.oneLiner),
      title: ctx.brief.oneLiner,
    });
    expect(page).not.toContain(WEBSITE_PASTE_MARKER);
    expect(page).toContain('| intent | surface | candidates | chosen | mode | reason |'); // curation comment present
    for (const item of p.items) {
      expect(page, `band ${item.fragmentId} missing from page`).toContain(`data-crf="${item.fragmentId}"`);
    }
  });

  it('the WS7 curation gate EXECUTES on the assembled page (returns a verdict; deterministic)', () => {
    const cat = loadFragmentCatalog();
    const bands: WebsiteBand[] = p.items.map((item) => ({
      html: loadFragmentHtml(item.fragmentId!),
      slug: item.fragmentId!,
      id: item.anchor.id,
      archetype: String(item.archetype),
    }));
    const page = assembleWebsitePage({
      bands,
      curationComment: serializeCurationComment(p.items),
      shell: websiteShell(ctx.brief.oneLiner),
      title: ctx.brief.oneLiner,
    });
    const r1 = runValidatePageGate(page, cat);
    const r2 = runValidatePageGate(page, cat);
    expect(typeof r1.pass).toBe('boolean'); // gate ran (verdict produced — no throw)
    expect(r1).toEqual(r2); // deterministic
  });
});
