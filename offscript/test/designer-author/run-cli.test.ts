/**
 * P32 — Designer Author Script Foundation: CLI argument parsing.
 *
 * RED-first per superpowers:test-driven-development. `resolveTargetDir` is the ONE piece of
 * CLI parsing logic worth unit-testing directly (the env-gate and process.exit calls live in
 * scripts/designer-author.ts itself, which — like scripts/actuate.ts and scripts/generate.ts —
 * is exercised via production verification, not a unit test; see the P32 report §2).
 */
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import {
  resolveTargetDir,
  getFlagValue,
  parseProposalKind,
  parseApprovalStatus,
  DesignerAuthorCliError,
} from '../../src/designer-author/run-cli.js';

describe('resolveTargetDir', () => {
  it('resolves the first non-flag argument', () => {
    expect(resolveTargetDir(['some/dir'], '/fallback')).toBe(resolve('some/dir'));
  });

  it('skips leading flags and picks the first non-flag argument', () => {
    expect(resolveTargetDir(['--foo', '--bar=baz', 'the/real/dir'], '/fallback')).toBe(resolve('the/real/dir'));
  });

  it('falls back to the supplied default when no non-flag argument is present', () => {
    expect(resolveTargetDir([], '/fallback/dir')).toBe(resolve('/fallback/dir'));
  });

  it('falls back when every argument is a flag', () => {
    expect(resolveTargetDir(['--track=website', '--verbose'], '/fallback/dir')).toBe(resolve('/fallback/dir'));
  });

  it('is deterministic — identical args always resolve to the identical path', () => {
    const a = resolveTargetDir(['a/b/c'], '/fallback');
    const b = resolveTargetDir(['a/b/c'], '/fallback');
    expect(a).toBe(b);
  });
});

describe('getFlagValue', () => {
  it('returns the value of a --name=value flag', () => {
    expect(getFlagValue(['--intent=make it pop', '--family=family-hero'], 'intent')).toBe('make it pop');
    expect(getFlagValue(['--intent=make it pop', '--family=family-hero'], 'family')).toBe('family-hero');
  });

  it('returns undefined when the flag is absent', () => {
    expect(getFlagValue(['--other=x'], 'intent')).toBeUndefined();
  });

  it('returns an empty string for --name= with no value', () => {
    expect(getFlagValue(['--intent='], 'intent')).toBe('');
  });

  it('is deterministic — identical args always resolve to the identical value', () => {
    const args = ['--intent=hello', '--family=family-hero'];
    expect(getFlagValue(args, 'intent')).toBe(getFlagValue(args, 'intent'));
  });
});

describe('parseProposalKind', () => {
  it('defaults to component when raw is undefined', () => {
    expect(parseProposalKind(undefined)).toBe('component');
  });

  it.each(['component', 'section', 'variant', 'overlay'] as const)('accepts the valid kind %s', (kind) => {
    expect(parseProposalKind(kind)).toBe(kind);
  });

  it('throws DesignerAuthorCliError on an invalid kind', () => {
    expect(() => parseProposalKind('not-a-kind')).toThrow(DesignerAuthorCliError);
  });
});

describe('parseApprovalStatus', () => {
  it.each(['approved', 'rejected'] as const)('accepts the valid status %s', (status) => {
    expect(parseApprovalStatus(status)).toBe(status);
  });

  it('has NO default — throws DesignerAuthorCliError when raw is undefined (an approval decision is never inferred)', () => {
    expect(() => parseApprovalStatus(undefined)).toThrow(DesignerAuthorCliError);
  });

  it('throws DesignerAuthorCliError on an invalid status', () => {
    expect(() => parseApprovalStatus('maybe')).toThrow(DesignerAuthorCliError);
  });
});
