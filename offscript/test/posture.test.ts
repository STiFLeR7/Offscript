import { describe, it, expect } from 'vitest';
import { deriveBrandPosture } from '../src/posture.js';
import { loadTokensFromCss } from '../src/tokens.js';
import type { BrandContract } from '../src/operator.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { deriveBrandContract } from '../src/brand-contract.js';

const here = dirname(fileURLToPath(import.meta.url));

const SINGLE_ACCENT_CSS = `:root {
  --brand-blue: #2563eb;
  --fg: #1a1a1a;
  --bg: #ffffff;
}`;

const SINGLE_ACCENT_CONTRACT: BrandContract = {
  schemaVersion: 1,
  subject: 'cr-like',
  generatedAt: '2026-05-29T00:00:00.000Z',
  decidedBy: 'auto',
  slots: {
    '--accent': { token: '--brand-blue', confidence: 'auto' },
    '--accent-2': null,
  },
};

describe('deriveBrandPosture', () => {
  it('derives a single-accent, restrained posture from a one-accent kit', () => {
    const tokens = loadTokensFromCss(SINGLE_ACCENT_CSS);
    const p = deriveBrandPosture({ tokens, brandContract: SINGLE_ACCENT_CONTRACT });

    expect(p.allowedAccentCount).toBe(1);
    expect(p.accentUsageBudget).toBeCloseTo(0.1, 5);
    expect(p.saturationCeiling).toBeGreaterThan(0.5);
    expect(p.saturationCeiling).toBeLessThanOrEqual(1);
    expect(p.confidence).toBe('auto');
  });

  it('falls back to a neutral ceiling when no --accent is mapped', () => {
    const tokens = loadTokensFromCss(':root { --x: #ffffff; }');
    const p = deriveBrandPosture({ tokens, brandContract: undefined });
    expect(p.allowedAccentCount).toBe(1);
    expect(p.saturationCeiling).toBeCloseTo(0.7, 5);
    expect(p.accentUsageBudget).toBeCloseTo(0.1, 5);
  });
});

describe('deriveBrandPosture — brand generalization', () => {
  it('derives a louder, multi-accent posture for a loud (any-sector) brand than for CR', () => {
    const loudCss = readFileSync(
      join(here, '..', 'fixtures', 'loud-kit', 'colors_and_type.css'),
      'utf8',
    );
    const loudTokens = loadTokensFromCss(loudCss);
    const loudContract = deriveBrandContract(loudCss, { subject: 'loud' });
    const loud = deriveBrandPosture({ tokens: loudTokens, brandContract: loudContract });

    const crTokens = loadTokensFromCss(SINGLE_ACCENT_CSS);
    const cr = deriveBrandPosture({ tokens: crTokens, brandContract: SINGLE_ACCENT_CONTRACT });

    expect(loud.allowedAccentCount).toBe(2);
    expect(cr.allowedAccentCount).toBe(1);
    expect(loud.accentUsageBudget).toBeGreaterThan(cr.accentUsageBudget);
    expect(loud.saturationCeiling).toBeGreaterThan(cr.saturationCeiling - 0.0001);
  });
});

describe('deriveBrandPosture — creative-direction overrides', () => {
  const tokens = loadTokensFromCss(SINGLE_ACCENT_CSS);

  it('overrides density and motion from a creative-direction block', () => {
    const creativeDirection = [
      '# Creative direction',
      '',
      'density: dense',
      'motion: energetic',
    ].join('\n');
    const p = deriveBrandPosture({ tokens, brandContract: SINGLE_ACCENT_CONTRACT, creativeDirection });
    expect(p.densityBudget).toBe('dense');
    expect(p.motionPersonality).toBe('energetic');
  });

  it('ignores unknown keys and keeps defaults when no block present', () => {
    const p = deriveBrandPosture({ tokens, brandContract: SINGLE_ACCENT_CONTRACT, creativeDirection: 'just prose, no keys' });
    expect(p.densityBudget).toBe('balanced');
    expect(p.motionPersonality).toBe('balanced');
  });
});
