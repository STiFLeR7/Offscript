/**
 * Render-probe crash isolation (I-3).
 *
 * Every render rail measures the live page via `RenderContext.probe<T>(fnString)`,
 * which can reject (Playwright timeout, page crash, eval error). Left unhandled,
 * a single probe rejection used to discard the *entire* render tier's findings for
 * a run (the dispatch built results as an array of sequential awaits — one throw
 * aborted the batch before any rail was recorded), masking real geometric failures
 * behind a clean-looking score.
 *
 * These helpers make a probe failure degrade *only its own rail* to a single
 * `'<rail>:probe-error'` warning ("geometry not verified"), surfaced in the score —
 * never a silent clean pass.
 *
 * See docs/internals/OFFSCRIPT-V2-I3-PROBE-CRASH-ISOLATION.md.
 */
import type { Finding } from './operator.js';
import type { RenderContext } from './render-context.js';

/** The warning a rail emits when its probe could not run. First line of the error only. */
export function probeErrorFinding(railName: string, err: unknown): Finding {
  const msg = (err instanceof Error ? err.message : String(err)).split('\n')[0];
  return {
    id: `${railName}:probe-error`,
    description: `${railName} render probe failed (${msg}) — geometry not verified.`,
    outcome: 'warning',
  };
}

export type ProbeResult<T> = { ok: true; value: T } | { ok: false; degrade: Finding[] };

/**
 * Wrap `rc.probe<T>(fnSource)`: a rejection becomes a single warning degrade
 * instead of a throw, so the caller returns `res.degrade` rather than propagating.
 */
export async function safeProbe<T>(
  rc: RenderContext,
  fnSource: string,
  railName: string,
): Promise<ProbeResult<T>> {
  try {
    return { ok: true, value: await rc.probe<T>(fnSource) };
  } catch (err) {
    return { ok: false, degrade: [probeErrorFinding(railName, err)] };
  }
}

/**
 * Run one rail's async detector in isolation. Any throw (probe failure that slipped
 * past `safeProbe`, or a mapping bug) degrades only this rail — a sibling rail's
 * already-computed findings are never discarded.
 */
export async function collectRail(
  railName: string,
  run: () => Promise<Finding[]>,
): Promise<{ name: string; findings: Finding[] }> {
  try {
    return { name: railName, findings: await run() };
  } catch (err) {
    return { name: railName, findings: [probeErrorFinding(railName, err)] };
  }
}
