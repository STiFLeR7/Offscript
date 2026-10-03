/**
 * Sprint 8 — Verification Harness.
 *
 * A single command that continuously verifies the COMPLETE pipeline
 *   Repository → Discovery → Composition → Conditioning → Authoring → Execution
 * obeys the architectural invariants. The harness VALIDATES execution; it never participates
 * in it. It drives every engine through their public seams (no engine is modified), runs each
 * stage independently and end-to-end, and emits a structured Verification Report.
 *
 * Six verification dimensions:
 *   1 invariant       per-stage structural invariants (repository → execution)
 *   2 identity        the identity chain links downstream back to the repository
 *   3 replay          re-running the deterministic stages reproduces the same identities
 *   4 evidence        obligations trace unbroken from discovery through authoring
 *   5 determinism     deterministic metadata is stable; provider payload may differ (boundary)
 *   6 conformance     no mutation of upstream state, validation enforced, identities + evidence
 *                     present, outputs immutable, stage outputs pure (no forbidden-layer reads)
 *
 * Future providers automatically inherit the harness: pass any Author implementation as
 * `provider` and the same checks apply. The harness never throws on a *finding* — it records a
 * failed check and continues — so a single report describes the whole architecture's health.
 */
import { canonicalText } from './digest.js';
import { buildDependencyGraph, buildSemanticGraph } from './graph.js';
import { discover, discoveryDigest, type DiscoveryIntent, type DiscoveryRepository } from './discovery.js';
import { compose, compositionDigest, repositoryIdentity, type CompositionRepository } from './composition.js';
import { condition } from './conditioning.js';
import { runAuthoring, type Author, type AuthoringRequest } from './authoring.js';
import { execute } from './execution.js';
import type { NormalizedAsset } from './model.js';
import type { GovernedVocabulary } from './vocabulary.js';
import { verifyDerivation, type DerivationVerificationReport } from './derivation/verify-derivation.js';
import { deriveModels, type ModelDeriver } from './derivation/deriver.js';
import { MODEL_KINDS, type RawBrief } from './derivation/models.js';

export const VERIFICATION_HARNESS_VERSION = '0.1.0';

const SHA = /^sha256:[0-9a-f]{64}$/;
const CATEGORIES = ['invariant', 'identity', 'replay', 'evidence', 'determinism', 'conformance'] as const;

export type VerificationCategory = (typeof CATEGORIES)[number];
export type VerificationStage =
  | 'repository' | 'graph' | 'discovery' | 'composition' | 'conditioning' | 'authoring' | 'execution' | 'pipeline';

export interface VerificationCheck {
  readonly category: VerificationCategory;
  readonly stage: VerificationStage;
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface IdentityChain {
  readonly repository: string;
  readonly composition: string;
  readonly conditioning: string;
  readonly authoring: string;
  readonly execution: string;
}

export interface EvidenceChain {
  readonly repositoryFacts: number;
  readonly discoveryObligations: readonly string[];
  readonly compositionObligations: readonly string[];
  readonly conditioningObligations: readonly string[];
  readonly authoringObligations: readonly string[];
}

export interface VerificationReport {
  readonly ok: boolean;
  readonly harnessVersion: string;
  readonly repositoryIdentity: string;
  readonly intentsVerified: number;
  readonly summary: {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
    readonly byCategory: Record<VerificationCategory, { passed: number; failed: number }>;
  };
  readonly checks: readonly VerificationCheck[];
  /** A representative concrete trace (the first lawful intent), or null if none ran. */
  readonly trace: { readonly intent: readonly string[]; readonly identityChain: IdentityChain; readonly evidenceChain: EvidenceChain } | null;
  /**
   * The Governed Model Derivation sub-report — present ONLY when a `deriver` + `brief` are supplied
   * (Sprint X). Absent by default, so the default report is byte-identical to pre-derivation runs.
   * The derivation layer is verified ALONGSIDE the pipeline; it never participates in it.
   */
  readonly derivation?: DerivationVerificationReport;
}

/** The repository the harness verifies (loaded, validated normalized model + vocabulary). */
export interface HarnessRepository {
  readonly assets: readonly NormalizedAsset[];
  readonly vocabulary: GovernedVocabulary;
}

export interface HarnessOptions {
  /** Intents to verify across. Default: one per satisfiable obligation in the vocabulary. */
  readonly intents?: readonly DiscoveryIntent[];
  /** The recording author for the authoring pass. Default: a deterministic pick-first recorder. */
  readonly recordingAuthor?: Author;
  /** The provider executed by the execution runtime. Default: an inert mock provider. */
  readonly provider?: Author;
  readonly requestId?: string;
  /**
   * Sprint X — when BOTH are supplied, the Governed Model Derivation layer is verified alongside
   * the pipeline and attached as `report.derivation`. Omit either to leave the report unchanged.
   */
  readonly deriver?: ModelDeriver;
  readonly brief?: RawBrief;
}

// --- default mocked seams (no real models) ---
const defaultRecordingAuthor: Author = {
  name: 'verify::recorder',
  author: (req) => ({ determinations: req.context.unresolvedPlurality.map((g) => ({ key: g.key, selected: g.members[0] })), payload: { recorded: true } }),
};
const defaultProvider: Author = { name: 'verify::provider', author: () => ({ determinations: [], payload: { artifact: 'verified' } }) };

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
function eq(a: unknown, b: unknown): boolean {
  return canonicalText(a) === canonicalText(b);
}
function fingerprint(assets: readonly NormalizedAsset[]): string {
  return canonicalText(
    assets.map((a) => ({ id: a.identity.id, satisfies: a.capabilities.satisfies, specializes: a.semantics.specializes, prerequisite: a.dependencies.prerequisite })),
  );
}
function deriveIntents(repo: HarnessRepository): DiscoveryIntent[] {
  const satisfied = new Set<string>();
  for (const a of repo.assets) for (const s of a.capabilities.satisfies) satisfied.add(s);
  return [...repo.vocabulary.obligations].filter((t) => satisfied.has(t)).sort().map((t) => ({ obligations: [t] }));
}

type Checks = VerificationCheck[];
function check(out: Checks, category: VerificationCategory, stage: VerificationStage, name: string, passed: boolean, detail = ''): void {
  out.push({ category, stage, name, passed, detail });
}

/** A fully-built lawful run, used by both per-intent verification and conformance probes. */
interface LawfulRun {
  readonly intent: DiscoveryIntent;
  readonly discovery: ReturnType<typeof discover>;
  readonly plan: ReturnType<typeof compose>;
  readonly ctx: ReturnType<typeof condition>;
  readonly ar: Awaited<ReturnType<typeof runAuthoring>>;
}

async function buildLawful(
  intent: DiscoveryIntent,
  discoveryRepo: DiscoveryRepository,
  composeRepo: CompositionRepository,
  recorder: Author,
  requestId: string,
): Promise<LawfulRun | null> {
  try {
    const discovery = discover(intent, discoveryRepo);
    const plan = compose(discovery, composeRepo);
    const ctx = condition(plan, composeRepo, { requestId });
    const ar = await runAuthoring(ctx, recorder);
    return { intent, discovery, plan, ctx, ar };
  } catch {
    return null;
  }
}

/** Verify one lawful intent end-to-end; push checks. Returns the concrete trace when capturing. */
async function verifyIntent(
  intent: DiscoveryIntent,
  discoveryRepo: DiscoveryRepository,
  composeRepo: CompositionRepository,
  repoId: string,
  recorder: Author,
  provider: Author,
  requestId: string,
  out: Checks,
  capture: boolean,
): Promise<VerificationReport['trace']> {
  const label = (intent.obligations ?? []).join('+') || '(empty)';

  // --- Discovery ---
  const discovery = discover(intent, discoveryRepo);
  check(out, 'invariant', 'discovery', `[${label}] discovery yields ≥1 lawful candidate`, discovery.candidates.length > 0, `candidates=${discovery.candidates.length}`);
  check(out, 'invariant', 'discovery', `[${label}] discovery has no unresolved obligations`, discovery.unresolvedObligations.length === 0, discovery.unresolvedObligations.join(', '));
  const present = new Set(discoveryRepo.assets.map((a) => a.identity.id));
  check(out, 'invariant', 'discovery', `[${label}] every candidate exists in the repository`, discovery.candidates.every((c) => present.has(c.id)), '');

  // --- Composition ---
  const plan = compose(discovery, composeRepo);
  const orderSet = new Set(plan.order);
  const unitsSet = new Set(plan.units.map((u) => u.id));
  check(out, 'invariant', 'composition', `[${label}] order is a permutation of units`, plan.order.length === plan.units.length && orderSet.size === unitsSet.size && [...orderSet].every((id) => unitsSet.has(id)), `order=${plan.order.length}, units=${plan.units.length}`);
  const pos = new Map(plan.order.map((id, i) => [id, i]));
  const topoOk = plan.units.every((u) => u.requires.every((r) => !pos.has(r) || pos.get(r)! < pos.get(u.id)!));
  check(out, 'invariant', 'composition', `[${label}] topological order respects every dependency`, topoOk, '');
  check(out, 'identity', 'composition', `[${label}] plan binds to the repository identity`, plan.repositoryIdentity === repoId, plan.repositoryIdentity);
  check(out, 'evidence', 'composition', `[${label}] obligations preserved from discovery`, eq(plan.obligations, discovery.resolvedObligations), '');

  // --- Conditioning ---
  const ctx = condition(plan, composeRepo, { requestId });
  check(out, 'invariant', 'conditioning', `[${label}] authoring context is immutable (frozen)`, Object.isFrozen(ctx), '');
  check(out, 'invariant', 'conditioning', `[${label}] conditioning identity is a content hash`, SHA.test(ctx.conditioningIdentity), ctx.conditioningIdentity);
  check(out, 'identity', 'conditioning', `[${label}] context binds the plan's repository identity`, ctx.repositoryIdentity === plan.repositoryIdentity, '');
  check(out, 'evidence', 'conditioning', `[${label}] obligations preserved from the plan`, eq(ctx.obligations, plan.obligations), '');
  check(out, 'invariant', 'conditioning', `[${label}] unresolved plurality preserved (never resolved)`, eq(ctx.unresolvedPlurality, plan.unresolvedPlurality), '');

  // --- Authoring ---
  const ar = await runAuthoring(ctx, recorder);
  check(out, 'invariant', 'authoring', `[${label}] authoring result is immutable (frozen)`, Object.isFrozen(ar), '');
  check(out, 'invariant', 'authoring', `[${label}] authoring identity is a content hash`, SHA.test(ar.authoringIdentity), ar.authoringIdentity);
  check(out, 'identity', 'authoring', `[${label}] authoring carries the conditioning identity`, ar.conditioningIdentity === ctx.conditioningIdentity, '');
  check(out, 'identity', 'authoring', `[${label}] authoring carries the repository identity`, ar.repositoryIdentity === ctx.repositoryIdentity, '');
  const lawfulSelections = ar.determinations.every((d) => d.from.includes(d.selected));
  check(out, 'evidence', 'authoring', `[${label}] every determination is a lawful (traceable) selection`, lawfulSelections, '');
  const allPluralityResolved = eq(ar.determinations.map((d) => d.key).sort(), ctx.unresolvedPlurality.map((g) => g.key).sort());
  check(out, 'invariant', 'authoring', `[${label}] exactly the preserved plurality is resolved`, allPluralityResolved, '');
  check(out, 'evidence', 'authoring', `[${label}] authoring evidence preserves the obligations`, eq(ar.evidence.obligations, ctx.obligations), '');

  // --- Execution ---
  const er = await execute(ar, provider);
  check(out, 'invariant', 'execution', `[${label}] execution result is immutable (frozen)`, Object.isFrozen(er), '');
  check(out, 'invariant', 'execution', `[${label}] execution identity is a content hash`, SHA.test(er.executionIdentity), er.executionIdentity);
  check(out, 'invariant', 'execution', `[${label}] execution succeeded`, er.status === 'succeeded', er.status);
  check(out, 'invariant', 'execution', `[${label}] provider determinism boundary is recorded`, er.provider.deterministic === false, '');
  check(out, 'identity', 'execution', `[${label}] execution carries the authoring identity`, er.authoringIdentity === ar.authoringIdentity, '');

  // --- Replay (deterministic stages reproduce identities) ---
  const d2 = discover(intent, discoveryRepo);
  check(out, 'replay', 'discovery', `[${label}] discovery replays identically`, discoveryDigest(d2) === discoveryDigest(discovery), '');
  const p2 = compose(d2, composeRepo);
  check(out, 'replay', 'composition', `[${label}] composition replays identically`, compositionDigest(p2) === compositionDigest(plan), '');
  const c2 = condition(p2, composeRepo, { requestId });
  check(out, 'replay', 'conditioning', `[${label}] conditioning replays identically`, c2.conditioningIdentity === ctx.conditioningIdentity, '');
  const a2 = await runAuthoring(c2, recorder);
  check(out, 'replay', 'authoring', `[${label}] authoring replays identically`, a2.authoringIdentity === ar.authoringIdentity, '');
  const e2 = await execute(a2, provider);
  check(out, 'replay', 'execution', `[${label}] execution metadata replays identically`, e2.executionIdentity === er.executionIdentity, '');

  // --- Determinism boundary (captured once, on the first lawful intent) ---
  if (capture) {
    const boundaryA: Author = { name: 'verify::boundary', author: () => ({ determinations: [], payload: { variant: 'A' } }) };
    const boundaryB: Author = { name: 'verify::boundary', author: () => ({ determinations: [], payload: { variant: 'B' } }) };
    const bA = await execute(ar, boundaryA);
    const bB = await execute(ar, boundaryB);
    check(out, 'determinism', 'execution', `[${label}] execution metadata is stable across provider runs`, bA.executionIdentity === bB.executionIdentity, '');
    check(out, 'determinism', 'execution', `[${label}] provider payload is free to differ (non-deterministic output)`, !eq(bA.payload, bB.payload), '');
  }

  if (!capture) return null;
  return {
    intent: discovery.intent,
    identityChain: {
      repository: repoId,
      composition: plan.repositoryIdentity,
      conditioning: ctx.conditioningIdentity,
      authoring: ar.authoringIdentity,
      execution: er.executionIdentity,
    },
    evidenceChain: {
      repositoryFacts: discoveryRepo.assets.length,
      discoveryObligations: discovery.resolvedObligations.map((o) => o.token),
      compositionObligations: plan.obligations.map((o) => o.token),
      conditioningObligations: ctx.obligations.map((o) => o.token),
      authoringObligations: ar.evidence.obligations.map((o) => o.token),
    },
  };
}

function probeThrows(out: Checks, stage: VerificationStage, name: string, fn: () => unknown, expected: string): void {
  try {
    fn();
    check(out, 'conformance', stage, name, false, `expected ${expected} but no error was thrown`);
  } catch (e) {
    const code = (e as { code?: string })?.code;
    check(out, 'conformance', stage, name, code === expected, code === expected ? `threw ${code}` : `threw ${code ?? msg(e)} (expected ${expected})`);
  }
}
async function probeThrowsAsync(out: Checks, stage: VerificationStage, name: string, fn: () => Promise<unknown>, expected: string): Promise<void> {
  try {
    await fn();
    check(out, 'conformance', stage, name, false, `expected ${expected} but no error was thrown`);
  } catch (e) {
    const code = (e as { code?: string })?.code;
    check(out, 'conformance', stage, name, code === expected, code === expected ? `threw ${code}` : `threw ${code ?? msg(e)} (expected ${expected})`);
  }
}

/**
 * Verify the complete architecture and produce a Verification Report.
 * A single command; future providers inherit it via the `provider` option.
 */
export async function verifyArchitecture(repo: HarnessRepository, options: HarnessOptions = {}): Promise<VerificationReport> {
  const out: Checks = [];
  const recorder = options.recordingAuthor ?? defaultRecordingAuthor;
  const provider = options.provider ?? defaultProvider;
  const requestId = options.requestId ?? 'verify';
  const discoveryRepo: DiscoveryRepository = { assets: repo.assets, vocabulary: repo.vocabulary };
  const before = fingerprint(repo.assets);

  // --- Graph stage (must build before anything else) ---
  let composeRepo: CompositionRepository;
  let repoId = '';
  try {
    const dependencyGraph = buildDependencyGraph(repo.assets);
    const semanticGraph = buildSemanticGraph(repo.assets);
    composeRepo = { assets: repo.assets, dependencyGraph, semanticGraph };
    repoId = repositoryIdentity(composeRepo);
    check(out, 'invariant', 'graph', 'dependency + semantic graphs build (acyclic dependency graph)', true, `dep edges=${dependencyGraph.edges.length}, sem edges=${semanticGraph.edges.length}`);
  } catch (e) {
    check(out, 'invariant', 'graph', 'dependency + semantic graphs build (acyclic dependency graph)', false, `graph build failed: ${msg(e)}`);
    return finalize(out, repoId, 0, null);
  }

  // --- Repository invariants ---
  check(out, 'invariant', 'repository', 'repository carries assets', repo.assets.length > 0, `assetCount=${repo.assets.length}`);
  check(out, 'invariant', 'repository', 'every asset has a non-empty identity', repo.assets.every((a) => typeof a.identity.id === 'string' && a.identity.id.length > 0), '');
  check(out, 'invariant', 'repository', 'asset identities are unique', new Set(repo.assets.map((a) => a.identity.id)).size === repo.assets.length, '');
  check(out, 'identity', 'repository', 'repository identity is a content hash', SHA.test(repoId), repoId);

  // --- Per-intent verification (independent + end-to-end) ---
  const intents = options.intents && options.intents.length > 0 ? options.intents : deriveIntents(repo);
  let trace: VerificationReport['trace'] = null;
  let intentsVerified = 0;
  let captured = false;
  for (const intent of intents) {
    const label = (intent.obligations ?? []).join('+') || '(empty)';
    try {
      const t = await verifyIntent(intent, discoveryRepo, composeRepo, repoId, recorder, provider, requestId, out, !captured);
      intentsVerified++;
      if (!captured) {
        trace = t;
        captured = true;
      }
    } catch (e) {
      // A lawful run that raises is a verification failure (recorded, never propagated).
      check(out, 'conformance', 'pipeline', `intent [${label}] completes the full pipeline`, false, `pipeline raised: ${msg(e)}`);
    }
  }

  // --- Architectural conformance ---
  await verifyConformance(repo, discoveryRepo, composeRepo, intents, recorder, requestId, before, out);

  // --- Cross-cutting roll-ups (identities + evidence + purity) ---
  rollups(out);

  // --- Sprint X: optional Governed Model Derivation verification (additive; alongside, not in, the pipeline) ---
  let derivation: DerivationVerificationReport | undefined;
  if (options.deriver && options.brief) {
    derivation = await verifyDerivation(
      { repositoryIdentity: repoId, assetCount: repo.assets.length },
      options.brief,
      { deriver: options.deriver },
    );
    // --- Phase B: prove the Conditioning carrier transports the ModelSet unchanged ---
    await verifyCarrier(repo, composeRepo, repoId, recorder, requestId, intents, options.deriver, options.brief, before, out);
  }

  return finalize(out, repoId, intentsVerified, trace, derivation);
}

/**
 * Phase B — verify the Conditioning Model carrier: the validated ModelSet reaches Conditioning
 * unchanged, identities + replay + governance + evidence + immutability hold, the default path
 * stays byte-identical, the repository is unmutated, and Authoring receives the set untouched.
 * Runs ONLY when a deriver + brief are supplied; never perturbs the per-intent pipeline.
 */
async function verifyCarrier(
  repo: HarnessRepository,
  composeRepo: CompositionRepository,
  repoId: string,
  recorder: Author,
  requestId: string,
  intents: readonly DiscoveryIntent[],
  deriver: ModelDeriver,
  brief: RawBrief,
  before: string,
  out: Checks,
): Promise<void> {
  const discoveryRepo: DiscoveryRepository = { assets: repo.assets, vocabulary: repo.vocabulary };
  // One lawful run to exercise the carrier on a real plan.
  let lawful: LawfulRun | null = null;
  for (const intent of intents) {
    lawful = await buildLawful(intent, discoveryRepo, composeRepo, recorder, requestId);
    if (lawful) break;
  }
  if (!lawful) return; // no lawful plan to carry against — nothing to probe

  const set = await deriveModels(brief, { repositoryIdentity: repoId, assetCount: repo.assets.length }, deriver);
  const withModel = condition(lawful.plan, composeRepo, { requestId }, set);
  const withoutModel = condition(lawful.plan, composeRepo, { requestId });

  // 1 — the ModelSet reaches Conditioning unchanged (every Model identity preserved)
  const carried = !!withModel.models && withModel.models.derivationIdentity === set.derivationIdentity &&
    MODEL_KINDS.every((k) => withModel.models!.models[k].identity === set.models[k].identity);
  check(out, 'evidence', 'conditioning', 'carrier transports the ModelSet unchanged', carried, '');

  // 2 — immutability preserved (deep-frozen)
  const frozen = Object.isFrozen(withModel.models) && Object.isFrozen(withModel.models?.models) &&
    MODEL_KINDS.every((k) => Object.isFrozen(withModel.models!.models[k]) && Object.isFrozen(withModel.models!.models[k].result));
  check(out, 'invariant', 'conditioning', 'carrier ModelSet is deep-frozen (immutable)', frozen, '');

  // 3 — governance references preserved (model + category level)
  const govOk = !!withModel.models && MODEL_KINDS.every((k) => {
    const m = withModel.models!.models[k];
    return !!m.governanceReferences.model.document && Object.values(m.result).every((c) => !!c.governanceRef.document);
  });
  check(out, 'evidence', 'conditioning', 'carrier preserves governance references', govOk, '');

  // 4 — evidence preserved (binds the repository)
  const evOk = !!withModel.models && MODEL_KINDS.every((k) => withModel.models!.models[k].evidence.repositoryIdentity === repoId);
  check(out, 'evidence', 'conditioning', 'carrier preserves Model evidence', evOk, '');

  // 5 — the set identity is folded into the conditioning identity (carry is recorded)
  check(out, 'identity', 'conditioning', 'carrier folds the ModelSet into the conditioning identity', withModel.conditioningIdentity !== withoutModel.conditioningIdentity, '');

  // 6 — default-off path is byte-identical (no Model ⇒ unchanged context)
  check(out, 'invariant', 'conditioning', 'no-Model conditioning is byte-identical (default unchanged)', !('models' in withoutModel) && withoutModel.models === undefined, '');

  // 7 — replay: re-deriving + re-conditioning reproduces the conditioning identity
  const set2 = await deriveModels(brief, { repositoryIdentity: repoId, assetCount: repo.assets.length }, deriver);
  const withModel2 = condition(lawful.plan, composeRepo, { requestId }, set2);
  check(out, 'replay', 'conditioning', 'carrier conditioning replays identically', withModel2.conditioningIdentity === withModel.conditioningIdentity, '');

  // 8 — Phase C: the Author EXPLICITLY receives all seven Models on the request, unchanged.
  let req1: AuthoringRequest | null = null;
  const capture1: Author = {
    name: 'verify::capture-1',
    author: (r) => { req1 = r; return { determinations: r.context.unresolvedPlurality.map((g) => ({ key: g.key, selected: g.members[0] })), payload: null }; },
  };
  const ar = await runAuthoring(withModel, capture1);
  const cap = req1 as AuthoringRequest | null;
  const authorGotAll = !!cap?.models && cap.models.derivationIdentity === set.derivationIdentity &&
    MODEL_KINDS.every((k) => cap.models!.models[k].identity === set.models[k].identity);
  check(out, 'evidence', 'authoring', 'Author receives all seven Models on the request, unchanged', authorGotAll, '');
  const authorGovEv = !!cap?.models && MODEL_KINDS.every((k) => {
    const m = cap.models!.models[k];
    return !!m.governanceReferences.model.document && m.evidence.repositoryIdentity === repoId;
  });
  check(out, 'evidence', 'authoring', 'Author-received Models preserve governance references + evidence', authorGovEv, '');
  check(out, 'conformance', 'authoring', 'runtime exposes the carried set without rebuilding it (same reference)', cap?.models === withModel.models, '');

  // 9 — provider independence: a different Author receives the identical ModelSet
  let req2: AuthoringRequest | null = null;
  const capture2: Author = {
    name: 'verify::capture-2',
    author: (r) => { req2 = r; return { determinations: r.context.unresolvedPlurality.map((g) => ({ key: g.key, selected: g.members[0] })), payload: { other: true } }; },
  };
  await runAuthoring(withModel, capture2);
  const cap2 = req2 as AuthoringRequest | null;
  check(out, 'conformance', 'authoring', 'Model exposure is provider-independent', !!cap2?.models && cap2.models.derivationIdentity === (cap?.models?.derivationIdentity ?? ''), '');

  // 10 — authoring replays identically with a carried set
  const arReplay = await runAuthoring(withModel, capture1);
  check(out, 'replay', 'authoring', 'authoring replays identically with a carried ModelSet', arReplay.authoringIdentity === ar.authoringIdentity, '');

  // 11 — repository fingerprint unchanged by the carrier + consumption
  check(out, 'conformance', 'conditioning', 'carrier does not mutate the repository', fingerprint(repo.assets) === before, '');
}

async function verifyConformance(
  repo: HarnessRepository,
  discoveryRepo: DiscoveryRepository,
  composeRepo: CompositionRepository,
  intents: readonly DiscoveryIntent[],
  recorder: Author,
  requestId: string,
  before: string,
  out: Checks,
): Promise<void> {
  // (1) No stage mutates upstream repository state.
  check(out, 'conformance', 'repository', 'no stage mutates upstream repository state', fingerprint(repo.assets) === before, '');

  // (2) Validation is never skipped — discovery rejects an empty intent (synchronous probe).
  probeThrows(out, 'discovery', 'discovery rejects an empty intent', () => discover({ obligations: [] }, discoveryRepo), 'EMPTY_INTENT');

  // Build representative lawful runs for the remaining probes.
  let lawful: LawfulRun | null = null;
  let lawfulPlural: LawfulRun | null = null;
  for (const intent of intents) {
    const b = await buildLawful(intent, discoveryRepo, composeRepo, recorder, requestId);
    if (!b) continue;
    lawful ??= b;
    if (!lawfulPlural && b.ctx.unresolvedPlurality.length > 0) lawfulPlural = b;
    if (lawful && lawfulPlural) break;
  }

  // (3) Conditioning rejects a repository-identity mismatch (a plan composed elsewhere).
  if (lawful && repo.assets.length > 1) {
    const otherAssets = repo.assets.slice(1);
    const otherRepo: CompositionRepository = { assets: otherAssets, dependencyGraph: buildDependencyGraph(otherAssets), semanticGraph: buildSemanticGraph(otherAssets) };
    probeThrows(out, 'conditioning', 'conditioning rejects a repository-identity mismatch', () => condition(lawful!.plan, otherRepo, { requestId }), 'REPOSITORY_IDENTITY_MISMATCH');
  }

  // (4) Authoring rejects an evidence-bypassing (out-of-set) determination.
  if (lawfulPlural) {
    const cheat: Author = { name: 'verify::cheat', author: () => ({ determinations: lawfulPlural!.ctx.unresolvedPlurality.map((g) => ({ key: g.key, selected: 'verify::not-a-candidate' })), payload: null }) };
    await probeThrowsAsync(out, 'authoring', 'authoring rejects an out-of-set (untraceable) selection', () => runAuthoring(lawfulPlural!.ctx, cheat), 'EVIDENCE_MISMATCH');
  }

  // (5) Execution rejects a non-immutable authoring result.
  if (lawful) {
    const mutable = { ...lawful.ar };
    await probeThrowsAsync(out, 'execution', 'execution rejects a non-immutable authoring result', () => execute(mutable as typeof lawful.ar, defaultProvider), 'INVALID_AUTHORING_RESULT');
  }
}

/** Cross-cutting conformance roll-ups derived from the gathered checks. */
function rollups(out: Checks): void {
  const identity = out.filter((c) => c.category === 'identity');
  const evidence = out.filter((c) => c.category === 'evidence');
  const replay = out.filter((c) => c.category === 'replay');
  const frozen = out.filter((c) => c.category === 'invariant' && c.name.includes('immutable (frozen)'));
  check(out, 'conformance', 'pipeline', 'no stage bypasses identities', identity.length > 0 && identity.every((c) => c.passed), `${identity.filter((c) => c.passed).length}/${identity.length} identity checks pass`);
  check(out, 'conformance', 'pipeline', 'no stage bypasses evidence', evidence.length > 0 && evidence.every((c) => c.passed), `${evidence.filter((c) => c.passed).length}/${evidence.length} evidence checks pass`);
  check(out, 'conformance', 'pipeline', 'all stage outputs are immutable', frozen.length > 0 && frozen.every((c) => c.passed), `${frozen.filter((c) => c.passed).length}/${frozen.length} frozen-output checks pass`);
  check(out, 'conformance', 'pipeline', 'no stage reads forbidden layers (replay-pure proxy)', replay.length > 0 && replay.every((c) => c.passed), `${replay.filter((c) => c.passed).length}/${replay.length} replay checks pass`);
}

function finalize(
  out: Checks,
  repoId: string,
  intentsVerified: number,
  trace: VerificationReport['trace'],
  derivation?: DerivationVerificationReport,
): VerificationReport {
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, { passed: 0, failed: 0 }])) as Record<VerificationCategory, { passed: number; failed: number }>;
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
    harnessVersion: VERIFICATION_HARNESS_VERSION,
    repositoryIdentity: repoId,
    intentsVerified,
    summary: { total: out.length, passed, failed: out.length - passed, byCategory },
    checks: out,
    trace,
    // Attach the derivation sub-report ONLY when computed — keeps the default report byte-identical.
    ...(derivation ? { derivation } : {}),
  };
}
