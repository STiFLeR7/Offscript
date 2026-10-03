import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseImageryManifest,
  imageryRole,
  resolveBrandKitImageryRole,
} from '../src/generate/imagery-manifest.js';
import { parseBrandKit } from '../src/brand-kit.js';

const FIXTURE = `
# imagery.md

| role           | mode        | file                        | scrim | notes                |
| -------------- | ----------- | --------------------------- | ----- | -------------------- |
| cover          | engine-cover| dark-tech-2.jpg             | navy  | calm dark-tech frame |
| hero-night     | author      | backgrounds/hero-bg-night.jpg|       | AI-strategy hero     |
| texture-grain  | author      | textures/texture-grain.png  |       | noise overlay        |
`;

describe('parseImageryManifest', () => {
  it('parses rows by header NAME (column order tolerant), ignoring notes', () => {
    const rows = parseImageryManifest(FIXTURE);
    expect(rows).toHaveLength(3);
    const cover = rows.find((r) => r.role === 'cover')!;
    expect(cover.file).toBe('dark-tech-2.jpg');
    expect(cover.mode).toBe('engine-cover');
    expect(cover.scrim).toBe('navy');
  });

  it('imageryRole returns the single matching row or null', () => {
    const rows = parseImageryManifest(FIXTURE);
    expect(imageryRole(rows, 'hero-night')?.file).toBe('backgrounds/hero-bg-night.jpg');
    expect(imageryRole(rows, 'nope')).toBeNull();
  });

  it('returns [] when no table is present', () => {
    expect(parseImageryManifest('# imagery\n\nno table here')).toEqual([]);
  });
});

describe('resolveBrandKitImageryRole — W79 Brand Kit imagery manifest resolution', () => {
  let tmp: string;
  afterEach(() => {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  function kitWithManifest(manifestPath: string) {
    return parseBrandKit(
      JSON.stringify({
        schemaVersion: 1,
        subject: 'fixture',
        logo: { lightSurfaceMark: 'a.svg', darkSurfaceMark: 'b.svg' },
        imageryManifest: manifestPath,
      }),
    );
  }

  it('resolves a role from the client manifest, joining file against kitDir', () => {
    tmp = mkdtempSync(join(tmpdir(), 'offscript-bki-'));
    writeFileSync(
      join(tmp, 'my-imagery.md'),
      '| role | mode | file | scrim | notes |\n|---|---|---|---|---|\n| cover | engine-cover | cover.jpg | navy | |\n',
      'utf8',
    );
    const kit = kitWithManifest('my-imagery.md');
    const resolved = resolveBrandKitImageryRole(kit, 'cover', tmp);
    expect(resolved).toBeDefined();
    expect(resolved!.row.file).toBe('cover.jpg');
    expect(resolved!.row.mode).toBe('engine-cover');
    expect(resolved!.absPath).toBe(join(tmp, 'cover.jpg'));
  });

  it('returns undefined when Brand Kit is absent', () => {
    expect(resolveBrandKitImageryRole(undefined, 'cover', '/anything')).toBeUndefined();
  });

  it('returns undefined when the Brand Kit has no imageryManifest field', () => {
    const kit = parseBrandKit(
      JSON.stringify({
        schemaVersion: 1,
        subject: 'fixture',
        logo: { lightSurfaceMark: 'a.svg', darkSurfaceMark: 'b.svg' },
      }),
    );
    expect(resolveBrandKitImageryRole(kit, 'cover', '/anything')).toBeUndefined();
  });

  it('returns undefined when the manifest file does not exist on disk (missing imagery entry)', () => {
    tmp = mkdtempSync(join(tmpdir(), 'offscript-bki-'));
    const kit = kitWithManifest('does-not-exist.md');
    expect(resolveBrandKitImageryRole(kit, 'cover', tmp)).toBeUndefined();
  });

  it('returns undefined when the manifest exists but has no row for the requested role (missing imagery entry)', () => {
    tmp = mkdtempSync(join(tmpdir(), 'offscript-bki-'));
    writeFileSync(
      join(tmp, 'my-imagery.md'),
      '| role | mode | file | scrim | notes |\n|---|---|---|---|---|\n| hero-night | author | night.jpg |  | |\n',
      'utf8',
    );
    const kit = kitWithManifest('my-imagery.md');
    expect(resolveBrandKitImageryRole(kit, 'cover', tmp)).toBeUndefined();
  });

  it('returns undefined when the matched row has an empty file', () => {
    tmp = mkdtempSync(join(tmpdir(), 'offscript-bki-'));
    writeFileSync(
      join(tmp, 'my-imagery.md'),
      '| role | mode | file | scrim | notes |\n|---|---|---|---|---|\n| cover | engine-cover |  | navy | |\n',
      'utf8',
    );
    const kit = kitWithManifest('my-imagery.md');
    expect(resolveBrandKitImageryRole(kit, 'cover', tmp)).toBeUndefined();
  });

  it('duplicate-key handling: the FIRST matching role wins, mirroring imageryRole/Array.find', () => {
    tmp = mkdtempSync(join(tmpdir(), 'offscript-bki-'));
    writeFileSync(
      join(tmp, 'my-imagery.md'),
      '| role | mode | file | scrim | notes |\n|---|---|---|---|---|\n' +
        '| cover | engine-cover | first.jpg | navy | |\n' +
        '| cover | engine-cover | second.jpg | navy | |\n',
      'utf8',
    );
    const kit = kitWithManifest('my-imagery.md');
    const resolved = resolveBrandKitImageryRole(kit, 'cover', tmp);
    expect(resolved!.row.file).toBe('first.jpg');
  });

  it('is deterministic: repeated resolution of the identical manifest agrees', () => {
    tmp = mkdtempSync(join(tmpdir(), 'offscript-bki-'));
    writeFileSync(
      join(tmp, 'my-imagery.md'),
      '| role | mode | file | scrim | notes |\n|---|---|---|---|---|\n| cover | engine-cover | cover.jpg | navy | |\n',
      'utf8',
    );
    const kit = kitWithManifest('my-imagery.md');
    const a = resolveBrandKitImageryRole(kit, 'cover', tmp);
    const b = resolveBrandKitImageryRole(kit, 'cover', tmp);
    expect(a).toEqual(b);
  });

  it('a malformed manifest table (no parseable rows) resolves to undefined, never throws', () => {
    tmp = mkdtempSync(join(tmpdir(), 'offscript-bki-'));
    writeFileSync(join(tmp, 'my-imagery.md'), 'not a table, just prose', 'utf8');
    const kit = kitWithManifest('my-imagery.md');
    expect(() => resolveBrandKitImageryRole(kit, 'cover', tmp)).not.toThrow();
    expect(resolveBrandKitImageryRole(kit, 'cover', tmp)).toBeUndefined();
  });
});
