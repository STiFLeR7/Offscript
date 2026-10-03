/**
 * P49 — Brief Source abstraction + registry.
 *
 * A BriefSource turns acquisition inputs into a Canonical Brief. Every source funnels through the
 * shared normalizer (`brief-normalizer.ts`), so all sources emit the identical brief.md contract
 * and the generator can never tell which one ran. Sources register into an extensible registry;
 * adding an input channel is a new BriefSource, never an orchestration edit.
 */
import type { Track } from '../paths.js';
import type { ProjectType } from './project-registry.js';
import type { NormalizedBriefInput } from './brief-normalizer.js';
import type { Brief } from '../generate/brief.js';

/** Everything a source may need to produce a brief. Not all fields apply to every source. */
export interface BriefAcquisitionContext {
  readonly client: string;
  readonly projectType: ProjectType;
  /** The deliverable track this brief targets (one of the project type's deliverables). */
  readonly track: Track;
  /** Content-Core input packet path (present ⇒ the content-core source applies). */
  readonly packetPath?: string;
  /** Creative Intent artifact path (present ⇒ the creative-intent source applies). */
  readonly creativeIntentPath?: string;
  /** Structured interview answers (the manual source's input). */
  readonly answers?: Record<string, unknown>;
  /** Injected ISO timestamp for deterministic adapter runs. */
  readonly now?: string;
}

/** A produced Canonical Brief — the brief.md text plus an optional grounding source doc. */
export interface CanonicalBriefResult {
  readonly client: string;
  readonly sourceId: string;
  /** Canonical brief.md text (already normalized). */
  readonly briefText: string;
  /** Optional long-form grounding doc to write alongside the brief. */
  readonly sourceDoc?: { readonly name: string; readonly text: string };
}

export interface BriefSource {
  readonly id: string;
  readonly label: string;
  /** Can this source handle the given context? */
  detect(ctx: BriefAcquisitionContext): boolean;
  /** Produce the Canonical Brief. */
  produce(ctx: BriefAcquisitionContext): Promise<CanonicalBriefResult>;
}

// ── Registry ────────────────────────────────────────────────────────────────
let registry: BriefSource[] = [];

/** Register a brief source (extensibility — new channels need no orchestration change). */
export function registerBriefSource(source: BriefSource): void {
  if (registry.some((s) => s.id === source.id)) {
    throw new Error(`brief source "${source.id}" is already registered.`);
  }
  registry.push(source);
}

export function listBriefSources(): BriefSource[] {
  return [...registry];
}

/** Select the first registered source whose `detect` accepts the context. */
export function selectBriefSource(ctx: BriefAcquisitionContext): BriefSource {
  const s = registry.find((src) => src.detect(ctx));
  if (!s) {
    throw new Error(
      `no brief source can handle this context (packet=${ctx.packetPath ? 'yes' : 'no'}, ` +
        `answers=${ctx.answers ? 'yes' : 'no'}). Registered: ${registry.map((r) => r.id).join(', ') || '(none)'}.`,
    );
  }
  return s;
}

/** Test-only: clear the registry. */
export function _resetBriefSources(): void {
  registry = [];
}

// ── Shared mapping helpers (every source produces the SAME intermediate) ──────

/** Read a value from interview answers under either a camelCase or kebab-case key. */
function pick(answers: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) if (answers[k] != null) return answers[k];
  return undefined;
}
function str(v: unknown): string | undefined {
  return v == null || String(v).trim() === '' ? undefined : String(v);
}
function arr(v: unknown): string[] | undefined {
  if (v == null) return undefined;
  const a = (Array.isArray(v) ? v : [v]).map(String).filter((s) => s.trim() !== '');
  return a.length > 0 ? a : undefined;
}

/** Map structured interview answers → the common NormalizedBriefInput (manual source). */
export function answersToNormalized(track: Track, answers: Record<string, unknown>): NormalizedBriefInput {
  return {
    track,
    oneLiner: str(pick(answers, 'oneLiner', 'one-liner')) ?? '',
    brand: str(pick(answers, 'brand')),
    audience: str(pick(answers, 'audience')),
    goals: arr(pick(answers, 'goals')),
    mustInclude: arr(pick(answers, 'mustInclude', 'must-include')),
    tone: str(pick(answers, 'tone')),
    successCriteria: arr(pick(answers, 'successCriteria', 'success-criteria')),
    parentUrl: str(pick(answers, 'parentUrl', 'parent_url')),
    sourceDoc: str(pick(answers, 'sourceDoc', 'source-doc')),
    provenance: provRecord(pick(answers, 'provenance')),
    body: str(pick(answers, 'body')),
  };
}

/** Coerce an answer's provenance mapping to Record<string,string> (opaque; engine never reads it). */
function provRecord(v: unknown): Record<string, string> | undefined {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) if (val != null) out[k] = String(val);
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Map a parsed Brief (e.g. from the Content-Core or Creative Intent adapter's output) →
 * NormalizedBriefInput. `body` is deliberately NOT forwarded here: every adapter round-trip that
 * reaches this function (content-core, creative-intent, and any future adapter reusing it) writes
 * only a fixed, self-describing pointer/notice into `body` — never real generation content (that
 * travels via `source-doc`, which IS forwarded, or plain frontmatter fields). Forwarding it made
 * plan()'s body segmentation treat that boilerplate as real Tier-2 source content, tripping a
 * false source-fidelity G2 (no-silent-loss) failure. `answersToNormalized` (the manual/interview
 * source) is untouched — a human-authored `body` answer is genuine content and must keep flowing.
 */
export function briefToNormalized(b: Brief): NormalizedBriefInput {
  return {
    track: b.track,
    oneLiner: b.oneLiner,
    brand: b.brand,
    audience: b.audience || undefined,
    goals: b.goals.length ? b.goals : undefined,
    mustInclude: b.mustInclude.length ? b.mustInclude : undefined,
    tone: b.tone || undefined,
    successCriteria: b.successCriteria.length ? b.successCriteria : undefined,
    parentUrl: b.parentUrl,
    sourceDoc: b.sourceDoc,
    provenance: b.provenance,
  };
}
