import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  scoreFindingsByRail,
  writeScore,
  formatScoreReport,
} from '../src/score.js';
import type { Finding, Operator, Tier } from '../src/operator.js';
import type { OperatorRun } from '../src/engine.js';

function mkOp(name: string, tier: Tier): Operator {
  return {
    name,
    tier,
    detect: () => [],
    apply: () => [],
  };
}

function mkFinding(id: string, outcome: Finding['outcome']): Finding {
  return { id, description: `f-${id}`, outcome };
}

function mkRun(operator: string, findings: Finding[]): OperatorRun {
  return { operator, findings, verified: true };
}

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'offscript-score-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('scoreFindingsByRail — bucketing', () => {
  // W29 correction: an `escalated` finding is bucketed by the EMITTING RAIL'S
  // declared tier — a tier-2 rail escalating is a TRUE architectural defect
  // (tier2, bespoke freeze); a tier-0/tier-1 rail escalating is an "expected
  // architectural rail" flagging a QUALITY CONCERN it could not auto-fix
  // (qualityConcerns / Tier-3, excluded from the ratio). Warnings → warnings.
  it('routes auto-remediated by rail tier; tier-2 escalation → tier2, tier-0/1 escalation → qualityConcerns; warning → warnings', () => {
    const score = scoreFindingsByRail({
      subject: 'kit',
      applied: [],
      perRail: [
        {
          operator: mkOp('lang', 0),
          findings: [mkFinding('a', 'auto-remediated')],
        },
        {
          operator: mkOp('semantics', 1),
          findings: [mkFinding('b', 'auto-remediated'), mkFinding('c', 'auto-remediated')],
        },
        {
          // tier-1 rail escalating (e.g. archetype-neighbour-collisions) — a
          // quality concern, NOT a bespoke architectural defect.
          operator: mkOp('cta-choreography', 1),
          findings: [mkFinding('d', 'escalated')],
        },
        {
          // genuinely tier-2 rail escalating — a true architectural defect.
          operator: mkOp('layout-alignment', 2),
          findings: [mkFinding('f', 'escalated')],
        },
        {
          operator: mkOp('brand', 0),
          findings: [mkFinding('e', 'warning')],
        },
      ],
    });
    expect(score.buckets.tier0).toBe(1);
    expect(score.buckets.tier1).toBe(2);
    expect(score.buckets.tier2).toBe(1); // ONLY the tier-2 rail's escalation
    expect(score.buckets.qualityConcerns).toBe(1); // the tier-1 rail's escalation
    expect(score.buckets.warnings).toBe(1);
    expect(score.buckets.total).toBe(6); // no finding lost
  });

  it('systematicRatio = (tier0+tier1)/(tier0+tier1+tier2), 4dp — only TRUE (tier-2) defects lower it', () => {
    const score = scoreFindingsByRail({
      subject: 's',
      applied: [],
      perRail: [
        { operator: mkOp('a', 0), findings: [mkFinding('1', 'auto-remediated')] },
        { operator: mkOp('b', 1), findings: [mkFinding('2', 'auto-remediated')] },
        {
          // tier-2 rail (true architectural defect) escalating twice.
          operator: mkOp('c', 2),
          findings: [mkFinding('3', 'escalated'), mkFinding('4', 'escalated')],
        },
      ],
    });
    // (1+1)/(1+1+2) = 0.5
    expect(score.systematicRatio).toBe(0.5);
    expect(score.buckets.tier2).toBe(2);
    expect(score.buckets.qualityConcerns).toBe(0);
  });

  it('systematicRatio EXCLUDES warnings from the denominator (advisory notes never penalise a clean page)', () => {
    const score = scoreFindingsByRail({
      subject: 's',
      applied: [],
      perRail: [
        { operator: mkOp('a', 0), findings: [mkFinding('1', 'auto-remediated')] },
        { operator: mkOp('b', 1), findings: [mkFinding('2', 'auto-remediated')] },
        {
          operator: mkOp('c', 0),
          findings: [
            mkFinding('3', 'warning'),
            mkFinding('4', 'warning'),
            mkFinding('5', 'warning'),
            mkFinding('6', 'warning'),
          ],
        },
      ],
    });
    // 2 systematic (tier0+tier1), 0 bespoke (tier2), 4 advisory warnings.
    // The ratio is systematic-vs-bespoke ONLY → 2 / (2 + 0) = 1.0; warnings stay
    // out of the denominator (they are QA notes, per the bucket label). `total`
    // still counts everything for the display line.
    expect(score.buckets.warnings).toBe(4);
    expect(score.buckets.total).toBe(6);
    expect(score.systematicRatio).toBe(1);
  });

  it('systematicRatio = 0 when total = 0', () => {
    const score = scoreFindingsByRail({
      subject: 's',
      applied: [],
      perRail: [{ operator: mkOp('a', 0), findings: [] }],
    });
    expect(score.buckets.total).toBe(0);
    expect(score.systematicRatio).toBe(0);
  });

  it('railBreakdown emits one entry per rail in input order with correct tier & counts', () => {
    const score = scoreFindingsByRail({
      subject: 's',
      applied: [],
      perRail: [
        {
          operator: mkOp('alpha', 0),
          findings: [
            mkFinding('1', 'auto-remediated'),
            mkFinding('2', 'auto-remediated'),
            mkFinding('3', 'warning'),
          ],
        },
        {
          operator: mkOp('beta', 1),
          findings: [mkFinding('4', 'escalated')],
        },
        {
          operator: mkOp('gamma', 1),
          findings: [],
        },
      ],
    });
    expect(score.railBreakdown.map((r) => r.name)).toEqual(['alpha', 'beta', 'gamma']);
    expect(score.railBreakdown[0]).toEqual({
      name: 'alpha',
      tier: 0,
      counts: { 'auto-remediated': 2, escalated: 0, warning: 1 },
    });
    expect(score.railBreakdown[1]).toEqual({
      name: 'beta',
      tier: 1,
      counts: { 'auto-remediated': 0, escalated: 1, warning: 0 },
    });
    expect(score.railBreakdown[2]).toEqual({
      name: 'gamma',
      tier: 1,
      counts: { 'auto-remediated': 0, escalated: 0, warning: 0 },
    });
  });
});

describe('scoreFindingsByRail — work-done from applied', () => {
  it('counts auto-remediated work from the mechanical applied array into the tier bucket', () => {
    // tier-0 op with N auto-remediated findings in applied contributes N to tier0.
    const tier0Op = mkOp('token-normalize', 0);
    const tier1Op = mkOp('landmark-semantics', 1);
    const applied: OperatorRun[] = [
      mkRun('token-normalize', [
        mkFinding('lit:1', 'auto-remediated'),
        mkFinding('lit:2', 'auto-remediated'),
        mkFinding('lit:3', 'auto-remediated'),
      ]),
      mkRun('landmark-semantics', [
        mkFinding('lm:1', 'auto-remediated'),
        mkFinding('lm:2', 'auto-remediated'),
      ]),
    ];
    const score = scoreFindingsByRail({
      subject: 'kit',
      applied,
      perRail: [
        { operator: tier0Op, findings: [] },
        { operator: tier1Op, findings: [] },
      ],
    });
    expect(score.buckets.tier0).toBe(3);
    expect(score.buckets.tier1).toBe(2);
    expect(score.buckets.tier2).toBe(0);
    expect(score.buckets.warnings).toBe(0);
    expect(score.buckets.total).toBe(5);
    expect(score.systematicRatio).toBe(1);
    // railBreakdown reflects work-done auto-remediated counts.
    expect(score.railBreakdown[0].counts['auto-remediated']).toBe(3);
    expect(score.railBreakdown[1].counts['auto-remediated']).toBe(2);
  });

  it('combines work-done (applied) with residual escalated/warning; tier-1 escalations are quality concerns, not defects', () => {
    // The real-CR shape: lots of mechanical work-done + a handful of escalated
    // TIER-1 judgment-rail gaps + a few warnings. Post-W29 those tier-1
    // escalations are quality concerns (Tier-3), NOT bespoke tier-2 defects, so
    // architectural purity is 1.0 — the site has no true architectural defect.
    const tier0Op = mkOp('token-normalize', 0);
    const tier1Op = mkOp('contrast', 1);
    const tier1Brand = mkOp('brand-fidelity-scan', 1);
    const applied: OperatorRun[] = [
      mkRun(
        'token-normalize',
        Array.from({ length: 472 }, (_, i) => mkFinding(`lit:${i}`, 'auto-remediated')),
      ),
    ];
    const perRail = [
      { operator: tier0Op, findings: [] as Finding[] },
      {
        operator: tier1Op,
        findings: [mkFinding('c:1', 'escalated'), mkFinding('c:2', 'escalated')],
      },
      {
        operator: tier1Brand,
        findings: [mkFinding('w:1', 'warning'), mkFinding('w:2', 'warning')],
      },
    ];
    const score = scoreFindingsByRail({ subject: 'example-brand', applied, perRail });
    expect(score.buckets.tier0).toBe(472);
    expect(score.buckets.tier1).toBe(0);
    expect(score.buckets.tier2).toBe(0); // no TRUE architectural defect
    expect(score.buckets.qualityConcerns).toBe(2); // the tier-1 escalations
    expect(score.buckets.warnings).toBe(2);
    expect(score.buckets.total).toBe(476);
    // No bespoke freeze ⇒ architectural purity is exactly 1.0.
    expect(score.systematicRatio).toBe(1);
  });

  it('ignores non-auto-remediated outcomes in applied (defensive)', () => {
    const op = mkOp('token-normalize', 0);
    const applied: OperatorRun[] = [
      mkRun('token-normalize', [
        mkFinding('a', 'auto-remediated'),
        // Defensive: applied shouldn't carry escalated/warning, but if it does, ignore.
        mkFinding('b', 'escalated'),
        mkFinding('c', 'warning'),
      ]),
    ];
    const score = scoreFindingsByRail({
      subject: 'k',
      applied,
      perRail: [{ operator: op, findings: [] }],
    });
    expect(score.buckets.tier0).toBe(1);
    expect(score.buckets.tier2).toBe(0);
    expect(score.buckets.warnings).toBe(0);
  });
});

describe('scoreFindingsByRail — W29 metric correction (escalation tiered by emitting rail)', () => {
  // Helper: reproduce a rail's residual as N findings of one outcome.
  function rail(name: string, tier: Tier, outcome: Finding['outcome'], n: number) {
    return {
      operator: mkOp(name, tier),
      findings: Array.from({ length: n }, (_, i) => mkFinding(`${name}:${i}`, outcome)),
    };
  }

  it('a tier-1 rail escalation is a quality concern (Tier-3) and does NOT reduce architectural purity', () => {
    const score = scoreFindingsByRail({
      subject: 's',
      applied: [],
      perRail: [
        rail('token-normalize', 0, 'auto-remediated', 10),
        rail('landmark-semantics', 1, 'auto-remediated', 2),
        rail('archetype-neighbour-collisions', 1, 'escalated', 3), // valid planner rail
        rail('cta-choreography', 1, 'escalated', 1), // valid realization rail
      ],
    });
    expect(score.buckets.tier2).toBe(0);
    expect(score.buckets.qualityConcerns).toBe(4);
    expect(score.systematicRatio).toBe(1); // 12 / (12 + 0)
  });

  it('a tier-2 rail escalation IS a true architectural defect and DOES reduce the ratio', () => {
    const score = scoreFindingsByRail({
      subject: 's',
      applied: [],
      perRail: [
        rail('token-normalize', 0, 'auto-remediated', 9),
        rail('layout-alignment', 2, 'escalated', 1), // genuine bespoke freeze
      ],
    });
    expect(score.buckets.tier2).toBe(1);
    expect(score.buckets.qualityConcerns).toBe(0);
    expect(score.systematicRatio).toBe(0.9); // 9 / (9 + 1)
  });

  it('qualityConcerns is counted in total (no finding is silently dropped)', () => {
    const score = scoreFindingsByRail({
      subject: 's',
      applied: [],
      perRail: [
        rail('a', 0, 'auto-remediated', 1),
        rail('archetype-neighbour-collisions', 1, 'escalated', 2),
        rail('brand-fidelity-scan', 0, 'warning', 3),
      ],
    });
    const b = score.buckets;
    expect(b.qualityConcerns).toBe(2);
    expect(b.total).toBe(b.tier0 + b.tier1 + b.tier2 + b.qualityConcerns + b.warnings);
    expect(b.total).toBe(6);
  });

  it('regression: the real apa corpus shape now scores 1.0 (was 0.7778 pre-W29) — authoring is not penalised', () => {
    // Reconstructed from projects/apa/website/score.json railBreakdown:
    // tier-0 auto-remediated=12, tier-1 auto-remediated=2, tier-1 escalations=4
    // (archetype-neighbour-collisions ×3 + cta-choreography ×1), warnings=27.
    const score = scoreFindingsByRail({
      subject: 'apa',
      applied: [],
      perRail: [
        rail('token-normalize', 0, 'auto-remediated', 12),
        rail('landmark-semantics', 1, 'auto-remediated', 2),
        rail('archetype-neighbour-collisions', 1, 'escalated', 3),
        rail('cta-choreography', 1, 'escalated', 1),
        rail('brand-fidelity-scan', 0, 'warning', 27),
      ],
    });
    // Old model would have routed the 4 tier-1 escalations to tier2 → 14/18 = 0.7778.
    expect(score.buckets.tier2).toBe(0);
    expect(score.buckets.qualityConcerns).toBe(4);
    expect(score.systematicRatio).toBe(1);
  });

  it('proves the inversion is gone: a genuinely-authored site (tier-1 escalations) is not scored below a verbatim-paste site (no escalations)', () => {
    const authored = scoreFindingsByRail({
      subject: 'authored',
      applied: [],
      perRail: [
        rail('token-normalize', 0, 'auto-remediated', 14),
        rail('landmark-semantics', 1, 'auto-remediated', 2),
        rail('archetype-neighbour-collisions', 1, 'escalated', 3),
      ],
    });
    const paste = scoreFindingsByRail({
      subject: 'paste',
      applied: [],
      perRail: [rail('token-normalize', 0, 'auto-remediated', 14)],
    });
    // Pre-W29: authored 0.8421 < paste 1.0 (inverted). Post-W29: equal purity,
    // and the authoring difference is surfaced as quality concerns, not as a
    // lower architecture score.
    expect(authored.systematicRatio).toBe(paste.systematicRatio);
    expect(authored.systematicRatio).toBe(1);
    expect(authored.buckets.qualityConcerns).toBe(3);
    expect(paste.buckets.qualityConcerns).toBe(0);
  });
});

describe('scoreFindingsByRail — governanceVersion passthrough (Fix D)', () => {
  const baseInput = {
    subject: 's',
    applied: [] as OperatorRun[],
    perRail: [
      { operator: mkOp('a', 0 as Tier), findings: [mkFinding('1', 'auto-remediated' as const)] },
      { operator: mkOp('b', 1 as Tier), findings: [mkFinding('2', 'escalated' as const)] },
    ],
  };

  it('copies governanceVersion onto the result when supplied', () => {
    const score = scoreFindingsByRail({ ...baseInput, governanceVersion: 'X' });
    expect(score.governanceVersion).toBe('X');
  });

  it('the field never perturbs ratio math (with vs without are deep-equal on ratio/buckets/breakdown)', () => {
    const withField = scoreFindingsByRail({ ...baseInput, governanceVersion: 'X' });
    const without = scoreFindingsByRail({ ...baseInput });
    expect(withField.systematicRatio).toEqual(without.systematicRatio);
    expect(withField.buckets).toEqual(without.buckets);
    expect(withField.railBreakdown).toEqual(without.railBreakdown);
  });

  it('omits governanceVersion when the field is not supplied (back-compat)', () => {
    const score = scoreFindingsByRail({ ...baseInput });
    expect(score.governanceVersion).toBeUndefined();
  });
});

describe('writeScore', () => {
  it('round-trips: read raw JSON, parse, equal', () => {
    const score = scoreFindingsByRail({
      subject: 'kit',
      applied: [],
      perRail: [
        { operator: mkOp('a', 0), findings: [mkFinding('1', 'auto-remediated')] },
        { operator: mkOp('b', 1), findings: [mkFinding('2', 'escalated')] },
      ],
    });
    const fp = path.join(tmp, 'score.json');
    writeScore(fp, score);
    const raw = fs.readFileSync(fp, 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(raw);
    expect(parsed).toEqual(score);
  });

  it('is idempotent: same content preserves mtime', async () => {
    const score = scoreFindingsByRail({
      subject: 'kit',
      applied: [],
      perRail: [{ operator: mkOp('a', 0), findings: [mkFinding('1', 'auto-remediated')] }],
    });
    const fp = path.join(tmp, 'score.json');
    writeScore(fp, score);
    const t1 = fs.statSync(fp).mtimeMs;
    // wait long enough for fs mtime granularity (10ms typical)
    await new Promise((r) => setTimeout(r, 30));
    writeScore(fp, score);
    const t2 = fs.statSync(fp).mtimeMs;
    expect(t2).toBe(t1);
  });

  it('creates parent directories as needed', () => {
    const score = scoreFindingsByRail({ subject: 's', applied: [], perRail: [] });
    const fp = path.join(tmp, 'nested', 'deeper', 'score.json');
    writeScore(fp, score);
    expect(fs.existsSync(fp)).toBe(true);
  });
});

describe('formatScoreReport', () => {
  it('contains the subject, ratio, all bucket counts, and at least one rail row', () => {
    const score = scoreFindingsByRail({
      subject: 'projects/website/example-brand',
      applied: [],
      perRail: [
        { operator: mkOp('lang-attr', 0), findings: [mkFinding('1', 'auto-remediated')] },
        // tier-2 rail escalating = true defect ⇒ ratio 0.5 in the report.
        { operator: mkOp('layout-alignment', 2), findings: [mkFinding('2', 'escalated')] },
      ],
    });
    const text = formatScoreReport(score);
    expect(text).toContain('projects/website/example-brand');
    expect(text).toContain('0.5000');
    expect(text).toContain('tier-0');
    expect(text).toContain('tier-1');
    expect(text).toContain('tier-2');
    expect(text).toContain('quality concerns');
    expect(text).toContain('warnings');
    expect(text).toContain('lang-attr');
    expect(text).toContain('layout-alignment');
  });

  it('is deterministic on repeated runs with the same input', () => {
    const score = scoreFindingsByRail({
      subject: 'kit',
      applied: [],
      perRail: [
        { operator: mkOp('a', 0), findings: [mkFinding('1', 'auto-remediated')] },
        { operator: mkOp('b', 1), findings: [mkFinding('2', 'escalated')] },
      ],
    });
    expect(formatScoreReport(score)).toBe(formatScoreReport(score));
  });
});
