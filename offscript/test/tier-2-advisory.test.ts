import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Finding } from '../src/operator.js';
import type { Frozen } from '../src/overlay.js';
import type { ComposePaths } from '../src/instruction.js';
import {
  runTier2AdvisoryPass,
  readProposals,
  type AdvisoryDispatcher,
  type AdvisoryRequest,
  type AdvisoryProposalDraft,
  type AdvisoryRunContext,
} from '../src/tier-2-advisory.js';

const PATHS: ComposePaths = {
  reference: '/kit/reference.html',
  index: '/kit/index.html',
  tokens: '/kit/tokens.css',
};

/** Records calls per findingId; returns a deterministic draft. */
class FakeDispatcher implements AdvisoryDispatcher {
  calls: AdvisoryRequest[] = [];
  async propose(request: AdvisoryRequest): Promise<AdvisoryProposalDraft> {
    this.calls.push(request);
    return {
      proposedEdit: { find: `find-${request.finding.id}`, replace: `var(--fixed-${request.finding.id})` },
      rationale: `corrects ${request.finding.id}`,
      confidence: 'medium',
    };
  }
  countFor(findingId: string): number {
    return this.calls.filter((c) => c.finding.id === findingId).length;
  }
}

const escalated = (id: string): Finding => ({ id, description: `bad ${id}`, outcome: 'escalated' });
const warning = (id: string): Finding => ({ id, description: `warn ${id}`, outcome: 'warning' });

const frozen = (id: string, pass: string, findingIds: string[]): Frozen => ({
  id,
  pass,
  findingIds,
  decidedAt: '2026-05-29T00:00:00.000Z',
  decidedBy: 'offscript-harden:v1',
});

let dir: string;
let dispatcher: FakeDispatcher;

const ctx = (overrides: Partial<AdvisoryRunContext> = {}): AdvisoryRunContext => ({
  brand: 'example-brand',
  outputDir: dir,
  html: '<!doctype html><html><body><p style="color:#abc">x</p></body></html>',
  dispatcher,
  proposedAt: '2026-05-29T12:00:00.000Z',
  composePaths: PATHS,
  ...overrides,
});

const proposalsPath = () => path.join(dir, 'tier-2-proposals.json');

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'offscript-advisory-'));
  dispatcher = new FakeDispatcher();
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('runTier2AdvisoryPass', () => {
  it('drafts a pending proposal for each escalated finding this run', async () => {
    const perRail = [{ operator: { name: 'layout-alignment' }, findings: [escalated('a'), escalated('b')] }];
    const proposals = await runTier2AdvisoryPass(perRail, [], ctx());
    expect(proposals).toHaveLength(2);
    expect(proposals.map((p) => p.findingId)).toEqual(['a', 'b']); // sorted
    for (const p of proposals) {
      expect(p.pass).toBe('tier-2-advisory');
      expect(p.status).toBe('pending');
      expect(p.proposedAt).toBe('2026-05-29T12:00:00.000Z');
      expect(p.confidence).toBe('medium');
      expect(p.proposedEdit.replace).toContain('var(--fixed-');
    }
  });

  it('ignores non-escalated findings (warnings / auto-remediated)', async () => {
    const perRail = [{ operator: { name: 'motion-budget' }, findings: [warning('w1'), escalated('e1')] }];
    const proposals = await runTier2AdvisoryPass(perRail, [], ctx());
    expect(proposals.map((p) => p.findingId)).toEqual(['e1']);
  });

  it('drafts proposals for frozen-entry findings, attaching frozenId', async () => {
    const frozenEntries = [frozen('layout-alignment:abc123', 'layout-alignment', ['f1', 'f2'])];
    const proposals = await runTier2AdvisoryPass([], frozenEntries, ctx());
    expect(proposals.map((p) => p.findingId)).toEqual(['f1', 'f2']);
    expect(proposals.every((p) => p.frozenId === 'layout-alignment:abc123')).toBe(true);
    // the synthesised finding description reaches the dispatcher
    expect(dispatcher.calls.find((c) => c.finding.id === 'f1')?.finding.description).toContain(
      'frozen Tier-2 region',
    );
  });

  it('dedups a finding that is both escalated this run and frozen → one proposal with frozenId', async () => {
    const perRail = [{ operator: { name: 'layout-alignment' }, findings: [escalated('dup')] }];
    const frozenEntries = [frozen('layout-alignment:xyz', 'layout-alignment', ['dup'])];
    const proposals = await runTier2AdvisoryPass(perRail, frozenEntries, ctx());
    expect(proposals).toHaveLength(1);
    expect(proposals[0].findingId).toBe('dup');
    expect(proposals[0].frozenId).toBe('layout-alignment:xyz');
    expect(dispatcher.countFor('dup')).toBe(1);
  });

  it('composes an instruction that reuses the standing brief + appends the advisory override', async () => {
    const perRail = [{ operator: { name: 'contrast' }, findings: [escalated('c1')] }];
    await runTier2AdvisoryPass(perRail, [], ctx());
    const instruction = dispatcher.calls[0].instruction;
    expect(instruction).toContain('You are the Offscript tier-2-advisory actuator for the example-brand website');
    expect(instruction).toContain('ADVISORY MODE (override)');
    expect(instruction).toContain('You must NOT');
  });

  it('writes tier-2-proposals.json with the proposals, stable-sorted', async () => {
    const perRail = [{ operator: { name: 'r' }, findings: [escalated('z'), escalated('a')] }];
    await runTier2AdvisoryPass(perRail, [], ctx());
    expect(fs.existsSync(proposalsPath())).toBe(true);
    const onDisk = readProposals(proposalsPath());
    expect(onDisk.map((p) => p.findingId)).toEqual(['a', 'z']);
  });

  it('is idempotent: a second identical run leaves the file byte-identical', async () => {
    const perRail = [{ operator: { name: 'r' }, findings: [escalated('a'), escalated('b')] }];
    await runTier2AdvisoryPass(perRail, [], ctx());
    const first = fs.readFileSync(proposalsPath(), 'utf8');
    await runTier2AdvisoryPass(perRail, [], ctx({ proposedAt: '2099-01-01T00:00:00.000Z' }));
    const second = fs.readFileSync(proposalsPath(), 'utf8');
    expect(second).toBe(first); // proposedAt preserved → no churn despite a fresh stamp
  });

  it('preserves a human decision and does NOT re-dispatch it', async () => {
    const perRail = [{ operator: { name: 'r' }, findings: [escalated('keep'), escalated('redo')] }];
    await runTier2AdvisoryPass(perRail, [], ctx());

    // Human accepts 'keep' out-of-band.
    const onDisk = readProposals(proposalsPath());
    const accepted = onDisk.map((p) =>
      p.findingId === 'keep'
        ? { ...p, status: 'accepted' as const, decidedAt: '2026-05-29T13:00:00.000Z' }
        : p,
    );
    fs.writeFileSync(proposalsPath(), JSON.stringify({ proposals: accepted }, null, 2));

    const fresh = new FakeDispatcher();
    dispatcher = fresh;
    const proposals = await runTier2AdvisoryPass(perRail, [], ctx());

    const kept = proposals.find((p) => p.findingId === 'keep')!;
    expect(kept.status).toBe('accepted');
    expect(kept.decidedAt).toBe('2026-05-29T13:00:00.000Z');
    expect(fresh.countFor('keep')).toBe(0); // decided → never re-dispatched
    expect(fresh.countFor('redo')).toBe(1); // still pending → refreshed
  });

  it('applies no edits — the artifact html is never written anywhere', async () => {
    const perRail = [{ operator: { name: 'r' }, findings: [escalated('a')] }];
    await runTier2AdvisoryPass(perRail, [], ctx());
    // only the proposals file exists in the output dir; no index.html, no html write
    const files = fs.readdirSync(dir);
    expect(files).toEqual(['tier-2-proposals.json']);
  });
});
