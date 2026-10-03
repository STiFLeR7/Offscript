/**
 * P52 — Project Context model + updater. The context is APPEND-ONLY: a completed session enriches
 * it without mutating prior decisions. Confirmed facts advance, but the full decision log (and thus
 * every change) is preserved and deterministically reconstructable.
 */
import { describe, it, expect } from 'vitest';
import { emptyContext, type ProjectIdentity } from '../../src/project/project-context.js';
import { newSession, applySession, reconstructContext, buildBriefSession } from '../../src/project/context-updater.js';
import { parseBrief } from '../../src/generate/brief.js';
import { normalizeBrief } from '../../src/project/brief-normalizer.js';

const IDENTITY: ProjectIdentity = { client: 'x', projectType: 'website', deliverables: ['website'] };
const T1 = '2026-01-01T00:00:00Z';
const T2 = '2026-01-02T00:00:00Z';

describe('P52 project context + updater', () => {
  it('an empty context is version 0 with no history', () => {
    const c = emptyContext(IDENTITY);
    expect(c.version).toBe(0);
    expect(c.sessions).toEqual([]);
    expect(c.decisions).toEqual([]);
    expect(Object.keys(c.confirmedFacts)).toEqual([]);
  });

  it('applySession appends a session + its decisions, advances facts, and NEVER mutates the input', () => {
    const c0 = emptyContext(IDENTITY);
    const s1 = newSession({ goal: 'acquire', decisions: [{ kind: 'confirmed', subject: 'audience', to: 'Devs' }] }, c0, T1);
    const c1 = applySession(c0, s1);
    expect(c1.version).toBe(1);
    expect(c1.confirmedFacts.audience.value).toBe('Devs');
    expect(c1.decisions).toHaveLength(1);
    expect(c1.sessions).toHaveLength(1);
    // input untouched (append-only, immutable)
    expect(c0.version).toBe(0);
    expect(c0.sessions).toHaveLength(0);
    expect(Object.keys(c0.confirmedFacts)).toHaveLength(0);
  });

  it('a CHANGED decision advances the fact but PRESERVES the prior decision (traceable history)', () => {
    const c0 = emptyContext(IDENTITY);
    const c1 = applySession(c0, newSession({ goal: 'acquire', decisions: [{ kind: 'confirmed', subject: 'audience', to: 'Devs' }] }, c0, T1));
    const c2 = applySession(c1, newSession({ goal: 'revise', decisions: [{ kind: 'changed', subject: 'audience', from: 'Devs', to: 'Enterprise' }] }, c1, T2));
    expect(c2.confirmedFacts.audience.value).toBe('Enterprise'); // latest wins
    expect(c2.decisions.map((d) => d.kind)).toEqual(['confirmed', 'changed']); // both retained
    expect(c2.version).toBe(2);
    expect(c2.sessions[1].previousSessionId).toBe(c2.sessions[0].id); // sessions linked
    expect(c2.sessions[1].ordinal).toBe(2);
  });

  it('a REJECTED decision is recorded as a rejected assumption (not a confirmed fact)', () => {
    const c0 = emptyContext(IDENTITY);
    const c1 = applySession(c0, newSession({ goal: 'review', decisions: [{ kind: 'rejected', subject: 'hero', to: 'hero-bento', rationale: 'off-brand' }] }, c0, T1));
    expect(c1.rejectedAssumptions).toHaveLength(1);
    expect(c1.rejectedAssumptions[0].subject).toBe('hero');
    expect(c1.confirmedFacts.hero).toBeUndefined();
  });

  it('buildBriefSession derives confirmed/changed decisions by diffing the brief against prior context', () => {
    const c0 = emptyContext(IDENTITY);
    const brief1 = parseBrief(normalizeBrief({ track: 'website', oneLiner: 'Ship fast', audience: 'Devs', mustInclude: ['hero', 'footer'] }));
    const in1 = buildBriefSession({ prior: c0, brief: brief1 });
    expect(in1.decisions!.map((d) => d.kind)).toEqual(['confirmed', 'confirmed', 'confirmed']); // one-liner, audience, must-include

    const c1 = applySession(c0, newSession(in1, c0, T1));
    const brief2 = parseBrief(normalizeBrief({ track: 'website', oneLiner: 'Ship fast', audience: 'Enterprise', mustInclude: ['hero', 'footer'] }));
    const in2 = buildBriefSession({ prior: c1, brief: brief2 });
    expect(in2.decisions).toHaveLength(1); // only audience changed
    expect(in2.decisions![0]).toMatchObject({ kind: 'changed', subject: 'audience', from: 'Devs', to: 'Enterprise' });
  });

  it('REPLAY: reconstructing a context from its own session log reproduces it exactly', () => {
    const c0 = emptyContext(IDENTITY);
    const c1 = applySession(c0, newSession({ goal: 'acquire', decisions: [{ kind: 'confirmed', subject: 'audience', to: 'Devs' }] }, c0, T1));
    const c2 = applySession(c1, newSession({ goal: 'revise', decisions: [{ kind: 'changed', subject: 'audience', from: 'Devs', to: 'Enterprise' }] }, c1, T2));
    expect(reconstructContext(IDENTITY, c2.sessions)).toEqual(c2);
  });
});
