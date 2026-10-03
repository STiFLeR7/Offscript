/**
 * W3 Stage-0 — Director Creation Seam (the missing PRODUCER of the Intent Brief).
 *
 * The frozen package (DIRECTOR-CREATION-SEAM-EXECUTION-PACKAGE.md): a NEW Stage-0 producer
 * emits an IntentBrief (or null); the ORCHESTRATOR persists it via S1's writeIntentBrief
 * ONLY when absent; buildContext replays it; plan() consumes it. Creation, persistence, and
 * replay are three distinct ownerships. The default scripted director is inert (null → no
 * artifact), so real runs stay byte-identical until a real createSubagentDirector is injected.
 *
 * These tests cover the pure seam, and — through a local helper that mirrors the
 * scripts/generate.ts Stage-0 edge EXACTLY (create-only-when-absent → persist via S1) — the
 * creation / persistence / replay / inert-default / liveness criteria. No live LLM: the
 * subjective creation is the injected seam, exercised here only via deterministic doubles.
 * No LLM-output / HTML / subjective assertions.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';

import { intentBriefPath, projectDir, type Track } from '../../src/paths.js';
import {
  type IntentBrief,
  writeIntentBrief,
  loadIntentBriefIfPresent,
  serializeIntentBrief,
} from '../../src/generate/intent-brief.js';
import {
  type Director,
  type DirectorInput,
  scriptedDirector,
  defaultScriptedDirector,
  createSubagentDirector,
} from '../../src/generate/intent-director.js';
import { buildContext } from '../../src/generate/context.js';
import { plan } from '../../src/generate/plan.js';
import { makeBriefFixture } from './_brief-fixture.js';

const FIXTURE_CLIENT = '__intent_director_test__';
const { scaffoldClient, writeBrief } = makeBriefFixture(FIXTURE_CLIENT);

afterEach(() => {
  rmSync(projectDir(FIXTURE_CLIENT), { recursive: true, force: true });
});

/** A ready IntentBrief (five floor categories non-empty) with a chosen HOW register. */
function readyBrief(how: string): IntentBrief {
  return {
    oneThing: 'A wary buyer leaves believing migration is low-risk.',
    what: 'A one-pager.',
    why: 'Reader is mid-evaluation; the change sought is one demo booking.',
    how,
    constraints: 'House brand.',
    antiPatterns: 'No hype.',
  };
}

/**
 * Mirrors the scripts/generate.ts Stage-0 orchestration edge EXACTLY:
 *   create-only-when-absent guard → director.create() → persist via S1 (never the director).
 * Kept in-test (the edge is 4 lines in a top-level script); the full suite is the integration.
 */
async function stage0(
  director: Director,
  track: Track = 'collateral',
  client: string = FIXTURE_CLIENT,
): Promise<void> {
  const ibPath = intentBriefPath(client, track);
  if (!existsSync(ibPath)) {
    const created = await director.create({ client, track });
    if (created !== null) writeIntentBrief(ibPath, created);
  }
}

describe('W3 Stage-0 Director seam — pure contract', () => {
  it('defaultScriptedDirector is inert: create() resolves null (no artifact)', async () => {
    const out = await defaultScriptedDirector().create({ client: 'x', track: 'collateral' });
    expect(out).toBeNull();
  });

  it('scriptedDirector returns a fixed IntentBrief object verbatim', async () => {
    const brief = readyBrief('calm');
    const out = await scriptedDirector(brief).create({ client: 'x', track: 'collateral' });
    expect(out).toEqual(brief);
  });

  it('scriptedDirector accepts a function of the input', async () => {
    const seen: DirectorInput[] = [];
    const dir = scriptedDirector((input) => {
      seen.push(input);
      return readyBrief(`how-for-${input.client}`);
    });
    const out = await dir.create({ client: 'acme', track: 'website' });
    expect(seen).toEqual([{ client: 'acme', track: 'website' }]);
    expect(out?.how).toBe('how-for-acme');
  });

  it('createSubagentDirector delegates to the injected dispatch', async () => {
    const brief = readyBrief('bold');
    const dir = createSubagentDirector({ dispatch: async () => brief });
    expect(await dir.create({ client: 'x', track: 'collateral' })).toEqual(brief);
  });
});

describe('W3 Stage-0 — creation / persistence / replay (A, B, C)', () => {
  it('AC-A + AC-B: a non-null director creates intent-brief.md persisted via S1 byte-format', async () => {
    scaffoldClient();
    const brief = readyBrief('calm, unhurried, spare');
    await stage0(scriptedDirector(brief));

    const ibPath = intentBriefPath(FIXTURE_CLIENT, 'collateral');
    expect(existsSync(ibPath)).toBe(true); // A — creation
    expect(readFileSync(ibPath, 'utf8')).toBe(serializeIntentBrief(brief)); // B — S1 owns the format
  });

  it('AC-C: the persisted artifact replays through S1 with the SAME six categories', async () => {
    scaffoldClient();
    const brief = readyBrief('calm, unhurried, spare');
    await stage0(scriptedDirector(brief));

    const replayed = loadIntentBriefIfPresent(intentBriefPath(FIXTURE_CLIENT, 'collateral'));
    expect(replayed).toEqual(brief);
  });

  it('AC-C: create-only-when-absent — a second director never overwrites an existing brief', async () => {
    scaffoldClient();
    const first = readyBrief('calm, unhurried, spare');
    await stage0(scriptedDirector(first));
    const ibPath = intentBriefPath(FIXTURE_CLIENT, 'collateral');
    const bytesAfterFirst = readFileSync(ibPath, 'utf8');

    // A different director on a present brief must be a no-op (guard short-circuits).
    await stage0(scriptedDirector(readyBrief('bold, confident, dynamic')));
    expect(readFileSync(ibPath, 'utf8')).toBe(bytesAfterFirst);
  });
});

describe('W3 Stage-0 — inert default (E)', () => {
  it('AC-E: the default director writes no artifact and leaves context.intentBrief undefined', async () => {
    scaffoldClient();
    writeBrief(['Overview', 'Approach'], 'collateral');

    await stage0(defaultScriptedDirector());

    expect(existsSync(intentBriefPath(FIXTURE_CLIENT, 'collateral'))).toBe(false);
    expect(buildContext(FIXTURE_CLIENT, 'collateral').intentBrief).toBeUndefined();
  });
});

describe('W3 Stage-0 — liveness differential (D)', () => {
  it('AC-D: different director HOW → different persisted brief AND different composition', async () => {
    // Run 1 — calm.
    scaffoldClient();
    writeBrief(['Overview', 'Approach', 'Method', 'Wrap up'], 'collateral');
    await stage0(scriptedDirector(readyBrief('calm, unhurried, spare')));
    const calmFile = readFileSync(intentBriefPath(FIXTURE_CLIENT, 'collateral'), 'utf8');
    const calmComps = plan(buildContext(FIXTURE_CLIENT, 'collateral')).items.map((i) => i.composition);

    // Reset to a clean client (create-only-when-absent would otherwise pin run 1's brief).
    rmSync(projectDir(FIXTURE_CLIENT), { recursive: true, force: true });

    // Run 2 — bold.
    scaffoldClient();
    writeBrief(['Overview', 'Approach', 'Method', 'Wrap up'], 'collateral');
    await stage0(scriptedDirector(readyBrief('bold, confident, dynamic')));
    const boldFile = readFileSync(intentBriefPath(FIXTURE_CLIENT, 'collateral'), 'utf8');
    const boldComps = plan(buildContext(FIXTURE_CLIENT, 'collateral')).items.map((i) => i.composition);

    expect(calmFile).not.toEqual(boldFile); // creation differs at the artifact
    expect(calmComps).not.toEqual(boldComps); // …and propagates to a planner decision
  });
});
