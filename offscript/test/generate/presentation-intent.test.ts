/**
 * Sprint W52 — Presentation Intent Foundation (RED-first).
 *
 * Model → Loader → Transport. Stops at Transport: nothing consumes PresentationIntent in this
 * sprint. Mirrors the W18 (semantic-body) / W23 (family-semantics) / W20 (semantic-author-context)
 * shape exactly: a pure immutable model, a deterministic content-addressed cache, and a
 * digest-checked provider. Grounded ONLY in the existing, unchanged `deriveContentSignal` — no new
 * detection, no AI, no embeddings, no probabilistic behaviour.
 */
import { describe, it, expect } from 'vitest';
import {
  PRESENTATION_INTENT_VERSION,
  PresentationIntentError,
  computePresentationIntent,
  computePresentationIntentCached,
  clearPresentationIntentCache,
  presentationIntentSourceText,
  presentationIntentDigest,
  createPresentationIntentProvider,
} from '../../src/generate/presentation-intent.js';
import type { PlanItem } from '../../src/generate/types.js';

function item(id: string, intent: string, content?: string): PlanItem {
  return { anchor: { id, anchor: id }, archetype: 'ContentPage', tokenRoles: [], intent, content };
}

describe('W52 — computePresentationIntent (model + classification)', () => {
  it('classifies "none" for plain prose with no rich shape', () => {
    const p = computePresentationIntent(item('a', 'Overview', 'A short prose paragraph with no shape.'));
    expect(p.intentClass).toBe('none');
    expect(p.commitment).toBe('none');
    expect(p.validationState).toBe('valid');
  });

  it('classifies "chart" for a stats-shaped section (grounds README-DATA-VIZ scope)', () => {
    const p = computePresentationIntent(item('b', 'Throughput', '99.9% uptime, 3x faster'));
    expect(p.intentClass).toBe('chart');
  });

  it('classifies "diagram" for a process-shaped section (grounds README-DIAGRAMS scope)', () => {
    const p = computePresentationIntent(item('c', 'How it works', 'step 1 -> step 2 -> step 3'));
    expect(p.intentClass).toBe('diagram');
  });

  it('classifies "diagram" for a comparison-shaped section (README-DIAGRAMS names Comparison a family)', () => {
    const p = computePresentationIntent(item('d', 'A vs B', 'before this, after that'));
    expect(p.intentClass).toBe('diagram');
  });

  it('classifies "spatial" for system/ecosystem language (grounds README-SPATIAL scope)', () => {
    const p = computePresentationIntent(
      item('e', 'The operating model', 'A layered system: an ingestion layer, an orchestration layer, and an execution layer across three zones.'),
    );
    expect(p.intentClass).toBe('spatial');
  });

  it('spatial takes priority over diagram when both cues are present (mirrors the existing routedStudyPointer precedent)', () => {
    const p = computePresentationIntent(
      item('f', 'Ecosystem', 'A layered system across three zones. Then step 1, then step 2.'),
    );
    expect(p.intentClass).toBe('spatial');
  });

  it('commitment is "inline" for a single rich cue', () => {
    const p = computePresentationIntent(item('g', 'How it works', 'step 1 -> step 2 -> step 3'));
    expect(p.intentClass).toBe('diagram');
    expect(p.commitment).toBe('inline');
  });

  it('commitment is "dominant" when 2+ distinct rich cues co-occur', () => {
    const p = computePresentationIntent(
      item('h', 'How it works vs the old way', 'step 1 -> step 2, before this, after that'),
    );
    expect(p.intentClass).toBe('diagram'); // process + comparison both present
    expect(p.commitment).toBe('dominant');
  });

  it('source carries the exact raw content-signal it classified from (traceability, verbatim)', () => {
    const p = computePresentationIntent(item('i', 'A vs B', 'before this, after that'));
    expect(p.source).toEqual(['comparison']);
  });

  it('digest is a stable sha256 hex string, deterministic for identical input', () => {
    const a = computePresentationIntent(item('j', 'Overview', 'same text'));
    const b = computePresentationIntent(item('j', 'Overview', 'same text'));
    expect(a.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(a.digest).toBe(b.digest);
  });

  it('digest changes when the bound content changes', () => {
    const a = computePresentationIntent(item('k', 'Overview', 'text one'));
    const b = computePresentationIntent(item('k', 'Overview', 'text two'));
    expect(a.digest).not.toBe(b.digest);
  });

  it('is deep-frozen: mutating the object or its source array throws (or silently no-ops) under strict mode', () => {
    const p = computePresentationIntent(item('l', 'Overview', 'text'));
    expect(Object.isFrozen(p)).toBe(true);
    expect(Object.isFrozen(p.source)).toBe(true);
    expect(() => {
      (p as { intentClass: string }).intentClass = 'chart';
    }).toThrow();
  });

  it('never throws PresentationIntentError from the pure computation (it is a total function over a closed shape vocabulary)', () => {
    expect(() => computePresentationIntent(item('m', '', ''))).not.toThrow();
  });
});

describe('W57 — structural evidence fusion (StatsPage archetype)', () => {
  function statsItem(id: string, intent: string, content?: string): PlanItem {
    return { anchor: { id, anchor: id }, archetype: 'StatsPage', tokenRoles: [], intent, content };
  }

  it('resolves "chart" for a StatsPage archetype even when no prose trigger is present (W56 metrics-page gap)', () => {
    // Mirrors the real logistics "metrics: Supply chain outcomes" section measured in W56 —
    // archetyped StatsPage by the planner's own richer STATS_RE, but zero literal digit/%/×/$
    // in the text, so deriveContentSignal alone returns ['generic'].
    const p = computePresentationIntent(statsItem('stats-1', 'metrics: Supply chain outcomes'));
    expect(p.intentClass).toBe('chart');
  });

  it('does NOT affect a ContentPage archetype with the same trigger-free text (no false positive)', () => {
    const p = computePresentationIntent(item('stats-2', 'metrics: Supply chain outcomes'));
    expect(p.intentClass).toBe('none');
  });

  it('does NOT affect a CoverPage archetype', () => {
    const p = computePresentationIntent({
      anchor: { id: 'stats-3', anchor: 'stats-3' },
      archetype: 'CoverPage',
      tokenRoles: [],
      intent: 'metrics: Supply chain outcomes',
    });
    expect(p.intentClass).toBe('none');
  });

  it('does NOT affect a ClosingPage archetype', () => {
    const p = computePresentationIntent({
      anchor: { id: 'stats-4', anchor: 'stats-4' },
      archetype: 'ClosingPage',
      tokenRoles: [],
      intent: 'metrics: Supply chain outcomes',
    });
    expect(p.intentClass).toBe('none');
  });

  it('a real spatial cue still wins over the StatsPage structural addition (existing classify() priority unchanged)', () => {
    const p = computePresentationIntent(
      statsItem('stats-5', 'The operating model', 'A layered system across three zones, an ecosystem of interacting parts.'),
    );
    expect(p.intentClass).toBe('spatial');
  });

  it('a real diagram cue still wins over the StatsPage structural addition (existing classify() priority unchanged)', () => {
    const p = computePresentationIntent(statsItem('stats-6', 'A vs B', 'before this, after that'));
    expect(p.intentClass).toBe('diagram');
  });

  it('StatsPage archetype does not duplicate "stats" in source when content-signal already detected it', () => {
    const p = computePresentationIntent(statsItem('stats-7', 'Throughput', '99.9% uptime, 3x faster'));
    expect(p.intentClass).toBe('chart');
    expect(p.source).toEqual(['stats']);
  });

  it('StatsPage structural addition drops the "generic" sentinel from source (real evidence supersedes the no-cue catch-all)', () => {
    const p = computePresentationIntent(statsItem('stats-8', 'metrics: Supply chain outcomes'));
    expect(p.source).toEqual(['stats']);
  });

  it('commitment is "inline" for the StatsPage structural addition alone (a single earned cue, not dominant)', () => {
    const p = computePresentationIntent(statsItem('stats-9', 'metrics: Supply chain outcomes'));
    expect(p.commitment).toBe('inline');
  });

  it('digest is unaffected by the structural rule — still computed from item.intent + item.content only', () => {
    const withStats = computePresentationIntent(statsItem('stats-10', 'Overview', 'same text'));
    const withoutStats = computePresentationIntent(item('stats-10b', 'Overview', 'same text'));
    expect(withStats.digest).toBe(withoutStats.digest);
  });
});

describe('W52 — presentationIntentSourceText / presentationIntentDigest (pure helpers)', () => {
  it('source text mirrors exactly what deriveContentSignal reads (intent + content)', () => {
    const i = item('n', 'The intent line', 'the content line');
    expect(presentationIntentSourceText(i)).toBe('The intent line\nthe content line');
  });

  it('digest is over (version + canonicalized text) — CRLF and LF hash identically', () => {
    const withCrlf = presentationIntentDigest('a\r\nb');
    const withLf = presentationIntentDigest('a\nb');
    expect(withCrlf).toBe(withLf);
  });

  it('PRESENTATION_INTENT_VERSION participates in the digest identity', () => {
    // Sanity: the exported version string is a non-empty, stable identifier.
    expect(PRESENTATION_INTENT_VERSION).toMatch(/^w52-/);
  });
});

describe('W52 — computePresentationIntentCached / clearPresentationIntentCache (content-addressed cache)', () => {
  it('replay: identical bound content returns the IDENTICAL frozen object (reference equality)', () => {
    clearPresentationIntentCache();
    const first = computePresentationIntentCached(item('o', 'Overview', 'same text'));
    const second = computePresentationIntentCached(item('o2', 'Overview', 'same text')); // different anchor, same content
    expect(first).toBe(second);
  });

  it('cache key is content-addressed only — no timestamps, no filesystem metadata', () => {
    clearPresentationIntentCache();
    const a = computePresentationIntentCached(item('p', 'Overview', 'alpha'));
    const b = computePresentationIntentCached(item('p', 'Overview', 'beta'));
    expect(a).not.toBe(b);
    expect(a.digest).not.toBe(b.digest);
  });

  it('clearPresentationIntentCache resets identity (a fresh object is produced, still content-equal)', () => {
    clearPresentationIntentCache();
    const first = computePresentationIntentCached(item('q', 'Overview', 'text'));
    clearPresentationIntentCache();
    const second = computePresentationIntentCached(item('q', 'Overview', 'text'));
    expect(first).not.toBe(second); // new object identity post-clear
    expect(first.digest).toBe(second.digest); // same content ⇒ same digest
    expect(first).toEqual(second); // structurally identical
  });
});

describe('W52 — createPresentationIntentProvider (digest-checked, keyed by item identity)', () => {
  it('intentFor computes and caches per plan-item anchor id; replay returns the identical object', () => {
    const provider = createPresentationIntentProvider();
    const i = item('r', 'How it works', 'step 1 -> step 2');
    const first = provider.intentFor(i);
    const second = provider.intentFor(i);
    expect(first).toBe(second);
    expect(first.intentClass).toBe('diagram');
  });

  it('independent items (different anchor ids) are transported independently', () => {
    const provider = createPresentationIntentProvider();
    const a = provider.intentFor(item('s1', 'Throughput', '99% faster'));
    const b = provider.intentFor(item('s2', 'How it works', 'step 1 -> step 2'));
    expect(a.intentClass).toBe('chart');
    expect(b.intentClass).toBe('diagram');
  });

  it('fails loud when the SAME anchor id reappears with DIFFERENT bound content mid-run (digest mismatch)', () => {
    const provider = createPresentationIntentProvider();
    provider.intentFor(item('t', 'Overview', 'version one'));
    expect(() => provider.intentFor(item('t', 'Overview', 'version two'))).toThrow(PresentationIntentError);
    expect(() => provider.intentFor(item('t', 'Overview', 'version two'))).toThrow(/digest mismatch/i);
  });

  it('re-supplying the SAME anchor id with the SAME content is a stable no-op replay', () => {
    const provider = createPresentationIntentProvider();
    const i = item('u', 'Overview', 'stable text');
    const first = provider.intentFor(i);
    const second = provider.intentFor(item('u', 'Overview', 'stable text'));
    expect(first).toBe(second);
  });
});
