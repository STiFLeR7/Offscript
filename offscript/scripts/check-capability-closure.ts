#!/usr/bin/env -S npx tsx
/**
 * P1 — capability closure / completeness contract (adapted from the Open Design architecture
 * study's "capability closure" observation — `.experiments/2026-08-19-open-design-offscript-
 * architecture-study/ARCHITECTURE-STUDY.md` §7's "Capability-closure rule" row — and the real
 * repository lessons in `.experiments/2026-08-20-capability-closure/CAPABILITY-CLOSURE-REPORT.md`
 * §6: `7378a0d` shipped a documented `--creative-intent` CLI flag that was never wired to its
 * parser or readiness gate, and `creative-generation/README.md` has described a pre-Sprint-10
 * state of the package since Sprint 4 while eight more sprints of real capability landed under it
 * unremarked).
 *
 * Complements — never replaces — `check-package-isolation.ts` (P0). Isolation asks "can these
 * things depend on each other?"; this asks "is this capability operationally complete?" Different
 * question, separate script, separate npm command, per the mission's explicit instruction not to
 * merge them into one mega-guard.
 *
 * DOES NOT invent a universal capability shape. Different capability TYPES have different closure
 * requirements (`capability-closure.json`'s `types` table) — an internal-support module is never
 * falsely required to have a CLI; a contract-only package is never required to have observability;
 * Review/Execution are declared `engine-library` (cli: not-applicable) matching this repo's own
 * existing, already-written statement that they are "library-level, no /offscript command surface yet."
 *
 * Every dimension is an array of evidence POINTERS — a required dimension is satisfied iff at
 * least one pointer resolves to a real file or directory on disk (relative to the outer repo root,
 * since capability evidence legitimately spans offscript/ and the outer docs/CLAUDE.md). A pointer
 * that is a free-text mnemonic (e.g. "/offscript generate --track website") never resolves as a path
 * and is simply ignored for verification purposes as long as a real path is present alongside it —
 * this is not a second, unverified truth channel; every REQUIRED dimension still needs at least one
 * real, on-disk backing artifact.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Manifest ────────────────────────────────────────────────────────────────

export type ClosureLevel = 'required' | 'optional' | 'not-applicable';

export const DIMENSIONS = [
  'contract',
  'implementation',
  'tests',
  'cli',
  'docs',
  'validation',
  'observability',
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export type CapabilityTypeRule = Record<Dimension, ClosureLevel>;

export interface CapabilityDecl {
  name: string;
  type: string;
  contract?: string[];
  implementation?: string[];
  tests?: string[];
  cli?: string[];
  docs?: string[];
  validation?: string[];
  observability?: string[];
}

export interface ManifestFile {
  types: Record<string, CapabilityTypeRule>;
  capabilities: CapabilityDecl[];
}

/** Load and parse the declarative capability-closure manifest (data only, never executed). */
export function loadManifest(manifestPath: string): ManifestFile {
  const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!raw.types || typeof raw.types !== 'object') {
    throw new Error(`check-capability-closure: manifest at ${manifestPath} has no "types" object.`);
  }
  if (!Array.isArray(raw.capabilities)) {
    throw new Error(`check-capability-closure: manifest at ${manifestPath} has no "capabilities" array.`);
  }
  return { types: raw.types, capabilities: raw.capabilities };
}

// ─── Evidence resolution ────────────────────────────────────────────────────

/** Most dimensions describe something that already lives in the repository right now (a contract
 * file, an implementation, a test, a doc) — verified by real on-disk existence. `observability` is
 * different by definition: it describes evidence a capability produces WHEN IT RUNS (a score.json
 * for a specific future client, a digest, a console report) — that artifact cannot exist as a
 * static repository file today, so requiring on-disk existence for it would be incoherent (an
 * earlier draft of this checker made exactly that mistake — see CAPABILITY-CLOSURE-REPORT.md §8).
 * `observability` is instead verified by PRESENCE: at least one specific, non-blank description was
 * declared. This is still mechanical (an empty array never passes) and still catches the one
 * failure mode that matters here — a capability with literally nothing said about how you'd know it
 * ran — without pretending to verify a runtime artifact that doesn't exist until runtime. */
export type EvidenceMode = 'path' | 'declared';

export function evidenceExists(repoRoot: string, entries: string[] | undefined, mode: EvidenceMode = 'path'): boolean {
  if (!entries || entries.length === 0) return false;
  if (mode === 'declared') return entries.some((entry) => entry.trim().length > 0);
  return entries.some((entry) => existsSync(resolve(repoRoot, entry)));
}

const EVIDENCE_MODE: Record<Dimension, EvidenceMode> = {
  contract: 'path',
  implementation: 'path',
  tests: 'path',
  cli: 'path',
  docs: 'path',
  validation: 'path',
  observability: 'declared',
};

// ─── The check ────────────────────────────────────────────────────────────────

export interface Gap {
  capability: string;
  type: string;
  dimension: Dimension;
  expected: string;
  found: string;
  evidence: string;
  nextAction: string;
}

export interface ClosureCheckResult {
  gaps: Gap[];
  capabilitiesChecked: string[];
  unknownTypes: string[];
}

function describeExpected(dimension: Dimension, capabilityName: string): string {
  const sentences: Record<Dimension, string> = {
    contract: `a contract or typed schema documenting what "${capabilityName}" produces or accepts`,
    implementation: `real, on-disk implementation for "${capabilityName}"`,
    tests: `a dedicated test suite for "${capabilityName}"`,
    cli: `a documented operational entrypoint (an /offscript subcommand or a scripts/*.ts entrypoint) for "${capabilityName}"`,
    docs: `discoverable documentation (a README, CLAUDE.md/AGENTS.md section, or docs/ reference) for "${capabilityName}"`,
    validation: `a validation mechanism (tests, a rail/gate, or a fail-closed check) for "${capabilityName}"`,
    observability: `evidence that "${capabilityName}" actually ran (a report, digest, manifest, or structured result)`,
  };
  return sentences[dimension];
}

export function checkCapabilityClosure(opts: { repoRoot: string; manifestPath: string }): ClosureCheckResult {
  const manifest = loadManifest(opts.manifestPath);
  const gaps: Gap[] = [];
  const unknownTypes: string[] = [];
  const capabilitiesChecked: string[] = [];

  for (const cap of manifest.capabilities) {
    capabilitiesChecked.push(cap.name);
    const rule = manifest.types[cap.type];
    if (!rule) {
      unknownTypes.push(cap.name);
      continue;
    }

    for (const dimension of DIMENSIONS) {
      const level = rule[dimension];
      if (level !== 'required') continue;

      const entries = cap[dimension];
      if (evidenceExists(opts.repoRoot, entries, EVIDENCE_MODE[dimension])) continue;

      gaps.push({
        capability: cap.name,
        type: cap.type,
        dimension,
        expected: describeExpected(dimension, cap.name),
        found: entries && entries.length > 0 ? `declared but unresolved: ${entries.join(', ')}` : 'nothing declared',
        evidence: entries && entries.length > 0 ? entries.join(', ') : `(none — see capability-closure.json's "${cap.name}".${dimension})`,
        nextAction: `add a real ${dimension} artifact for "${cap.name}" and list its path in capability-closure.json, or reclassify the capability's type if ${dimension} is genuinely not applicable`,
      });
    }
  }

  gaps.sort((a, b) => (a.capability === b.capability ? a.dimension.localeCompare(b.dimension) : a.capability.localeCompare(b.capability)));

  return { gaps, capabilitiesChecked: capabilitiesChecked.sort(), unknownTypes: unknownTypes.sort() };
}

// ─── Diagnostics ────────────────────────────────────────────────────────────────

export function formatGap(gap: Gap): string {
  return [
    'Incomplete capability',
    '',
    `Capability:     ${gap.capability}`,
    `Type:           ${gap.type}`,
    `Missing:        ${gap.dimension}`,
    `Expected:       ${gap.expected}`,
    `Found:          ${gap.found}`,
    `Evidence:       ${gap.evidence}`,
    `Next action:    ${gap.nextAction}`,
  ].join('\n');
}

// ─── CLI ────────────────────────────────────────────────────────────────────────

export function main(): number {
  const here = dirname(fileURLToPath(import.meta.url));
  // capability-closure.json's paths are relative to the OUTER repo root (docs/CLAUDE.md live
  // there, not under offscript/) — here = offscript/scripts, so '../..' is the outer root.
  const repoRoot = resolve(here, '..', '..');
  const manifestPath = resolve(here, 'capability-closure.json');

  const result = checkCapabilityClosure({ repoRoot, manifestPath });

  if (result.unknownTypes.length > 0) {
    console.error(
      `[check-capability-closure] ${result.unknownTypes.length} capability(ies) declare a type not ` +
        `present in capability-closure.json's "types" table: ${result.unknownTypes.join(', ')}.`,
    );
  }

  if (result.gaps.length === 0 && result.unknownTypes.length === 0) {
    console.log(
      `[check-capability-closure] OK — ${result.capabilitiesChecked.length} capability(ies) checked, ` +
        `0 closure gaps.`,
    );
    return 0;
  }

  for (const g of result.gaps) {
    console.error(formatGap(g));
    console.error('');
  }
  if (result.gaps.length > 0) {
    console.error(`[check-capability-closure] ${result.gaps.length} closure gap(s) found.`);
  }
  return 1;
}

const invokedDirectly = typeof process.argv[1] === 'string' && process.argv[1].replace(/\\/g, '/').endsWith('/check-capability-closure.ts');
if (invokedDirectly) {
  process.exitCode = main();
}
