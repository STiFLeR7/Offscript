/**
 * PKG — Repository Builder: repository scan + package discovery (ES-2 stages 1-2).
 *
 * Layout-aware, serialization-agnostic discovery (Implementation Phase 1): a package
 * is a directory under `canonical/` or `scopes/` holding exactly one metadata
 * document. The metadata BASENAME is one of the known kinds; the EXTENSION selects
 * the source adapter (.yaml/.yml or .md). Fail-loud on duplicate metadata in a dir
 * and on nested packages.
 */
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { KINDS } from '../model.js';
import { KnowledgeError } from '../finding.js';

export type SourceFormat = 'yaml' | 'markdown';

export interface PackageHandle {
  /** Absolute package directory. */
  readonly dir: string;
  /** Absolute metadata file path. */
  readonly file: string;
  /** Repo-relative metadata path (the stable `location` for findings). */
  readonly location: string;
  readonly format: SourceFormat;
}

const BASENAMES = new Set<string>(KINDS);
const PARTITIONS = ['canonical', 'scopes'];

function formatOf(name: string): SourceFormat | null {
  if (name.endsWith('.yaml') || name.endsWith('.yml')) return 'yaml';
  if (name.endsWith('.md')) return 'markdown';
  return null;
}

function baseNameOf(name: string): string {
  return name.replace(/\.(ya?ml|md)$/, '');
}

type DirEntry = { name: string; isDirectory(): boolean; isFile(): boolean };

/**
 * Recursive discovery. Repository completeness is a PRECONDITION of validation
 * (C1): the only tolerated read failure is an absent partition ROOT (ENOENT on
 * `canonical/` or `scopes/` — an empty repo is valid). Any other filesystem error,
 * at any depth, fails loudly so authored content can never silently disappear.
 */
function walk(dir: string, acc: string[], isPartitionRoot: boolean): void {
  let entries: DirEntry[];
  try {
    entries = readdirSync(dir, { withFileTypes: true }) as unknown as DirEntry[];
  } catch (e) {
    const code = (e as NodeJS.ErrnoException | undefined)?.code;
    if (isPartitionRoot && code === 'ENOENT') return; // optional partition absent
    throw new KnowledgeError(
      `cannot read directory '${dir}' during discovery (${code ?? 'unknown'}): ` +
        `${e instanceof Error ? e.message : String(e)}`,
    );
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, acc, false);
    else if (e.isFile() && formatOf(e.name) && BASENAMES.has(baseNameOf(e.name))) acc.push(full);
  }
}

export function discoverPackages(root: string): PackageHandle[] {
  const files: string[] = [];
  for (const p of PARTITIONS) walk(join(root, p), files, true);

  const byDir = new Map<string, string[]>();
  for (const f of files) {
    const dir = f.slice(0, f.lastIndexOf(sep));
    const list = byDir.get(dir) ?? [];
    list.push(f);
    byDir.set(dir, list);
  }
  for (const [dir, fs] of byDir) {
    if (fs.length > 1) {
      throw new KnowledgeError(
        `package at ${relative(root, dir)} has ${fs.length} metadata documents (one per package)`,
      );
    }
  }

  const handles: PackageHandle[] = files.map((file) => {
    const dir = file.slice(0, file.lastIndexOf(sep));
    return {
      dir,
      file,
      location: relative(root, file).split(sep).join('/'),
      format: formatOf(file)!,
    };
  });

  // nested-package detection (a package dir that is an ancestor of another)
  const dirs = handles.map((h) => h.dir).sort();
  for (let i = 0; i < dirs.length; i++) {
    for (let j = i + 1; j < dirs.length; j++) {
      if (dirs[j].startsWith(dirs[i] + sep)) {
        throw new KnowledgeError(
          `nested package: ${relative(root, dirs[j])} inside ${relative(root, dirs[i])}`,
        );
      }
    }
  }

  return handles.sort((a, b) => a.location.localeCompare(b.location));
}
