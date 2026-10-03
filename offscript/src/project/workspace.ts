/**
 * P49 — Project bootstrap / workspace metadata. The core of `offscript init`.
 *
 * Responsibility: create the project, register its identity (client + chosen project type +
 * derived deliverables), and prepare the execution context (the references/ input dir). It
 * STOPS there — it never collects branding, voice, audience, or any creative information (that is
 * the Creative Director's brief-acquisition job) and never writes a brief.md. The manifest is
 * deterministic (no clock, no rng) so a project is reproducible and diffable.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir, projectReferencesDir, type Track } from '../paths.js';
import { getProjectType } from './project-registry.js';

/** The on-disk workspace identity record: projects/<client>/project.json. */
export interface ProjectManifest {
  readonly schemaVersion: 1;
  readonly client: string;
  readonly projectType: string;
  /** Deliverable tracks derived from the project type — the pipeline still runs per-track. */
  readonly deliverables: Track[];
}

export interface InitProjectInput {
  readonly client: string;
  readonly projectType: string;
}

/** Path to a project's manifest. */
export function projectManifestPath(client: string): string {
  return join(projectDir(client), 'project.json');
}

/**
 * Create the project + references dir and write project.json. Idempotent-guarded: refuses to
 * clobber an existing project (delete it to re-init). Validates the project type against the
 * registry (fail-loud). Returns the persisted manifest.
 */
export function initProject(input: InitProjectInput): ProjectManifest {
  const type = getProjectType(input.projectType); // throws loud on unknown type
  const manifestPath = projectManifestPath(input.client);
  if (existsSync(manifestPath)) {
    throw new Error(
      `project "${input.client}" already exists (${manifestPath}). ` +
        `Delete the project dir to re-initialize, or pick another client id.`,
    );
  }
  mkdirSync(projectReferencesDir(input.client), { recursive: true }); // creates projectDir too
  const manifest: ProjectManifest = {
    schemaVersion: 1,
    client: input.client,
    projectType: type.id,
    deliverables: [...type.deliverables],
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return manifest;
}

/** Read a project's manifest; throws loud if the project was never initialized. */
export function readProjectManifest(client: string): ProjectManifest {
  const p = projectManifestPath(client);
  if (!existsSync(p)) {
    throw new Error(`no project.json for "${client}" at ${p}. Run 'offscript init ${client} --type <type>' first.`);
  }
  return JSON.parse(readFileSync(p, 'utf8')) as ProjectManifest;
}
