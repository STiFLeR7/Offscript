import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planSync, runSync } from '../src/sync.js';

describe('planSync (pure)', () => {
  it('produces a write-plan spanning both the generic flatten and the section-library rename', () => {
    const plan = planSync([
      'brand-pack/ASSETS.md',
      'section-library/sections/hero-bento.html',
      'section-library/sections/accordion-panel-right.html',
      'governance/website/component-governance/verify-library.py', // excluded
      '.DS_Store', // excluded
    ]);
    expect(plan.writes.get('ASSETS.md')?.sourceRelPath).toBe('brand-pack/ASSETS.md');
    expect(plan.writes.get('exemplars/sections/component-hero-bento.html')?.sourceRelPath).toBe(
      'section-library/sections/hero-bento.html',
    );
    expect(plan.writes.get('exemplars/sections/component-feature-accordion.html')?.sourceRelPath).toBe(
      'section-library/sections/accordion-panel-right.html',
    );
    expect(plan.excludedSource).toContain('governance/website/component-governance/verify-library.py');
    expect(plan.excludedSource).toContain('.DS_Store');
    expect(plan.unmappedSource).toEqual([]);
  });

  it('marks COMPOSITION.md and components.md for content transform; nothing else', () => {
    const plan = planSync([
      'governance/website/component-governance/COMPOSITION.md',
      'governance/website/component-governance/components.md',
      'governance/website/component-governance/COMPOSE.md',
    ]);
    expect(plan.writes.get('component-governance/COMPOSITION.md')?.transform).toBe('composition');
    expect(plan.writes.get('component-governance/components.md')?.transform).toBe('components');
    expect(plan.writes.get('component-governance/COMPOSE.md')?.transform).toBeUndefined();
  });

  it('reports an unrecognized source shape as unmapped, never silently drops it', () => {
    const plan = planSync(['brand-pack/some-genuinely-new-file-type.xyz']);
    expect(plan.unmappedSource).toEqual(['brand-pack/some-genuinely-new-file-type.xyz']);
    expect(plan.writes.size).toBe(0);
  });
});

describe('runSync (integration, real temp dirs)', () => {
  let root: string;
  let sourceRoot: string;
  let targetRoot: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'wgs-test-'));
    sourceRoot = join(root, 'design/website');
    targetRoot = join(root, 'resources');

    const write = (relPath: string, content: string) => {
      const abs = join(sourceRoot, relPath);
      mkdirSync(join(abs, '..'), { recursive: true });
      writeFileSync(abs, content, 'utf8');
    };
    write('brand-pack/ASSETS.md', '# Assets\n');
    write('brand-pack/colors_and_type.css', ':root { --cr-ink: #000; }\n');
    write(
      'governance/website/component-governance/COMPOSITION.md',
      '| Component | File |\n|---|---|\n' +
        '| Hero · bento | `../../../section-library/sections/hero-bento.html` |\n' +
        '| Feature accordion | `../../../section-library/sections/accordion-panel-right.html` |\n',
    );
    write(
      'governance/website/component-governance/components.md',
      '## Variant appendix\n| Family | Variant | Angle |\n|---|---|---|\n' +
        '| Feature | accordion-panel-right | x |\n',
    );
    write('section-library/sections/hero-bento.html', '<section>hero</section>');
    write('section-library/sections/accordion-panel-right.html', '<section>accordion</section>');
    write('governance/website/component-governance/verify-library.py', 'print("excluded")');

    // an existing target with a preserve-list file + a true orphan already present
    mkdirSync(join(targetRoot, 'exemplars', 'fragments'), { recursive: true });
    writeFileSync(join(targetRoot, 'behavior.js'), '// house behaviour\n', 'utf8');
    writeFileSync(join(targetRoot, 'exemplars', 'fragments', 'hero.html'), '<div>frag</div>', 'utf8');
    writeFileSync(join(targetRoot, 'imagery.md'), 'role|mode|file\n', 'utf8');
    mkdirSync(join(targetRoot, 'rulebooks'), { recursive: true });
    writeFileSync(join(targetRoot, 'rulebooks', 'numerics.md'), '# orphan\n', 'utf8');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('writes the flattened files and applies the transform to COMPOSITION.md / components.md', () => {
    runSync({ sourceRoot, targetRoot });

    expect(readFileSync(join(targetRoot, 'ASSETS.md'), 'utf8')).toBe('# Assets\n');
    expect(existsSync(join(targetRoot, 'component-governance', 'verify-library.py'))).toBe(false);

    const composition = readFileSync(join(targetRoot, 'component-governance', 'COMPOSITION.md'), 'utf8');
    expect(composition).toContain('`component-hero-bento.html`');
    expect(composition).toContain('`component-feature-accordion.html`');
    expect(composition).not.toContain('section-library');

    const components = readFileSync(join(targetRoot, 'component-governance', 'components.md'), 'utf8');
    expect(components).toContain('| Feature | feature-accordion | x |');

    expect(existsSync(join(targetRoot, 'exemplars', 'sections', 'component-hero-bento.html'))).toBe(true);
    expect(existsSync(join(targetRoot, 'exemplars', 'sections', 'component-feature-accordion.html'))).toBe(true);
  });

  it('leaves the preserve-list byte-identical', () => {
    const before = readFileSync(join(targetRoot, 'behavior.js'));
    const beforeFrag = readFileSync(join(targetRoot, 'exemplars', 'fragments', 'hero.html'));

    runSync({ sourceRoot, targetRoot });

    expect(readFileSync(join(targetRoot, 'behavior.js'))).toEqual(before);
    expect(readFileSync(join(targetRoot, 'exemplars', 'fragments', 'hero.html'))).toEqual(beforeFrag);
  });

  it('reports the true orphan (numerics.md) as unaccounted, and does not delete it', () => {
    const result = runSync({ sourceRoot, targetRoot });
    expect(result.unaccounted).toContain('rulebooks/numerics.md');
    expect(existsSync(join(targetRoot, 'rulebooks', 'numerics.md'))).toBe(true);
  });

  it('dry-run computes the same plan but writes nothing', () => {
    const before = existsSync(join(targetRoot, 'ASSETS.md'));
    const result = runSync({ sourceRoot, targetRoot, dryRun: true });
    expect(before).toBe(false);
    expect(existsSync(join(targetRoot, 'ASSETS.md'))).toBe(false); // still not written
    expect(result.written).toContain('ASSETS.md'); // but the plan reports it WOULD be
    expect(result.dryRun).toBe(true);
  });

  it('is idempotent — a second run over an already-synced target changes nothing further', () => {
    runSync({ sourceRoot, targetRoot });
    const snapshot = new Map(
      readdirSync(targetRoot, { recursive: true } as any)
        .filter((f) => typeof f === 'string')
        .map((f) => [f as string, null]),
    );

    const second = runSync({ sourceRoot, targetRoot });
    const afterFiles = readdirSync(targetRoot, { recursive: true } as any).filter((f) => typeof f === 'string');

    expect(afterFiles.sort()).toEqual([...snapshot.keys()].sort());
    expect(second.written.length).toBeGreaterThan(0); // still "writes" (overwrite-with-same-content), byte-identical
  });

  it('repeated sync is byte-identical: re-running produces the exact same file contents', () => {
    runSync({ sourceRoot, targetRoot });
    const first = readFileSync(join(targetRoot, 'component-governance', 'COMPOSITION.md'), 'utf8');

    runSync({ sourceRoot, targetRoot });
    const second = readFileSync(join(targetRoot, 'component-governance', 'COMPOSITION.md'), 'utf8');

    expect(second).toBe(first);
  });

  it('throws loud on an unmapped source file rather than silently dropping it', () => {
    writeFileSync(join(sourceRoot, 'brand-pack', 'a-genuinely-new-shape.xyz'), 'x', 'utf8');
    expect(() => runSync({ sourceRoot, targetRoot })).toThrow(/unmapped|matched no/i);
  });
});
