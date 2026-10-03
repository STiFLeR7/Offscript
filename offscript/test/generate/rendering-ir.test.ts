/**
 * D1-S2 — Rendering IR Builder (RED-first).
 *
 * Phase 0 of the RENDERING_IR_ARCHITECTURE.md migration: DERIVE ONLY. The builder maps the existing
 * semantic model (AuthoringPlan / PlanItem) into a rendering-neutral Rendering IR. Nothing in the
 * generate pipeline consumes it; generation is unchanged and byte-identical. The builder is pure and
 * deterministic, never inspects HTML fragments / CSS / React, and excludes the one presentational
 * leak (`fragmentId`).
 *
 * Mirrors the W52 (presentation-intent) transport-only shape: a pure model, a content-addressed
 * digest, a measured validator.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import {
  RIR_VERSION,
  SUPPORTED_IR_VERSIONS,
  buildRenderingIR,
  validateRenderingIR,
  serializeRenderingIR,
  type RenderingIR,
} from '../../src/generate/rendering-ir.js';
import type { AuthoringPlan, PlanItem } from '../../src/generate/types.js';
import { stubBrief, type Brief } from '../../src/generate/brief.js';

// ── fixtures ──────────────────────────────────────────────────────────────────
const brief = (over: Partial<Brief> = {}): Brief => ({
  ...stubBrief('website'),
  brand: 'Helix',
  oneLiner: 'Close the books in days, not weeks.',
  ...over,
});

/** A rich website item exercising every derivable field. `fragmentId` MUST be dropped. */
function websiteItem(id: string, order: number): PlanItem {
  return {
    anchor: { id, anchor: id, landmark: id === 'hero' ? 'main' : undefined },
    archetype: 'hero',
    tokenRoles: ['--cr-bg', '--cr-accent'],
    intent: 'Land the one-liner',
    content: order === 0 ? 'Close the books in days.' : undefined,
    fragmentId: 'component-hero-split-01', // ← the presentational leak; must NOT appear in the IR
    candidates: ['component-hero-split-01', 'component-hero-stack-02'],
    reason: 'chosen over stack-02 because …',
    sectionGuidance: 'Component family Job/Rules …',
    composition: 'Feature trio — split — base',
    componentVariant: 'hero-split',
    surfaceRole: 'base',
    presentationIntent: {
      intentClass: 'none',
      commitment: 'dominant',
      source: [],
      digest: 'x',
      validationState: 'valid',
    },
    reasoning: {
      role: 'open the page',
      communicationObjective: 'state the promise',
    },
  };
}

function websitePlan(): AuthoringPlan {
  return {
    track: 'website',
    items: [websiteItem('hero', 0), websiteItem('features', 1)],
    warnings: [],
  };
}

function collateralPlan(): AuthoringPlan {
  return {
    track: 'collateral',
    items: [
      { anchor: { id: 'cover', anchor: 'cover' }, archetype: 'CoverPage', tokenRoles: ['--cr-bg'], intent: 'Cover' },
      { anchor: { id: 'body', anchor: 'body' }, archetype: 'ContentPage', tokenRoles: [], intent: 'Body', content: 'Prose.' },
    ],
    warnings: [],
  };
}

// ── mapping ─────────────────────────────────────────────────────────────────
describe('D1-S2 — buildRenderingIR (mapping)', () => {
  it('produces a versioned, tracked IR with one website page holding ordered sections', () => {
    const ir = buildRenderingIR(websitePlan(), brief());
    expect(ir.irVersion).toBe(RIR_VERSION);
    expect(ir.track).toBe('website');
    expect(ir.document.pages).toHaveLength(1);
    expect(ir.document.pages[0].role).toBe('page');
    expect(ir.document.pages[0].sections.map((s) => s.id)).toEqual(['hero', 'features']);
    expect(ir.document.pages[0].sections.map((s) => s.order)).toEqual([0, 1]);
  });

  it('maps semantic fields: role, intent, landmark, composition, presentation, reasoning', () => {
    const s = buildRenderingIR(websitePlan(), brief()).document.pages[0].sections[0];
    expect(s.role).toBe('hero');
    expect(s.intent).toBe('Land the one-liner');
    expect(s.landmark).toBe('main');
    expect(s.composition).toEqual({ variant: 'hero-split', surface: 'base' });
    expect(s.presentation).toEqual({ medium: 'none', commitment: 'dominant' });
    expect(s.reasoning).toEqual({ role: 'open the page', communicationObjective: 'state the promise' });
  });

  it('maps present content to a single prose slot; absent content to no slots', () => {
    const [hero, features] = buildRenderingIR(websitePlan(), brief()).document.pages[0].sections;
    expect(hero.slots).toEqual([{ name: 'content', kind: 'prose', content: 'Close the books in days.' }]);
    expect(features.slots).toEqual([]);
  });

  it('unions + sorts + dedupes referenced token roles at the document level', () => {
    expect(buildRenderingIR(websitePlan(), brief()).document.tokens).toEqual(['--cr-accent', '--cr-bg']);
  });

  it('derives document metadata (intent only) from the brief', () => {
    const m = buildRenderingIR(websitePlan(), brief()).document.metadata;
    // D1-S4 fixed the title-derivation bug: title now resolves from oneLiner first, matching
    // the real renderers (site-metadata.ts:75 resolveMetadata; author.ts:485 assembleDocument).
    // See docs/offscript/D1-S4-RIR-SEMANTIC-EXPANSION.md.
    expect(m.title).toBe('Close the books in days, not weeks.');
    expect(m.description).toBe('Close the books in days, not weeks.');
    expect(m.siteName).toBe('Helix');
  });

  it('groups non-website tracks into one page per plan item', () => {
    const ir = buildRenderingIR(collateralPlan(), brief({ track: 'collateral' }));
    expect(ir.document.pages).toHaveLength(2);
    expect(ir.document.pages.map((p) => p.id)).toEqual(['cover', 'body']);
    expect(ir.document.pages.every((p) => p.sections.length === 1)).toBe(true);
  });
});

// ── exclusion of the presentational leak ──────────────────────────────────────
describe('D1-S2 — excludes presentation (no fragmentId / no HTML deps)', () => {
  it('never carries fragmentId or the curation trail into the IR', () => {
    const json = serializeRenderingIR(buildRenderingIR(websitePlan(), brief()));
    for (const forbidden of ['fragmentId', 'candidates', 'sectionGuidance', 'componentKnowledge', 'component-hero-split-01']) {
      expect(json).not.toContain(forbidden);
    }
  });

  it('carries no HTML/CSS markup in any structural field', () => {
    const json = serializeRenderingIR(buildRenderingIR(websitePlan(), brief()));
    expect(json).not.toMatch(/[<>]/); // no tags anywhere (content copy here is markup-free too)
    expect(json).not.toContain('@media');
    expect(json).not.toContain('class=');
  });

  it('the builder source imports no HTML/fragment/fs module (pure derivation)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '..', '..', 'src', 'generate', 'rendering-ir.ts'), 'utf8');
    // Scan only the module specifiers of real import statements — naming a module in a doc-comment
    // (to say we DON'T import it) is documentation, not a dependency.
    const specifiers = [...src.matchAll(/^\s*import\b[^\n]*\bfrom\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    const bannedFragments = ['reconstruct-band', 'website-shell', 'website-assembly', 'catalog', 'node:fs'];
    for (const spec of specifiers) {
      for (const banned of bannedFragments) {
        expect(spec, `imports ${spec}`).not.toContain(banned);
      }
    }
    // Also assert no bare fs usage sneaks in.
    expect(specifiers).not.toContain('fs');
  });
});

// ── determinism + replay ──────────────────────────────────────────────────────
describe('D1-S2 — determinism, digest & replay', () => {
  it('is deterministic: identical plan → identical IR + identical digest', () => {
    const a = buildRenderingIR(websitePlan(), brief());
    const b = buildRenderingIR(websitePlan(), brief());
    expect(b).toEqual(a);
    expect(b.digest).toBe(a.digest);
    expect(typeof a.digest).toBe('string');
    expect(a.digest.length).toBeGreaterThan(16);
  });

  it('changes the digest when semantic content changes', () => {
    const base = buildRenderingIR(websitePlan(), brief());
    const changed = buildRenderingIR(
      { ...websitePlan(), items: [{ ...websiteItem('hero', 0), intent: 'A DIFFERENT intent' }, websiteItem('features', 1)] },
      brief(),
    );
    expect(changed.digest).not.toBe(base.digest);
  });

  it('replays: serialize → parse → validate holds, and round-trips byte-stably', () => {
    const ir = buildRenderingIR(websitePlan(), brief());
    const text = serializeRenderingIR(ir);
    const parsed = JSON.parse(text) as RenderingIR;
    expect(parsed).toEqual(ir);
    expect(validateRenderingIR(parsed).valid).toBe(true);
    expect(serializeRenderingIR(parsed)).toBe(text); // idempotent serialization
  });
});

// ── versioning + validation ───────────────────────────────────────────────────
describe('D1-S2 — versioning & validation', () => {
  it('declares version 1 as supported', () => {
    expect(RIR_VERSION).toBe(1);
    expect(SUPPORTED_IR_VERSIONS.has(1)).toBe(true);
  });

  it('a freshly built IR validates clean', () => {
    const res = validateRenderingIR(buildRenderingIR(websitePlan(), brief()));
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it('rejects an unsupported irVersion', () => {
    const ir = buildRenderingIR(websitePlan(), brief());
    const res = validateRenderingIR({ ...ir, irVersion: 999 });
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toMatch(/version/i);
  });

  it('rejects a tampered digest (replay integrity is measured, not claimed)', () => {
    const ir = buildRenderingIR(websitePlan(), brief());
    const res = validateRenderingIR({ ...ir, digest: 'deadbeef' });
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toMatch(/digest/i);
  });

  it('rejects an IR whose structural field carries markup (neutrality is measured)', () => {
    const ir = buildRenderingIR(websitePlan(), brief());
    const page0 = ir.document.pages[0];
    const badSection = { ...page0.sections[0], role: '<div class="hero">' };
    const bad: RenderingIR = {
      ...ir,
      document: { ...ir.document, pages: [{ ...page0, sections: [badSection, page0.sections[1]] }] },
    };
    const res = validateRenderingIR(bad);
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toMatch(/markup|html|neutral/i);
  });
});
