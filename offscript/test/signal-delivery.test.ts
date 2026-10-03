import { describe, it, expect } from 'vitest';
import {
  createSignalLedger,
  detectSeveredPaths,
  signalKey,
} from '../src/signal-delivery.js';
import { validateSignal, type AuthoritySignal } from '../src/authority.js';

// W1-S2 — Signal delivery + severed-path detection.
// Governed by docs/internals/W1-OBSERVABILITY-TASK-PLAN.md (W1-S2),
// OFFSCRIPT-V3-AUTHORITY-SIGNAL-OWNERSHIP-CONTRACT.md, W1-S1-FORENSIC-REVIEW.md (R-C),
// and OFFSCRIPT-V3-EXECUTION-CHARTER.md (LOUD-MARK).
// Additive: exercises only the new delivery surface over the W1-S1 authority module;
// nothing in the scoring/freeze/loop path is imported or touched.

function sig(over: Partial<AuthoritySignal> = {}): AuthoritySignal {
  return {
    producer: 'layout-alignment',
    level: 'warning',
    where: 'section:4',
    what: 'off the 8pt grid',
    why: 'deterministic soft QA note',
    nature: 'objective',
    ...over,
  };
}

describe('signal delivery — a produced signal reaches a consumer', () => {
  it('emits, then drains the signal to a consumer; the ledger is clean afterwards', () => {
    const ledger = createSignalLedger();
    ledger.registerProducer('layout-alignment');

    const result = ledger.emit(sig());
    expect(result.accepted).toBe(true);

    const delivered = ledger.drain();
    expect(delivered).toHaveLength(1);

    const report = detectSeveredPaths(
      ledger.entries(),
      ledger.rejectedSignals(),
      ledger.registeredProducers(),
    );
    expect(report.ok).toBe(true);
    expect(report.severed).toHaveLength(0);
    expect(report.failures).toHaveLength(0);
  });
});

describe('severed-path detection — a produced signal with no delivery path is surfaced', () => {
  it('flags an emitted-but-undelivered signal and mints an objective Failure for it', () => {
    const ledger = createSignalLedger();
    ledger.registerProducer('layout-alignment');
    ledger.emit(sig({ what: 'never drained' }));
    // deliberately do NOT drain

    const report = detectSeveredPaths(
      ledger.entries(),
      ledger.rejectedSignals(),
      ledger.registeredProducers(),
    );

    expect(report.ok).toBe(false);
    expect(report.severed).toHaveLength(1);
    expect(report.failures).toHaveLength(1);

    const failure = report.failures[0];
    expect(failure.level).toBe('failure');
    expect(failure.nature).toBe('objective');
    expect(failure.producer).toBe('signal-delivery');
    expect(failure.where).toContain('layout-alignment'); // original attribution preserved in the trace
    expect(validateSignal(failure).valid).toBe(true); // the severed-path Failure is itself well-formed
  });

  it('a partially-drained batch leaves the undelivered signal severed', () => {
    const ledger = createSignalLedger();
    ledger.registerProducer('p');
    ledger.emit(sig({ producer: 'p', where: 'a', what: 'delivered one' }));
    ledger.emit(sig({ producer: 'p', where: 'b', what: 'left behind' }));

    // deliver only the first by key
    const firstKey = ledger.entries()[0].key;
    expect(ledger.deliver(firstKey)).toBe(true);

    const report = detectSeveredPaths(
      ledger.entries(),
      ledger.rejectedSignals(),
      ledger.registeredProducers(),
    );
    expect(report.severed).toHaveLength(1);
    expect(report.severed[0].what).toBe('left behind');
  });
});

describe('attribution preservation — attribution survives delivery', () => {
  it('the drained signal is field-for-field identical to the emitted one', () => {
    const ledger = createSignalLedger();
    ledger.registerProducer('source-fidelity');
    const original = sig({
      producer: 'source-fidelity',
      where: 'unit:hero',
      what: 'unit delivered',
      why: 'reachability satisfied',
      level: 'information',
    });
    ledger.emit(original);

    const [delivered] = ledger.drain();
    expect(delivered).toEqual(original);
  });
});

describe('authority preservation — signal level survives delivery unchanged', () => {
  it('a Failure-level objective signal is delivered still at Failure', () => {
    const ledger = createSignalLedger();
    ledger.registerProducer('source-fidelity');
    ledger.emit(
      sig({
        producer: 'source-fidelity',
        level: 'failure',
        where: 'unit:cta',
        what: 'authored from void',
        why: 'objective guarantee violation (no-authoring-from-void)',
        nature: 'objective',
      }),
    );

    const [delivered] = ledger.drain();
    expect(delivered.level).toBe('failure');
    expect(delivered.nature).toBe('objective');
  });
});

describe('LOUD-MARK preservation — no signal terminates execution or changes control flow', () => {
  it('emit / deliver / drain / detect never throw, even with a Failure present', () => {
    const ledger = createSignalLedger();
    ledger.registerProducer('source-fidelity');
    expect(() =>
      ledger.emit(sig({ producer: 'source-fidelity', level: 'failure', nature: 'objective' })),
    ).not.toThrow();
    expect(() => ledger.drain()).not.toThrow();
    expect(() =>
      detectSeveredPaths(ledger.entries(), ledger.rejectedSignals(), ledger.registeredProducers()),
    ).not.toThrow();
  });

  it('detectSeveredPaths is pure — it does not mutate the entries it inspects', () => {
    const ledger = createSignalLedger();
    ledger.registerProducer('p');
    ledger.emit(sig({ producer: 'p', what: 'undelivered' }));
    const before = JSON.stringify(ledger.entries());
    detectSeveredPaths(ledger.entries(), ledger.rejectedSignals(), ledger.registeredProducers());
    expect(JSON.stringify(ledger.entries())).toBe(before);
  });
});

describe('failure scenarios (intentional)', () => {
  it('orphaned producer: a signal from an unregistered producer is surfaced, never silently lost', () => {
    const ledger = createSignalLedger();
    // no registerProducer
    const r = ledger.emit(sig({ producer: 'rogue-rail', where: 'x', what: 'orphan' }));
    expect(r.accepted).toBe(true); // still ledgered, not dropped

    const report = detectSeveredPaths(
      ledger.entries(),
      ledger.rejectedSignals(),
      ledger.registeredProducers(),
    );
    expect(report.unregistered.map((s) => s.producer)).toContain('rogue-rail');
    expect(report.ok).toBe(false);
  });

  it('invalid signal: an objective Critical Warning is rejected at the chokepoint and recorded loudly', () => {
    const ledger = createSignalLedger();
    ledger.registerProducer('layout-alignment');
    const r = ledger.emit(sig({ nature: 'objective', level: 'critical-warning' }));
    expect(r.accepted).toBe(false);
    expect(r.reason).toBeTruthy();
    expect(ledger.entries()).toHaveLength(0); // never enters the delivery ledger
    expect(ledger.rejectedSignals()).toHaveLength(1); // but is not lost — surfaced
  });

  it('unattributed signal: a missing-producer signal is rejected at the chokepoint', () => {
    const ledger = createSignalLedger();
    const r = ledger.emit(sig({ producer: '' }));
    expect(r.accepted).toBe(false);
    expect(r.reason).toBeTruthy();
    expect(ledger.rejectedSignals()).toHaveLength(1);
  });

  it('duplicated signal: an identical re-emit is flagged duplicate and accounted once', () => {
    const ledger = createSignalLedger();
    ledger.registerProducer('layout-alignment');
    const first = ledger.emit(sig());
    const second = ledger.emit(sig());
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(ledger.entries()).toHaveLength(1); // accounted once (idempotent)
  });

  it('undelivered signal: drains do not auto-deliver future emits — a late emit stays severed', () => {
    const ledger = createSignalLedger();
    ledger.registerProducer('p');
    ledger.emit(sig({ producer: 'p', where: 'a', what: 'first' }));
    ledger.drain(); // delivers 'first'
    ledger.emit(sig({ producer: 'p', where: 'b', what: 'second, never drained' }));

    const report = detectSeveredPaths(
      ledger.entries(),
      ledger.rejectedSignals(),
      ledger.registeredProducers(),
    );
    expect(report.severed.map((s) => s.what)).toEqual(['second, never drained']);
  });
});

describe('signalKey — stable identity for accounting', () => {
  it('identical signals share a key; differing signals do not', () => {
    expect(signalKey(sig())).toBe(signalKey(sig()));
    expect(signalKey(sig())).not.toBe(signalKey(sig({ where: 'section:5' })));
  });
});
