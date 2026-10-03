import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { engineRoot } from '../src/references.js';
import { produceCreativeArtifact, type CreativeIntentInput } from '../src/producer.js';
import { writeCreativeArtifact } from '../src/write-artifact.js';

const CLIENT = '__producer-unit-test__';
const INTENT: CreativeIntentInput = {
  id: 'write-test-intent',
  digest: 'sha256:' + 'b'.repeat(64),
  belief: 'a written artifact can be read back exactly as produced',
  feature: 'automation',
  ratio: '4:3',
  camera: 'product',
  mustInclude: ['round-trip fidelity'],
  contentProvenance: 'human',
};

afterEach(() => {
  rmSync(join(engineRoot, 'projects', CLIENT), { recursive: true, force: true });
});

describe('writeCreativeArtifact', () => {
  it('writes intent.json, artifact.json, and visual.html under projects/<client>/creative-assets/<id>/', () => {
    const { artifact, html } = produceCreativeArtifact(INTENT, { client: CLIENT });
    const dir = writeCreativeArtifact(CLIENT, INTENT, artifact, html);

    expect(existsSync(join(dir, 'intent.json'))).toBe(true);
    expect(existsSync(join(dir, 'artifact.json'))).toBe(true);
    expect(existsSync(join(dir, 'visual.html'))).toBe(true);
  });

  it('round-trips the intent and artifact byte-for-byte through the required inventory fields', () => {
    const { artifact, html } = produceCreativeArtifact(INTENT, { client: CLIENT });
    const dir = writeCreativeArtifact(CLIENT, INTENT, artifact, html);

    const readIntent = JSON.parse(readFileSync(join(dir, 'intent.json'), 'utf8'));
    expect(readIntent.id).toBe(INTENT.id);
    expect(readIntent.belief).toBe(INTENT.belief);
    expect(readIntent.feature).toBe(INTENT.feature);
    expect(readIntent.mustInclude).toEqual(INTENT.mustInclude);

    const readArtifact = JSON.parse(readFileSync(join(dir, 'artifact.json'), 'utf8'));
    expect(readArtifact.id).toBe(artifact.id);
    expect(readArtifact.intentDigest).toBe(artifact.intentDigest);
    expect(readArtifact.artifactDigest).toBe(artifact.artifactDigest);
    expect(readArtifact.location).toBe(artifact.location);
    expect(readArtifact.approval).toEqual(artifact.approval);

    expect(readFileSync(join(dir, 'visual.html'), 'utf8')).toBe(html);
  });

  it('writes to a location resolvable relative to the engine root (portable, no absolute path baked in)', () => {
    const { artifact, html } = produceCreativeArtifact(INTENT, { client: CLIENT });
    const dir = writeCreativeArtifact(CLIENT, INTENT, artifact, html);
    expect(dir).toBe(join(engineRoot, 'projects', CLIENT, 'creative-assets', artifact.id));
  });
});
