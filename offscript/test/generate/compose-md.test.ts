import { describe, it, expect } from 'vitest';
import { parseSkeletons, skeletonForIntent, loadComposeSkeletons } from '../../src/generate/compose-md.js';

const MD = `## §B. Section Skeletons (slots per intent)

- **Hero** — \`[nav-bar]\` + \`[headline-cluster]\` + \`[cta-row | form-block]\` + \`[creative-panel]?\`
- **Feature** — \`[headline-cluster]\` + \`[proof: card-grid | bento-tiles]\` + \`[cta-row]?\`

The same skeleton…
`;

describe('compose-md skeleton parser (A4)', () => {
  it('parses §B bullets into intent + ordered slots', () => {
    const sk = parseSkeletons(MD);
    expect(sk.find((s) => s.intent === 'hero')?.slots).toEqual(
      ['[nav-bar]', '[headline-cluster]', '[cta-row | form-block]', '[creative-panel]?'],
    );
  });

  it('maps a serves-intent to its nearest §B skeleton', () => {
    const sk = parseSkeletons(MD);
    expect(skeletonForIntent('feature', sk)?.intent).toBe('feature');
    expect(skeletonForIntent('value-prop', sk)?.intent).toBe('feature'); // alias → Feature
  });

  it('captures an optional `?` that sits outside the backticks (real-file form)', () => {
    const sk = parseSkeletons('- **Hero** — `[nav-bar]` + `[logo-row]`?\n');
    expect(sk.find((s) => s.intent === 'hero')?.slots).toEqual(['[nav-bar]', '[logo-row]?']);
  });

  it('ignores a non-skeleton bold bullet (whitelist gate), incl. the hyphen separator', () => {
    const sk = parseSkeletons('- **Glossary** - see the appendix\n- **Note** — not a section\n');
    expect(sk).toHaveLength(0);
  });

  it('loads the real COMPOSE.md (fail-loud smoke)', () => {
    expect(loadComposeSkeletons().length).toBeGreaterThanOrEqual(10);
  });
});
