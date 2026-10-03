/**
 * E2 — execution provenance survives into the evaluation output.
 *
 * The run knows which author contract produced an artifact (scripted double vs
 * in-session subagent); that identity was lost before reaching score.json. E2
 * carries it through the SAME passthrough mechanism Fix D uses for governanceVersion:
 * an optional `authorMode` on the RunScore, never computed from findings, never in
 * ratio math. This pins the pure passthrough; the end-to-end survival is proven by
 * the live dry-generate.
 */
import { describe, it, expect } from 'vitest';
import { scoreFindingsByRail } from '../src/score.js';

describe('E2 — scoreFindingsByRail preserves authorMode provenance', () => {
  it('stamps authorMode into the RunScore when supplied', () => {
    const s = scoreFindingsByRail({ subject: 'x', applied: [], perRail: [], authorMode: 'scripted' });
    expect(s.authorMode).toBe('scripted');
  });

  it('omits the authorMode key entirely when not supplied (back-compat)', () => {
    const s = scoreFindingsByRail({ subject: 'x', applied: [], perRail: [] });
    expect('authorMode' in s).toBe(false);
  });

  it('authorMode is observability only — never affects ratio or buckets', () => {
    const withMode = scoreFindingsByRail({ subject: 'x', applied: [], perRail: [], authorMode: 'subagent' });
    const without = scoreFindingsByRail({ subject: 'x', applied: [], perRail: [] });
    expect(withMode.systematicRatio).toBe(without.systematicRatio);
    expect(withMode.buckets).toEqual(without.buckets);
  });
});
