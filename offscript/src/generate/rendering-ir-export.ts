/**
 * C1 — Rendering IR Export: the generation-pipeline seam that persists a `RenderingIR` as
 * `rendering-ir.json` alongside `index.html`. Pure composition of three already-tested D1
 * exports — `buildRenderingIR` / `validateRenderingIR` / `serializeRenderingIR`
 * (`rendering-ir.ts`) — no derivation or validation logic is duplicated here. See
 * docs/core/C1-RENDERING-IR-EXPORT.md for the artifact contract.
 */
import { buildRenderingIR, validateRenderingIR, serializeRenderingIR, type RenderingIR, type RenderingSiteMetadataInput } from './rendering-ir.js';
import type { AuthoringPlan } from './types.js';
import type { Brief } from './brief.js';

/** Fail-loud gate + serialize — never writes an IR that doesn't validate (measured, not claimed). */
export function exportRenderingIR(rir: RenderingIR): string {
  const check = validateRenderingIR(rir);
  if (!check.valid) {
    throw new Error(`exportRenderingIR: refusing to export an invalid RenderingIR — ${check.errors.join('; ')}`);
  }
  return serializeRenderingIR(rir);
}

export interface RenderingIRArtifact {
  readonly rir: RenderingIR;
  readonly serialized: string;
}

/** `(plan, brief, siteMetadata?) → { rir, serialized }` — what `scripts/generate.ts` calls. */
export function buildRenderingIRArtifact(
  plan: AuthoringPlan,
  brief?: Brief,
  siteMetadata?: RenderingSiteMetadataInput,
): RenderingIRArtifact {
  const rir = buildRenderingIR(plan, brief, siteMetadata);
  return { rir, serialized: exportRenderingIR(rir) };
}
