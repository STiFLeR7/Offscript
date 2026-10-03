/**
 * P49 — Project Registry (Platform layer, above the generation engine).
 *
 * The discoverable catalogue of project FAMILIES a Offscript engagement can start from. A project
 * type is a declarative capability definition: which deliverable track(s) it produces, which
 * canonical-brief artifacts it requires vs. accepts optionally, and which brief sources it
 * supports. The Creative Director reads these definitions to drive interviews — nothing about
 * the interview flow is hardcoded, so a new project family is added as a DEFINITION here (or via
 * `registerProjectType`), never by editing orchestration logic.
 *
 * The registry sits ABOVE the engine's `Track` vocabulary: a family maps to one or more existing
 * tracks (`website`/`collateral`/`deck`). It introduces no new track and touches no generation,
 * governance, doctor, author, ranking, or variety code — its output is only the Canonical Brief.
 */
import type { Track } from '../paths.js';

/** A declarative project-family capability definition. */
export interface ProjectType {
  /** Stable kebab-case id (the `--type` value). */
  readonly id: string;
  /** Human label shown by `offscript init`. */
  readonly label: string;
  readonly description: string;
  /** Existing engine tracks this family produces (≥1). The registry never invents a track. */
  readonly deliverables: readonly Track[];
  /** Canonical-brief artifact keys this family REQUIRES (drives the interview's questions). */
  readonly requiredArtifacts: readonly string[];
  /** Artifact keys that enrich the brief but are not gating. */
  readonly optionalArtifacts: readonly string[];
  /** Brief-source ids this family supports (e.g. 'manual', 'content-core'). */
  readonly briefSources: readonly string[];
}

const ALL_SOURCES = ['manual', 'content-core', 'creative-intent'] as const;

/** The shipped project families. Extend by adding an entry (or calling registerProjectType). */
const BUILTIN: readonly ProjectType[] = [
  {
    id: 'website',
    label: 'Website',
    description: 'A responsive marketing site built from the governed website catalog.',
    deliverables: ['website'],
    requiredArtifacts: ['one-liner', 'audience', 'must-include'],
    optionalArtifacts: ['brand', 'tone', 'goals', 'success-criteria', 'source-doc'],
    briefSources: [...ALL_SOURCES],
  },
  {
    id: 'brand-identity',
    label: 'Brand Identity',
    description: 'A brand-guideline collateral piece capturing voice, palette, and usage.',
    deliverables: ['collateral'],
    requiredArtifacts: ['one-liner', 'brand', 'audience'],
    optionalArtifacts: ['tone', 'goals', 'source-doc'],
    briefSources: [...ALL_SOURCES],
  },
  {
    id: 'collateral',
    label: 'Collateral',
    description: 'A one-pager / sell sheet in the governed collateral format.',
    deliverables: ['collateral'],
    requiredArtifacts: ['one-liner', 'audience', 'must-include'],
    optionalArtifacts: ['brand', 'tone', 'goals', 'success-criteria', 'source-doc'],
    briefSources: [...ALL_SOURCES],
  },
  {
    id: 'presentation',
    label: 'Presentation',
    description: 'A pitch/slide deck (deck track — deck authoring governance is design-team gated).',
    deliverables: ['deck'],
    requiredArtifacts: ['one-liner', 'audience', 'must-include'],
    optionalArtifacts: ['brand', 'tone', 'goals', 'success-criteria', 'source-doc'],
    briefSources: [...ALL_SOURCES],
  },
  {
    id: 'social-campaign',
    label: 'Social Campaign',
    description: 'A set of on-brand social collateral units.',
    deliverables: ['collateral'],
    requiredArtifacts: ['one-liner', 'audience'],
    optionalArtifacts: ['brand', 'tone', 'goals', 'must-include', 'source-doc'],
    briefSources: [...ALL_SOURCES],
  },
  {
    id: 'full-brand-package',
    label: 'Full Brand Package',
    description: 'A multi-deliverable engagement: website + collateral + deck from one brief context.',
    deliverables: ['website', 'collateral', 'deck'],
    requiredArtifacts: ['one-liner', 'brand', 'audience', 'must-include'],
    optionalArtifacts: ['tone', 'goals', 'success-criteria', 'source-doc'],
    briefSources: [...ALL_SOURCES],
  },
];

let registry = new Map<string, ProjectType>(BUILTIN.map((p) => [p.id, p]));

/** All registered project types, in registration order. */
export function listProjectTypes(): ProjectType[] {
  return [...registry.values()];
}

/** Resolve a project type by id; throws loud on an unknown id. */
export function getProjectType(id: string): ProjectType {
  const p = registry.get(id);
  if (!p) {
    throw new Error(
      `unknown project type "${id}". Available: ${[...registry.keys()].join(', ')}. ` +
        `Run 'offscript init' with no --type to list families.`,
    );
  }
  return p;
}

/** Register a new project family at runtime (extensibility). Rejects a duplicate id. */
export function registerProjectType(def: ProjectType): void {
  if (registry.has(def.id)) throw new Error(`project type "${def.id}" is already registered.`);
  registry.set(def.id, def);
}

/** Test-only: restore the built-in registry. */
export function _resetProjectRegistry(): void {
  registry = new Map(BUILTIN.map((p) => [p.id, p]));
}
