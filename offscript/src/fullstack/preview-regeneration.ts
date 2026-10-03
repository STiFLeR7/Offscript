/**
 * F12 — Preview Regeneration Manager: coordinates an already-running `PreviewSession` (F10) with a
 * freshly generated Full Stack project (F7/F8), re-launches it, and waits for the new session to
 * become ready (F11). This module owns ORCHESTRATION ONLY — it performs no generation, no writing,
 * no process management, no readiness logic of its own; every real step is a call into an
 * already-tested Program-F export.
 *
 * Ownership (`docs/fullstack/F12-PREVIEW-REGENERATION.md` §2 for the full grounding):
 *   1. Current boundaries (unchanged, all reused verbatim): Generation → `GeneratedProject` (F7
 *      `runFullstackCommand`); materialization → real files (F8 `FilesystemWriter`); discovery →
 *      `PreviewProject` (F9 `loadPreviewProject`); execution/lifecycle → `PreviewSession` (F10
 *      `PreviewServer`); liveness → `HealthSnapshot` (F11 `PreviewHealth`). This module adds a
 *      NEW capability — sequencing across all five — duplicating no logic from any of them.
 *   2. Sessions are located by an EXPLICIT `sessionId` the caller already holds (from a prior
 *      `PreviewServer.start()`), never by searching `listSessions()` for a client/track match —
 *      F10 allows multiple concurrent sessions for the same project on different ports, so only an
 *      explicit id is unambiguous.
 *   3. Generated projects are rewritten via F7 + F8 exactly as `/offscript fullstack --write` (F8's own
 *      still-unbuilt CLI seam) would: `runFullstackCommand(client, track)` then
 *      `FilesystemWriter.write(generated, targetDir)` — F8's own documented behavior (unconditional
 *      overwrite, no diffing) is inherited unchanged, never reimplemented here.
 *   4. The sequence that avoids inconsistent preview state: LOCATE (validate the project is still
 *      discoverable) → STOP (the old process, before touching anything on disk) → GENERATE + WRITE
 *      (only after the old process is out of the way) → START a NEW session → wait for READY.
 *      Every step gates the next; a failure at any step returns immediately with the exact phase
 *      named, and never proceeds to a step whose precondition didn't hold.
 *
 * `loadProject`/`regenerateProject` are injectable (default to F9's `loadPreviewProject` / F7's
 * `runFullstackCommand`) — the same default-parameter testability seam every prior F-series
 * constructor uses (F7 §2, F10 §1, F11 §1) — so this module is testable without depending on the
 * real repo's `projects/` tree, while production always gets the real subsystems by default.
 */
import type { Track } from '../paths.js';
import { runFullstackCommand } from './fullstack-command.js';
import type { GeneratedProject } from './project-generator.js';
import { createFilesystemWriter, type FilesystemWriter } from './filesystem-writer.js';
import { loadPreviewProject, type PreviewProject } from './preview-workspace.js';
import type { PreviewServer, PreviewSession } from './preview-server.js';
import { createPreviewHealth, type PreviewHealth, type HealthSnapshot } from './preview-health.js';

export type RegenerationPolicy = 'PLANNING' | 'STOPPING' | 'GENERATING' | 'STARTING' | 'READY' | 'FAILED';

export interface RegenerationPlan {
  readonly sessionId: string;
  readonly client: string;
  readonly track: Track;
  readonly targetDir: string;
  readonly previousPort: number;
  readonly plannedAt: string;
}

export interface RegenerationResult {
  /** `undefined` only when PLANNING itself failed before a plan could be built. */
  readonly plan: RegenerationPlan | undefined;
  /** The final outcome: 'READY' or 'FAILED'. */
  readonly phase: RegenerationPolicy;
  /** Set iff `phase === 'FAILED'` — which of PLANNING/STOPPING/GENERATING/STARTING/READY broke. */
  readonly failedPhase: RegenerationPolicy | undefined;
  /** The NEW session, present once STARTING was reached (regardless of eventual READY/FAILED). */
  readonly session: PreviewSession | undefined;
  /** The final health snapshot, present once the READY phase was reached. */
  readonly health: HealthSnapshot | undefined;
  readonly diagnostics: readonly string[];
}

export interface RegenerateOptions {
  readonly startTimeoutMs?: number;
  readonly readinessTimeoutMs?: number;
  /** Forwarded to `PreviewServer.start` for the new session. Omit to let F10 auto-allocate. */
  readonly port?: number;
}

export interface PreviewRegenerationManager {
  regenerate(sessionId: string, opts?: RegenerateOptions): Promise<RegenerationResult>;
}

export interface RegenerationManagerDeps {
  readonly health?: PreviewHealth;
  readonly writer?: FilesystemWriter;
  /** Defaults to `runFullstackCommand` (F7). */
  readonly regenerateProject?: (client: string, track: Track) => GeneratedProject;
  /** Defaults to `loadPreviewProject` (F9). */
  readonly loadProject?: (client: string, track: Track) => PreviewProject;
}

function freezeResult(r: RegenerationResult): RegenerationResult {
  return Object.freeze({ ...r, diagnostics: Object.freeze([...r.diagnostics]) });
}

export function createPreviewRegenerationManager(
  server: PreviewServer,
  deps: RegenerationManagerDeps = {},
): PreviewRegenerationManager {
  const health = deps.health ?? createPreviewHealth();
  const writer = deps.writer ?? createFilesystemWriter();
  const regenerateProject = deps.regenerateProject ?? runFullstackCommand;
  const loadProject = deps.loadProject ?? loadPreviewProject;

  return {
    async regenerate(sessionId, opts = {}) {
      const diagnostics: string[] = [];

      // ── PLANNING — locate the current session and confirm the project is still discoverable ──
      let current: PreviewSession;
      let previewProject: PreviewProject;
      try {
        current = server.getSession(sessionId);
        previewProject = loadProject(current.client, current.track);
      } catch (err) {
        diagnostics.push(`PLANNING failed: ${(err as Error).message}`);
        return freezeResult({ plan: undefined, phase: 'FAILED', failedPhase: 'PLANNING', session: undefined, health: undefined, diagnostics });
      }
      const plan: RegenerationPlan = Object.freeze({
        sessionId,
        client: current.client,
        track: current.track,
        targetDir: previewProject.path,
        previousPort: current.port,
        plannedAt: new Date().toISOString(),
      });
      diagnostics.push(`PLANNING: session=${plan.sessionId} client=${plan.client} track=${plan.track} targetDir=${plan.targetDir}`);

      // ── STOPPING — tear down the old process BEFORE touching anything on disk ───────────────
      try {
        server.stop(sessionId);
        diagnostics.push(`STOPPING: session ${sessionId} stopped.`);
      } catch (err) {
        diagnostics.push(`STOPPING failed: ${(err as Error).message}`);
        return freezeResult({ plan, phase: 'FAILED', failedPhase: 'STOPPING', session: undefined, health: undefined, diagnostics });
      }

      // ── GENERATING — reuse F7 + F8 verbatim; a failure here must NOT restart a preview ───────
      let generated: GeneratedProject;
      try {
        generated = regenerateProject(plan.client, plan.track);
        writer.write(generated, plan.targetDir);
      } catch (err) {
        diagnostics.push(`GENERATING failed: ${(err as Error).message}`);
        return freezeResult({ plan, phase: 'FAILED', failedPhase: 'GENERATING', session: undefined, health: undefined, diagnostics });
      }
      diagnostics.push(`GENERATING: wrote ${generated.files.length} file(s) (digest ${generated.digest.slice(0, 12)}…) to ${plan.targetDir}`);

      // ── STARTING — a NEW session for the freshly-written project ────────────────────────────
      let newSession: PreviewSession;
      try {
        const updatedProject = loadProject(plan.client, plan.track);
        newSession = server.start(updatedProject, { startTimeoutMs: opts.startTimeoutMs, port: opts.port });
      } catch (err) {
        diagnostics.push(`STARTING failed: ${(err as Error).message}`);
        return freezeResult({ plan, phase: 'FAILED', failedPhase: 'STARTING', session: undefined, health: undefined, diagnostics });
      }
      if (newSession.state === 'FAILED') {
        diagnostics.push(`STARTING failed: ${newSession.diagnostics.map((d) => d.message).join('; ')}`);
        return freezeResult({ plan, phase: 'FAILED', failedPhase: 'STARTING', session: newSession, health: undefined, diagnostics });
      }
      diagnostics.push(`STARTING: new session ${newSession.id} on port ${newSession.port}.`);

      // ── READY — wait for the new session to actually answer, not just exist ─────────────────
      const finalHealth = await health.waitUntilReady(() => server.getSession(newSession.id), {
        timeoutMs: opts.readinessTimeoutMs,
      });
      if (finalHealth.readiness !== 'READY') {
        server.stop(newSession.id); // process hygiene only — the regenerated project stays on disk
        diagnostics.push(
          `READY failed: readiness=${finalHealth.readiness} (${finalHealth.failureReason ?? 'no reason given'}). The regenerated project on disk was preserved.`,
        );
        return freezeResult({
          plan,
          phase: 'FAILED',
          failedPhase: 'READY',
          session: server.getSession(newSession.id),
          health: finalHealth,
          diagnostics,
        });
      }
      diagnostics.push(`READY: session ${newSession.id} is ready at ${finalHealth.endpoint}.`);

      return freezeResult({
        plan,
        phase: 'READY',
        failedPhase: undefined,
        session: server.getSession(newSession.id),
        health: finalHealth,
        diagnostics,
      });
    },
  };
}
