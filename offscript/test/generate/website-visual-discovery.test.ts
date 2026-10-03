/**
 * Sprint W70 — Website Visual Discovery Foundation (RED-first).
 *
 * Model → Loader → Transport. Stops at Transport: nothing consumes WebsiteVisualDiscovery in this
 * sprint. Mirrors the W18 (semantic-body) / W23 (family-semantics) / W52 (presentation-intent)
 * shape exactly: a pure immutable model, a deterministic content-addressed cache, and a
 * digest-checked provider. Grounded ONLY in the existing, unchanged `deriveContentSignal`
 * (content-signal.ts) PLUS the item's own already-assigned `archetype` (Structural Evidence
 * Fusion, W57 precedent) — no new detection, no AI, no embeddings, no probabilistic behaviour.
 *
 * Per SPRINT-W68-WEBSITE-VISUAL-DISCOVERY-ARCHITECTURE.md §7.2: the closed, website-native
 * vocabulary is deliberately narrow — `process` / `comparison` / `stats`, the three families that
 * already have a catalog home (§4.2) — excluding `diagram`/`spatial` equivalents until a catalog
 * destination exists for them.
 */
import { describe, it, expect } from 'vitest';
import {
  WEBSITE_VISUAL_DISCOVERY_VERSION,
  WebsiteVisualDiscoveryError,
  computeWebsiteVisualDiscovery,
  computeWebsiteVisualDiscoveryCached,
  clearWebsiteVisualDiscoveryCache,
  websiteVisualDiscoverySourceText,
  websiteVisualDiscoveryDigest,
  createWebsiteVisualDiscoveryProvider,
  websiteVisualDiscoveryTieBreak,
  type WebsiteVisualDiscovery,
} from '../../src/generate/website-visual-discovery.js';
import type { PlanItem } from '../../src/generate/types.js';

function item(id: string, archetype: string, intent: string, content?: string): PlanItem {
  return { anchor: { id, anchor: id }, archetype, tokenRoles: [], intent, content };
}

describe('W70 — computeWebsiteVisualDiscovery (model + classification)', () => {
  it('archetypeFit is true and suggestedFamily is absent for plain prose with no rich shape', () => {
    const d = computeWebsiteVisualDiscovery(item('a', 'feature-grid', 'Overview', 'A short prose paragraph.'));
    expect(d.archetypeFit).toBe(true);
    expect(d.suggestedFamily).toBeUndefined();
    expect(d.validationState).toBe('valid');
  });

  it('archetypeFit is true when a process-archetyped item carries process-shaped content', () => {
    const d = computeWebsiteVisualDiscovery(item('b', 'process', 'How it works', 'step 1 -> step 2 -> step 3'));
    expect(d.archetypeFit).toBe(true);
  });

  it('archetypeFit is true when a plan-comparison-archetyped item carries comparison-shaped content', () => {
    const d = computeWebsiteVisualDiscovery(item('c', 'plan-comparison', 'A vs B', 'before this, after that'));
    expect(d.archetypeFit).toBe(true);
  });

  it('archetypeFit is true when a metrics-archetyped item carries stats-shaped content', () => {
    const d = computeWebsiteVisualDiscovery(item('d', 'metrics', 'Throughput', '99.9% uptime, 3x faster'));
    expect(d.archetypeFit).toBe(true);
  });

  it('flags disagreement: a feature-grid item whose content reads as comparison-shaped (W68 §4.3)', () => {
    const d = computeWebsiteVisualDiscovery(item('e', 'feature-grid', 'A vs B', 'before this, after that'));
    expect(d.archetypeFit).toBe(false);
    expect(d.suggestedFamily).toBe('comparison');
  });

  it('flags disagreement: a feature-grid item whose content reads as process-shaped', () => {
    const d = computeWebsiteVisualDiscovery(item('f', 'feature-grid', 'Onboarding', 'step 1 -> step 2 -> step 3'));
    expect(d.archetypeFit).toBe(false);
    expect(d.suggestedFamily).toBe('process');
  });

  it('flags disagreement: a feature-grid item whose content reads as stats-shaped', () => {
    const d = computeWebsiteVisualDiscovery(item('g', 'feature-grid', 'Throughput', '99.9% uptime, 3x faster'));
    expect(d.archetypeFit).toBe(false);
    expect(d.suggestedFamily).toBe('stats');
  });

  it('comparison takes priority over process when both cues are present (rarer cue wins, mirrors presentation-intent precedent)', () => {
    const d = computeWebsiteVisualDiscovery(
      item('h', 'feature-grid', 'How it works vs the old way', 'step 1 -> step 2, before this, after that'),
    );
    expect(d.suggestedFamily).toBe('comparison');
  });

  it('a hero-archetyped item with no rich cue stays fit (no false disagreement on an unrelated archetype)', () => {
    const d = computeWebsiteVisualDiscovery(item('i', 'hero', 'Welcome', 'The best way to ship software.'));
    expect(d.archetypeFit).toBe(true);
    expect(d.suggestedFamily).toBeUndefined();
  });

  it('source carries the exact raw content-signal it classified from (traceability, verbatim)', () => {
    const d = computeWebsiteVisualDiscovery(item('j', 'feature-grid', 'A vs B', 'before this, after that'));
    expect(d.source).toEqual(['comparison']);
  });

  it('digest is a stable sha256 hex string, deterministic for identical input', () => {
    const a = computeWebsiteVisualDiscovery(item('k', 'feature-grid', 'Overview', 'same text'));
    const b = computeWebsiteVisualDiscovery(item('k', 'feature-grid', 'Overview', 'same text'));
    expect(a.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(a.digest).toBe(b.digest);
  });

  it('digest changes when the bound content changes', () => {
    const a = computeWebsiteVisualDiscovery(item('l', 'feature-grid', 'Overview', 'text one'));
    const b = computeWebsiteVisualDiscovery(item('l', 'feature-grid', 'Overview', 'text two'));
    expect(a.digest).not.toBe(b.digest);
  });

  it('digest changes when the archetype changes but content stays the same (archetype is fused evidence)', () => {
    const a = computeWebsiteVisualDiscovery(item('m', 'feature-grid', 'A vs B', 'before this, after that'));
    const b = computeWebsiteVisualDiscovery(item('m', 'plan-comparison', 'A vs B', 'before this, after that'));
    expect(a.digest).not.toBe(b.digest);
  });

  it('is deep-frozen: mutating the object or its source array throws under strict mode', () => {
    const d = computeWebsiteVisualDiscovery(item('n', 'feature-grid', 'Overview', 'text'));
    expect(Object.isFrozen(d)).toBe(true);
    expect(Object.isFrozen(d.source)).toBe(true);
    expect(() => {
      (d as { archetypeFit: boolean }).archetypeFit = false;
    }).toThrow();
  });

  it('never throws WebsiteVisualDiscoveryError from the pure computation (it is a total function)', () => {
    expect(() => computeWebsiteVisualDiscovery(item('o', 'feature-grid', '', ''))).not.toThrow();
  });
});

describe('W70 — websiteVisualDiscoverySourceText / websiteVisualDiscoveryDigest (pure helpers)', () => {
  it('source text mirrors what deriveContentSignal reads (intent + content), prefixed with archetype', () => {
    const i = item('p', 'feature-grid', 'The intent line', 'the content line');
    expect(websiteVisualDiscoverySourceText(i)).toBe('feature-grid\nThe intent line\nthe content line');
  });

  it('digest is over (version + canonicalized text) — CRLF and LF hash identically', () => {
    const withCrlf = websiteVisualDiscoveryDigest('feature-grid\r\na\r\nb');
    const withLf = websiteVisualDiscoveryDigest('feature-grid\na\nb');
    expect(withCrlf).toBe(withLf);
  });

  it('WEBSITE_VISUAL_DISCOVERY_VERSION participates in the digest identity', () => {
    expect(WEBSITE_VISUAL_DISCOVERY_VERSION).toMatch(/^w70-/);
  });
});

describe('W70 — computeWebsiteVisualDiscoveryCached / clearWebsiteVisualDiscoveryCache (content-addressed cache)', () => {
  it('replay: identical (archetype + bound content) returns the IDENTICAL frozen object (reference equality)', () => {
    clearWebsiteVisualDiscoveryCache();
    const first = computeWebsiteVisualDiscoveryCached(item('q', 'feature-grid', 'Overview', 'same text'));
    const second = computeWebsiteVisualDiscoveryCached(item('q2', 'feature-grid', 'Overview', 'same text'));
    expect(first).toBe(second);
  });

  it('cache key is content-addressed only — no timestamps, no filesystem metadata', () => {
    clearWebsiteVisualDiscoveryCache();
    const a = computeWebsiteVisualDiscoveryCached(item('r', 'feature-grid', 'Overview', 'alpha'));
    const b = computeWebsiteVisualDiscoveryCached(item('r', 'feature-grid', 'Overview', 'beta'));
    expect(a).not.toBe(b);
    expect(a.digest).not.toBe(b.digest);
  });

  it('clearWebsiteVisualDiscoveryCache resets identity (a fresh object is produced, still content-equal)', () => {
    clearWebsiteVisualDiscoveryCache();
    const first = computeWebsiteVisualDiscoveryCached(item('s', 'feature-grid', 'Overview', 'text'));
    clearWebsiteVisualDiscoveryCache();
    const second = computeWebsiteVisualDiscoveryCached(item('s', 'feature-grid', 'Overview', 'text'));
    expect(first).not.toBe(second);
    expect(first.digest).toBe(second.digest);
    expect(first).toEqual(second);
  });
});

describe('W70 — createWebsiteVisualDiscoveryProvider (digest-checked, keyed by item identity)', () => {
  it('discoveryFor computes and caches per plan-item anchor id; replay returns the identical object', () => {
    const provider = createWebsiteVisualDiscoveryProvider();
    const i = item('t', 'process', 'How it works', 'step 1 -> step 2');
    const first = provider.discoveryFor(i);
    const second = provider.discoveryFor(i);
    expect(first).toBe(second);
    expect(first.archetypeFit).toBe(true);
  });

  it('independent items (different anchor ids) are transported independently', () => {
    const provider = createWebsiteVisualDiscoveryProvider();
    const a = provider.discoveryFor(item('u1', 'metrics', 'Throughput', '99% faster'));
    const b = provider.discoveryFor(item('u2', 'feature-grid', 'A vs B', 'before this, after that'));
    expect(a.archetypeFit).toBe(true);
    expect(b.archetypeFit).toBe(false);
  });

  it('fails loud when the SAME anchor id reappears with DIFFERENT bound content mid-run (digest mismatch)', () => {
    const provider = createWebsiteVisualDiscoveryProvider();
    provider.discoveryFor(item('v', 'feature-grid', 'Overview', 'version one'));
    expect(() => provider.discoveryFor(item('v', 'feature-grid', 'Overview', 'version two'))).toThrow(
      WebsiteVisualDiscoveryError,
    );
    expect(() => provider.discoveryFor(item('v', 'feature-grid', 'Overview', 'version two'))).toThrow(
      /digest mismatch/i,
    );
  });

  it('re-supplying the SAME anchor id with the SAME content is a stable no-op replay', () => {
    const provider = createWebsiteVisualDiscoveryProvider();
    const i = item('w', 'feature-grid', 'Overview', 'stable text');
    const first = provider.discoveryFor(i);
    const second = provider.discoveryFor(item('w', 'feature-grid', 'Overview', 'stable text'));
    expect(first).toBe(second);
  });
});

/**
 * Sprint W72 — websiteVisualDiscoveryTieBreak: the pure scoring function BEHAVIOURAL consumers
 * (pickFragment, assignWebsiteCompositions) apply to their existing, unwidened candidate pool. It
 * introduces no new evidence — only re-reads the already-transported WebsiteVisualDiscovery object.
 */
function discovery(overrides: Partial<WebsiteVisualDiscovery> = {}): WebsiteVisualDiscovery {
  return Object.freeze({
    archetypeFit: true,
    source: Object.freeze([]),
    digest: 'test-digest',
    validationState: 'valid' as const,
    ...overrides,
  });
}

describe('W72 — websiteVisualDiscoveryTieBreak', () => {
  it('undefined when the transport is absent entirely', () => {
    expect(websiteVisualDiscoveryTieBreak(undefined)).toBeUndefined();
  });

  it('undefined when archetypeFit is true (agreement — nothing to tie-break)', () => {
    expect(websiteVisualDiscoveryTieBreak(discovery({ archetypeFit: true }))).toBeUndefined();
  });

  it('undefined when archetypeFit is false but suggestedFamily is somehow absent (defensive)', () => {
    expect(websiteVisualDiscoveryTieBreak(discovery({ archetypeFit: false }))).toBeUndefined();
  });

  it('scores 1 a candidate whose serves includes the suggested family, 0 otherwise', () => {
    const score = websiteVisualDiscoveryTieBreak(discovery({ archetypeFit: false, suggestedFamily: 'comparison' }));
    expect(score).toBeDefined();
    expect(score!(['feature', 'comparison'])).toBe(1);
    expect(score!(['feature'])).toBe(0);
    expect(score!([])).toBe(0);
  });

  it('is deterministic — the same discovery object always yields the same verdict', () => {
    const d = discovery({ archetypeFit: false, suggestedFamily: 'process' });
    const a = websiteVisualDiscoveryTieBreak(d)!;
    const b = websiteVisualDiscoveryTieBreak(d)!;
    expect(a(['process'])).toBe(b(['process']));
    expect(a(['feature'])).toBe(b(['feature']));
  });
});
