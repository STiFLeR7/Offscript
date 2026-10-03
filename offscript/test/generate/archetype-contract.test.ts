/**
 * W85 — Selector Contract Unification.
 *
 * `archetype-contract.ts` is the ONE canonical archetype→serves table. Before this sprint,
 * `catalog.ts` (`ARCHETYPE_TO_SERVES`, feeding the fragment picker) and `website-composition.ts`
 * (`ARCHETYPE_INTENT`, feeding the composition router) each declared their own copy, coherent
 * only by a hand-maintained convention — and they had already drifted on `case-study`
 * (`social-proof` vs `testimonials`; see SPRINT-W84 §3.1). These tests pin: the canonical table
 * is total and correct, both consumers re-export/import the SAME object (not a copy), and no
 * second `Record<Archetype, string>` literal exists anywhere in `src/generate`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARCHETYPE_SERVES } from '../../src/generate/archetype-contract.js';
import { ARCHETYPE_TO_SERVES } from '../../src/generate/catalog.js';
import type { Archetype } from '../../src/archetype.js';

const ALL_ARCHETYPES: Archetype[] = [
  'hero',
  'sub-hero',
  'logo-bar',
  'feature-grid',
  'feature-spotlight',
  'process',
  'metrics',
  'testimonial',
  'testimonial-wall',
  'case-study',
  'pricing',
  'plan-comparison',
  'faq',
  'cta-banner',
  'footer',
  'editorial',
  'founder',
  'integrations',
  'contact',
  'resources',
];

describe('archetype-contract — ARCHETYPE_SERVES (W85 canonical table)', () => {
  it('is a TOTAL map — every one of the 20 closed archetypes has a serves value', () => {
    expect(Object.keys(ARCHETYPE_SERVES).sort()).toEqual([...ALL_ARCHETYPES].sort());
    for (const a of ALL_ARCHETYPES) {
      expect(typeof ARCHETYPE_SERVES[a]).toBe('string');
      expect(ARCHETYPE_SERVES[a].length).toBeGreaterThan(0);
    }
  });

  it('case-study regression — resolves to "testimonials", not the drifted "social-proof"', () => {
    // Governance evidence (SPRINT-W84 §3.1 + repository/canonical frontmatter):
    // case-carousel specializes concept:role:testimonials-case-studies (voice);
    // results-proof specializes concept:role:social-proof-logos (marks, not voice).
    // "case-study" is a customer-narrative archetype — testimonials-case-studies is correct.
    expect(ARCHETYPE_SERVES['case-study']).toBe('testimonials');
  });

  it('unknown archetype handling — an unrecognized key is simply absent (no throw, no invented entry)', () => {
    const bogus = 'not-a-real-archetype' as Archetype;
    expect(ARCHETYPE_SERVES[bogus]).toBeUndefined();
  });
});

describe('archetype-contract — single canonical source (structural guard)', () => {
  it('catalog.ts re-exports the SAME object as ARCHETYPE_TO_SERVES (reference-identical, not a copy)', () => {
    expect(ARCHETYPE_TO_SERVES).toBe(ARCHETYPE_SERVES);
  });

  it('exactly one archetype→serves table literal exists in src/generate — in archetype-contract.ts only', () => {
    // Scoped to the archetype→SERVES contract specifically (the W85 bug), not every
    // `Record<Archetype, …>` table in the codebase — archetype.ts documents several other
    // legitimate closed Archetype-keyed tables with a DIFFERENT value domain (e.g.
    // playbook-anchors.ts's `ARCHETYPE_PLAYBOOK_ANCHOR`, archetype → §3.N section reference;
    // narrative-arc-presence's STAGE; archetype-neighbour-collisions' MATRIX_KEY) — those are
    // out of scope and must NOT be flagged.
    const genDir = fileURLToPath(new URL('../../src/generate/', import.meta.url));
    const pattern = /(?:const|let|var)\s+(?:ARCHETYPE_TO_SERVES|ARCHETYPE_INTENT|ARCHETYPE_SERVES)\s*:\s*Record<Archetype,\s*string>\s*=\s*\{/g;
    const offenders: string[] = [];
    let totalMatches = 0;
    for (const name of readdirSync(genDir)) {
      if (!name.endsWith('.ts')) continue;
      const text = readFileSync(join(genDir, name), 'utf8');
      const matches = text.match(pattern);
      if (!matches) continue;
      totalMatches += matches.length;
      if (name !== 'archetype-contract.ts') offenders.push(name);
    }
    expect(offenders, `duplicate archetype→serves literal(s) found outside archetype-contract.ts: ${offenders.join(', ')}`).toEqual([]);
    expect(totalMatches).toBe(1);
  });

  it('website-composition.ts imports ARCHETYPE_SERVES from archetype-contract.ts (no local redeclaration)', () => {
    const path = fileURLToPath(new URL('../../src/generate/website-composition.ts', import.meta.url));
    const text = readFileSync(path, 'utf8');
    expect(text).toMatch(/from ['"]\.\/archetype-contract\.js['"]/);
    expect(text).not.toMatch(/const ARCHETYPE_INTENT:\s*Record<Archetype/);
  });

  it('catalog.ts imports ARCHETYPE_SERVES from archetype-contract.ts and only re-exports it BY REFERENCE (no local literal)', () => {
    const path = fileURLToPath(new URL('../../src/generate/catalog.ts', import.meta.url));
    const text = readFileSync(path, 'utf8');
    expect(text).toMatch(/from ['"]\.\/archetype-contract\.js['"]/);
    // A typed re-export (`= ARCHETYPE_SERVES`) is fine — a literal object (`= {`) is the bug this
    // sprint removes.
    expect(text).not.toMatch(/ARCHETYPE_TO_SERVES:\s*Record<Archetype,\s*string>\s*=\s*\{/);
  });
});
