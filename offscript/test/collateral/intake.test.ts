import { describe, it, expect } from 'vitest';
import { intakeCollateral, isCollateral } from '../../src/collateral/intake.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', '..', 'fixtures', 'collateral-kit');

describe('intakeCollateral', () => {
  it('recognizes a .cr-doc artifact', () => {
    expect(isCollateral(readFileSync(join(dir, 'clean.html'), 'utf8'))).toBe(true);
    expect(isCollateral('<main><p>hi</p></main>')).toBe(false);
  });
  it('inlines the linked stylesheet into a <style> block (no surviving <link>)', () => {
    const html = readFileSync(join(dir, 'clean.html'), 'utf8');
    const { selfContained, pageCount } = intakeCollateral(html, dir);
    expect(selfContained).toContain('<style');
    expect(selfContained).toContain('--cr-electric:#149DFF');
    expect(selfContained).not.toMatch(/<link[^>]+stylesheet/i);
    expect(pageCount).toBe(2);
  });
});
