/**
 * I-1 — Website pipeline smoke test (parity with generate-collateral.test.ts).
 *
 * Positively verifies the website track's authored structure + validate integration
 * via the scripted-author pipeline (deterministic, no LLM, default-CI safe):
 *
 *  (a) authorDocument(website ctx) → isCollateral false, self-contained <div id="root">
 *      document (no <main> shell), NO cr-doc/cr-page wrappers, the token sheet inlined as
 *      a <style> block (no <link>) with fonts rewritten to data: URIs, behaviour library
 *      embedded (track isolation — the inverse of collateral's zero-JS rule), valid HTML,
 *      one section per plan item, deterministic.
 *  (b) validate(websiteHtml, websiteCtx) → RunScore via the website registry
 *      (buckets.total ≥ 1, website-specific rails present).
 *
 * Grounding: src/generate/author.ts:230-317 (assembly); operators/index.ts (registry).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildContext } from '../src/generate/context.js';
import { plan } from '../src/generate/plan.js';
import { authorDocument } from '../src/generate/author.js';
import { defaultScriptedAuthor } from '../src/generate/authoring-seam.js';
import { validate } from '../src/generate/validate.js';
import { isCollateral } from '../src/collateral/intake.js';
import { parseHtml } from '../src/working-rep.js';

// ── Shared website fixture ────────────────────────────────────────────────────

let websiteHtml: string;
let websiteCtx: ReturnType<typeof buildContext>;
let websiteItemCount: number;

beforeAll(async () => {
  websiteCtx = buildContext('example-brand', 'website');
  const p = plan(websiteCtx);
  websiteItemCount = p.items.length;
  const { html } = await authorDocument(p, websiteCtx, defaultScriptedAuthor());
  websiteHtml = html;
});

// ── (a) authorDocument — website-shaped output ────────────────────────────────

describe('authorDocument — website track produces #root structure', () => {
  it('isCollateral(html) === false (no cr-doc wrapper)', () => {
    expect(isCollateral(websiteHtml)).toBe(false);
  });

  it('is self-contained #root-rooted: a <div id="root"> hosts the bands, no <main> shell', () => {
    expect(websiteHtml).toContain('<div id="root">');
    expect(websiteHtml).not.toMatch(/<main\b/);
  });

  it('does NOT emit collateral cr-doc / cr-page wrapper attributes', () => {
    expect(websiteHtml).not.toMatch(/class\s*=\s*["'][^"']*\bcr-doc\b/);
    expect(websiteHtml).not.toMatch(/class\s*=\s*["'][^"']*\bcr-page\b/);
  });

  it('embeds the website behaviour library (track isolation: website gets JS, collateral does not)', () => {
    // The inverse of generate-collateral.test.ts's zero-JS assertion: website MUST carry a
    // <script>, and it must be the real behavior.js — proven by a marker the scripted
    // author's own section stubs never emit ([data-nav-toggle] lives in behavior.js).
    expect(websiteHtml).toContain('<script');
    expect(websiteHtml).toContain('data-nav-toggle');
  });

  it('output parses as valid HTML (no throw)', () => {
    expect(() => parseHtml(websiteHtml)).not.toThrow();
  });

  it('self-contained: inlines the token sheet (no <link>) with fonts as data: URIs', () => {
    // Post-pivot the website ships as ONE self-contained document: the house
    // colors_and_type.css is inlined as a <style> block (no external stylesheet),
    // and its @font-face url("fonts/*.ttf") refs are rewritten to data: URIs.
    expect(websiteHtml).not.toMatch(/<link\b/);
    expect(websiteHtml).toContain('<style>');
    expect(websiteHtml).toMatch(/data:font/); // fonts inlined, not linked
    expect(websiteHtml).not.toMatch(/url\(\s*["']?\.?\/?fonts\//); // no relative font refs survive
    expect(websiteHtml).not.toMatch(/url\(\s*["']?\.\.\//); // no ../ refs
  });

  it('emits one section per plan item (data-archetype-tagged)', () => {
    const sections = websiteHtml.match(/data-archetype="/g);
    expect(sections ? sections.length : 0).toBe(websiteItemCount);
  });

  it('every plan item anchor id appears in the output', () => {
    const p = plan(buildContext('example-brand', 'website'));
    for (const item of p.items) {
      expect(websiteHtml).toContain(`id="${item.anchor.id}"`);
    }
  });

  it('deterministic: two calls produce byte-identical HTML', async () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    const { html: html1 } = await authorDocument(p, ctx, defaultScriptedAuthor());
    const { html: html2 } = await authorDocument(p, ctx, defaultScriptedAuthor());
    expect(html1).toBe(html2);
  });
});

// ── (a2) Self-containment regression — validate runs the rails on the real output ─
//
// Post-pivot the website is author-from-governance (no Path C catalog paste / data-crf
// bands / Curation Table). This keeps the regression that matters: validate must run the
// rails over the REAL assembled (self-contained) artifact without throwing.

describe('authorDocument — website self-contained artifact validates cleanly', () => {
  it('validate runs the rails on the assembled artifact without throwing', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-website-validate-self-'));
    try {
      const result = await validate(websiteHtml, buildContext('example-brand', 'website'), { outDir });
      expect(result.score.systematicRatio).toBeGreaterThanOrEqual(0);
      expect(result.score.buckets.total).toBeGreaterThanOrEqual(1);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});

// ── (b) validate — website registry runs, score populated ─────────────────────

describe('validate — website track runs the website registry', () => {
  it('returns a RunScore with systematicRatio in [0,1]', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-website-validate-a-'));
    try {
      const result = await validate(websiteHtml, websiteCtx, { outDir });
      expect(result.score.systematicRatio).toBeGreaterThanOrEqual(0);
      expect(result.score.systematicRatio).toBeLessThanOrEqual(1);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('buckets.total ≥ 1 (rails fired, not vacuous)', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-website-validate-b-'));
    try {
      const result = await validate(websiteHtml, websiteCtx, { outDir });
      expect(result.score.buckets.total).toBeGreaterThanOrEqual(1);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('per-rail breakdown is non-empty and well-formed', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-website-validate-c-'));
    try {
      const result = await validate(websiteHtml, websiteCtx, { outDir });
      expect(result.perRail.length).toBeGreaterThan(0);
      for (const entry of result.perRail) {
        expect(typeof entry.operator.name).toBe('string');
        expect(Array.isArray(entry.findings)).toBe(true);
      }
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('website-specific rails are present in perRail (cta-choreography, narrative-arc-presence)', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-website-validate-d-'));
    try {
      const result = await validate(websiteHtml, websiteCtx, { outDir });
      const railNames = result.perRail.map((r) => r.operator.name);
      expect(railNames).toContain('cta-choreography');
      expect(railNames).toContain('narrative-arc-presence');
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('writes score.json to outDir', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-website-validate-e-'));
    try {
      await validate(websiteHtml, websiteCtx, { outDir });
      expect(existsSync(join(outDir, 'score.json'))).toBe(true);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
