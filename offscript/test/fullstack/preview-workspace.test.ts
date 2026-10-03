/**
 * F9 — Preview Workspace (RED-first).
 *
 * Read-only discovery/inspection over F8's on-disk convention (`projects/<client>/<track>/fullstack/`).
 * Never generates, never transforms, never writes project files.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadPreviewWorkspace,
  loadPreviewProject,
  createWorkspaceResolver,
  createWorkspaceLoader,
} from '../../src/fullstack/preview-workspace.js';

function writeProject(root: string, client: string, track: string, files: Record<string, string>): string {
  const dir = join(root, client, track, 'fullstack');
  mkdirSync(dir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content, 'utf8');
  }
  return dir;
}

const NEXTJS_PACKAGE_JSON = JSON.stringify({ name: 'fixture', dependencies: { next: '^15.0.0', react: '^19.0.0' } });

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'offscript-f9-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('F9 — loadPreviewWorkspace — discovery', () => {
  it('discovers every generated project under the projects root', () => {
    writeProject(root, 'forgeline', 'website', { 'package.json': NEXTJS_PACKAGE_JSON, 'app/page.tsx': 'x' });
    writeProject(root, 'veyra', 'website', { 'package.json': NEXTJS_PACKAGE_JSON, 'app/page.tsx': 'x' });
    const workspace = loadPreviewWorkspace(root);
    expect(workspace.manifest.projectCount).toBe(2);
    expect(workspace.manifest.projects.map((p) => p.client)).toEqual(['forgeline', 'veyra']);
  });

  it('only picks tracks that actually have a fullstack/ directory', () => {
    writeProject(root, 'forgeline', 'website', { 'package.json': NEXTJS_PACKAGE_JSON });
    mkdirSync(join(root, 'forgeline', 'collateral'), { recursive: true }); // no fullstack/ inside
    const workspace = loadPreviewWorkspace(root);
    expect(workspace.manifest.projectCount).toBe(1);
    expect(workspace.manifest.projects[0].track).toBe('website');
  });

  it('returns an empty manifest, not a throw, when the projects root does not exist', () => {
    const workspace = loadPreviewWorkspace(join(root, 'does-not-exist'));
    expect(workspace.manifest.projectCount).toBe(0);
    expect(workspace.manifest.projects).toEqual([]);
  });
});

describe('F9 — loadPreviewWorkspace — ordering', () => {
  it('sorts projects by client, then by track — deterministic regardless of filesystem enumeration order', () => {
    writeProject(root, 'veyra', 'website', { 'package.json': NEXTJS_PACKAGE_JSON });
    writeProject(root, 'champion-accountants', 'collateral', { 'package.json': NEXTJS_PACKAGE_JSON });
    writeProject(root, 'forgeline', 'website', { 'package.json': NEXTJS_PACKAGE_JSON });
    const workspace = loadPreviewWorkspace(root);
    expect(workspace.manifest.projects.map((p) => `${p.client}/${p.track}`)).toEqual([
      'champion-accountants/collateral',
      'forgeline/website',
      'veyra/website',
    ]);
  });
});

describe('F9 — loadPreviewWorkspace — replay', () => {
  it('produces an identical digest for the same on-disk project across repeated loads', () => {
    writeProject(root, 'forgeline', 'website', { 'package.json': NEXTJS_PACKAGE_JSON, 'app/page.tsx': 'export default function Page() {}' });
    const first = loadPreviewWorkspace(root).manifest.projects[0];
    const second = loadPreviewWorkspace(root).manifest.projects[0];
    expect(second.digest).toBe(first.digest);
    expect(second).toEqual(first);
  });

  it('produces a different digest when the on-disk content changes', () => {
    writeProject(root, 'forgeline', 'website', { 'package.json': NEXTJS_PACKAGE_JSON });
    const before = loadPreviewWorkspace(root).manifest.projects[0];
    mkdirSync(join(root, 'forgeline', 'website', 'fullstack', 'app'), { recursive: true });
    writeFileSync(join(root, 'forgeline', 'website', 'fullstack', 'app', 'page.tsx'), 'export default function Page() {}', 'utf8');
    const after = loadPreviewWorkspace(root).manifest.projects[0];
    expect(after.digest).not.toBe(before.digest);
  });
});

describe('F9 — PreviewProject fields', () => {
  it('detects the nextjs framework from package.json dependencies', () => {
    writeProject(root, 'forgeline', 'website', { 'package.json': NEXTJS_PACKAGE_JSON });
    const p = loadPreviewWorkspace(root).manifest.projects[0];
    expect(p.framework).toBe('nextjs');
    expect(p.status).toBe('ready');
  });

  it('reports framework "unknown" and a diagnostic when package.json is missing', () => {
    writeProject(root, 'forgeline', 'website', { 'app/page.tsx': 'x' });
    const p = loadPreviewWorkspace(root).manifest.projects[0];
    expect(p.framework).toBe('unknown');
    expect(p.status).toBe('ready');
    expect(p.diagnostics.some((d) => /package\.json/i.test(d))).toBe(true);
  });

  it('reports status "empty" and a diagnostic when the fullstack/ directory has zero files', () => {
    mkdirSync(join(root, 'forgeline', 'website', 'fullstack'), { recursive: true });
    const p = loadPreviewWorkspace(root).manifest.projects[0];
    expect(p.status).toBe('empty');
    expect(p.artifactSummary.fileCount).toBe(0);
    expect(p.diagnostics.length).toBeGreaterThan(0);
  });

  it('handles a corrupt (unparseable) package.json without throwing — diagnostic, not a crash', () => {
    writeProject(root, 'forgeline', 'website', { 'package.json': '{ not valid json', 'app/page.tsx': 'x' });
    const workspace = loadPreviewWorkspace(root);
    const p = workspace.manifest.projects[0];
    expect(p.status).toBe('ready');
    expect(p.framework).toBe('unknown');
    expect(p.diagnostics.some((d) => /not valid json/i.test(d))).toBe(true);
    expect(p.artifactSummary.fileCount).toBe(2);
  });

  it('reports accurate file/directory counts', () => {
    writeProject(root, 'champion-accountants', 'collateral', {
      'package.json': NEXTJS_PACKAGE_JSON,
      'app/page.tsx': 'x',
      'app/outcomes/page.tsx': 'y',
    });
    const p = loadPreviewWorkspace(root).manifest.projects[0];
    expect(p.artifactSummary.fileCount).toBe(3);
    expect(p.artifactSummary.directoryCount).toBe(2); // app, app/outcomes
  });

  it('returns a frozen PreviewProject and PreviewManifest', () => {
    writeProject(root, 'forgeline', 'website', { 'package.json': NEXTJS_PACKAGE_JSON });
    const workspace = loadPreviewWorkspace(root);
    expect(Object.isFrozen(workspace.manifest)).toBe(true);
    expect(Object.isFrozen(workspace.manifest.projects[0])).toBe(true);
  });
});

describe('F9 — loadPreviewProject — direct single-project entry', () => {
  it('loads one project directly by client/track', () => {
    writeProject(root, 'forgeline', 'website', { 'package.json': NEXTJS_PACKAGE_JSON });
    const resolver = createWorkspaceResolver(root);
    const [candidate] = resolver.resolve();
    const project = createWorkspaceLoader().load(candidate);
    expect(project.client).toBe('forgeline');
    expect(project.framework).toBe('nextjs');
  });

  it('fails loudly (throws), naming the path, for a project that was never written to disk', () => {
    expect(() => loadPreviewProject('__f9-nonexistent-client__', 'website')).toThrow(/__f9-nonexistent-client__/);
  });
});
