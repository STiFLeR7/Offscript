/**
 * Stage 4 — validate.ts tests: validate(html, context, opts) → ValidateResult
 *
 * Coverage:
 *  (a) Real example-brand artifact: validate over a generated example-brand website
 *      returns a RunScore with populated per-rail breakdown, a finite
 *      systematicRatio in [0,1], and writes score.json.
 *      CIRCULAR-PROOF NOTE: on the scripted path this scores ~0.57 (measured),
 *      NOT ≈1.0 — the scripted author leaves real rail gaps. It is a pipeline
 *      smoke-test, not the on-brand proof.
 *
 *  (b) Non-vacuous proof: validate over a deliberate off-brand violation (two
 *      position:sticky elements on the same edge → sticky-stack escalated) produces
 *      escalated finding(s) AND freezes them to overlay/.
 *      This proves the rails actually catch things, not just rubber-stamp.
 *
 *  (c) Determinism: same html → same score (excluding generatedAt timestamp).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildContext } from '../src/generate/context.js';
import { plan } from '../src/generate/plan.js';
import { authorDocument } from '../src/generate/author.js';
import { defaultScriptedAuthor } from '../src/generate/authoring-seam.js';
import { validate } from '../src/generate/validate.js';
import { parseHtml } from '../src/working-rep.js';
import type { ValidateResult } from '../src/generate/validate.js';

// ── Shared fixture: real example-brand generated artifact ───────────────────────

let sharedHtml: string;
let sharedContext: ReturnType<typeof buildContext>;

beforeAll(async () => {
  sharedContext = buildContext('example-brand', 'website');
  const p = plan(sharedContext);
  const { html } = await authorDocument(p, sharedContext, defaultScriptedAuthor());
  sharedHtml = html;
});

// ── (a) Real generated example-brand artifact — populated score + score.json ────

describe('validate — real example-brand artifact', () => {
  it('returns a RunScore with a valid systematicRatio in [0,1]', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-validate-a-'));
    try {
      const result = await validate(sharedHtml, sharedContext, { outDir });
      expect(result.score.systematicRatio).toBeGreaterThanOrEqual(0);
      expect(result.score.systematicRatio).toBeLessThanOrEqual(1);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('score.buckets has a populated total (at least 1 finding — rails actually ran)', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-validate-a2-'));
    try {
      const result = await validate(sharedHtml, sharedContext, { outDir });
      // total >= 1 ensures rails fired and produced findings — a zero total would
      // indicate the registry was empty or all operators short-circuited.
      expect(result.score.buckets.total).toBeGreaterThanOrEqual(1);
      // tier0 > 0: token-normalize / font-fidelity auto-remediated residual is
      // expected from the scripted-path artifact (measured ~4 on example-brand).
      expect(result.score.buckets.tier0).toBeGreaterThan(0);
      // All bucket fields are non-negative
      expect(result.score.buckets.tier1).toBeGreaterThanOrEqual(0);
      expect(result.score.buckets.tier2).toBeGreaterThanOrEqual(0);
      expect(result.score.buckets.warnings).toBeGreaterThanOrEqual(0);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('per-rail breakdown is non-empty (one row per operator in registry)', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-validate-a3-'));
    try {
      const result = await validate(sharedHtml, sharedContext, { outDir });
      expect(result.perRail.length).toBeGreaterThan(0);
      // Each rail entry has an operator with a name
      for (const entry of result.perRail) {
        expect(typeof entry.operator.name).toBe('string');
        expect(Array.isArray(entry.findings)).toBe(true);
      }
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('writes a score.json to outDir', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-validate-a4-'));
    try {
      await validate(sharedHtml, sharedContext, { outDir });
      expect(existsSync(join(outDir, 'score.json'))).toBe(true);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('score.json subject matches outDir', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-validate-a5-'));
    try {
      const result = await validate(sharedHtml, sharedContext, { outDir });
      expect(result.score.subject).toBe(outDir);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('scripted artifact escalates only its composition gaps (B5 soft-signal gates)', async () => {
    // Phase-3 B5 promoted four website soft signals (narrative-arc, accent-budget,
    // neighbour-collisions, render-visibility-floor) from warning → escalated. The
    // scripted author is a smoke-test, not on-brand design — it leaves a real
    // composition gap (a CTA → feature-grid neighbour collision), so the artifact
    // now legitimately carries B5 escalations. Token-fidelity is still clean
    // (var()-only): no token/contrast/fidelity rail escalates.
    //
    // Fix B note: the hero-family cap + surface-rhythm guarantee re-route the
    // scripted page off its old all-hero/all-base shape; the new variant mix puts
    // a feature-bento {avoidAdjacent:stats} next to the metrics/stats band, which
    // the composition-LIMITS rail correctly escalates. That is another legitimate
    // composition-discipline gap (same family as the neighbour-collision gate),
    // so it is allowlisted here — it is NOT a token/contrast/fidelity leak.
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-validate-a6-'));
    try {
      const result = await validate(sharedHtml, sharedContext, { outDir });
      const escalated = result.perRail.flatMap((r) =>
        r.findings.filter((f) => f.outcome === 'escalated'),
      );
      // Every escalation is a composition-discipline gate (B5 soft signals + the
      // composition-limits/surface-rhythm rails) — no token / contrast /
      // brand-fidelity escalation leaked from the scripted var()-only path.
      const B5_PREFIXES = [
        'narrative-arc-presence:',
        'accent-saturation-budget:over:',
        'archetype-neighbour-collisions:collide:',
        'render-visibility-floor:',
        'website-composition-limits:',
        'website-surface-rhythm:',
      ];
      expect(escalated.length).toBeGreaterThan(0);
      for (const f of escalated) {
        expect(B5_PREFIXES.some((p) => f.id.startsWith(p))).toBe(true);
      }
      // one frozen overlay per rail that escalated
      const railsWithEscalations = new Set(
        result.perRail
          .filter((r) => r.findings.some((f) => f.outcome === 'escalated'))
          .map((r) => r.operator.name),
      );
      expect(result.frozen).toHaveLength(railsWithEscalations.size);

      // the overlays' findingIds cover exactly the escalated findings, no more/less
      const frozenIds = result.frozen.flatMap((o) => o.findingIds).sort();
      expect(frozenIds).toEqual(escalated.map((f) => f.id).sort());
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});

// ── (a-D) Fix D: governance version stamped into manifest.json + score.json ───

describe('validate — Fix D governance version recording', () => {
  it('writes manifest.json carrying the website marker, and score.json matches', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-validate-d-'));
    try {
      const result = await validate(sharedHtml, sharedContext, { outDir });

      // manifest.json present + carries the website v3 marker
      const manifestPath = join(outDir, 'manifest.json');
      expect(existsSync(manifestPath)).toBe(true);
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      expect(manifest.governanceVersion).toMatch(/^v3 — EDITORIAL RESTRAINT/);
      expect(manifest.client).toBe('example-brand');
      expect(manifest.track).toBe('website');
      // repo-relative provenance path (no drive letter / leading slash)
      expect(manifest.governanceCssPath).not.toMatch(/^([A-Za-z]:|\/)/);
      expect(manifest.governanceCssPath.replace(/\\/g, '/')).toMatch(
        /website\/colors_and_type\.css$/,
      );
      expect(Array.isArray(manifest.warnings)).toBe(true);

      // score carries the same version + shares the timestamp with the manifest
      expect(result.score.governanceVersion).toBe(manifest.governanceVersion);
      expect(result.score.generatedAt).toBe(manifest.generatedAt);

      // score.json on disk also carries it
      const score = JSON.parse(readFileSync(join(outDir, 'score.json'), 'utf8'));
      expect(score.governanceVersion).toBe(manifest.governanceVersion);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});

// ── (b) Non-vacuous proof: deliberate violation → escalated + frozen ──────────
//
// Inject two position:sticky elements on the same edge (top) into otherwise
// valid markup. sticky-stack produces outcome:'escalated' from inline style
// attributes — no sections model needed, fires from html+context alone.
//
// Uses a SEPARATE temp outDir to avoid writing to the real example-brand working dir.

describe('validate — non-vacuous: deliberate sticky-stack violation', () => {
  let violationHtml: string;

  beforeAll(async () => {
    // Build a minimal valid document using the real example-brand tokens,
    // then inject two sticky-top elements into the body.
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());

    // Inject two position:sticky;top:0 divs as real elements at the head of the website
    // body. Post-pivot the website output is self-contained and #root-rooted (no <main>
    // shell), so anchor on the unique <div id="root"> open tag — the divs land inside the
    // mounted markup. These fire sticky-stack with outcome:'escalated' and get frozen to
    // overlay/.
    violationHtml = html.replace(
      '<div id="root">',
      '<div id="root">' +
        '<div id="sticky-nav" style="position:sticky;top:0">Nav</div>' +
        '<div id="sticky-bar" style="position:sticky;top:0">Bar</div>',
    );
  });

  it('detect sticky-stack violation in the injected html', () => {
    // Sanity: confirm the sticky elements are present and parseable
    expect(() => parseHtml(violationHtml)).not.toThrow();
    expect(violationHtml).toContain('position:sticky');
  });

  it('validate produces at least one escalated finding from sticky-stack', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-validate-b-'));
    try {
      const result = await validate(violationHtml, sharedContext, { outDir });
      const stickyEscalated = result.perRail
        .filter((r) => r.operator.name === 'sticky-stack')
        .flatMap((r) => r.findings.filter((f) => f.outcome === 'escalated'));
      expect(stickyEscalated.length).toBeGreaterThan(0);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('validate freezes escalated findings to overlay/', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-validate-b2-'));
    try {
      const result = await validate(violationHtml, sharedContext, { outDir });
      // frozen[] is non-empty — escalated findings were written to overlay/
      expect(result.frozen.length).toBeGreaterThan(0);
      // The overlay directory was created
      const overlayDir = join(outDir, 'overlay');
      expect(existsSync(overlayDir)).toBe(true);
      // At least one .json file lives there
      const files = readdirSync(overlayDir).filter((f) => f.endsWith('.json'));
      expect(files.length).toBeGreaterThan(0);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('W29: a tier-1 (sticky-stack) escalation lands in qualityConcerns, NOT tier2', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-validate-b3-'));
    try {
      const result = await validate(violationHtml, sharedContext, { outDir });
      // sticky-stack is a TIER-1 rail. Post-W29 its escalation is an expected
      // architectural rail flagging a quality concern — it is NOT a bespoke
      // tier-2 architectural defect. (Freeze to overlay/ still happens above.)
      expect(result.score.buckets.qualityConcerns).toBeGreaterThan(0);
      expect(result.score.buckets.tier2).toBe(0);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('W29: a tier-1 escalation does NOT lower architectural purity (ratio stays 1.0)', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-validate-b4-'));
    try {
      const result = await validate(violationHtml, sharedContext, { outDir });
      // No TRUE architectural defect (no tier-2 escalation) ⇒ purity is 1.0,
      // even though a valid tier-1 rail escalated. The concern is surfaced in
      // qualityConcerns, not by penalising the systematic ratio. This is the
      // exact inversion W28 identified and W29 corrects.
      expect(result.score.buckets.tier2).toBe(0);
      expect(result.score.systematicRatio).toBe(1);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});

// ── (c) Determinism: same html → same score (excluding generatedAt) ───────────

describe('validate — determinism', () => {
  it('two calls with the same html produce identical buckets + systematicRatio', async () => {
    const outDir1 = mkdtempSync(join(tmpdir(), 'offscript-validate-c1-'));
    const outDir2 = mkdtempSync(join(tmpdir(), 'offscript-validate-c2-'));
    try {
      const [r1, r2] = await Promise.all([
        validate(sharedHtml, sharedContext, { outDir: outDir1 }),
        validate(sharedHtml, sharedContext, { outDir: outDir2 }),
      ]);
      // Exclude generatedAt (timestamp) and subject (path) from comparison
      const stableScore = (r: ValidateResult) => ({
        buckets: r.score.buckets,
        systematicRatio: r.score.systematicRatio,
        railBreakdown: r.score.railBreakdown,
      });
      expect(stableScore(r1)).toEqual(stableScore(r2));
    } finally {
      rmSync(outDir1, { recursive: true, force: true });
      rmSync(outDir2, { recursive: true, force: true });
    }
  });

  it('same html produces the same per-rail finding count for each operator', async () => {
    const outDir1 = mkdtempSync(join(tmpdir(), 'offscript-validate-c3-'));
    const outDir2 = mkdtempSync(join(tmpdir(), 'offscript-validate-c4-'));
    try {
      const [r1, r2] = await Promise.all([
        validate(sharedHtml, sharedContext, { outDir: outDir1 }),
        validate(sharedHtml, sharedContext, { outDir: outDir2 }),
      ]);
      expect(r1.perRail.length).toBe(r2.perRail.length);
      for (let i = 0; i < r1.perRail.length; i++) {
        expect(r1.perRail[i].operator.name).toBe(r2.perRail[i].operator.name);
        expect(r1.perRail[i].findings.length).toBe(r2.perRail[i].findings.length);
      }
    } finally {
      rmSync(outDir1, { recursive: true, force: true });
      rmSync(outDir2, { recursive: true, force: true });
    }
  });
});

// ── W50 Track 4: geometry-unvalidated escalates when geometry was REQUIRED ───────
// A production score must never imply "geometry verified" when no geometry
// verification happened. When the operator asked for geometry (OFFSCRIPT_PLAYWRIGHT=1)
// but render rails could not run, that is an ESCALATION (production gate). When the
// operator did not ask (flag unset — dev/test default), it stays a WARNING so the
// default no-Playwright flow is byte-identical.
import { geometryUnvalidatedFinding } from '../src/generate/validate.js';

describe('W50 Track 4 — geometry-unvalidated gate', () => {
  it('ESCALATES when geometry was required but could not be validated', () => {
    const f = geometryUnvalidatedFinding(true);
    expect(f.outcome).toBe('escalated');
    expect(f.id).toBe('geometry-unvalidated:render-skipped');
  });

  it('stays a WARNING when geometry was not required (deliberate skip)', () => {
    const f = geometryUnvalidatedFinding(false);
    expect(f.outcome).toBe('warning');
  });
});
