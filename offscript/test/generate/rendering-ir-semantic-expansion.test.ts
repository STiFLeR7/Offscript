/**
 * D1-S4 — Rendering IR Semantic Expansion (RED-first).
 *
 * Implements ONLY the D1-S3-verified gaps that have real, already-flowing, non-invented source
 * data:
 *   1. brief.tone → RenderingMetadata.tone (already passed to every AuthoringRequest —
 *      authoring-seam.ts:48-49 — just never carried into the IR).
 *   2. The verified title-derivation bug: buildRenderingIR set metadata.title = brief.brand, but
 *      BOTH real renderers resolve the title from brief.oneLiner FIRST (site-metadata.ts:75
 *      resolveMetadata; author.ts:485 assembleDocument). Fixed to match.
 *   3. SiteMetadata (canonicalUrl/robots/themeColor/ogType/ogImage/twitterCard/twitterSite/
 *      favicon/appleTouchIcon/manifest/organization/locale) — a genuinely semantic, already-real
 *      per-project data structure (site-metadata.ts:22-44) that simply never reached
 *      buildRenderingIR's signature. Threaded in as a new OPTIONAL third parameter (mirrors how
 *      `brief` itself is caller-supplied, not read from disk inside the builder) — the builder
 *      still performs zero I/O.
 *
 * Explicitly NOT implemented (see D1-S4-RIR-SEMANTIC-EXPANSION.md §2 "Rejected gaps"): fine-
 * grained slots, layout taxonomy, action intent, interactivity intent, responsive intent — none
 * have real non-invented source data pre-authoring. This file's last describe block is a
 * regression guard proving none of those leaked in.
 */
import { describe, it, expect } from 'vitest';
import {
  RIR_VERSION,
  SUPPORTED_IR_VERSIONS,
  buildRenderingIR,
  validateRenderingIR,
  serializeRenderingIR,
  type RenderingSiteMetadataInput,
} from '../../src/generate/rendering-ir.js';
import {
  analyzeRenderingIRCompleteness,
} from '../../src/generate/rendering-ir-completeness.js';
import type { AuthoringPlan, PlanItem } from '../../src/generate/types.js';
import { stubBrief, type Brief } from '../../src/generate/brief.js';

// ── fixtures ──────────────────────────────────────────────────────────────────
const brief = (over: Partial<Brief> = {}): Brief => ({
  ...stubBrief('website'),
  brand: 'Helix',
  oneLiner: 'Close the books in days, not weeks.',
  ...over,
});

function websiteItem(id: string, order: number): PlanItem {
  return {
    anchor: { id, anchor: id, landmark: id === 'hero' ? 'main' : undefined },
    archetype: 'hero',
    tokenRoles: ['--cr-bg'],
    intent: 'Land the one-liner',
    content: order === 0 ? 'Close the books in days.' : undefined,
    fragmentId: 'component-hero-split-01',
    componentVariant: 'hero-split',
    surfaceRole: 'base',
  };
}

function websitePlan(): AuthoringPlan {
  return { track: 'website', items: [websiteItem('hero', 0), websiteItem('features', 1)], warnings: [] };
}

const fullSiteMetadata: RenderingSiteMetadataInput = {
  canonicalUrl: 'https://helix.example.com/',
  robots: 'index, follow',
  themeColor: '#0B1B2A',
  ogType: 'website',
  ogImage: 'https://helix.example.com/og.png',
  twitterCard: 'summary_large_image',
  twitterSite: '@helix',
  favicon: '/favicon.ico',
  appleTouchIcon: '/apple-touch-icon.png',
  manifest: '/site.webmanifest',
  locale: 'en_US',
  organization: { name: 'Helix Inc.', url: 'https://helix.example.com', logo: '/logo.svg', sameAs: ['https://x.com/helix'] },
};

// ── the title-derivation bug fix ────────────────────────────────────────────────
describe('D1-S4 — title derivation matches the real renderers (bug fix)', () => {
  it('resolves title from brief.oneLiner, not brief.brand, when brand !== oneLiner (site-metadata.ts:75 parity)', () => {
    const ir = buildRenderingIR(websitePlan(), brief());
    expect(ir.document.metadata.title).toBe('Close the books in days, not weeks.');
    expect(ir.document.metadata.siteName).toBe('Helix'); // siteName still resolves from brand
  });

  it('an explicit siteMetadata.title still wins over brief.oneLiner (project override, same precedence as resolveMetadata)', () => {
    const ir = buildRenderingIR(websitePlan(), brief(), { title: 'Helix — Close Faster' });
    expect(ir.document.metadata.title).toBe('Helix — Close Faster');
  });

  it('falls back to brief.brand only when oneLiner is absent', () => {
    const ir = buildRenderingIR(websitePlan(), brief({ oneLiner: '' }));
    expect(ir.document.metadata.title).toBe('Helix');
  });
});

// ── brief.tone ────────────────────────────────────────────────────────────────
describe('D1-S4 — brief.tone → RenderingMetadata.tone', () => {
  it('carries a non-empty brief.tone into document.metadata.tone', () => {
    const ir = buildRenderingIR(websitePlan(), brief({ tone: 'confident, plainspoken' }));
    expect(ir.document.metadata.tone).toBe('confident, plainspoken');
  });

  it('omits tone entirely (no empty-string field) when brief.tone is empty', () => {
    const ir = buildRenderingIR(websitePlan(), brief({ tone: '' }));
    expect(ir.document.metadata.tone).toBeUndefined();
    expect(JSON.stringify(ir)).not.toContain('"tone"');
  });
});

// ── SiteMetadata pass-through ────────────────────────────────────────────────────
describe('D1-S4 — SiteMetadata pass-through (new optional 3rd builder parameter)', () => {
  it('carries every SiteMetadata field verbatim into document.metadata when supplied', () => {
    const ir = buildRenderingIR(websitePlan(), brief(), fullSiteMetadata);
    const m = ir.document.metadata;
    expect(m.canonicalUrl).toBe(fullSiteMetadata.canonicalUrl);
    expect(m.robots).toBe(fullSiteMetadata.robots);
    expect(m.themeColor).toBe(fullSiteMetadata.themeColor);
    expect(m.ogType).toBe(fullSiteMetadata.ogType);
    expect(m.ogImage).toBe(fullSiteMetadata.ogImage);
    expect(m.twitterCard).toBe(fullSiteMetadata.twitterCard);
    expect(m.twitterSite).toBe(fullSiteMetadata.twitterSite);
    expect(m.favicon).toBe(fullSiteMetadata.favicon);
    expect(m.appleTouchIcon).toBe(fullSiteMetadata.appleTouchIcon);
    expect(m.manifest).toBe(fullSiteMetadata.manifest);
    expect(m.locale).toBe(fullSiteMetadata.locale);
    expect(m.organization).toEqual(fullSiteMetadata.organization);
  });

  it('omits every SiteMetadata field (no keys at all) when the 3rd parameter is absent — unchanged from D1-S2 shape plus tone', () => {
    const ir = buildRenderingIR(websitePlan(), brief());
    const json = JSON.stringify(ir);
    for (const key of ['canonicalUrl', 'robots', 'themeColor', 'ogType', 'ogImage', 'twitterCard', 'twitterSite', 'favicon', 'appleTouchIcon', 'manifest', 'locale', 'organization']) {
      expect(json, `should not contain "${key}"`).not.toContain(`"${key}"`);
    }
  });

  it('carries no HTML/markup — SiteMetadata fields are references/intent, never <meta> tags', () => {
    const ir = buildRenderingIR(websitePlan(), brief(), fullSiteMetadata);
    expect(JSON.stringify(ir)).not.toMatch(/<[a-z][\s\S]*>/i);
  });
});

// ── version compatibility ────────────────────────────────────────────────────────
describe('D1-S4 — version compatibility (additive, non-breaking)', () => {
  it('RIR_VERSION stays 1 — this is an additive optional-field expansion, not a breaking change', () => {
    expect(RIR_VERSION).toBe(1);
    expect(SUPPORTED_IR_VERSIONS.has(1)).toBe(true);
    expect(SUPPORTED_IR_VERSIONS.size).toBe(1);
  });

  it('an old-style 2-argument call is still a valid call and produces a valid IR', () => {
    const ir = buildRenderingIR(websitePlan(), brief());
    expect(validateRenderingIR(ir).valid).toBe(true);
  });
});

// ── digest stability ─────────────────────────────────────────────────────────────
describe('D1-S4 — digest stability (the new parameter is a true no-op when absent)', () => {
  it('an explicit undefined 3rd argument produces a byte-identical IR + digest to the 2-argument call', () => {
    const twoArg = buildRenderingIR(websitePlan(), brief());
    const threeArgUndefined = buildRenderingIR(websitePlan(), brief(), undefined);
    expect(threeArgUndefined).toEqual(twoArg);
    expect(threeArgUndefined.digest).toBe(twoArg.digest);
  });

  it('supplying siteMetadata changes the digest (content-addressed, as designed)', () => {
    const bare = buildRenderingIR(websitePlan(), brief());
    const enriched = buildRenderingIR(websitePlan(), brief(), fullSiteMetadata);
    expect(enriched.digest).not.toBe(bare.digest);
  });
});

// ── replay & validation with the new fields ───────────────────────────────────────
describe('D1-S4 — replay & validation still hold with the new fields populated', () => {
  it('serialize → parse → validate round-trips byte-stably with SiteMetadata + tone present', () => {
    const ir = buildRenderingIR(websitePlan(), brief({ tone: 'confident' }), fullSiteMetadata);
    const text = serializeRenderingIR(ir);
    const parsed = JSON.parse(text) as typeof ir;
    expect(parsed).toEqual(ir);
    expect(validateRenderingIR(parsed).valid).toBe(true);
    expect(serializeRenderingIR(parsed)).toBe(text);
  });

  it('still rejects markup smuggled into a new metadata field (neutrality guard covers the expansion too)', () => {
    const ir = buildRenderingIR(websitePlan(), brief(), fullSiteMetadata);
    const tampered = {
      ...ir,
      document: { ...ir.document, metadata: { ...ir.document.metadata, organization: { ...ir.document.metadata.organization, name: '<script>evil</script>' } } },
    };
    const res = validateRenderingIR(tampered);
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toMatch(/markup|html|neutral|digest/i);
  });
});

// ── coverage increase (re-running the D1-S3 analyzer) ─────────────────────────────
describe('D1-S4 — coverage increase (re-running the completeness analyzer)', () => {
  it('tone and SiteMetadata concerns flip from absent to present once real data is supplied, raising coverage', () => {
    const plan = websitePlan();
    const before = analyzeRenderingIRCompleteness(plan, buildRenderingIR(plan, brief()), brief());
    const after = analyzeRenderingIRCompleteness(
      plan,
      buildRenderingIR(plan, brief({ tone: 'confident' }), fullSiteMetadata),
      brief({ tone: 'confident' }),
    );
    const byIdBefore = new Map(before.findings.map((f) => [f.id, f]));
    const byIdAfter = new Map(after.findings.map((f) => [f.id, f]));

    expect(byIdBefore.get('metadata-tone')?.presence).toBe('absent');
    expect(byIdAfter.get('metadata-tone')?.presence).toBe('present');
    expect(byIdBefore.get('metadata-seo-social')?.presence).toBe('absent');
    expect(byIdAfter.get('metadata-seo-social')?.presence).toBe('present');
    expect(byIdBefore.get('metadata-locale-lang')?.presence).toBe('absent');
    expect(byIdAfter.get('metadata-locale-lang')?.presence).toBe('present');

    expect(after.coverage.representedPct).toBeGreaterThan(before.coverage.representedPct);
    expect(after.coverage.present).toBeGreaterThan(before.coverage.present);
  });

  it('the three closed gaps are now classified "represented", not "missing-semantic"', () => {
    const plan = websitePlan();
    const report = analyzeRenderingIRCompleteness(plan, buildRenderingIR(plan, brief()), brief());
    const byId = new Map(report.findings.map((f) => [f.id, f]));
    expect(byId.get('metadata-tone')?.category).toBe('represented');
    expect(byId.get('metadata-seo-social')?.category).toBe('represented');
    expect(byId.get('metadata-locale-lang')?.category).toBe('represented');
  });
});

// ── regression guard: rejected gaps stayed rejected ────────────────────────────────
describe('D1-S4 — rejected gaps were NOT implemented (no scope creep)', () => {
  it('RenderingSlotKind is still exactly "prose" — no fine-grained slot decomposition was invented', () => {
    const ir = buildRenderingIR(websitePlan(), brief());
    const slots = ir.document.pages.flatMap((p) => p.sections).flatMap((s) => s.slots);
    for (const slot of slots) expect(slot.kind).toBe('prose');
  });

  it('no action/interactivity/responsive/layout keys were added anywhere in the IR', () => {
    const ir = buildRenderingIR(websitePlan(), brief(), fullSiteMetadata);
    const json = JSON.stringify(ir);
    for (const key of ['"action"', '"interactivity"', '"responsive"', '"layout"']) {
      expect(json, `should not contain ${key}`).not.toContain(key);
    }
  });
});
