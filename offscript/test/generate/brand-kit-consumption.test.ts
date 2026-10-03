/**
 * Sprint W77 — Brand Kit Consumption (existing override integration).
 *
 * W77's investigation (see docs/internals/SPRINT-W77-BRAND-KIT-CONSUMPTION.md §1) found that the
 * colors/typography/spacing/motion domain has exactly ONE transport mechanism —
 * `DesignContext.brandContract` + `DesignContext.tokens`, populated once in `buildContext` via the
 * already-wired `resolveBrandContract`/`loadTokensFromCss`/`loadBrandContract` — and that `validate()`
 * (this file's target) is the sole bridge that forwards it into the rails' `OperatorContext`
 * (`buildOperatorContext({ tokens: context.tokens, brandContract: context.brandContract, ... })`,
 * validate.ts:154-158). `DesignContext.brandKit` (W76) deliberately carries none of this domain's
 * data (W75 §2.1) — there is no separate "Brand Kit" color/type/spacing/motion field to migrate a
 * consumer TO. This file proves the ALREADY-EXISTING mechanism is genuinely, exclusively consumed —
 * using the falsification discipline W53 established: fabricate a client override value the house
 * default could never produce, and confirm it (not the house default) is what a real rail measures.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectDir, projectReferencesDir } from '../../src/paths.js';
import { buildContext } from '../../src/generate/context.js';
import { validate } from '../../src/generate/validate.js';

const FIXTURE_CLIENT = '__w77_brand_kit_consumption__';

afterEach(() => {
  rmSync(projectDir(FIXTURE_CLIENT), { recursive: true, force: true });
});

/** 10 accent inkings + 2 non-accent inkings (12 total, 83% ratio — well over the 10% budget). */
function fabricatedHtml(): string {
  const accentDecls = Array.from({ length: 10 }, (_, i) => `.acc${i}{color:var(--fixture-accent)}`).join('\n');
  return `<html><head><style>${accentDecls}\n.n1{color:#000}\n.n2{color:#000}</style></head><body><div>content</div></body></html>`;
}

function scaffoldFixtureWithBrandContract(): void {
  const refs = projectReferencesDir(FIXTURE_CLIENT);
  mkdirSync(refs, { recursive: true });
  writeFileSync(join(refs, 'colors_and_type.css'), ':root { --fixture-accent: #ff00ff; }', 'utf8');
  writeFileSync(
    join(refs, 'brand-contract.json'),
    JSON.stringify({
      schemaVersion: 1,
      subject: FIXTURE_CLIENT,
      generatedAt: '2026-07-01T00:00:00.000Z',
      decidedBy: 'human',
      slots: { '--accent': { token: '--fixture-accent', confidence: 'human' } },
    }),
    'utf8',
  );
}

function writeBrandKit(): void {
  writeFileSync(
    join(projectReferencesDir(FIXTURE_CLIENT), 'brand-kit.json'),
    JSON.stringify({
      schemaVersion: 1,
      subject: FIXTURE_CLIENT,
      logo: { lightSurfaceMark: 'a.svg', darkSurfaceMark: 'b.svg' },
      imageryManifest: 'imagery.md',
      iconography: { convention: 'monoline-inline-svg' },
      voiceReference: 'voice.md',
    }),
    'utf8',
  );
}

async function runValidate(html: string) {
  const outDir = mkdtempSync(join(tmpdir(), 'offscript-w77-'));
  try {
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const result = await validate(html, ctx, { outDir });
    return result.perRail.find((r) => r.operator.name === 'accent-saturation-budget');
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

describe('W77 — validate() genuinely consumes DesignContext.brandContract/tokens (falsification)', () => {
  it('a fabricated client override (--accent → --fixture-accent) drives a real rail escalation the house default could never produce', async () => {
    scaffoldFixtureWithBrandContract();
    const rail = await runValidate(fabricatedHtml());
    expect(rail).toBeDefined();
    expect(rail!.findings.some((f) => f.outcome === 'escalated')).toBe(true);
    expect(rail!.findings.some((f) => f.id.startsWith('accent-saturation-budget:over:'))).toBe(true);
  });

  it('fallback to today\'s behaviour: a bare client (no brand-contract.json) still warns, never crashes', async () => {
    // No colors_and_type.css / brand-contract.json at all — house fallback, ctx.brandContract === null.
    mkdirSync(projectReferencesDir(FIXTURE_CLIENT), { recursive: true });
    const rail = await runValidate(fabricatedHtml());
    expect(rail).toBeDefined();
    expect(rail!.findings.some((f) => f.id === 'accent-saturation-budget:no-accent-slot')).toBe(true);
    expect(rail!.findings.some((f) => f.outcome === 'escalated')).toBe(false);
  });

  it('isolation: a present Brand Kit (logo/imagery/icon/voice) does not alter the accent-saturation finding at all', async () => {
    scaffoldFixtureWithBrandContract();
    const without = await runValidate(fabricatedHtml());
    writeBrandKit();
    const withKit = await runValidate(fabricatedHtml());
    expect(withKit).toEqual(without);
  });

  it('a present Brand Kit does not change whether ctx.brandContract/ctx.tokens resolve (transport is independent)', () => {
    scaffoldFixtureWithBrandContract();
    const before = buildContext(FIXTURE_CLIENT, 'website');
    writeBrandKit();
    const after = buildContext(FIXTURE_CLIENT, 'website');
    expect(after.brandContract).toEqual(before.brandContract);
    expect(after.tokens.customProps).toEqual(before.tokens.customProps);
    expect(after.brandKit).toBeDefined();
    expect(before.brandKit).toBeUndefined();
  });

  it('deterministic replay: two validate() runs over identical html+context agree on the accent rail', async () => {
    scaffoldFixtureWithBrandContract();
    const html = fabricatedHtml();
    const a = await runValidate(html);
    const b = await runValidate(html);
    expect(a).toEqual(b);
  });
});
