import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir, trackDir } from '../src/paths.js';
import { collectProjectRows, parseProjectsArgs } from '../scripts/projects.js';

// Throwaway client so we can lay down real score.json files and enumerate them
// without touching any actual project. Removed after each test.
const CLIENT = '__projects_test_client__';

function writeScore(dir: string, ratio: number, total: number): void {
  mkdirSync(dir, { recursive: true });
  const score = {
    generatedAt: '2026-06-02T00:00:00.000Z',
    subject: dir,
    buckets: { tier0: 1, tier1: 1, tier2: 0, warnings: 0, total },
    systematicRatio: ratio,
    railBreakdown: [],
  };
  writeFileSync(join(dir, 'score.json'), JSON.stringify(score), 'utf8');
}

afterEach(() => {
  rmSync(projectDir(CLIENT), { recursive: true, force: true });
});

describe('collectProjectRows', () => {
  it('finds website (track-level) and collateral (per-artifact) scores', () => {
    writeScore(trackDir(CLIENT, 'website'), 0.9, 10);
    writeScore(join(trackDir(CLIENT, 'collateral'), 'sellsheet'), 0.8, 5);

    const rows = collectProjectRows({ client: CLIENT });
    expect(rows).toHaveLength(2);

    const web = rows.find((r) => r.track === 'website');
    const col = rows.find((r) => r.track === 'collateral');
    expect(web?.artifact).toBeNull();
    expect(web?.score?.systematicRatio).toBe(0.9);
    expect(col?.artifact).toBe('sellsheet');
    expect(col?.score?.buckets.total).toBe(5);
  });

  it('filters by track', () => {
    writeScore(trackDir(CLIENT, 'website'), 0.9, 10);
    writeScore(join(trackDir(CLIENT, 'collateral'), 'sellsheet'), 0.8, 5);

    const rows = collectProjectRows({ client: CLIENT, track: 'website' });
    expect(rows).toHaveLength(1);
    expect(rows[0].track).toBe('website');
  });

  it('returns nothing for a client with no scores', () => {
    expect(collectProjectRows({ client: CLIENT })).toEqual([]);
  });
});

describe('parseProjectsArgs', () => {
  it('captures the client when no --track is given (status <client>)', () => {
    // Regression: a -1 indexOf for an absent --track made ti+1 === 0, which
    // dropped the client at index 0 and degraded `status <client>` into `list`.
    expect(parseProjectsArgs(['example-brand'])).toEqual({
      client: 'example-brand',
      track: undefined,
      json: false,
    });
  });

  it('captures client + track and skips the track value', () => {
    expect(parseProjectsArgs(['acme', '--track', 'website'])).toEqual({
      client: 'acme',
      track: 'website',
      json: false,
    });
  });

  it('treats a bare invocation as list mode (no client)', () => {
    expect(parseProjectsArgs([])).toEqual({ client: undefined, track: undefined, json: false });
    expect(parseProjectsArgs(['--json'])).toEqual({
      client: undefined,
      track: undefined,
      json: true,
    });
  });

  it('captures client with --json and no track', () => {
    expect(parseProjectsArgs(['example-brand', '--json'])).toEqual({
      client: 'example-brand',
      track: undefined,
      json: true,
    });
  });

  it('degrades cleanly when --track is the last token with no value', () => {
    expect(parseProjectsArgs(['acme', '--track'])).toEqual({
      client: 'acme',
      track: undefined,
      json: false,
    });
  });
});
