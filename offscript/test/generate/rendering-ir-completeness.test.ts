/**
 * D1-S3 — Rendering IR Completeness Analyzer (RED-first).
 *
 * Verification sprint: measure what the CURRENT HTML renderers (assembleWebsiteBySelection /
 * authorDocument) consume that the D1-S2 Rendering IR does and does not represent. The analyzer
 * is a pure, read-only comparison over (AuthoringPlan, RenderingIR, Brief) against a static,
 * grounded registry of renderer-input concerns (each carrying a path:line citation) — it never
 * renders HTML, never inspects a fragment/CSS/React, and never touches Generation.
 *
 * See docs/offscript/D1-S3-RIR-COMPLETENESS.md for the full grounding + findings.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { buildRenderingIR } from '../../src/generate/rendering-ir.js';
import {
  RENDERER_INPUT_REGISTRY,
  analyzeRenderingIRCompleteness,
  validateCompletenessReport,
} from '../../src/generate/rendering-ir-completeness.js';
import type { AuthoringPlan, PlanItem } from '../../src/generate/types.js';
import { stubBrief, type Brief } from '../../src/generate/brief.js';

// ── fixtures (mirrors rendering-ir.test.ts) ────────────────────────────────────
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
    tokenRoles: ['--cr-bg', '--cr-accent'],
    intent: 'Land the one-liner',
    content: order === 0 ? 'Close the books in days.' : undefined,
    fragmentId: 'component-hero-split-01',
    candidates: ['component-hero-split-01', 'component-hero-stack-02'],
    reason: 'chosen over stack-02 because …',
    sectionGuidance: 'Component family Job/Rules …',
    composition: 'Feature trio — split — base',
    componentVariant: 'hero-split',
    surfaceRole: 'base',
    reasoning: { role: 'open the page', communicationObjective: 'state the promise' },
  };
}

function websitePlan(): AuthoringPlan {
  return { track: 'website', items: [websiteItem('hero', 0), websiteItem('features', 1)], warnings: [] };
}

function collateralPlan(): AuthoringPlan {
  return {
    track: 'collateral',
    items: [
      { anchor: { id: 'cover', anchor: 'cover' }, archetype: 'CoverPage', tokenRoles: ['--cr-bg'], intent: 'Cover' },
      {
        anchor: { id: 'body', anchor: 'body' },
        archetype: 'ContentPage',
        tokenRoles: [],
        intent: 'Body',
        content: 'Prose.',
        presentationIntent: { intentClass: 'chart', commitment: 'inline', source: [], digest: 'x', validationState: 'valid' },
      },
    ],
    warnings: [],
  };
}

// ── registry integrity (measured, not claimed) ─────────────────────────────────
describe('D1-S3 — RENDERER_INPUT_REGISTRY', () => {
  it('every entry has exactly one of the four closed categories', () => {
    const categories = new Set(['represented', 'missing-semantic', 'presentational', 'framework-specific']);
    for (const entry of RENDERER_INPUT_REGISTRY) {
      expect(categories.has(entry.category), `entry ${entry.id} has category ${entry.category}`).toBe(true);
    }
  });

  it('every entry has exactly one of the four closed owners', () => {
    const owners = new Set(['IR', 'Runtime', 'Framework', 'Theme']);
    for (const entry of RENDERER_INPUT_REGISTRY) {
      expect(owners.has(entry.owner), `entry ${entry.id} has owner ${entry.owner}`).toBe(true);
    }
  });

  it('has unique, non-empty ids and a path:line citation for every entry', () => {
    const ids = new Set<string>();
    for (const entry of RENDERER_INPUT_REGISTRY) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(ids.has(entry.id), `duplicate id ${entry.id}`).toBe(false);
      ids.add(entry.id);
      expect(entry.citation).toMatch(/\.ts:\d|\.md(:\d+)?/);
    }
  });

  it('is non-trivial — covers all four categories and all four owners', () => {
    expect(new Set(RENDERER_INPUT_REGISTRY.map((e) => e.category)).size).toBe(4);
    expect(new Set(RENDERER_INPUT_REGISTRY.map((e) => e.owner)).size).toBe(4);
  });
});

// ── analysis correctness (spot checks against real mapping behavior) ───────────
describe('D1-S3 — analyzeRenderingIRCompleteness (mapping correctness)', () => {
  it('marks IR-mapped fields present when the plan/RIR actually carry them', () => {
    const plan = websitePlan();
    const rir = buildRenderingIR(plan, brief());
    const report = analyzeRenderingIRCompleteness(plan, rir, brief());
    const byId = new Map(report.findings.map((f) => [f.id, f]));
    expect(byId.get('section-role')?.presence).toBe('present');
    expect(byId.get('section-id')?.presence).toBe('present');
    expect(byId.get('section-intent')?.presence).toBe('present');
    expect(byId.get('section-landmark')?.presence).toBe('present');
    expect(byId.get('section-content-blob')?.presence).toBe('present');
    expect(byId.get('composition-variant-surface')?.presence).toBe('present');
    expect(byId.get('token-roles')?.presence).toBe('present');
  });

  it('marks structurally-excluded (presentational/framework) fields absent, never present, in a real RIR', () => {
    const plan = websitePlan();
    const rir = buildRenderingIR(plan, brief());
    const report = analyzeRenderingIRCompleteness(plan, rir, brief());
    const byId = new Map(report.findings.map((f) => [f.id, f]));
    expect(byId.get('fragment-id')?.presence).toBe('absent');
    expect(byId.get('candidates-reason')?.presence).toBe('absent');
    expect(byId.get('section-guidance')?.presence).toBe('absent');
    expect(byId.get('base-fragment')?.presence).toBe('absent');
  });

  it('marks reserved-but-unimplemented architecture fields (actions/interactivity/responsive/fine slots) absent', () => {
    const plan = websitePlan();
    const rir = buildRenderingIR(plan, brief());
    const report = analyzeRenderingIRCompleteness(plan, rir, brief());
    const byId = new Map(report.findings.map((f) => [f.id, f]));
    expect(byId.get('action-intent')?.presence).toBe('absent');
    expect(byId.get('interactivity-intent')?.presence).toBe('absent');
    expect(byId.get('responsive-intent')?.presence).toBe('absent');
    expect(byId.get('section-content-fine-grained')?.presence).toBe('absent');
    expect(byId.get('metadata-tone')?.presence).toBe('absent');
  });

  it('marks track-inapplicable concerns not-applicable rather than absent (website plan excludes collateral-only concerns)', () => {
    const plan = websitePlan();
    const rir = buildRenderingIR(plan, brief());
    const report = analyzeRenderingIRCompleteness(plan, rir, brief());
    const byId = new Map(report.findings.map((f) => [f.id, f]));
    expect(byId.get('study-pointer')?.presence).toBe('not-applicable');
    expect(byId.get('canonical-footer')?.presence).toBe('not-applicable');
    expect(byId.get('presentation-medium-commitment')?.presence).toBe('not-applicable'); // always absent on website (types.ts:220)
  });

  it('marks collateral-only concerns applicable (present or absent) on a collateral plan', () => {
    const plan = collateralPlan();
    const rir = buildRenderingIR(plan, brief({ track: 'collateral' }));
    const report = analyzeRenderingIRCompleteness(plan, rir, brief({ track: 'collateral' }));
    const byId = new Map(report.findings.map((f) => [f.id, f]));
    expect(byId.get('presentation-medium-commitment')?.presence).toBe('present'); // one item carries presentationIntent
    expect(byId.get('canonical-footer')?.presence).toBe('not-applicable'); // structural framework concern; always exercised in a real run, not measurable from plan/RIR alone — see impl
    expect(byId.get('study-pointer')?.presence).not.toBe('not-applicable');
  });

  it('never renders HTML: the report contains no markup anywhere', () => {
    const plan = websitePlan();
    const rir = buildRenderingIR(plan, brief());
    const report = analyzeRenderingIRCompleteness(plan, rir, brief());
    expect(JSON.stringify(report)).not.toMatch(/<[a-z][\s\S]*>/i);
  });
});

// ── coverage measurement ────────────────────────────────────────────────────────
describe('D1-S3 — coverage', () => {
  it('computes coverage as present / (present + absent), excluding not-applicable', () => {
    const plan = websitePlan();
    const rir = buildRenderingIR(plan, brief());
    const report = analyzeRenderingIRCompleteness(plan, rir, brief());
    const present = report.findings.filter((f) => f.presence === 'present').length;
    const absent = report.findings.filter((f) => f.presence === 'absent').length;
    expect(report.coverage.present).toBe(present);
    expect(report.coverage.absent).toBe(absent);
    expect(report.coverage.applicable).toBe(present + absent);
    expect(report.coverage.representedPct).toBeCloseTo((present / (present + absent)) * 100, 5);
  });

  it('coverage percentage is strictly between 0 and 100 for a realistic plan (neither total leak nor total capture)', () => {
    const plan = websitePlan();
    const rir = buildRenderingIR(plan, brief());
    const report = analyzeRenderingIRCompleteness(plan, rir, brief());
    expect(report.coverage.representedPct).toBeGreaterThan(0);
    expect(report.coverage.representedPct).toBeLessThan(100);
  });
});

// ── determinism & replay (mirrors D1-S2's determinism doctrine) ─────────────────
describe('D1-S3 — determinism & digest', () => {
  it('is deterministic: identical (plan, rir, brief) → identical report + identical digest', () => {
    const plan = websitePlan();
    const rir = buildRenderingIR(plan, brief());
    const a = analyzeRenderingIRCompleteness(plan, rir, brief());
    const b = analyzeRenderingIRCompleteness(plan, rir, brief());
    expect(b).toEqual(a);
    expect(b.digest).toBe(a.digest);
  });

  it('changes the digest when the underlying plan/RIR content changes', () => {
    const planA = websitePlan();
    const rirA = buildRenderingIR(planA, brief());
    const a = analyzeRenderingIRCompleteness(planA, rirA, brief());

    const planB = collateralPlan();
    const rirB = buildRenderingIR(planB, brief({ track: 'collateral' }));
    const b = analyzeRenderingIRCompleteness(planB, rirB, brief({ track: 'collateral' }));

    expect(b.digest).not.toBe(a.digest);
  });
});

// ── validateCompletenessReport (every dependency classified into exactly one category) ─
describe('D1-S3 — validateCompletenessReport', () => {
  it('a freshly analyzed report validates clean — every finding has exactly one category', () => {
    const plan = websitePlan();
    const rir = buildRenderingIR(plan, brief());
    const report = analyzeRenderingIRCompleteness(plan, rir, brief());
    const res = validateCompletenessReport(report);
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it('rejects a report with an unclassified finding', () => {
    const plan = websitePlan();
    const rir = buildRenderingIR(plan, brief());
    const report = analyzeRenderingIRCompleteness(plan, rir, brief());
    const bad = {
      ...report,
      findings: [...report.findings.slice(1), { ...report.findings[0], category: 'unknown' as never }],
    };
    const res = validateCompletenessReport(bad);
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toMatch(/categor/i);
  });

  it('rejects a report with a duplicate finding id', () => {
    const plan = websitePlan();
    const rir = buildRenderingIR(plan, brief());
    const report = analyzeRenderingIRCompleteness(plan, rir, brief());
    const bad = { ...report, findings: [...report.findings, report.findings[0]] };
    const res = validateCompletenessReport(bad);
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toMatch(/duplicate/i);
  });
});

// ── purity: no rendering, no HTML/fragment/fs deps ──────────────────────────────
describe('D1-S3 — the analyzer never renders HTML (pure, read-only comparison)', () => {
  it('the module source imports no HTML/fragment/fs/React module', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '..', '..', 'src', 'generate', 'rendering-ir-completeness.ts'), 'utf8');
    const specifiers = [...src.matchAll(/^\s*import\b[^\n]*\bfrom\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    const banned = ['reconstruct-band', 'website-shell', 'website-assembly', 'catalog', 'author.js', 'node:fs', 'react'];
    for (const spec of specifiers) {
      for (const b of banned) {
        expect(spec, `imports ${spec}`).not.toContain(b);
      }
    }
    expect(specifiers).not.toContain('fs');
  });
});
