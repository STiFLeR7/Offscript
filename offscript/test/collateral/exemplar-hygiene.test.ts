import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { designProcessesDir } from '../../src/paths.js';

const FRAGS = ['cover.html', 'content.html', 'stats.html', 'closing.html'];
const BANNED = [
  'Dr. Scribe', 'An autonomous digital worker', 'Figures illustrative',
  'Agentic Process Automation', 'clinician', 'Clinician', 'physician',
  'EHR', 'HIPAA', 'athenahealth', 'Epic', 'Cerner',
];

describe('collateral exemplar fragments are decontaminated', () => {
  for (const f of FRAGS) {
    it(`${f} contains no cross-project strings`, () => {
      const html = readFileSync(
        join(designProcessesDir('collateral'), 'exemplars', 'fragments', f),
        'utf8',
      );
      for (const s of BANNED) expect(html).not.toContain(s);
    });
    it(`${f} contains no author-authored .cr-page-foot (engine owns the footer)`, () => {
      const html = readFileSync(
        join(designProcessesDir('collateral'), 'exemplars', 'fragments', f),
        'utf8',
      );
      expect(html).not.toContain('cr-page-foot');
    });
  }
});
