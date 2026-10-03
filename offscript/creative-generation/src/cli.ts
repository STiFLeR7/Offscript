#!/usr/bin/env node
/**
 * Creative Generation's canonical operational entrypoint — closes the P1 capability-closure gap
 * recorded in `.experiments/2026-08-20-capability-closure/CAPABILITY-CLOSURE-REPORT.md` §15
 * ("creative-generation: Missing: CLI"). Before this file, the only way to actually produce a
 * `CreativeArtifact` was one of fifteen `_`-prefixed, sprint-numbered, throwaway experiment scripts
 * under `offscript/scripts/`. This is a THIN wrapper — it contains no orchestration logic of its own.
 * Every real decision is made by `runRethinkLoop` (`visual-proof-rethink-loop.ts`, unmodified) and
 * `writeCreativeArtifact` (`write-artifact.ts`, unmodified); this file only parses argv, loads a
 * CreativeIntent file, wires the (scripted or real-dispatch) executors, calls those two real
 * functions, and reports the result.
 *
 * Two judgment modes, matching the exact `--dispatch-dir`-absent/present split this repo already
 * uses for Website Generation's `OFFSCRIPT_AUTHOR` (scripted double vs. real subagent):
 *
 *  - Default (no `--dispatch-dir`): SCRIPTED judgment — `createScriptedStubExecutor` with all six
 *    Visual Proof questions answered `true`. This is a deterministic double, not real evidence
 *    (the scripted stub's own `evidence` field says so verbatim — "SCRIPTED STUB — no real
 *    judgment performed"), exactly mirroring `authoring-seam.ts`'s own guardrail language for
 *    Website Generation's scripted author. It exists to prove the real orchestration path —
 *    `runRethinkLoop` → `produceCreativeArtifact` → `writeCreativeArtifact`, digest-verified,
 *    approval-pending — runs correctly end to end without requiring a live LLM call for every
 *    invocation.
 *  - `--dispatch-dir <dir>`: REAL subagent dispatch for the three genuine JUDGMENT-shaped stages —
 *    Visual Proof Judgment, Revision, and Creative Authoring (the repo's own module headers
 *    distinguish these from Environment Selection / Role Assignment, which are "upstream
 *    candidate-state derivation... not a sibling of either judgment or revision" — see
 *    `role-assignment.ts`'s header). Uses the exact two-phase, resumable, offline file protocol
 *    already proven end-to-end in `offscript/scripts/_sprint10s-real-rethink-run.ts` and the 2026-08-17
 *    production trace: write `<id>.<stage>-<n>.prompt.md`, and if a matching
 *    `<id>.<stage>-<n>.response.*` file does not exist yet, report PENDING (exit 3) and stop —
 *    resumable by writing the real subagent's response and re-running the identical command.
 *
 * Environment Selection and Role Assignment stay SCRIPTED in both modes (v1 scope, documented in
 * CAPABILITY-GAPS-CLOSED-REPORT.md's Remaining Technical Debt) — both are optional, plain-data
 * inputs to `runRethinkLoop` ("Absent means no environment/role selection was performed upstream" —
 * a fully legitimate, already-documented production configuration, never a degraded one), and
 * restricting real dispatch to the three stages the repo's own vocabulary calls "judgment" keeps
 * this wrapper genuinely thin rather than re-deriving a second copy of every upstream stage's
 * dispatch wiring.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CreativeIntentWire } from 'creative-intent-exporter/src/intent/types.js';
import { runRethinkLoop, type RethinkLoopOptions, type RethinkLoopResult } from './visual-proof-rethink-loop.js';
import { writeCreativeArtifact } from './write-artifact.js';
import type { CreativeIntentInput, ProduceOptions } from './producer.js';
import { componentsForFeature } from './feature-mapping.js';
import { getEligibleEnvironments } from './environment-selection-eligibility.js';
import { isEnvironmentSlug, type EnvironmentSlug } from './environment-library.js';
import { validateRoleAssignment, type RoleAssignment } from './role-assignment.js';
import { createScriptedStubExecutor } from './visual-proof-validation.js';
import type { VisualProofValidationRequest } from './visual-proof-validation.js';
import { createScriptedRevisionExecutor } from './visual-proof-revision.js';
import type { RevisionRequest, VisualProofRevisionExecutor } from './visual-proof-revision.js';
import { buildJudgmentPrompt, parseJudgmentResponse } from './visual-proof-judgment-executor.js';
import type { VisualProofJudgmentExecutor } from './visual-proof-judgment-executor.js';
import { buildRevisionPrompt, parseRevisionResponse } from './visual-proof-revision-executor.js';
import { buildCreativeAuthoringPrompt, parseCreativeAuthoringResponse } from './creative-authoring.js';
import type { CreativeAuthoringExecutor } from './creative-authoring.js';
import { loadProjectAuthoringBrand } from './brand-typography.js';

// ─── Governed vocabulary transcription ───────────────────────────────────────
// environment-library.ts deliberately does not export its candidate list (only the type guard).
// This local transcription matches the SAME precedent offscript/scripts/_sprint10ae-real-environment-
// selection-run.ts's own `ALL_SEVEN` already established for exactly this reason — the eligibility
// LOGIC (ratio legality, recency exclusion) still lives entirely in getEligibleEnvironments; this is
// only the input candidate universe.
const ALL_ENVIRONMENTS: readonly EnvironmentSlug[] = [
  'cliffside-muted',
  'dawn-haze',
  'lake-mirror',
  'massif-banded',
  'massif-clear',
  'ridges-distant',
  'valley-deep',
];

// ─── Argument parsing ────────────────────────────────────────────────────────

export interface ParsedArgs {
  help: boolean;
  creativeIntentPath?: string;
  client?: string;
  dispatchDir?: string;
  maxAttempts?: number;
}

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const help = argv.includes('--help') || argv.includes('-h');
  const maxAttemptsRaw = flag(argv, 'max-attempts');
  return {
    help,
    creativeIntentPath: flag(argv, 'creative-intent'),
    client: flag(argv, 'client'),
    dispatchDir: flag(argv, 'dispatch-dir'),
    maxAttempts: maxAttemptsRaw !== undefined ? Number(maxAttemptsRaw) : undefined,
  };
}

const USAGE = `usage: creative-generation generate --creative-intent <path> --client <name> [--dispatch-dir <dir>] [--max-attempts <n>]

Produces one CreativeArtifact from an approved CreativeIntent, via the real Creative Generation
pipeline (Feature Mapping -> Camera Selection -> Composition Camera Bias -> [Environment/Role,
scripted] -> Visual Proof Judgment -> Revision -> Creative Authoring -> CreativeArtifact), and
persists it to projects/<client>/creative-assets/<id>/{intent.json,artifact.json,visual.html}.

Required:
  --creative-intent <path>  a <slug>.creative-intent.json wire file (creative-intent-exporter's
                             output format)
  --client <name>           the client whose creative-assets/ this artifact is written under

Optional:
  --dispatch-dir <dir>      enable REAL subagent dispatch for Judgment/Revision/Creative Authoring
                             via a resumable prompt/response file protocol (writes <id>.<stage>-
                             <n>.prompt.md; re-run after supplying the matching .response file).
                             Absent: deterministic SCRIPTED judgment (always passes) -- a pipeline
                             proof, not real evidence. Environment Selection and Role Assignment
                             are always scripted in this version (see the module header).
  --max-attempts <n>        revision-attempt bound passed to runRethinkLoop (default: 2)
  --help, -h                print this message and exit 0

Exit codes: 0 produced, 1 pipeline failure (no artifact), 2 usage/input error, 3 pending real dispatch.`;

// ─── CreativeIntent loading ───────────────────────────────────────────────────

export function loadCreativeIntentInput(path: string): CreativeIntentInput {
  if (!existsSync(path)) {
    throw new Error(`creative-intent file not found: ${path}`);
  }
  let wire: CreativeIntentWire;
  try {
    wire = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`creative-intent file at ${path} is not valid JSON: ${(e as Error).message}`);
  }
  return {
    id: wire.id,
    digest: wire.digest,
    belief: wire.belief,
    feature: wire.feature,
    ratio: wire.ratio,
    camera: wire.camera,
    mustInclude: wire['must-include'],
    contentProvenance: wire['content-provenance'],
    ...(wire.section !== undefined ? { section: wire.section } : {}),
  };
}

// ─── Scripted Environment / Role pre-loop defaults (plain data, no executor) ──

function scriptedEnvironment(intent: CreativeIntentInput): EnvironmentSlug | undefined {
  const eligible = getEligibleEnvironments({ candidates: ALL_ENVIRONMENTS, ratio: intent.ratio });
  return eligible[0];
}

function scriptedRoles(intent: CreativeIntentInput): RoleAssignment | undefined {
  const components = componentsForFeature(intent.feature);
  if (components.length === 0) return undefined;
  const candidate: RoleAssignment = {
    hero: components[0],
    support: components.slice(1),
    signal: [],
    subordinateContext: [],
    unassigned: [],
  };
  const outcome = validateRoleAssignment(candidate, components, 'scripted default: hero=first component, rest=support');
  return outcome.outcome === 'assigned' ? outcome.roles : undefined;
}

// ─── Real dispatch (Judgment / Revision / Authoring only — see module header) ─

export class PendingDispatch extends Error {
  constructor(public readonly promptFile: string) {
    super(`pending real subagent response: ${promptFile}`);
  }
}

function dispatchStage(dispatchDir: string, base: string, promptExt: string, responseExt: string, promptText: string): string {
  const responsePath = join(dispatchDir, `${base}.response.${responseExt}`);
  if (existsSync(responsePath)) return readFileSync(responsePath, 'utf8');
  mkdirSync(dispatchDir, { recursive: true });
  writeFileSync(join(dispatchDir, `${base}.prompt.${promptExt}`), promptText, 'utf8');
  throw new PendingDispatch(`${base}.prompt.${promptExt}`);
}

/**
 * `createScriptedStubExecutor` (`visual-proof-validation.ts`) returns a bare
 * `VisualProofValidationAnswer` — `VisualProofJudgmentExecutor` (`visual-proof-judgment-
 * executor.ts`, what `runRethinkLoop` actually requires) wraps that in the judged/unavailable
 * outcome shape. These are deliberately two distinct types in this package (see visual-proof-
 * judgment-executor.ts's own header); this is the thin adapter between them, not a
 * reimplementation of either — the scripted answer itself (and its honest "SCRIPTED STUB"
 * evidence text) is 100% the real, unmodified function. Exported so tests can build the identical
 * scripted judgment executor `runCli` itself uses, rather than duplicating the wrap.
 */
export function scriptedPassingJudgmentExecutor(
  answers: Parameters<typeof createScriptedStubExecutor>[0],
): VisualProofJudgmentExecutor {
  const scriptedAnswer = createScriptedStubExecutor(answers);
  return async (request) => ({ outcome: 'judged', answer: await scriptedAnswer(request) });
}

function buildJudgmentExecutor(dispatchDir: string | undefined, intentId: string): VisualProofJudgmentExecutor {
  if (!dispatchDir) {
    return scriptedPassingJudgmentExecutor({ q1: true, q2: true, q3: true, q4: true, q5: true, q6: true });
  }
  let n = 0;
  return async (request: VisualProofValidationRequest) => {
    const raw = dispatchStage(dispatchDir, `${intentId}.judge-${n++}`, 'md', 'json', buildJudgmentPrompt(request));
    return parseJudgmentResponse(raw);
  };
}

function buildRevisionExecutorFor(dispatchDir: string | undefined, intentId: string): VisualProofRevisionExecutor {
  if (!dispatchDir) {
    return createScriptedRevisionExecutor({
      outcome: 'unavailable',
      reason: 'scripted mode never revises — scripted judgment always passes on the first attempt',
    });
  }
  let n = 0;
  return async (request: RevisionRequest) => {
    const raw = dispatchStage(dispatchDir, `${intentId}.revision-${n++}`, 'md', 'json', buildRevisionPrompt(request));
    return parseRevisionResponse(raw, request);
  };
}

function buildAuthoringExecutor(dispatchDir: string | undefined, intentId: string, client: string): CreativeAuthoringExecutor | undefined {
  if (!dispatchDir) return undefined; // absent -> runRethinkLoop's documented default (v1-deterministic-placeholder)
  return async (request) => {
    const brand = loadProjectAuthoringBrand(client);
    const projectRequest = { ...request, ...(brand ? { brand } : {}) };
    const raw = dispatchStage(dispatchDir, `${intentId}.authoring`, 'md', 'html', buildCreativeAuthoringPrompt(projectRequest));
    return parseCreativeAuthoringResponse(raw, projectRequest);
  };
}

// ─── Core (argv-free, directly testable, the ONLY place that calls the real pipeline) ──

export interface CoreRunOptions {
  intent: CreativeIntentInput;
  client: string;
  judgmentExecutor: VisualProofJudgmentExecutor;
  revisionExecutor: VisualProofRevisionExecutor;
  authoringExecutor?: CreativeAuthoringExecutor;
  initialEnvironment?: EnvironmentSlug;
  initialRoles?: RoleAssignment;
  maxAttempts?: number;
  createdAt?: string;
}

export interface CoreRunResult {
  readonly result: RethinkLoopResult;
  readonly artifactDir?: string;
}

export async function runCreativeGenerationCore(opts: CoreRunOptions): Promise<CoreRunResult> {
  const produceOptions: ProduceOptions = { client: opts.client, ...(opts.createdAt ? { createdAt: opts.createdAt } : {}) };
  const loopOptions: RethinkLoopOptions = {
    judgmentExecutor: opts.judgmentExecutor,
    revisionExecutor: opts.revisionExecutor,
    produceOptions,
    ...(opts.maxAttempts !== undefined ? { maxAttempts: opts.maxAttempts } : {}),
    ...(opts.initialEnvironment ? { initialEnvironment: opts.initialEnvironment } : {}),
    ...(opts.initialRoles ? { initialRoles: opts.initialRoles } : {}),
    ...(opts.authoringExecutor ? { authoringExecutor: opts.authoringExecutor } : {}),
  };

  const result = await runRethinkLoop(opts.intent, loopOptions);
  if (result.status !== 'PASSED') return { result };

  const artifactDir = writeCreativeArtifact(opts.client, opts.intent, result.artifact, result.html);
  return { result, artifactDir };
}

// ─── Exit-code mapping ────────────────────────────────────────────────────────

export function resultToExitCode(result: RethinkLoopResult): number {
  return result.status === 'PASSED' ? 0 : 1;
}

// ─── CLI ────────────────────────────────────────────────────────────────────────

/** Output sink, injectable for tests (avoids relying on console spying — the returned exit code
 * plus this sink's captured lines are the whole observable contract). Defaults to real console. */
export interface CliIO {
  log: (line: string) => void;
  error: (line: string) => void;
}

const REAL_IO: CliIO = { log: (l) => console.log(l), error: (l) => console.error(l) };

export async function runCli(argv: string[], io: CliIO = REAL_IO): Promise<number> {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    io.log(USAGE);
    return 0;
  }

  const missing: string[] = [];
  if (!parsed.creativeIntentPath) missing.push('--creative-intent');
  if (!parsed.client) missing.push('--client');
  if (missing.length > 0) {
    io.error(`missing required flag(s): ${missing.join(', ')}\n\n${USAGE}`);
    return 2;
  }

  let intent: CreativeIntentInput;
  try {
    intent = loadCreativeIntentInput(parsed.creativeIntentPath!);
  } catch (e) {
    io.error((e as Error).message);
    return 2;
  }

  const dispatchDir = parsed.dispatchDir;
  const judgmentExecutor = buildJudgmentExecutor(dispatchDir, intent.id);
  const revisionExecutor = buildRevisionExecutorFor(dispatchDir, intent.id);
  const authoringExecutor = buildAuthoringExecutor(dispatchDir, intent.id, parsed.client!);

  try {
    const { result, artifactDir } = await runCreativeGenerationCore({
      intent,
      client: parsed.client!,
      judgmentExecutor,
      revisionExecutor,
      authoringExecutor,
      initialEnvironment: scriptedEnvironment(intent),
      initialRoles: scriptedRoles(intent),
      maxAttempts: parsed.maxAttempts,
    });

    if (result.status === 'PASSED') {
      io.log(`[creative-generation] produced ${artifactDir}`);
      io.log(`[creative-generation] approval.status=${result.artifact.approval.status} artifactDigest=${result.artifact.artifactDigest}`);
      return 0;
    }

    io.error(`[creative-generation] terminal status: ${result.status}`);
    if (result.finalJudgment.outcome === 'unavailable') {
      io.error(`[creative-generation] reason: ${result.finalJudgment.reason}`);
    }
    return resultToExitCode(result);
  } catch (e) {
    if (e instanceof PendingDispatch) {
      io.error(`[creative-generation] PENDING — dispatch ${dispatchDir}/${e.promptFile} to a real subagent, write its response, then re-run this exact command.`);
      return 3;
    }
    io.error((e as Error).message);
    return 1;
  }
}

const invokedDirectly = typeof process.argv[1] === 'string' && process.argv[1].replace(/\\/g, '/').endsWith('/cli.ts');
if (invokedDirectly) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
