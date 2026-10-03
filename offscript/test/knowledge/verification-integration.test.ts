/**
 * Sprint 8 — Verification Harness: the single command verifying the WHOLE architecture against
 * the REAL enriched repository (all six engines, every satisfiable obligation), mocked provider.
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { loadRepository } from '../../src/knowledge/source/index.js';
import { verifyArchitecture } from '../../src/knowledge/verification.js';

const REAL_REPO = fileURLToPath(new URL('../../repository', import.meta.url));
const loaded = loadRepository(REAL_REPO);

describe('verifyArchitecture — the real repository', () => {
  it('verifies the entire architecture and reports OK', async () => {
    const r = await verifyArchitecture({ assets: loaded.assets, vocabulary: loaded.vocabulary });
    if (!r.ok) console.error('FAILED CHECKS:', r.checks.filter((c) => !c.passed));
    expect(r.ok).toBe(true);
    expect(r.intentsVerified).toBeGreaterThan(0);
    expect(r.summary.failed).toBe(0);
    expect(r.trace).not.toBeNull();
    expect(r.trace!.identityChain.repository).toBe(r.repositoryIdentity);
  });

  it('is deterministic across runs on the real repository', async () => {
    const a = await verifyArchitecture({ assets: loaded.assets, vocabulary: loaded.vocabulary });
    const b = await verifyArchitecture({ assets: loaded.assets, vocabulary: loaded.vocabulary });
    expect(b.repositoryIdentity).toBe(a.repositoryIdentity);
    expect(b.summary).toEqual(a.summary);
    expect(b.trace!.identityChain).toEqual(a.trace!.identityChain);
  });
});
