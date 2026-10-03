import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { parseHtml } from '../../src/working-rep.js';
import { websiteStyleScope } from '../../src/operators/website-style-scope.js';
import { websiteCompositionGrammar } from '../../src/operators/website-composition-grammar.js';
import { selectExemplar } from '../../src/generate/author-contract.js';
import type { OperatorContext } from '../../src/operator.js';
import type { Archetype } from '../../src/archetype.js';

const FRAG_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../resources/design_processes/website/exemplars/fragments',
);
const ctx: OperatorContext = { params: {} };
const files = readdirSync(FRAG_DIR).filter((f) => f.endsWith('.html'));

const ARCHETYPES: Archetype[] = [
  'hero', 'sub-hero', 'logo-bar', 'feature-grid', 'feature-spotlight', 'process', 'metrics',
  'testimonial', 'testimonial-wall', 'case-study', 'pricing', 'plan-comparison', 'faq',
  'cta-banner', 'footer', 'editorial', 'founder', 'integrations', 'contact', 'resources',
];

describe('website exemplar fragments — provisioned + rail-clean (A3)', () => {
  it('ships exactly the 17 curated fragments', () => {
    expect(files.length).toBe(17);
  });

  it('every archetype resolves to a non-empty website exemplar', () => {
    for (const a of ARCHETYPES) {
      expect(selectExemplar(a, 'website'), `exemplar for "${a}"`).not.toBe('');
    }
  });

  for (const f of files) {
    it(`"${f}" passes B2 + B3 with zero escalations`, () => {
      const tree = parseHtml(readFileSync(join(FRAG_DIR, f), 'utf8'));
      const findings = [
        ...websiteStyleScope.detect(tree, ctx),
        ...websiteCompositionGrammar.detect(tree, ctx),
      ];
      const escalated = findings.filter((x) => x.outcome === 'escalated');
      expect(escalated, `${f}: ${escalated.map((x) => x.id).join(', ')}`).toHaveLength(0);
    });
  }
});
