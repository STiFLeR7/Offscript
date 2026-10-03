/**
 * P49 — the Canonical Brief boundary holds: a brief produced by the acquisition layer is consumed
 * by the UNCHANGED pipeline entry (src/generate/brief.ts loadBrief) with no field loss and no
 * knowledge of its origin. This is the "downstream pipeline remains unchanged" proof at the seam.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir, projectReferencesDir } from '../../src/paths.js';
import { loadBrief } from '../../src/generate/brief.js';
import { initProject } from '../../src/project/workspace.js';
import { createCreativeDirector } from '../../src/project/creative-director.js';
import type { PacketAdapterRunner } from '../../src/project/brief-source-content-core.js';
import { normalizeBrief } from '../../src/project/brief-normalizer.js';

const CLIENT = '__p49_downstream__';
afterEach(() => rmSync(projectDir(CLIENT), { recursive: true, force: true }));

const runner: PacketAdapterRunner = {
  async run() {
    return {
      briefMd: normalizeBrief({
        track: 'website', oneLiner: 'Origin-agnostic brief', audience: 'Devs',
        mustInclude: ['hero', 'footer'], provenance: { packetId: 'q-9' },
      }),
    };
  },
};

describe('P49 canonical brief boundary → unchanged pipeline', () => {
  it('an acquired brief is loaded by the existing loadBrief() unchanged, regardless of source', async () => {
    initProject({ client: CLIENT, projectType: 'website' });
    const cd = createCreativeDirector({ runner });

    // Produce via the manual source and persist exactly as the acquire CLI would.
    const result = await cd.acquire({
      client: CLIENT,
      projectType: 'website',
      answers: { oneLiner: 'Origin-agnostic brief', audience: 'Devs', mustInclude: ['hero', 'footer'] },
    });
    writeFileSync(join(projectReferencesDir(CLIENT), 'brief.md'), result.briefText, 'utf8');

    // The UNCHANGED pipeline reader consumes it — no origin knowledge, no loss.
    const b = loadBrief(CLIENT);
    expect(b.schemaVersion).toBe(1);
    expect(b.track).toBe('website');
    expect(b.oneLiner).toBe('Origin-agnostic brief');
    expect(b.audience).toBe('Devs');
    expect(b.mustInclude).toEqual(['hero', 'footer']);
    // nothing in the Brief type carries "source origin" — the boundary is clean
    expect(Object.keys(b)).not.toContain('sourceId');
  });
});
