/**
 * Sprint 10V — the runtime side of the Environment Library port. Recognizes the seven-value
 * closed environment vocabulary from ENVIRONMENT-LIBRARY.md (read through the existing
 * reference-loading boundary, references.ts) and resolves each governed slug to its REAL,
 * authoritative asset file under resources/design_processes/website/assets/imagery/environments/ — the
 * website track's own already-existing, unmodified, unduplicated asset location.
 *
 * This module performs NO selection. `resolveEnvironmentAsset` answers only "given a governed
 * slug, where is its real asset" — it never decides WHICH slug a given CreativeIntent should use.
 * No belief/feature/camera/section input is read anywhere in this file; see
 * ENVIRONMENT-LIBRARY.md's own "Non-goals" section for the full boundary this port does not cross.
 *
 * Asset resolution reaches outside `offscript/` to the repository root's `resources/design_processes/website/`
 * — the one sanctioned exception to this package's usual `resources/`-only reference
 * boundary, computed relative to `engineRoot` (already exported by references.ts) exactly as
 * `website-governance-sync/src/cli.ts` already resolves the same directory. This is a filesystem
 * path reference only — never an import of Website Generation code, never a dependency on
 * `offscript/src/`.
 */
import { resolve } from 'node:path';
import { engineRoot, loadCreativeReference } from './references.js';

export type EnvironmentSlug =
  | 'cliffside-muted'
  | 'dawn-haze'
  | 'lake-mirror'
  | 'massif-banded'
  | 'massif-clear'
  | 'ridges-distant'
  | 'valley-deep';

/** The seven governed values, verbatim from ENVIRONMENT-LIBRARY.md's own vocabulary table —
 * a closed-set membership array, the same role CAMERAS plays for camera-selection.ts. This is
 * structural plumbing for the type guard below, not a second copy of the document's prose or its
 * asset-filename mapping (that mapping is a deterministic rule, computed in resolveEnvironmentAsset). */
const ENVIRONMENT_SLUGS: readonly EnvironmentSlug[] = [
  'cliffside-muted',
  'dawn-haze',
  'lake-mirror',
  'massif-banded',
  'massif-clear',
  'ridges-distant',
  'valley-deep',
];

/** Whether `value` is one of the seven governed environment slugs. */
export function isEnvironmentSlug(value: string): value is EnvironmentSlug {
  return (ENVIRONMENT_SLUGS as readonly string[]).includes(value);
}

/** Returns the raw Environment Library methodology document — the authoritative statement of the
 * seven-value vocabulary, the finite-library rule, and this port's own non-goals. Never duplicated
 * as a string literal in this module. */
export function loadEnvironmentLibrary(): string {
  return loadCreativeReference('ENVIRONMENT-LIBRARY.md');
}

/** The directory resources/design_processes/website authoritatively owns the seven environment assets in —
 * never copied, never vendored into creative-generation, computed relative to the repository root
 * exactly as website-governance-sync's own cli.ts resolves the same directory. */
export function environmentAssetsDir(): string {
  return resolve(engineRoot, 'resources', 'design_processes', 'website', 'assets', 'imagery', 'environments');
}

/**
 * Resolves a governed `EnvironmentSlug` to its authoritative asset's real, computed path. Returns
 * undefined for any value outside the seven governed slugs — fail-safe, never throws, mirroring
 * `componentsForFeature`'s/`getCompositionCameraBias`'s established convention. The asset filename
 * follows ENVIRONMENT-LIBRARY.md's own documented deterministic rule (`env-<slug>.jpg`) rather than
 * a second parsed table — every one of the seven real assets already follows it exactly (verified
 * by this package's own test suite against the real files on disk).
 */
export function resolveEnvironmentAsset(slug: string): string | undefined {
  if (!isEnvironmentSlug(slug)) return undefined;
  return resolve(environmentAssetsDir(), `env-${slug}.jpg`);
}
