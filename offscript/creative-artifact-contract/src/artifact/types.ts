/**
 * The Creative Artifact Contract (contractVersion 1). Mirrors
 * schema/creative-artifact.schema.json field-for-field.
 *
 * A CreativeArtifact answers "what was actually created, where is it, what
 * intent did it instantiate, what does it digest to, and is it approved by
 * its origin system" — never "what should be created" (CreativeIntent's job,
 * a separate contract this one never extends or merges into).
 */

export type ArtifactType = 'html' | 'animated-html' | 'asset';
export type ArtifactApprovalStatus = 'approved' | 'pending' | 'rejected';
export type ArtifactValidationStatus = 'passed' | 'failed' | 'unknown';

export interface CreativeArtifactGeneration {
  /** Names the system that produced this artifact. Never 'offscript' or a Track name. */
  sourceSystem: string;
  runId?: string;
  generatorVersion?: string;
  methodologyVersion?: string;
}

/**
 * Approval AS RECORDED BY ITS ORIGIN SYSTEM ONLY. Never equivalent to a Offscript
 * ReadinessState (src/project/readiness.ts) or a generation-admission decision.
 */
export interface CreativeArtifactApproval {
  status: ArtifactApprovalStatus;
  /** Names the system whose approval this reflects (e.g. 'creative-generation'). */
  source: string;
  evidence?: string;
}

/** Summarizes an origin-system validation result without duplicating the full report. */
export interface CreativeArtifactValidation {
  status: ArtifactValidationStatus;
  validator?: string;
  validatedAt?: string;
  reportDigest?: string;
}

export interface CreativeArtifact {
  contractVersion: 1;
  /** Stable identity for this record. Opaque; distinct from artifactDigest. */
  id: string;
  /** The CreativeIntent.digest this artifact instantiates — a reference only. */
  intentDigest: string;
  artifactType: ArtifactType;
  /** A portable reference (see src/artifact/location.ts) — never an absolute machine path. */
  location: string;
  /** sha256 content digest over the artifact's own referenced content. */
  artifactDigest: string;
  /** ISO-8601. Immutable once set. */
  createdAt: string;
  generation: CreativeArtifactGeneration;
  approval: CreativeArtifactApproval;
  validation?: CreativeArtifactValidation;
  provenance?: Record<string, string | number | boolean>;
}
