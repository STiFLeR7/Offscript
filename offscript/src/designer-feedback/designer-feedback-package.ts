/**
 * P18 — designer feedback package. Mirrors overlay-approval-package.ts's
 * (P14) exact shape and discipline: one artifact indexing the already-built
 * DesignerFeedback, hashed directly over the in-memory object (no disk I/O
 * here — persistence lives in designer-feedback-io.ts).
 */
import { createHash } from 'node:crypto';
import type { DesignerFeedback } from './designer-feedback.js';

export interface FeedbackArtifact {
  readonly name: string;
  readonly path: string;
  readonly sha256: string;
}

export interface FeedbackManifest {
  readonly feedbackId: string;
  readonly packagedAt: string;
  readonly artifacts: readonly FeedbackArtifact[];
}

export interface FeedbackPackage {
  readonly manifest: FeedbackManifest;
  readonly feedback: DesignerFeedback;
}

export interface FeedbackPackageInput {
  readonly feedback: DesignerFeedback;
}

export interface BuildFeedbackPackageOptions {
  readonly now?: () => string;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, sortedReplacerKeys(value), 2) + '\n';
}

function sortedReplacerKeys(root: unknown): string[] {
  const keys = new Set<string>();
  const walk = (v: unknown): void => {
    if (v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    for (const k of Object.keys(v as Record<string, unknown>)) {
      keys.add(k);
      walk((v as Record<string, unknown>)[k]);
    }
  };
  walk(root);
  return Array.from(keys).sort();
}

function deepFreeze<T>(value: T): T {
  Object.freeze(value);
  if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
    }
  }
  return value;
}

/** Build an immutable FeedbackPackage. Pure — hashes the in-memory feedback, touches no disk. */
export function buildFeedbackPackage(
  input: FeedbackPackageInput,
  opts: BuildFeedbackPackageOptions = {},
): FeedbackPackage {
  const now = opts.now ?? (() => new Date().toISOString());
  const feedbackHash = createHash('sha256').update(stableStringify(input.feedback)).digest('hex');
  const pkg: FeedbackPackage = {
    manifest: {
      feedbackId: input.feedback.id,
      packagedAt: now(),
      artifacts: [{ name: 'designer-feedback.json', path: 'designer-feedback.json', sha256: feedbackHash }],
    },
    feedback: input.feedback,
  };
  return deepFreeze(pkg);
}
