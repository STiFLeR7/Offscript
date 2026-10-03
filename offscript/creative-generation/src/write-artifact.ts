/**
 * Persists a produced {intent, artifact, html} triple to the storage convention
 * Sprint 5's consumer (offscript/src/generate/creative-artifact-consumption.ts) already
 * reads: projects/<client>/creative-assets/<artifact-id>/{intent.json,artifact.json,
 * visual.html}. Resolves against `engineRoot` (references.ts's import.meta.url-relative
 * root), never a hardcoded or machine-specific path — the same portability mechanism
 * this package already uses for resources resolution.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serializeCreativeArtifact } from 'creative-artifact-contract/src/artifact/serialize.js';
import type { CreativeArtifact } from 'creative-artifact-contract/src/artifact/types.js';
import { engineRoot } from './references.js';
import type { CreativeIntentInput } from './producer.js';

/** Writes the triple and returns the directory it was written to. */
export function writeCreativeArtifact(
  client: string,
  intent: CreativeIntentInput,
  artifact: CreativeArtifact,
  html: string,
): string {
  const dir = join(engineRoot, 'projects', client, 'creative-assets', artifact.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'intent.json'), JSON.stringify(intent, null, 2), 'utf8');
  writeFileSync(join(dir, 'artifact.json'), serializeCreativeArtifact(artifact), 'utf8');
  writeFileSync(join(dir, 'visual.html'), html, 'utf8');
  return dir;
}
