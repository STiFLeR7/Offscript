/**
 * F5 — Project Generator contract: `ProjectModel → GeneratedProject`, entirely in memory. No
 * filesystem writes, no framework-specific rendering, no component/route generation.
 *
 * Ownership (see docs/fullstack/F5-PROJECT-GENERATOR-CONTRACT.md §2 for the full grounding):
 *   - Belongs HERE (the contract, framework-independent): the `ProjectGenerator` interface, the
 *     in-memory `GeneratedProject` shape (files/directories/diagnostics/manifest), and ONE
 *     reference implementation (`createDescriptorGenerator`) that produces pure JSON
 *     re-serializations of `ProjectModel` data — never a component, never a route, mirroring F3's
 *     `inspectionNodeAdapter` ("not React, invents nothing").
 *   - Belongs to a future FRAMEWORK-SPECIFIC generator (Next.js, Astro, Remix — none built here):
 *     resolving `ViewNode.componentRef` against a real component library, choosing JSX/template
 *     syntax, and deciding the routing convention a `ProjectPage` maps to.
 *   - Belongs to a future FILESYSTEM WRITER (a separate consumer, not built here): turning a
 *     `GeneratedArtifact.path` (a virtual, POSIX-style string — never touched by `node:fs`
 *     anywhere in this module) into a real file on disk.
 */
import type { ProjectModel, ProjectPage } from './project-model.js';
import { canonicalizeStructural, versionedStructuralDigest } from '../canonical-digest.js';

// -- canonicalization + digest -- shared with every sibling program via canonical-digest.ts --

const PROJECT_GENERATOR_VERSION_TAG = 'f5-project-generator@1';

function digestOf(value: unknown): string {
  return versionedStructuralDigest(value, PROJECT_GENERATOR_VERSION_TAG);
}

// ── The contract ─────────────────────────────────────────────────────────────────────────────

/** Deliberately thin today — the extension point a future framework-specific generator (Next.js)
 *  would widen with its OWN config, without changing `ProjectGenerator`'s signature. */
export interface GeneratorContext {
  readonly generatorName: string;
}

/** `'descriptor'` is F5's own reference-generator kind. `'config'` / `'component'` / `'style'` /
 *  `'doc'` are added by F6 (`nextjs-generator.ts`) — an additive widening, never a breaking
 *  change, per this contract's own §7 "Future Next.js integration" (F5 report). */
export type GeneratedArtifactKind = 'descriptor' | 'config' | 'component' | 'style' | 'doc';

/** One in-memory, virtual output unit. `path` is a relative, POSIX-style string — pure data, never
 *  passed to `node:fs`/`node:path` anywhere in this module; a future filesystem writer is the only
 *  consumer that would ever turn it into a real file. */
export interface GeneratedArtifact {
  readonly path: string;
  readonly kind: GeneratedArtifactKind;
  readonly content: string;
  readonly digest: string;
}

export type DiagnosticLevel = 'info' | 'warning';

export interface GeneratorDiagnostic {
  readonly level: DiagnosticLevel;
  readonly message: string;
}

export interface GeneratorManifest {
  readonly generator: string;
  /** `ProjectModel.digest` — traces every GeneratedProject back to the model it came from. */
  readonly sourceModelDigest: string;
  readonly fileCount: number;
  readonly directoryCount: number;
  readonly diagnosticCount: number;
}

export interface GeneratedProject {
  readonly files: readonly GeneratedArtifact[];
  readonly directories: readonly string[];
  readonly diagnostics: readonly GeneratorDiagnostic[];
  readonly manifest: GeneratorManifest;
  readonly digest: string;
}

export interface ProjectGenerator {
  readonly name: string;
  generate(model: ProjectModel, ctx: GeneratorContext): GeneratedProject;
}

// ── directory derivation — pure POSIX string ops, no node:path needed ───────────────────────────

function parentDir(path: string): string | undefined {
  const idx = path.lastIndexOf('/');
  return idx > 0 ? path.slice(0, idx) : undefined;
}

function derivedDirectories(files: readonly GeneratedArtifact[]): string[] {
  const dirs = new Set<string>();
  for (const f of files) {
    const d = parentDir(f.path);
    if (d) dirs.add(d);
  }
  return [...dirs].sort();
}

// ── The reference generator — NOT React, NOT a router: one pure JSON descriptor per page ───────

function pageDescriptor(page: ProjectPage): GeneratedArtifact {
  const data = { id: page.id, role: page.role, componentRef: page.componentRef, view: page.view };
  const content = `${JSON.stringify(canonicalizeStructural(data), null, 2)}\n`;
  return { path: `pages/${page.id}.json`, kind: 'descriptor', content, digest: digestOf(content) };
}

/** A reference `ProjectGenerator`: one descriptor artifact per `ProjectModel` page, sorted by
 *  path — never a component, never a route, never a framework choice. */
export function createDescriptorGenerator(name = 'descriptor'): ProjectGenerator {
  return {
    name,
    generate(model, ctx) {
      const files = model.pages.map(pageDescriptor).sort((a, b) => a.path.localeCompare(b.path));
      const directories = derivedDirectories(files);
      const diagnostics: GeneratorDiagnostic[] = [];
      if (model.assets.length === 0) {
        diagnostics.push({ level: 'info', message: 'ProjectModel.assets is empty — nothing to materialize.' });
      }
      if (model.pages.length === 0) {
        diagnostics.push({ level: 'warning', message: 'ProjectModel has zero pages.' });
      }
      const manifest: GeneratorManifest = {
        generator: ctx.generatorName,
        sourceModelDigest: model.digest,
        fileCount: files.length,
        directoryCount: directories.length,
        diagnosticCount: diagnostics.length,
      };
      const core = { files, directories, diagnostics, manifest };
      return Object.freeze({ ...core, digest: digestOf(core) });
    },
  };
}

/** `ProjectModel → GeneratedProject` — the one-call entry point, mirroring F3/F4's own
 *  default-argument composition idiom. */
export function generateProject(
  model: ProjectModel,
  generator: ProjectGenerator = createDescriptorGenerator(),
  ctx?: GeneratorContext,
): GeneratedProject {
  return generator.generate(model, ctx ?? { generatorName: generator.name });
}
