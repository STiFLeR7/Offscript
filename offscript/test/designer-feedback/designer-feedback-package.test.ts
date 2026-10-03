/**
 * P18 — designer feedback package. RED-first. Mirrors
 * overlay-approval-package.test.ts's manifest-correctness and falsification
 * patterns exactly.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { recordDesignerFeedback } from '../../src/designer-feedback/designer-feedback.js';
import { buildFeedbackPackage } from '../../src/designer-feedback/designer-feedback-package.js';

function sampleFeedback(now = () => '2026-07-10T00:00:00.000Z') {
  return recordDesignerFeedback(
    { subject: { kind: 'doctor-finding', id: 'contrast:hero' }, reviewer: 'designer:hill', status: 'accept', note: 'looks right' },
    { now },
  );
}

function stableStringifyForTest(value: unknown): string {
  const keys = new Set<string>();
  const walk = (v: unknown): void => {
    if (v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    for (const k of Object.keys(v as Record<string, unknown>)) {
      keys.add(k);
      walk((v as Record<string, unknown>)[k]);
    }
  };
  walk(value);
  return JSON.stringify(value, Array.from(keys).sort(), 2) + '\n';
}

describe('buildFeedbackPackage', () => {
  it('produces a manifest with exactly one artifact indexing the feedback', () => {
    const feedback = sampleFeedback();
    const pkg = buildFeedbackPackage({ feedback }, { now: () => '2026-07-10T01:00:00.000Z' });
    expect(pkg.manifest.feedbackId).toBe(feedback.id);
    expect(pkg.manifest.packagedAt).toBe('2026-07-10T01:00:00.000Z');
    expect(pkg.manifest.artifacts).toHaveLength(1);
    expect(pkg.manifest.artifacts[0].name).toBe('designer-feedback.json');
  });

  it('manifest correctness: the recorded hash matches a fresh recomputation over the packaged feedback', () => {
    const feedback = sampleFeedback();
    const pkg = buildFeedbackPackage({ feedback });
    const expectedHash = createHash('sha256').update(stableStringifyForTest(feedback)).digest('hex');
    expect(pkg.manifest.artifacts[0].sha256).toBe(expectedHash);
  });

  it('is deterministic: identical feedback content produces an identical manifest hash', () => {
    const a = buildFeedbackPackage({ feedback: sampleFeedback() }, { now: () => '2026-01-01T00:00:00.000Z' });
    const b = buildFeedbackPackage({ feedback: sampleFeedback() }, { now: () => '2026-12-31T00:00:00.000Z' });
    expect(a.manifest.artifacts[0].sha256).toBe(b.manifest.artifacts[0].sha256);
    expect(a.manifest.feedbackId).toBe(b.manifest.feedbackId);
  });

  it('embeds the feedback verbatim', () => {
    const feedback = sampleFeedback();
    const pkg = buildFeedbackPackage({ feedback });
    expect(pkg.feedback).toEqual(feedback);
  });

  it('is deep-frozen', () => {
    const pkg = buildFeedbackPackage({ feedback: sampleFeedback() });
    expect(Object.isFrozen(pkg)).toBe(true);
    expect(Object.isFrozen(pkg.manifest)).toBe(true);
    expect(Object.isFrozen(pkg.manifest.artifacts)).toBe(true);
  });

  it('falsification: two different pieces of feedback produce different manifest hashes', () => {
    const a = buildFeedbackPackage({
      feedback: recordDesignerFeedback({ subject: { kind: 'doctor-finding', id: 'x' }, reviewer: 'designer:hill', status: 'accept', note: 'ok' }),
    });
    const b = buildFeedbackPackage({
      feedback: recordDesignerFeedback({ subject: { kind: 'doctor-finding', id: 'x' }, reviewer: 'designer:hill', status: 'needs-change', note: 'ok' }),
    });
    expect(a.manifest.artifacts[0].sha256).not.toBe(b.manifest.artifacts[0].sha256);
  });
});

describe('structural isolation: designer-feedback-package.ts touches no filesystem and no overlay store', () => {
  it('imports nothing from node:fs or overlay.js', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-feedback/designer-feedback-package.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      expect(line).not.toMatch(/node:fs/);
      expect(line).not.toMatch(/['"](?:\.\.?\/)*overlay\.js['"]/);
    }
  });
});
