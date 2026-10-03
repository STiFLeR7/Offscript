/**
 * The one, deliberate, one-way dependency this package takes today: on the
 * Creative Artifact contract's TYPES, as the future extension point for
 * whatever eventually produces a CreativeArtifact record here. No creation,
 * storage, or website-consumption logic exists yet — see Sprint 3's STRICT
 * STOP list. Nothing in creative-artifact-contract imports from this package
 * (verified in test/artifact-boundary.test.ts) — the dependency is one-way.
 */
import type { CreativeArtifact } from 'creative-artifact-contract/src/artifact/types.js';

/**
 * Not yet implemented. Documents the eventual shape: creative-generation will
 * one day produce a CreativeArtifact record per rendered creative. Exists now
 * only to prove the dependency direction compiles, type-checks, and has no
 * cycle back into this package from creative-artifact-contract.
 */
export type FutureCreativeArtifact = CreativeArtifact;
