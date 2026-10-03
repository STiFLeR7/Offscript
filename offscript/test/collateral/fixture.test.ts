import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', '..', 'fixtures', 'collateral-kit');
describe('collateral-kit fixture', () => {
  it('clean + dirty both load and reference the token css', () => {
    for (const f of ['clean.html', 'dirty.html']) {
      const html = readFileSync(join(dir, f), 'utf8');
      expect(html).toContain('class="cr-doc"');
      expect(html).toContain('colors_and_type.css');
    }
  });
});
