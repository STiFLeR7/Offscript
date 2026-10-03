import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseGovernanceVersion,
  loadGovernanceVersion,
  writeManifest,
  UNVERSIONED,
  type RunManifest,
} from '../../src/generate/governance-version.js';

describe('parseGovernanceVersion (Fix D)', () => {
  it('captures the bracketed token from the real website header', () => {
    const css = `/*\n   Example Brand — Colors & Type  [v2 RE-THEME — PROPOSED, gate-1 draft]\n   more header text\n*/`;
    expect(parseGovernanceVersion(css)).toBe('v2 RE-THEME — PROPOSED, gate-1 draft');
  });

  it('returns UNVERSIONED for a header with no bracket', () => {
    const css = `/* Example Brand Design System — colors, type & A4 collateral layout */`;
    expect(parseGovernanceVersion(css)).toBe(UNVERSIONED);
  });

  it('returns UNVERSIONED for an empty bracket', () => {
    expect(parseGovernanceVersion('/* header []  */')).toBe(UNVERSIONED);
  });

  it('returns UNVERSIONED for a whitespace-only bracket', () => {
    expect(parseGovernanceVersion('/* header [   ]  */')).toBe(UNVERSIONED);
  });

  it('collapses internal whitespace in the captured token', () => {
    expect(parseGovernanceVersion('/* header [  v2   draft ] */')).toBe('v2 draft');
  });

  it('ignores a bracket below the header scan window (header-only scan)', () => {
    const head = Array.from({ length: 12 }, () => '/* x */').join('\n');
    const css = `${head}\n.foo { content: "[v9]"; }`;
    expect(parseGovernanceVersion(css)).toBe(UNVERSIONED);
  });
});

describe('loadGovernanceVersion (fail-soft)', () => {
  it('reads the real website marker for example-brand/website', () => {
    const r = loadGovernanceVersion('example-brand', 'website');
    expect(r.version).toMatch(/^v3 — EDITORIAL RESTRAINT/);
    expect(r.warning).toBeUndefined();
    expect(r.cssPath.replace(/\\/g, '/')).toMatch(/website\/colors_and_type\.css$/);
  });

  it('degrades to UNVERSIONED + warning for example-brand/collateral (house sheet has no marker)', () => {
    const r = loadGovernanceVersion('example-brand', 'collateral');
    expect(r.version).toBe(UNVERSIONED);
    expect(typeof r.warning).toBe('string');
    expect((r.warning ?? '').length).toBeGreaterThan(0);
  });

  it('does not throw for an unknown client (website house dir still resolves)', () => {
    let r: ReturnType<typeof loadGovernanceVersion>;
    expect(() => {
      r = loadGovernanceVersion('__no_such_client__', 'website');
    }).not.toThrow();
    expect(typeof r!.version).toBe('string');
  });
});

describe('writeManifest', () => {
  it('round-trips a stable, sorted, trailing-newline manifest.json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'offscript-manifest-'));
    const manifest: RunManifest = {
      client: 'example-brand',
      track: 'website',
      generatedAt: '2026-06-22T12:00:00.000Z',
      governanceVersion: 'v2 RE-THEME — PROPOSED, gate-1 draft',
      governanceCssPath: 'resources/design_processes/website/colors_and_type.css',
      warnings: [],
    };
    writeManifest(dir, manifest);

    const raw = readFileSync(join(dir, 'manifest.json'), 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.governanceVersion).toBe('v2 RE-THEME — PROPOSED, gate-1 draft');
    // repo-relative: no drive letter, no leading slash
    expect(parsed.governanceCssPath).not.toMatch(/^([A-Za-z]:|\/)/);
    expect(Array.isArray(parsed.warnings)).toBe(true);
    expect(raw.endsWith('\n')).toBe(true);
    // keys are sorted (stable)
    const keys = Object.keys(parsed);
    expect(keys).toEqual([...keys].sort());
  });
});
