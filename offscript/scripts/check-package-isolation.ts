#!/usr/bin/env -S npx tsx
/**
 * P0 — repo-wide package-isolation guard (adapted from the Open Design architecture study,
 * `.experiments/2026-08-19-open-design-offscript-architecture-study/ARCHITECTURE-STUDY.md` §12
 * PORT row "derived-file digest-parity guards" / §18 recommendation 5).
 *
 * Turns Offscript's existing package-boundary discipline — today enforced only by per-package
 * `isolation.test.ts` files and by prose in CLAUDE.md/each package's own `package.json`
 * `description` — into one deterministic, repo-wide, mechanically-run check.
 *
 * DOES NOT invent new rules. The allowed-import graph is derived entirely from each declared
 * package's own `package.json` `dependencies`/`devDependencies` `file:../<sibling>` entries —
 * the same source of truth CLAUDE.md already cites (e.g. "creative-artifact-contract... one
 * `file:` dependency, one-way"). `package-boundaries.json` (sibling to this file) declares only
 * what package.json cannot express: which top-level directories under `offscript/` are independently
 * owned packages, and which of their subdirectories this guard scans.
 *
 * Uses the TypeScript compiler API (already a devDependency; no new dependency added) to parse
 * import/export/dynamic-import forms reliably — a regex could false-positive inside a string
 * literal or comment, which the existing `isolation.test.ts` files' own regex checks already
 * accept as a known trade-off for their narrower scope; this guard reuses the parser other repo
 * tooling would otherwise need to introduce (see the Open Design study's own
 * `check-cross-app-imports.ts`, which makes the identical choice for the identical reason).
 *
 * Complements — does not replace — the existing package-local isolation tests
 * (`creative-generation/test/isolation.test.ts`, `creative-generation/test/artifact-boundary.test.ts`,
 * and the intra-engine consumption-isolation tests under `offscript/test/designer-*`). Those check
 * package-specific invariants (e.g. "no Windows drive-letter literal", "no cycle back to this
 * package"); this guard checks the general cross-package boundary graph.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// ─── Manifest ────────────────────────────────────────────────────────────────

export interface RawPackageDecl {
  name: string;
  root: string;
  scanDirs: string[];
  note?: string;
}

export interface ManifestFile {
  packages: RawPackageDecl[];
}

/** Load and parse the declarative boundary manifest (data only, never executed). */
export function loadManifest(manifestPath: string): ManifestFile {
  const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(raw.packages)) {
    throw new Error(`check-package-isolation: manifest at ${manifestPath} has no "packages" array.`);
  }
  return { packages: raw.packages };
}

/** A manifest package resolved to absolute paths, with its sibling allow-list derived from its
 * own package.json `file:` dependencies. */
export interface PackageDecl {
  name: string;
  rootAbs: string;
  scanDirsAbs: string[];
  /** Sibling package names this package's own package.json declares via a `file:` dependency —
   * the only allowed cross-package import targets besides itself. */
  allowedSiblings: Set<string>;
}

const IGNORED_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  'output',
  '.git',
  '.experiments',
  'coverage',
  'fixtures',
]);

/** Sibling package names declared as `file:../<name>` (or `file:<relative-path>`) deps in a
 * package.json. This IS the real, existing dependency-graph source of truth — never duplicated
 * into the manifest. */
export function declaredFileDependencies(packageJsonPath: string): Set<string> {
  const names = new Set<string>();
  if (!existsSync(packageJsonPath)) return names;
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const deps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [depName, spec] of Object.entries(deps)) {
    if (typeof spec === 'string' && spec.startsWith('file:')) names.add(depName);
  }
  return names;
}

/** Resolve the manifest's declared packages to absolute paths + their derived allow-lists. */
export function resolvePackages(manifest: ManifestFile, repoRoot: string): PackageDecl[] {
  return manifest.packages.map((p) => {
    const rootAbs = resolve(repoRoot, p.root);
    return {
      name: p.name,
      rootAbs,
      scanDirsAbs: p.scanDirs.map((d) => resolve(rootAbs, d)),
      allowedSiblings: declaredFileDependencies(join(rootAbs, 'package.json')),
    };
  });
}

/** Every directory directly under `repoRoot` that contains its own `package.json`, excluding
 * ignored directories. Used to catch a new standalone package that was added on disk but never
 * registered in the manifest (see PACKAGE-ISOLATION-GUARD-REPORT.md "future package workflow"). */
export function discoverPackageDirs(repoRoot: string): string[] {
  const found: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(repoRoot);
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (IGNORED_DIR_NAMES.has(entry) || entry.startsWith('.')) continue;
    const full = join(repoRoot, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    if (existsSync(join(full, 'package.json'))) found.push(entry);
  }
  return found;
}

// ─── File collection ─────────────────────────────────────────────────────────

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (IGNORED_DIR_NAMES.has(entry) || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (SOURCE_EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
      out.push(full);
    }
  }
}

/** Collect every TypeScript source file under the given (already-resolved, already-ignored-dir-
 * filtered) directories. Absolute paths, deterministic order (directory-walk order, then sorted). */
export function collectSourceFiles(dirs: string[]): string[] {
  const out: string[] = [];
  for (const dir of dirs) {
    if (existsSync(dir)) walk(dir, out);
  }
  return out.sort();
}

// ─── Import extraction (TypeScript compiler API — already a devDependency) ────

export interface ImportRecord {
  specifier: string;
  /** 1-indexed line number of the import/require/dynamic-import token. */
  line: number;
}

/** Extract every static import, `export ... from`, dynamic `import()`, and `require()` call's
 * module specifier from a TypeScript source file's content. Uses the real AST — not a regex —
 * so string literals and comments that merely LOOK like an import are never misdetected. */
export function extractImports(fileContent: string, fileName = 'file.ts'): ImportRecord[] {
  const sourceFile = ts.createSourceFile(fileName, fileContent, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const records: ImportRecord[] = [];

  const lineOf = (pos: number): number => sourceFile.getLineAndCharacterOfPosition(pos).line + 1;

  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      records.push({ specifier: node.moduleSpecifier.text, line: lineOf(node.moduleSpecifier.getStart(sourceFile)) });
    } else if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      if ((isDynamicImport || isRequire) && node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
        const arg = node.arguments[0];
        records.push({ specifier: arg.text, line: lineOf(arg.getStart(sourceFile)) });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return records;
}

// ─── Boundary resolution ──────────────────────────────────────────────────────

/** Which declared package owns an absolute path, by longest-prefix match against every
 * package's root. Real path resolution — never string-prefix matching on the raw specifier. */
export function ownerOfPath(absPath: string, packages: PackageDecl[]): PackageDecl | null {
  let best: PackageDecl | null = null;
  for (const pkg of packages) {
    const rel = relative(pkg.rootAbs, absPath);
    const inside = rel === '' || (!rel.startsWith('..') && !isAbsolutePathLike(rel));
    if (!inside) continue;
    if (!best || pkg.rootAbs.length > best.rootAbs.length) best = pkg;
  }
  return best;
}

function isAbsolutePathLike(p: string): boolean {
  return /^[A-Za-z]:/.test(p) || p.startsWith('/');
}

/** Resolve an import specifier found in `fromFile` (an absolute path) to the package that owns
 * the specifier's target, or null if the specifier is external (a bare npm package / node
 * builtin) or does not resolve inside any declared package. */
export function resolveImportOwner(specifier: string, fromFile: string, packages: PackageDecl[]): PackageDecl | null {
  if (specifier.startsWith('node:')) return null;

  if (specifier.startsWith('.')) {
    const targetAbs = resolve(dirname(fromFile), specifier);
    return ownerOfPath(targetAbs, packages);
  }

  // Bare specifier: either `<package-name>` or `<package-name>/sub/path`.
  const segment = specifier.split('/')[0];
  const byName = packages.find((p) => p.name === segment);
  return byName ?? null;
}

// ─── The check ────────────────────────────────────────────────────────────────

export interface Violation {
  packageName: string;
  /** Repo-root-relative, POSIX-normalized. */
  file: string;
  line: number;
  importSpecifier: string;
  targetPackage: string;
  rule: string;
}

export interface IsolationCheckResult {
  violations: Violation[];
  undeclaredPackages: string[];
  packagesScanned: string[];
  filesScanned: number;
}

function toPosix(p: string): string {
  return p.split('\\').join('/');
}

export function checkPackageIsolation(opts: { repoRoot: string; manifestPath: string }): IsolationCheckResult {
  const manifest = loadManifest(opts.manifestPath);
  const packages = resolvePackages(manifest, opts.repoRoot);

  const declaredRoots = new Set(manifest.packages.map((p) => p.root));
  const undeclaredPackages = discoverPackageDirs(opts.repoRoot).filter((dir) => !declaredRoots.has(dir));

  const violations: Violation[] = [];
  let filesScanned = 0;

  for (const pkg of packages) {
    const files = collectSourceFiles(pkg.scanDirsAbs);
    for (const file of files) {
      filesScanned++;
      const content = readFileSync(file, 'utf8');
      const imports = extractImports(content, file);
      for (const imp of imports) {
        const owner = resolveImportOwner(imp.specifier, file, packages);
        if (owner === null) continue; // external dependency — always allowed
        if (owner.name === pkg.name) continue; // package-local import — always allowed
        if (pkg.allowedSiblings.has(owner.name)) continue; // declared file: dependency — allowed

        violations.push({
          packageName: pkg.name,
          file: toPosix(relative(opts.repoRoot, file)),
          line: imp.line,
          importSpecifier: imp.specifier,
          targetPackage: owner.name,
          rule: `${pkg.name} must not import ${owner.name} (no "file:" dependency on it is declared in ${pkg.name}/package.json)`,
        });
      }
    }
  }

  violations.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));

  return {
    violations,
    undeclaredPackages: undeclaredPackages.sort(),
    packagesScanned: packages.map((p) => p.name).sort(),
    filesScanned,
  };
}

// ─── Diagnostics ────────────────────────────────────────────────────────────────

export function formatViolation(v: Violation): string {
  return [
    'Boundary violation',
    '',
    `Package:  ${v.packageName}`,
    `File:     ${v.file}:${v.line}`,
    `Import:   ${v.importSpecifier}`,
    `Target:   ${v.targetPackage}`,
    `Rule:     ${v.rule}`,
  ].join('\n');
}

// ─── CLI ────────────────────────────────────────────────────────────────────────

export function main(argv: string[]): number {
  // fileURLToPath, not a manual URL-string parse — the same portable, machine-independent
  // resolution `offscript/src/paths.ts` already uses for the exact same "where am I on disk" problem.
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, '..');
  const manifestPath = resolve(here, 'package-boundaries.json');

  const result = checkPackageIsolation({ repoRoot, manifestPath });

  if (result.undeclaredPackages.length > 0) {
    console.error(
      `[check-package-isolation] ${result.undeclaredPackages.length} package(s) found on disk but not declared ` +
        `in ${relative(repoRoot, manifestPath)}: ${result.undeclaredPackages.join(', ')}. ` +
        `Add each to package-boundaries.json before this guard can cover it.`,
    );
  }

  if (result.violations.length === 0 && result.undeclaredPackages.length === 0) {
    console.log(
      `[check-package-isolation] OK — ${result.packagesScanned.length} package(s), ` +
        `${result.filesScanned} file(s) scanned, 0 boundary violations.`,
    );
    return 0;
  }

  for (const v of result.violations) {
    console.error(formatViolation(v));
    console.error('');
  }
  if (result.violations.length > 0) {
    console.error(`[check-package-isolation] ${result.violations.length} boundary violation(s) found.`);
  }
  return 1;
}

// Only run when invoked directly (`tsx check-package-isolation.ts` / `npm run check:isolation`) —
// never when imported by the test suite.
const invokedDirectly = typeof process.argv[1] === 'string' && process.argv[1].replace(/\\/g, '/').endsWith('/check-package-isolation.ts');
if (invokedDirectly) {
  process.exitCode = main(process.argv.slice(2));
}
