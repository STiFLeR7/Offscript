/**
 * Sprint 7 — Execution Runtime: immutable Authoring Result + Author → immutable Execution Result.
 *
 * Execution owns execution (lifecycle / timeout / cancellation / retry / telemetry); authoring
 * owns authoring; providers own generation. The runtime depends ONLY on the abstract `Author`
 * seam — no Claude / Gemini / GPT logic. Execution metadata is deterministic; provider output is
 * intentionally non-deterministic, and the runtime records that boundary explicitly. Tests mock
 * the provider (no network, no real LLMs).
 */
import { describe, it, expect } from 'vitest';
import { parseAsset, type NormalizedAsset } from '../../src/knowledge/model.js';
import { makeVocabulary } from '../../src/knowledge/vocabulary.js';
import { buildDependencyGraph, buildSemanticGraph } from '../../src/knowledge/graph.js';
import { discover } from '../../src/knowledge/discovery.js';
import { compose, type CompositionRepository } from '../../src/knowledge/composition.js';
import { condition } from '../../src/knowledge/conditioning.js';
import { runAuthoring, type Author, type AuthoringResult } from '../../src/knowledge/authoring.js';
import {
  execute,
  ExecutionError,
  EXECUTION_RUNTIME_VERSION,
  type StreamSink,
  type StreamingAuthor,
  type ExecutionEvent,
} from '../../src/knowledge/execution.js';

// --- a real (synthetic) Authoring Result to execute against ---
const base = {
  schema_version: '1.0',
  kind: 'component',
  ownership: { owner: 'ds' },
  scope: { class: 'canonical', identity: 'offscript' },
  governance: { authority: 'canonical-global' },
};
function asset(loose: Record<string, unknown>): NormalizedAsset {
  const { asset, findings } = parseAsset({ ...base, ...loose }, (loose.identity as any).id);
  if (!asset) throw new Error(JSON.stringify(findings));
  return asset;
}
const heroA = asset({ identity: { id: 'canonical::hero-a', title: 'a' }, semantics: { specializes: ['concept:role:hero'] }, capabilities: { satisfies: ['serves:hero'] } });
const heroB = asset({ identity: { id: 'canonical::hero-b', title: 'b' }, semantics: { specializes: ['concept:role:hero'] }, capabilities: { satisfies: ['serves:hero'] } });
const assets = [heroA, heroB];
const vocab = makeVocabulary({ concepts: ['concept:role:hero'], obligations: ['serves:hero'], owners: ['ds'], scopeIdentities: ['offscript'] });
const repo: CompositionRepository = { assets, dependencyGraph: buildDependencyGraph(assets), semanticGraph: buildSemanticGraph(assets) };
const recordingAuthor: Author = {
  name: 'authoring-pass',
  author: (req) => ({ determinations: req.context.unresolvedPlurality.map((g) => ({ key: g.key, selected: g.members[0] })), payload: { stub: true } }),
};
async function authoringResult(): Promise<AuthoringResult> {
  const ctx = condition(compose(discover({ obligations: ['serves:hero'] }, { assets, vocabulary: vocab }), repo), repo, { requestId: 'r-1' });
  return runAuthoring(ctx, recordingAuthor);
}

// --- mock providers for the EXECUTION pass (no real models) ---
const providerOk: Author = { name: 'provider-ok', author: () => ({ determinations: [], payload: { html: '<main>x</main>' } }) };
const providerHtmlB: Author = { name: 'provider-ok', author: () => ({ determinations: [], payload: { html: '<main>DIFFERENT</main>' } }) };
function flakyProvider(failures: number): Author {
  let n = 0;
  return { name: 'provider-flaky', author: () => { if (n++ < failures) throw new Error('transient'); return { determinations: [], payload: { ok: true } }; } };
}
const providerThrows: Author = { name: 'provider-bad', author: () => { throw new Error('provider exploded'); } };
const providerHangs: Author = { name: 'provider-hang', author: () => new Promise(() => {}) };
const providerInvalid: Author = { name: 'provider-weird', author: () => 42 as never };
const providerNoPayload: Author = { name: 'provider-empty', author: () => ({ determinations: [] } as never) };

describe('execute — lifecycle + result shape', () => {
  it('produces a succeeded execution result with all declared fields', async () => {
    const r = await execute(await authoringResult(), providerOk);
    expect(r.executionIdentity).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(r.authoringIdentity).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(r.provider.name).toBe('provider-ok');
    expect(r.status).toBe('succeeded');
    expect(r.payload).toEqual({ html: '<main>x</main>' });
    expect(r.telemetry.attempts).toBe(1);
    expect(r.metadata.runtimeVersion).toBe(EXECUTION_RUNTIME_VERSION);
  });

  it('carries the authoring identity through unchanged', async () => {
    const ar = await authoringResult();
    const r = await execute(ar, providerOk);
    expect(r.authoringIdentity).toBe(ar.authoringIdentity);
  });
});

describe('execute — provider abstraction + the determinism boundary', () => {
  it('records the provider determinism boundary explicitly (provider output is non-deterministic)', async () => {
    const r = await execute(await authoringResult(), providerOk);
    expect(r.provider.deterministic).toBe(false);
  });

  it('execution metadata is deterministic: same authoring result + author → same execution identity', async () => {
    const ar = await authoringResult();
    const a = await execute(ar, providerOk);
    const b = await execute(ar, providerOk);
    expect(b.executionIdentity).toBe(a.executionIdentity);
  });

  it('non-deterministic provider payload does NOT change the execution identity (boundary held)', async () => {
    const ar = await authoringResult();
    const a = await execute(ar, providerOk);
    const b = await execute(ar, providerHtmlB); // same provider name, different payload
    expect(b.payload).not.toEqual(a.payload);
    expect(b.executionIdentity).toBe(a.executionIdentity);
  });

  it('carries the artifact payload opaque (never interprets it)', async () => {
    const weird = { name: 'provider-ok', author: () => ({ determinations: [], payload: { anything: [1, { nested: true }] } }) } as Author;
    const r = await execute(await authoringResult(), weird);
    expect(r.payload).toEqual({ anything: [1, { nested: true }] });
  });
});

describe('execute — immutability', () => {
  it('produces a deeply frozen result', async () => {
    const r = await execute(await authoringResult(), providerOk);
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.telemetry)).toBe(true);
    expect(Object.isFrozen(r.provider)).toBe(true);
    expect(() => { (r as any).status = 'x'; }).toThrow();
  });
});

describe('execute — retry policy', () => {
  it('retries a transient provider failure up to maxAttempts and then succeeds', async () => {
    const r = await execute(await authoringResult(), flakyProvider(2), { maxAttempts: 3 });
    expect(r.status).toBe('succeeded');
    expect(r.telemetry.attempts).toBe(3);
    expect(r.telemetry.attemptOutcomes.filter((o) => o.outcome === 'failure')).toHaveLength(2);
  });

  it('never retries forever — fails loud after exhausting maxAttempts', async () => {
    await expect(execute(await authoringResult(), providerThrows, { maxAttempts: 3 })).rejects.toMatchObject({
      code: 'PROVIDER_FAILURE',
    });
  });

  it('defaults to a single attempt (no retry) when no policy is given', async () => {
    const err = await execute(await authoringResult(), providerThrows).catch((e) => e);
    expect(err).toBeInstanceOf(ExecutionError);
    expect(err.telemetry.attempts).toBe(1);
  });
});

describe('execute — fail-loud validation', () => {
  it('rejects an invalid / non-immutable authoring result', async () => {
    const mutable = { ...(await authoringResult()) }; // a shallow clone is not frozen
    await expect(execute(mutable as AuthoringResult, providerOk)).rejects.toMatchObject({ code: 'INVALID_AUTHORING_RESULT' });
  });

  it('fails loud on a timeout (provider exceeds the deadline)', async () => {
    await expect(execute(await authoringResult(), providerHangs, { timeoutMs: 20 })).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('fails loud on cancellation via an already-aborted signal (and does not retry)', async () => {
    const ac = new AbortController();
    ac.abort();
    const err = await execute(await authoringResult(), providerHangs, { signal: ac.signal, maxAttempts: 3 }).catch((e) => e);
    expect(err.code).toBe('CANCELLED');
    expect(err.telemetry.attempts).toBe(1);
  });

  it('fails loud on cancellation triggered mid-flight', async () => {
    const ac = new AbortController();
    const p = execute(await authoringResult(), providerHangs, { signal: ac.signal });
    ac.abort();
    await expect(p).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('fails loud on an invalid provider response (and does not retry — deterministic)', async () => {
    const err = await execute(await authoringResult(), providerInvalid, { maxAttempts: 3 }).catch((e) => e);
    expect(err.code).toBe('INVALID_RESPONSE');
    expect(err.telemetry.attempts).toBe(1);
  });

  it('fails loud on a malformed payload', async () => {
    await expect(execute(await authoringResult(), providerNoPayload)).rejects.toMatchObject({ code: 'MALFORMED_PAYLOAD' });
  });
});

describe('execute — telemetry', () => {
  it('emits telemetry events through the hook', async () => {
    const events: ExecutionEvent[] = [];
    await execute(await authoringResult(), providerOk, { onEvent: (e) => events.push(e) });
    expect(events.map((e) => e.kind)).toEqual(['attempt-start', 'attempt-success']);
  });

  it('uses the injected clock for telemetry timing (and excludes it from identity)', async () => {
    const ar = await authoringResult();
    const a = await execute(ar, providerOk, { now: () => 42 });
    expect(a.telemetry.startedAt).toBe(42);
    expect(a.telemetry.endedAt).toBe(42);
    expect(a.telemetry.durationMs).toBe(0);
    const b = await execute(ar, providerOk, { now: () => 999999 }); // different wall-clock
    expect(b.executionIdentity).toBe(a.executionIdentity); // timing is NOT part of identity
  });
});

describe('execute — streaming abstraction', () => {
  it('routes provider chunks to the supplied sink and records the chunk count', async () => {
    const chunks: unknown[] = [];
    const sink: StreamSink = { push: (c) => chunks.push(c.value) };
    const streaming: StreamingAuthor = {
      name: 'provider-stream',
      author: () => ({ determinations: [], payload: { final: true } }),
      authorStream: (_req, s) => {
        s.push({ seq: 0, value: 'a' });
        s.push({ seq: 1, value: 'b' });
        return { determinations: [], payload: { final: true } };
      },
    };
    const r = await execute(await authoringResult(), streaming, { streamSink: sink });
    expect(chunks).toEqual(['a', 'b']);
    expect(r.telemetry.chunkCount).toBe(2);
    expect(r.payload).toEqual({ final: true });
  });
});
