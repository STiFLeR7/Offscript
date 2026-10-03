/**
 * Exemplar-fidelity sprint — Example Brand's own real, already-authoritative typography/color source
 * (`design/website/brand-pack/colors_and_type.css`) is what the Creative Authoring prompt should
 * ground its type/color guidance in — never a value invented by the LLM author, never copied from
 * the historical Repo B reference system. Mirrors `environment-library.ts`'s own established
 * pattern: read the REAL file, resolve REAL values, perform NO selection/decision.
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolveBrandTypography, brandTypographyCssPath } from '../src/brand-typography.js';

describe('resolveBrandTypography — real Example Brand typography', () => {
  it('the source file it reads actually exists on disk', () => {
    expect(existsSync(brandTypographyCssPath())).toBe(true);
  });

  it('resolves the real, single authoritative typeface — Instrument Sans', () => {
    const typography = resolveBrandTypography();
    expect(typography).toBeDefined();
    expect(typography?.fontFamily).toBe('Instrument Sans');
  });

  it('resolves a real font file that exists on disk', () => {
    const typography = resolveBrandTypography();
    expect(typography).toBeDefined();
    expect(existsSync(typography!.fontFilePath)).toBe(true);
  });

  it('resolves the real weight range (400-700), never an invented step', () => {
    const typography = resolveBrandTypography();
    expect(typography?.fontWeightRange).toEqual([400, 700]);
  });

  it('resolves the real accent hex — never an invented color', () => {
    const typography = resolveBrandTypography();
    expect(typography?.accentHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(typography?.accentHex).toBe('#FF7926');
  });

  it('resolves the real text-primary/secondary/muted hexes', () => {
    const typography = resolveBrandTypography();
    expect(typography?.textPrimaryHex).toBe('#2A2A2A');
    expect(typography?.textSecondaryHex).toBe('#626262');
    expect(typography?.textMutedHex).toBe('#8B8B8B');
  });

  it('resolves a real type-scale ratio between the largest heading and the supporting/micro size', () => {
    const typography = resolveBrandTypography();
    expect(typography?.headingPx).toBeGreaterThan(0);
    expect(typography?.supportingPx).toBeGreaterThan(0);
    // The sourced discipline requires hero >= 4x the micro register — assert the REAL brand scale
    // actually clears that bar, so the prompt can honestly cite it as evidence, not assert it blind.
    expect(typography!.headingPx / typography!.supportingPx).toBeGreaterThanOrEqual(4);
  });
});
