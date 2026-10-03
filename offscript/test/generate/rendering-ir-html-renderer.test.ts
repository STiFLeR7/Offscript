/**
 * D2-S1 — RenderingIRHtmlRenderer (RED-first).
 *
 * The experimental HTML renderer whose ONLY semantic input is a RenderingIR. It exists to
 * validate the IR contract (does it carry enough to render a structurally faithful document?),
 * never to replace or influence the production renderer (`assembleWebsiteBySelection` /
 * `authorDocument`), which is untouched.
 *
 * See docs/offscript/D2-S1-HTML-RENDERER-OVER-RIR.md for the grounding + parity analysis.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { renderRenderingIRToHtml, RENDERER_DEFAULT_LANG } from '../../src/generate/rendering-ir-html-renderer.js';
import { buildRenderingIR, type RenderingIR } from '../../src/generate/rendering-ir.js';
import type { AuthoringPlan, PlanItem } from '../../src/generate/types.js';
import { stubBrief, type Brief } from '../../src/generate/brief.js';

// ── fixtures ──────────────────────────────────────────────────────────────────
const brief = (over: Partial<Brief> = {}): Brief => ({
  ...stubBrief('website'),
  brand: 'Helix',
  oneLiner: 'Close the books in days, not weeks.',
  ...over,
});

function websiteItem(id: string, order: number, landmark?: string): PlanItem {
  return {
    anchor: { id, anchor: id, ...(landmark ? { landmark } : {}) },
    archetype: id === 'hero' ? 'hero' : 'faq',
    tokenRoles: ['--cr-bg'],
    intent: 'x',
    content: order === 0 ? 'Close the books in days.' : 'How does it work?',
    fragmentId: 'component-hero-split-01',
    componentVariant: 'hero-split',
    surfaceRole: 'base',
  };
}

function websitePlan(): AuthoringPlan {
  return {
    track: 'website',
    items: [websiteItem('hero', 0, 'main'), websiteItem('faq', 1)],
    warnings: [],
  };
}

function collateralPlan(): AuthoringPlan {
  return {
    track: 'collateral',
    items: [
      { anchor: { id: 'cover', anchor: 'cover' }, archetype: 'CoverPage', tokenRoles: [], intent: 'Cover', content: 'Helix.' },
      { anchor: { id: 'body', anchor: 'body' }, archetype: 'ContentPage', tokenRoles: [], intent: 'Body', content: 'Prose.' },
    ],
    warnings: [],
  };
}

const siteMeta = {
  canonicalUrl: 'https://helix.example.com/',
  ogImage: 'https://helix.example.com/og.png',
  organization: { name: 'Helix Inc.', url: 'https://helix.example.com' },
};

// ── purity ────────────────────────────────────────────────────────────────────
describe('D2-S1 — RenderingIRHtmlRenderer purity (no Generation dependency)', () => {
  it('the module imports only from rendering-ir.js — no AuthoringPlan, DesignContext, PresentationIntent, author modules, or fs', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '..', '..', 'src', 'generate', 'rendering-ir-html-renderer.ts'), 'utf8');
    const specifiers = [...src.matchAll(/^\s*import\b[\s\S]*?\bfrom\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    for (const spec of specifiers) {
      expect(spec === './rendering-ir.js' || spec === './rendering-ir.ts', `unexpected import: ${spec}`).toBe(true);
    }
    expect(specifiers.length).toBeGreaterThan(0);
  });

  it('renders from a hand-built RenderingIR with no Plan/context/brief anywhere in the call chain', () => {
    const rir: RenderingIR = {
      irVersion: 1,
      track: 'website',
      document: {
        metadata: { title: 'Hand Built' },
        tokens: [],
        pages: [{ id: 'page', role: 'page', sections: [{ id: 's1', role: 'hero', order: 0, intent: 'x', slots: [], digest: 'irrelevant-for-render' }] }],
      },
      digest: 'irrelevant-for-render',
    };
    // renderRenderingIRToHtml validates internally; a hand-built IR without real digests must
    // still be REJECTED as fail-loud (digest integrity is measured) — proving the renderer never
    // silently trusts unverified input, even though it took zero Plan/context arguments.
    expect(() => renderRenderingIRToHtml(rir)).toThrow(/digest/i);
  });
});

// ── determinism & replay ───────────────────────────────────────────────────────
describe('D2-S1 — determinism & replay', () => {
  it('is deterministic: rendering the same RIR twice produces byte-identical HTML', () => {
    const rir = buildRenderingIR(websitePlan(), brief(), siteMeta);
    const a = renderRenderingIRToHtml(rir);
    const b = renderRenderingIRToHtml(rir);
    expect(b.html).toBe(a.html);
  });

  it('replays: render(parse(serialize(rir))) === render(rir)', () => {
    const rir = buildRenderingIR(websitePlan(), brief(), siteMeta);
    const roundTripped = JSON.parse(JSON.stringify(rir)) as RenderingIR;
    expect(renderRenderingIRToHtml(roundTripped).html).toBe(renderRenderingIRToHtml(rir).html);
  });

  it('rejects an IR that fails validateRenderingIR (fail-loud, measured not claimed)', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const tampered: RenderingIR = { ...rir, digest: 'deadbeef' };
    expect(() => renderRenderingIRToHtml(tampered)).toThrow(/digest|invalid/i);
  });
});

// ── semantic ordering & landmarks ──────────────────────────────────────────────
describe('D2-S1 — semantic ordering & landmarks', () => {
  it('preserves section order in the rendered output', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const { html } = renderRenderingIRToHtml(rir);
    expect(html.indexOf('id="hero"')).toBeLessThan(html.indexOf('id="faq"'));
  });

  it('renders a declared landmark as its matching semantic HTML5 element', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const { html } = renderRenderingIRToHtml(rir);
    expect(html).toMatch(/<main[^>]*id="hero"/);
  });

  it('falls back to a generic <section> when no landmark is declared', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const { html } = renderRenderingIRToHtml(rir);
    expect(html).toMatch(/<section[^>]*id="faq"/);
  });

  it('stamps role/order/composition as data attributes — never invents markup the IR does not carry', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const { html } = renderRenderingIRToHtml(rir);
    expect(html).toContain('data-cr-role="hero"');
    expect(html).toContain('data-cr-order="0"');
    expect(html).toContain('data-cr-variant="hero-split"');
    expect(html).toContain('data-cr-surface="base"');
  });

  it('wraps each collateral page in its own container, one per RenderingPage', () => {
    const rir = buildRenderingIR(collateralPlan(), brief({ track: 'collateral' }));
    const { html } = renderRenderingIRToHtml(rir);
    expect(html).toContain('data-cr-page="cover"');
    expect(html).toContain('data-cr-page="body"');
    expect(html.indexOf('data-cr-page="cover"')).toBeLessThan(html.indexOf('data-cr-page="body"'));
  });
});

// ── metadata rendering ───────────────────────────────────────────────────────
describe('D2-S1 — metadata rendering', () => {
  it('renders title, description, canonical, OG, twitter, and organization JSON-LD from document.metadata', () => {
    const rir = buildRenderingIR(websitePlan(), brief(), siteMeta);
    const { html } = renderRenderingIRToHtml(rir);
    expect(html).toContain('<title>Close the books in days, not weeks.</title>');
    expect(html).toContain('<meta name="description" content="Close the books in days, not weeks.">');
    expect(html).toContain(`<link rel="canonical" href="${siteMeta.canonicalUrl}">`);
    expect(html).toContain('<meta property="og:title"');
    expect(html).toContain(`<meta property="og:image" content="${siteMeta.ogImage}">`);
    expect(html).toContain('<meta name="twitter:card"');
    expect(html).toContain('"@type":"Organization"');
    expect(html).toContain('"name":"Helix Inc."');
  });

  it('omits a metadata tag entirely when its source field is absent (never a placeholder)', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const { html } = renderRenderingIRToHtml(rir);
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('twitter:image');
  });

  it('uses the renderer-owned default lang, since no locale-for-<html> source exists in the IR (documented, D1-S4 §2)', () => {
    const rir = buildRenderingIR(websitePlan(), brief());
    const { html } = renderRenderingIRToHtml(rir);
    expect(html).toContain(`<html lang="${RENDERER_DEFAULT_LANG}">`);
  });

  it('gates the SEO/OG/Twitter/icon head block to website — matching production (applySiteMetadata is website-only, scripts/generate.ts:645-666) — but always renders <title> on every track', () => {
    const rir = buildRenderingIR(collateralPlan(), brief({ track: 'collateral' }), siteMeta);
    const { html } = renderRenderingIRToHtml(rir);
    expect(html).toContain('<title>Close the books in days, not weeks.</title>');
    expect(html).not.toContain('og:title');
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('twitter:card');
  });
});

// ── content escaping (the renderer is the FIRST place raw copy becomes HTML) ────
describe('D2-S1 — content escaping (renderer implements presentation, including safety)', () => {
  it('escapes slot content and metadata that contain HTML-special characters', () => {
    const plan: AuthoringPlan = {
      track: 'website',
      items: [{ anchor: { id: 'hero', anchor: 'hero' }, archetype: 'hero', tokenRoles: [], intent: 'x', content: '<script>alert(1)</script> & "quotes"' }],
      warnings: [],
    };
    const rir = buildRenderingIR(plan, brief());
    const { html } = renderRenderingIRToHtml(rir);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
