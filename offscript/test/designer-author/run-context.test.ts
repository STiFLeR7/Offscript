/**
 * P32 — Designer Author Script Foundation: execution context + structured exit model.
 *
 * RED-first per superpowers:test-driven-development. Mirrors platform-harness.ts's own
 * createHarnessExecutionContext/buildHarnessRunResult test shape, but for a deliberately
 * SEPARATE module — see the isolation test at the bottom proving this file never imports
 * platform-harness.ts (P30 §4: the Harness owns nothing about sequencing Designer Author).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createDesignerAuthorExecutionContext,
  exitCodeFor,
  buildDesignerAuthorRunResult,
  type DesignerAuthorOutcomeKind,
} from '../../src/designer-author/run-context.js';
import type { RunArtifactDiscovery } from '../../src/designer-author/run-artifacts.js';
import type { ReviewPackage } from '../../src/doctor/review-package.js';
import type { DoctorReport } from '../../src/doctor/doctor-report.js';

describe('createDesignerAuthorExecutionContext', () => {
  it('carries the supplied input verbatim and stamps startedAt via the injected clock', () => {
    const ctx = createDesignerAuthorExecutionContext(
      { dir: '/some/dir' },
      { now: () => '2026-07-13T00:00:00.000Z' },
    );
    expect(ctx.input.dir).toBe('/some/dir');
    expect(ctx.startedAt).toBe('2026-07-13T00:00:00.000Z');
  });

  it('defaults to the real clock when no now() is supplied', () => {
    const before = Date.now();
    const ctx = createDesignerAuthorExecutionContext({ dir: '/some/dir' });
    const after = Date.now();
    const stamped = new Date(ctx.startedAt).getTime();
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(after);
  });

  it('is deep-frozen — the context and its input', () => {
    const ctx = createDesignerAuthorExecutionContext({ dir: '/some/dir' });
    expect(Object.isFrozen(ctx)).toBe(true);
    expect(Object.isFrozen(ctx.input)).toBe(true);
  });

  it('never mutates the caller-supplied input object', () => {
    const input = { dir: '/some/dir' };
    createDesignerAuthorExecutionContext(input);
    expect(Object.isFrozen(input)).toBe(false);
    expect(input.dir).toBe('/some/dir');
  });

  it('deterministic replay — identical input + injected clock produce deep-equal contexts', () => {
    const now = () => '2026-07-13T00:00:00.000Z';
    const a = createDesignerAuthorExecutionContext({ dir: '/some/dir' }, { now });
    const b = createDesignerAuthorExecutionContext({ dir: '/some/dir' }, { now });
    expect(a).toEqual(b);
  });
});

describe('exitCodeFor', () => {
  const cases: Array<[DesignerAuthorOutcomeKind, 0 | 1]> = [
    ['invalid-directory', 1],
    ['malformed-artifacts', 1],
    ['not-ready', 0],
    ['ready', 0],
  ];

  it.each(cases)('maps outcome %s to exit code %i', (outcome, expected) => {
    expect(exitCodeFor(outcome)).toBe(expected);
  });
});

describe('buildDesignerAuthorRunResult', () => {
  function discoveryFor(status: DesignerAuthorOutcomeKind): RunArtifactDiscovery {
    if (status === 'not-ready') {
      return Object.freeze({ status, dir: '/d', missing: Object.freeze(['review-package.json']) });
    }
    if (status === 'malformed-artifacts') {
      return Object.freeze({ status, dir: '/d', malformed: Object.freeze(['doctor-report.json']) });
    }
    if (status === 'ready') {
      return Object.freeze({
        status,
        dir: '/d',
        reviewPackage: {} as unknown as ReviewPackage,
        doctorReport: {} as unknown as DoctorReport,
      });
    }
    return Object.freeze({ status: 'invalid-directory', dir: '/d' });
  }

  it('derives exitCode from exitCodeFor and carries the outcome + discovery through', () => {
    const ctx = createDesignerAuthorExecutionContext({ dir: '/d' }, { now: () => '2026-07-13T00:00:00.000Z' });
    const discovery = discoveryFor('not-ready');
    const result = buildDesignerAuthorRunResult({ context: ctx, discovery });
    expect(result.outcome).toBe('not-ready');
    expect(result.exitCode).toBe(0);
    expect(result.discovery).toBe(discovery);
    expect(result.context).toBe(ctx);
  });

  it('is frozen', () => {
    const ctx = createDesignerAuthorExecutionContext({ dir: '/d' });
    const result = buildDesignerAuthorRunResult({ context: ctx, discovery: discoveryFor('invalid-directory') });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('deterministic replay — identical context + discovery produce deep-equal results', () => {
    const now = () => '2026-07-13T00:00:00.000Z';
    const ctx = createDesignerAuthorExecutionContext({ dir: '/d' }, { now });
    const discovery = discoveryFor('ready');
    const a = buildDesignerAuthorRunResult({ context: ctx, discovery });
    const b = buildDesignerAuthorRunResult({ context: ctx, discovery });
    expect(a).toEqual(b);
  });
});

describe('structural isolation — run-context.ts never imports the Harness or the engine', () => {
  it('never imports platform-harness.ts, scripts/generate.ts, or src/generate/*', () => {
    const modulePath = fileURLToPath(new URL('../../src/designer-author/run-context.ts', import.meta.url));
    const source = readFileSync(modulePath, 'utf8');
    expect(source).not.toMatch(/from ['"].*platform-harness/);
    expect(source).not.toMatch(/from ['"].*\/generate\//);
  });

  it('writes nothing — no fs import at all', () => {
    const modulePath = fileURLToPath(new URL('../../src/designer-author/run-context.ts', import.meta.url));
    const source = readFileSync(modulePath, 'utf8');
    expect(source).not.toMatch(/from ['"]node:fs['"]/);
  });
});
