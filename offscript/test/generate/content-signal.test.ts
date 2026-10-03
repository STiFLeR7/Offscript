import { describe, it, expect } from 'vitest';
import { deriveContentSignal } from '../../src/generate/content-signal.js';
import type { PlanItem } from '../../src/generate/types.js';

function item(intent: string, content?: string): PlanItem {
  return { anchor: { id: 'x', anchor: 'x' }, archetype: 'ContentPage', tokenRoles: [], intent, content };
}

describe('deriveContentSignal', () => {
  it('flags comparison shape', () => {
    expect(deriveContentSignal(item('A vs B', 'before this, after that'))).toContain('comparison');
  });
  it('flags stats shape on numbers/percent', () => {
    expect(deriveContentSignal(item('Throughput', '99.9% uptime, 3× faster, 40ms'))).toContain('stats');
  });
  it('flags process shape on flow language', () => {
    expect(deriveContentSignal(item('How it works', 'step 1 → step 2 → step 3'))).toContain('process');
  });
  it('flags quote shape', () => {
    expect(deriveContentSignal(item('Voice', '"This changed everything," said the CTO.'))).toContain('quote');
  });
  it('returns a stable, sorted, de-duplicated multi-shape list', () => {
    const s = deriveContentSignal(item('Throughput vs baseline', '"It is fast," said the CTO. 40% faster.'));
    expect(s).toEqual(['comparison', 'quote', 'stats']); // sorted, deduped, all three present
    expect(new Set(s).size).toBe(s.length);
  });
  it('returns ["generic"] when nothing matches', () => {
    expect(deriveContentSignal(item('Overview', 'A short prose paragraph with no shape.'))).toEqual(['generic']);
  });
  // WS5 — spatial shape for system / operating-model / ecosystem / layer-stack language.
  it('tags spatial for system/operating-model/ecosystem language', () => {
    const s = deriveContentSignal(item('The operating model', 'A layered system: an ingestion layer, an orchestration layer, and an execution layer across three zones.'));
    expect(s).toContain('spatial');
  });
  it('does NOT tag spatial for a plain feature list', () => {
    expect(deriveContentSignal(item('Features', 'Fast. Secure. Simple.'))).not.toContain('spatial');
  });
});
