/**
 * F7 — Fullstack Command: the first public entry point into Program F. Pure orchestration of
 * already-built, unmodified subsystems — introduces NO new transformation or validation logic.
 *
 *   loadTransformationProject (F2, reused)
 *     → runProjectModelPipeline (F4, reused — internally reuses runTransformationPipeline, F3)
 *     → generateProject (F5, reused) with createNextJsGenerator (F6, reused, the default)
 *     → GeneratedProject
 *
 * Findings from grounding against F1-S1 through F6 before implementation
 * (`docs/fullstack/F7-FULLSTACK-COMMAND.md` §1–§3 for the full write-up):
 *   1. Existing public entry points: `loadTransformationProject`/`loadTransformationProjectFromFile`
 *      (F2), `runTransformationPipeline` (F3), `runProjectModelPipeline` (F4), `generateProject`
 *      (F5), `createNextJsGenerator` (F6) — every one already composable; nothing needed a new
 *      capability, only a caller.
 *   2. Orchestration belongs in a NEW, thin module (this file) — not inside any existing F-series
 *      module, each of which owns exactly one stage and STOPs there by its own sprint's design.
 *   3. No logic is duplicated: this module contains no validation, no digest computation, no tree
 *      walk — every one of those already lives in F2/F3/F4/F5/F6 and is called, never re-derived.
 */
import type { Track } from '../paths.js';
import { loadTransformationProject } from './transformation-loader.js';
import type { TransformationProject } from './transformation-loader.js';
import { runProjectModelPipeline } from './project-model.js';
import { generateProject } from './project-generator.js';
import type { GeneratedProject, ProjectGenerator } from './project-generator.js';
import { createNextJsGenerator } from './nextjs-generator.js';

/**
 * `TransformationProject → GeneratedProject`. Takes an already-loaded project (not a disk path),
 * so it is testable against a hand-built fixture without touching `projects/<client>/<track>/` —
 * mirroring F2's own `loadTransformationProjectFromFile`/`loadTransformationProject` split.
 */
export function runFullstackPipeline(
  project: TransformationProject,
  generator: ProjectGenerator = createNextJsGenerator(),
): GeneratedProject {
  const model = runProjectModelPipeline(project);
  return generateProject(model, generator);
}

/**
 * The real entry point — `/offscript fullstack`'s implementation (`scripts/fullstack.ts`). Resolves
 * and loads `rendering-ir.json` for `(client, track)` (F2) and runs it through
 * `runFullstackPipeline` above. Errors from any reused stage (a missing artifact, a failed
 * `RenderingIR` validation, an incomplete adapted tree) propagate unmodified — this function never
 * catches, wraps, or re-messages them.
 */
export function runFullstackCommand(
  client: string,
  track: Track,
  generator: ProjectGenerator = createNextJsGenerator(),
): GeneratedProject {
  return runFullstackPipeline(loadTransformationProject(client, track), generator);
}
