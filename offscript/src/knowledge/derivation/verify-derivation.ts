/**
 * Sprint X — the derivation Verification Harness.
 *
 * A single command that verifies the Governed Model Derivation layer obeys its invariants. It
 * VALIDATES derivation; it never participates in any pipeline. It drives the layer through its
 * public seam (deriveModels + an injected deriver) and emits a structured report. Like the main
 * harness, it never throws on a finding — it records a failed check and continues.
 *
 * Dimensions, per Model and across the set:
 *   existence     — every one of the seven Models is present
 *   immutability  — each Model + its result are deep-frozen
 *   governance    — model- and category-level governance references are present + traceable
 *   schema        — every authored category is present (none omitted) and none is invented
 *   identity      — each Model + the set carry content-hash identities
 *   evidence      — each Model binds the brief + repository identities
 *   replay        — re-deriving reproduces every identity (scripted double remains stable)
 *
 * Phase A boundary: this harness proves the Models as first-class artifacts. It does NOT route
 * them to any engine — no downstream consumption.
 */
import { canonicalText } from '../digest.js';
import {
  MODEL_KINDS,
  MODEL_SCHEMA,
  type ModelKind,
  type RawBrief,
  type GovernedModel,
  type DerivedModelSet,
} from './models.js';
import { deriveModels, type DerivationRepository, type ModelDeriver } from './deriver.js';
import { defaultScriptedDeriver } from './scripted-deriver.js';

export const DERIVATION_HARNESS_VERSION = '0.1.0';

const SHA = /^sha256:[0-9a-f]{64}$/;
const DERIVATION_CATEGORIES = [
  'existence',
  'immutability',
  'governance',
  'schema',
  'identity',
  'evidence',
  'replay',
] as const;
export type DerivationCheckCategory = (typeof DERIVATION_CATEGORIES)[number];

export interface DerivationCheck {
  readonly category: DerivationCheckCategory;
  /** The Model this check concerns, or 'set' for set-level checks. */
  readonly model: ModelKind | 'set';
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface DerivationVerificationReport {
  readonly ok: boolean;
  readonly harnessVersion: string;
  readonly repositoryIdentity: string;
  readonly derivationIdentity: string;
  readonly modelsVerified: number;
  readonly summary: {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
    readonly byCategory: Record<DerivationCheckCategory, { passed: number; failed: number }>;
  };
  readonly checks: readonly DerivationCheck[];
}

export interface DerivationHarnessOptions {
  /** The deriver to verify. Default: the deterministic scripted double. */
  readonly deriver?: ModelDeriver;
}

function deepFrozen(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value as Record<string, unknown>).every(deepFrozen);
}

type Checks = DerivationCheck[];
function check(out: Checks, category: DerivationCheckCategory, model: ModelKind | 'set', name: string, passed: boolean, detail = ''): void {
  out.push({ category, model, name, passed, detail });
}

function verifyModel(out: Checks, kind: ModelKind, model: GovernedModel | undefined): void {
  if (!model) {
    check(out, 'existence', kind, `${kind} Model exists`, false, 'absent');
    return;
  }
  check(out, 'existence', kind, `${kind} Model exists`, model.kind === kind, model.kind);

  // immutability
  check(out, 'immutability', kind, `${kind} Model is deep-frozen`, deepFrozen(model), '');

  // schema — exactly the authored categories (none omitted, none invented)
  const authored = MODEL_SCHEMA[kind].categories.map((c) => c.key).sort();
  const present = Object.keys(model.result).sort();
  const missing = authored.filter((k) => !present.includes(k));
  const extra = present.filter((k) => !authored.includes(k));
  check(out, 'schema', kind, `${kind} represents every authored category, none invented`, missing.length === 0 && extra.length === 0, [missing.length ? `missing: ${missing.join(', ')}` : '', extra.length ? `invented: ${extra.join(', ')}` : ''].filter(Boolean).join('; '));

  // governance — model-level + every category-level reference, traceable to the constitution
  const doc = MODEL_SCHEMA[kind].model.document;
  const modelRefOk = model.governanceReferences.model.document === doc && /§/.test(model.governanceReferences.model.section);
  const catRefsOk = MODEL_SCHEMA[kind].categories.every((c) => {
    const dc = model.result[c.key];
    return !!dc && dc.governanceRef.document === doc && /§/.test(dc.governanceRef.section);
  });
  check(out, 'governance', kind, `${kind} carries traceable governance references (model + category level)`, modelRefOk && catRefsOk, doc);

  // identity
  check(out, 'identity', kind, `${kind} identity is a content hash`, SHA.test(model.identity), model.identity);
}

/**
 * Verify the derivation layer and produce a report. Re-derives once to prove replay. Never throws
 * on a finding; a deriver that fails the lifecycle (e.g. omits a category) is recorded as failures.
 */
export async function verifyDerivation(
  repo: DerivationRepository,
  brief: RawBrief,
  options: DerivationHarnessOptions = {},
): Promise<DerivationVerificationReport> {
  const out: Checks = [];
  const deriver = options.deriver ?? defaultScriptedDeriver();
  const repoId = repo?.repositoryIdentity ?? '';

  let set: DerivedModelSet | null = null;
  try {
    set = await deriveModels(brief, repo, deriver);
  } catch (e) {
    check(out, 'existence', 'set', 'derivation completes the lifecycle', false, e instanceof Error ? `${(e as { code?: string }).code ?? ''} ${e.message}`.trim() : String(e));
    return finalize(out, repoId, '', 0);
  }

  // Per-model checks.
  let modelsVerified = 0;
  for (const k of MODEL_KINDS) {
    verifyModel(out, k, set.models[k]);
    if (set.models[k]) modelsVerified++;
    // evidence binds brief + repository identities
    const ev = set.models[k]?.evidence;
    check(out, 'evidence', k, `${k} binds brief + repository identities`, !!ev && ev.briefIdentity === set.inputs.briefIdentity && ev.repositoryIdentity === set.inputs.repositoryIdentity, '');
  }

  // Set-level checks.
  check(out, 'existence', 'set', 'all seven Models present', MODEL_KINDS.every((k) => !!set!.models[k]), `${modelsVerified}/7`);
  check(out, 'immutability', 'set', 'the model set is deep-frozen', deepFrozen(set), '');
  check(out, 'identity', 'set', 'set derivation identity is a content hash', SHA.test(set.derivationIdentity), set.derivationIdentity);
  check(out, 'evidence', 'set', 'inputs bind the repository identity', set.inputs.repositoryIdentity === repoId, '');

  // Replay — re-derive and confirm every identity reproduces (scripted double remains stable).
  try {
    const again = await deriveModels(brief, repo, deriver);
    check(out, 'replay', 'set', 'set replays identically', again.derivationIdentity === set.derivationIdentity, '');
    for (const k of MODEL_KINDS) {
      check(out, 'replay', k, `${k} replays identically`, again.models[k]?.identity === set.models[k]?.identity, '');
    }
  } catch (e) {
    check(out, 'replay', 'set', 'set replays identically', false, e instanceof Error ? e.message : String(e));
  }

  return finalize(out, repoId, set.derivationIdentity, modelsVerified);
}

function finalize(out: Checks, repoId: string, derivationIdentity: string, modelsVerified: number): DerivationVerificationReport {
  const byCategory = Object.fromEntries(DERIVATION_CATEGORIES.map((c) => [c, { passed: 0, failed: 0 }])) as Record<DerivationCheckCategory, { passed: number; failed: number }>;
  let passed = 0;
  for (const c of out) {
    if (c.passed) {
      passed++;
      byCategory[c.category].passed++;
    } else {
      byCategory[c.category].failed++;
    }
  }
  return {
    ok: passed === out.length && out.length > 0,
    harnessVersion: DERIVATION_HARNESS_VERSION,
    repositoryIdentity: repoId,
    derivationIdentity,
    modelsVerified,
    summary: { total: out.length, passed, failed: out.length - passed, byCategory },
    checks: out,
  };
}

/** Stable canonical text of a report — for snapshotting / equality in tests. */
export function derivationReportText(report: DerivationVerificationReport): string {
  return canonicalText(report);
}
