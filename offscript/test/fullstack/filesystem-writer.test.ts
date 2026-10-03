/**
 * F8 — Filesystem Writer (RED-first).
 *
 * GeneratedProject → real files on disk. The first Program-F module that touches `node:fs` for
 * writing — every prior module (F5/F6) deliberately avoided it. Writes exactly what it is given,
 * unconditionally overwriting whatever exists; never transforms content, never reorders artifacts,
 * never regenerates.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GeneratedProject } from '../../src/fullstack/project-generator.js';
import { createFilesystemWriter } from '../../src/fullstack/filesystem-writer.js';

function fixtureProject(overrides: Partial<GeneratedProject> = {}): GeneratedProject {
  const base: GeneratedProject = {
    files: [
      { path: 'package.json', kind: 'config', content: '{\n  "name": "fixture"\n}\n', digest: 'digest-a' },
      { path: 'app/page.tsx', kind: 'component', content: 'export default function Page() {}\n', digest: 'digest-b' },
      { path: 'app/globals.css', kind: 'style', content: '* { box-sizing: border-box; }\n', digest: 'digest-c' },
    ],
    directories: ['app'],
    diagnostics: [],
    manifest: { generator: 'fixture', sourceModelDigest: 'model-digest', fileCount: 3, directoryCount: 1, diagnosticCount: 0 },
    digest: 'fixture-project-digest',
  };
  return { ...base, ...overrides };
}

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFilesRecursive(full).map((p) => join(entry, p)));
    else out.push(entry);
  }
  return out.sort();
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'offscript-f8-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('F8 — createFilesystemWriter — writing rules', () => {
  it('creates the target directory and every GeneratedProject.directories entry', () => {
    const target = join(dir, 'out');
    createFilesystemWriter().write(fixtureProject(), target);
    expect(existsSync(target)).toBe(true);
    expect(existsSync(join(target, 'app'))).toBe(true);
  });

  it('writes every artifact\'s content verbatim — byte-for-byte, nothing transformed', () => {
    const target = join(dir, 'out');
    const project = fixtureProject();
    createFilesystemWriter().write(project, target);
    for (const artifact of project.files) {
      expect(readFileSync(join(target, artifact.path), 'utf8')).toBe(artifact.content);
    }
  });

  it('preserves artifact ordering in the returned WriteResult — never re-sorts', () => {
    const project = fixtureProject();
    const result = createFilesystemWriter().write(project, join(dir, 'out'));
    expect(result.writtenFiles).toEqual(project.files.map((f) => f.path));
    expect(result.createdDirectories).toEqual(project.directories);
  });

  it('is deterministic — repeated writes to a fresh clean directory produce an identical file tree', () => {
    const project = fixtureProject();
    const targetA = join(dir, 'a');
    const targetB = join(dir, 'b');
    createFilesystemWriter().write(project, targetA);
    createFilesystemWriter().write(project, targetB);
    expect(listFilesRecursive(targetA)).toEqual(listFilesRecursive(targetB));
    for (const f of project.files) {
      expect(readFileSync(join(targetA, f.path), 'utf8')).toBe(readFileSync(join(targetB, f.path), 'utf8'));
    }
  });

  it('sourceDigest in the WriteResult traces back to GeneratedProject.digest', () => {
    const project = fixtureProject();
    const result = createFilesystemWriter().write(project, join(dir, 'out'));
    expect(result.sourceDigest).toBe(project.digest);
  });

  it('returns a frozen WriteResult', () => {
    const result = createFilesystemWriter().write(fixtureProject(), join(dir, 'out'));
    expect(Object.isFrozen(result)).toBe(true);
  });
});

describe('F8 — createFilesystemWriter — diagnostics', () => {
  it('reports an info diagnostic when the target directory is newly created', () => {
    const result = createFilesystemWriter().write(fixtureProject(), join(dir, 'fresh'));
    expect(result.diagnostics.some((d) => d.level === 'info' && /created target directory/i.test(d.message))).toBe(true);
  });

  it('reports a warning diagnostic when the target directory already existed (overwrite)', () => {
    const target = join(dir, 'existing');
    const writer = createFilesystemWriter();
    writer.write(fixtureProject(), target);
    const second = writer.write(fixtureProject(), target);
    expect(second.diagnostics.some((d) => d.level === 'warning' && /already existed/i.test(d.message))).toBe(true);
  });

  it('reports a warning diagnostic when GeneratedProject has zero files', () => {
    const result = createFilesystemWriter().write(fixtureProject({ files: [], directories: [] }), join(dir, 'out'));
    expect(result.diagnostics.some((d) => d.level === 'warning' && /zero files/i.test(d.message))).toBe(true);
    expect(result.writtenFiles).toEqual([]);
  });
});

describe('F8 — createFilesystemWriter — failure reporting', () => {
  it('fails loudly and refuses to write an artifact path that escapes the target directory', () => {
    const project = fixtureProject({ files: [{ path: '../escape.txt', kind: 'config', content: 'x', digest: 'd' }] });
    expect(() => createFilesystemWriter().write(project, join(dir, 'out'))).toThrow(/unsafe|outside/i);
  });

  it('fails loudly and names the failing path when a real filesystem error occurs', () => {
    const blockingFile = join(dir, 'blocked');
    writeFileSync(blockingFile, 'not a directory', 'utf8');
    expect(() => createFilesystemWriter().write(fixtureProject(), blockingFile)).toThrow(/blocked/);
  });
});
