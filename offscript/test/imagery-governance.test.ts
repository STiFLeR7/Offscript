import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadImageryManifest, imageryRole } from '../src/generate/imagery-manifest.js';
import { designPrinciplesDir, designProcessesDir } from '../src/paths.js';

describe('imagery governance is vendored + consistent', () => {
  it('collateral imagery.md has a cover row whose file exists on disk', () => {
    const rows = loadImageryManifest('collateral');
    const cover = imageryRole(rows, 'cover')!;
    expect(cover).toBeTruthy();
    expect(cover.mode).toBe('engine-cover');
    const abs = join(designPrinciplesDir(), 'assets', 'imagery', cover.file);
    expect(existsSync(abs)).toBe(true);
  });

  it('website imagery.md author rows all resolve in the website imagery dir', () => {
    const rows = loadImageryManifest('website');
    const base = join(designProcessesDir('website'), 'assets', 'imagery');
    const authorRows = rows.filter((r) => r.mode === 'author');
    expect(authorRows.length).toBeGreaterThan(0);
    for (const r of authorRows) {
      expect(existsSync(join(base, r.file)), `missing ${r.file}`).toBe(true);
    }
  });

  it('hero-bg-night.jpg is vendored into website governance', () => {
    const p = join(designProcessesDir('website'), 'assets', 'imagery', 'backgrounds', 'hero-bg-night.jpg');
    expect(existsSync(p)).toBe(true);
  });
});
