import { describe, it, expect } from 'vitest';
import { detectKitLayout } from '../src/intake.js';
import { fileURLToPath } from 'node:url';
import { join, dirname, basename } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, '..', 'fixtures', 'website-kit');

/** Copy the canonical fixture into a throwaway temp dir we can mutate per-test. */
function freshKit(): string {
  const dir = mkdtempSync(join(tmpdir(), 'offscript-kit-'));
  cpSync(fixture, dir, { recursive: true });
  return dir;
}

describe('detectKitLayout', () => {
  it('recognizes a valid website kit and returns a typed descriptor', () => {
    const kit = detectKitLayout(fixture);
    expect(kit.dir).toBe(fixture);
    expect(kit.harnessHtml).toContain('<div id="root">');
    expect(kit.tokensCss).toContain('--cr-accent');
    expect(kit.componentFiles).toHaveLength(2);
    expect(kit.componentFiles.map((p) => basename(p))).toEqual(['Footer.jsx', 'Header.jsx']);
    expect(kit.assetsDir).toBe(join(fixture, 'assets'));
    expect(kit.fontsDir).toBeNull();
  });

  it('resolves fontsDir when fonts/ exists', () => {
    const dir = freshKit();
    try {
      mkdirSync(join(dir, 'fonts'));
      writeFileSync(join(dir, 'fonts', 'Inter.woff2'), 'x');
      const kit = detectKitLayout(dir);
      expect(kit.fontsDir).toBe(join(dir, 'fonts'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns null for assetsDir/fontsDir when neither exists', () => {
    const dir = freshKit();
    try {
      rmSync(join(dir, 'assets'), { recursive: true, force: true });
      const kit = detectKitLayout(dir);
      expect(kit.assetsDir).toBeNull();
      expect(kit.fontsDir).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('excludes a directory named *.jsx from componentFiles', () => {
    const dir = freshKit();
    try {
      mkdirSync(join(dir, 'ui_kits', 'website', 'Widget.jsx'));
      const kit = detectKitLayout(dir);
      expect(kit.componentFiles.map((p) => basename(p))).toEqual(['Footer.jsx', 'Header.jsx']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a kit missing colors_and_type.css with a specific reason', () => {
    const dir = freshKit();
    try {
      rmSync(join(dir, 'colors_and_type.css'), { force: true });
      expect(() => detectKitLayout(dir)).toThrow(/colors_and_type\.css/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a kit missing ui_kits/website/index.html with a specific reason', () => {
    const dir = freshKit();
    try {
      rmSync(join(dir, 'ui_kits', 'website', 'index.html'), { force: true });
      expect(() => detectKitLayout(dir)).toThrow(/index\.html/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('leaves creativeDirection undefined when no creative-direction.md exists', () => {
    const kit = detectKitLayout(fixture);
    expect(kit.creativeDirection).toBeUndefined();
  });

  it('reads creative-direction.md verbatim into creativeDirection when present', () => {
    const dir = freshKit();
    try {
      const body = '# CR direction\n\nMinimal, editorial, low-saturation.\n';
      writeFileSync(join(dir, 'creative-direction.md'), body);
      const kit = detectKitLayout(dir);
      expect(kit.creativeDirection).toBe(body);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a kit with no *.jsx component with a specific reason', () => {
    const dir = freshKit();
    try {
      rmSync(join(dir, 'ui_kits', 'website', 'Header.jsx'), { force: true });
      rmSync(join(dir, 'ui_kits', 'website', 'Footer.jsx'), { force: true });
      expect(() => detectKitLayout(dir)).toThrow(/jsx/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
