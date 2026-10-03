import { describe, it, expect } from 'vitest';
import { ALL_ARCHETYPES } from '../src/operators/archetype-tag.js';
import { ARCHETYPE_PLAYBOOK_ANCHOR, playbookAnchorFor } from '../src/generate/playbook-anchors.js';
import { loadPlaybook } from '../src/playbook.js';

// The static archetype → §3.N anchor map (ARCHETYPE_PLAYBOOK_ANCHOR) lives in code and
// is validated here directly — independent of any playbook file on disk.
describe('playbook anchors (C-2: archetype → §3.N wiring, static map)', () => {
  it('maps every archetype to a §3.N anchor (totality)', () => {
    for (const a of ALL_ARCHETYPES) {
      expect(playbookAnchorFor(a), `no anchor for archetype "${a}"`).toMatch(/^§3\.\d+$/);
    }
  });

  it('has exactly one entry per archetype and no extras', () => {
    expect(Object.keys(ARCHETYPE_PLAYBOOK_ANCHOR).sort()).toEqual([...ALL_ARCHETYPES].sort());
  });

  it('returns undefined for a non-website (collateral) archetype', () => {
    expect(playbookAnchorFor('CoverPage')).toBeUndefined();
    expect(playbookAnchorFor('cover')).toBeUndefined();
  });
});

// Post-website-pivot (#46): these two cases resolve archetype anchors against the real
// SECTION_INTELLIGENCE.md, which the author-from-governance layout no longer ships. They
// stay skipped (dormant, not deleted) — they reactivate if/when a section-intelligence
// playbook is re-supplied for the harden path.
describe.skip('playbook anchors — resolution against the real playbook (dormant post-pivot)', () => {
  it('resolves every anchor to a real section block in the loaded playbook', () => {
    const playbook = loadPlaybook();
    for (const a of ALL_ARCHETYPES) {
      const anchor = playbookAnchorFor(a)!;
      expect(playbook.has(anchor), `playbook missing ${anchor} (archetype "${a}")`).toBe(true);
      expect(playbook.get(anchor)!.length, `${anchor} excerpt is empty`).toBeGreaterThan(0);
    }
  });

  it('delivers verbatim governance, not just a key (hero → §3.1)', () => {
    const playbook = loadPlaybook();
    const excerpt = playbook.get(playbookAnchorFor('hero')!)!;
    expect(excerpt).toContain('### 3.1');
    expect(excerpt.toLowerCase()).toContain('hero');
  });
});
