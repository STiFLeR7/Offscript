/**
 * P55 — Generation Plan model: the IMMUTABLE execution contract at the boundary between the Project
 * Platform and the Generation Platform.
 *
 * Generation must never begin directly from Project Readiness — it begins from an explicit Generation
 * Plan. Once created, the plan is FROZEN: Designer Doctor and Designer Author consume it but never
 * modify it; a change means a NEW plan. This module owns the model, the deep-freeze, a self-verifying
 * content-hash id (tampering is detectable), a deterministic serialize/deserialize (replay), and the
 * manifest builder. The derivation is the planner (generation-planner.ts); the read seam is the
 * contract (generation-contract.ts).
 *
 * Pure data — no clock/rng/fs. It is the handoff artifact; the Generation Platform is downstream and
 * never imports the planner (only the frozen plan / the contract accessors).
 */
import type { Track } from '../paths.js';
import type { ReadinessState } from './readiness.js';

export type ConstraintKind =
  | 'output' // deliverable shape (single self-contained HTML, no framework)
  | 'palette' // colour/token discipline
  | 'motion' // motion discipline
  | 'governance' // a governance regime applies (e.g. regulated domain)
  | 'approval' // a sign-off is required before publish
  | 'coordination' // cross-deliverable consistency
  | 'deliverable'; // a per-deliverable rule (e.g. deck blocked)

/** An explicit, typed generation constraint (not free prose). */
export interface GenerationConstraint {
  readonly id: string;
  readonly kind: ConstraintKind;
  readonly description: string;
  readonly source: string;
}

/** A frozen assumption the generator may rely on (established upstream, not re-checked at gen time). */
export interface ExecutionAssumption {
  readonly id: string;
  readonly assumption: string;
  readonly basis: string;
}

/** A pointer to a Project-Platform artifact — reference, never a copy (no duplication). */
export interface PlanReference {
  readonly kind: string;
  readonly ref: string;
  readonly version?: number;
}

export interface BrandContext {
  readonly brand?: string;
  readonly tone?: string;
  readonly audience?: string;
}

export interface GenerationScope {
  /** Deliverables that WILL be generated. */
  readonly included: Track[];
  /** Deliverables explicitly out of scope (e.g. deck — design-team-gated). */
  readonly excluded: Track[];
  /** Enabled generation capabilities (one per included deliverable). */
  readonly capabilities: string[];
}

export interface DeliverableValidations {
  readonly track: Track;
  readonly validations: string[];
}

/** A compact, faithful index of the plan — what a launcher inspects without the full contract. */
export interface GenerationManifest {
  readonly planId: string;
  readonly client: string;
  readonly projectType: string;
  readonly deliverables: Track[];
  readonly capabilities: string[];
  readonly validations: string[];
  readonly constraints: string[];
  readonly assumptions: string[];
  readonly assetCount: number;
  /** Equals planId — the content hash, for integrity checking. */
  readonly checksum: string;
}

export interface GenerationPlanIdentity {
  readonly client: string;
  readonly projectType: string;
  readonly deliverables: Track[];
}

export interface GenerationPlanReferences {
  readonly canonicalBrief: PlanReference;
  readonly workflow: PlanReference;
  readonly projectContext: PlanReference;
  readonly readiness: PlanReference & { readonly state: ReadinessState };
}

/** The immutable execution contract. */
export interface GenerationPlan {
  readonly schemaVersion: 1;
  /** Deterministic content-hash id — same content ⇒ same id; a change ⇒ a new id. */
  readonly planId: string;
  /** The Living Project Context version this plan was produced from (lineage). */
  readonly createdVersion: number;
  /** The id of the plan this supersedes, if any (a change produces a new plan, never a mutation). */
  readonly supersedes?: string;
  readonly identity: GenerationPlanIdentity;
  readonly objective: string;
  readonly scope: GenerationScope;
  readonly brandContext: BrandContext;
  readonly references: GenerationPlanReferences;
  readonly requiredAssets: string[];
  readonly requiredValidations: DeliverableValidations[];
  readonly constraints: GenerationConstraint[];
  readonly assumptions: ExecutionAssumption[];
  readonly manifest: GenerationManifest;
}

/** The plan content that determines identity — everything EXCEPT the derived planId + manifest. */
export interface GenerationPlanBody {
  readonly createdVersion: number;
  readonly supersedes?: string;
  readonly identity: GenerationPlanIdentity;
  readonly objective: string;
  readonly scope: GenerationScope;
  readonly brandContext: BrandContext;
  readonly references: GenerationPlanReferences;
  readonly requiredAssets: string[];
  readonly requiredValidations: DeliverableValidations[];
  readonly constraints: GenerationConstraint[];
  readonly assumptions: ExecutionAssumption[];
}

// ── Integrity (content hash) ────────────────────────────────────────────────────

/** FNV-1a 32-bit, hex — a small deterministic content hash (no crypto dependency needed). */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Canonicalize the identity-bearing body into a fixed key order so the hash is stable. */
function canonicalBody(b: GenerationPlanBody): string {
  const ordered = {
    createdVersion: b.createdVersion,
    supersedes: b.supersedes ?? null,
    identity: { client: b.identity.client, projectType: b.identity.projectType, deliverables: b.identity.deliverables },
    objective: b.objective,
    scope: { included: b.scope.included, excluded: b.scope.excluded, capabilities: b.scope.capabilities },
    brandContext: { brand: b.brandContext.brand ?? null, tone: b.brandContext.tone ?? null, audience: b.brandContext.audience ?? null },
    references: {
      canonicalBrief: b.references.canonicalBrief,
      workflow: b.references.workflow,
      projectContext: b.references.projectContext,
      readiness: b.references.readiness,
    },
    requiredAssets: b.requiredAssets,
    requiredValidations: b.requiredValidations.map((v) => ({ track: v.track, validations: v.validations })),
    constraints: b.constraints.map((c) => ({ id: c.id, kind: c.kind, description: c.description, source: c.source })),
    assumptions: b.assumptions.map((a) => ({ id: a.id, assumption: a.assumption, basis: a.basis })),
  };
  return JSON.stringify(ordered);
}

/** The deterministic plan id for a body. */
export function planIdOf(body: GenerationPlanBody): string {
  return `gp-${fnv1a(canonicalBody(body))}`;
}

/** True iff the plan's stored id matches a fresh hash of its body — i.e. it was not tampered with. */
export function verifyPlanIntegrity(plan: GenerationPlan): boolean {
  const { schemaVersion: _s, planId: _p, manifest: _m, ...body } = plan;
  return planIdOf(body as GenerationPlanBody) === plan.planId;
}

// ── Manifest ────────────────────────────────────────────────────────────────────

export function buildManifest(planId: string, body: GenerationPlanBody): GenerationManifest {
  return {
    planId,
    client: body.identity.client,
    projectType: body.identity.projectType,
    deliverables: [...body.scope.included],
    capabilities: [...body.scope.capabilities],
    validations: [...new Set(body.requiredValidations.flatMap((v) => v.validations))],
    constraints: body.constraints.map((c) => c.id),
    assumptions: body.assumptions.map((a) => a.id),
    assetCount: body.requiredAssets.length,
    checksum: planId,
  };
}

// ── Freeze ───────────────────────────────────────────────────────────────────────

/** Recursively freeze an object graph — the runtime half of the immutability guarantee. */
export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    for (const v of Object.values(o)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
}

// ── Serialization (deterministic replay artifact) ───────────────────────────────

/** Assemble the canonical plan (fixed key order) from a body + its id + manifest. */
export function assembleGenerationPlan(body: GenerationPlanBody, planId: string, manifest: GenerationManifest): GenerationPlan {
  const plan: GenerationPlan = {
    schemaVersion: 1,
    planId,
    createdVersion: body.createdVersion,
    ...(body.supersedes !== undefined ? { supersedes: body.supersedes } : {}),
    identity: body.identity,
    objective: body.objective,
    scope: body.scope,
    brandContext: body.brandContext,
    references: body.references,
    requiredAssets: body.requiredAssets,
    requiredValidations: body.requiredValidations,
    constraints: body.constraints,
    assumptions: body.assumptions,
    manifest,
  };
  return plan;
}

export function serializeGenerationPlan(plan: GenerationPlan): string {
  return JSON.stringify(plan, null, 2);
}

export function deserializeGenerationPlan(text: string): GenerationPlan {
  const obj = JSON.parse(text) as GenerationPlan;
  if (obj.schemaVersion !== 1) throw new Error(`generation plan: unsupported schemaVersion ${String(obj.schemaVersion)}.`);
  return deepFreeze(obj);
}
