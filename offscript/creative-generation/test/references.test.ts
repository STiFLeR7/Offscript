import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  packageRoot,
  engineRoot,
  creativeReferencesDir,
  creativeReferencesAvailable,
  tryLoadCreativeReference,
  loadCreativeReference,
} from '../src/references.js';

describe('engineRoot / packageRoot — derived from file location, not hardcoded', () => {
  it('engineRoot is the parent of packageRoot', () => {
    expect(engineRoot).toBe(join(packageRoot, '..'));
  });

  it('packageRoot ends in creative-generation', () => {
    expect(packageRoot.endsWith('creative-generation')).toBe(true);
  });
});

describe('creativeReferencesDir', () => {
  it('resolves to resources/design_processes/creative under the engine root', () => {
    expect(creativeReferencesDir()).toBe(
      join(engineRoot, 'resources', 'design_processes', 'creative')
    );
  });

  it('never resolves into D:/Offscript-creatives-generation', () => {
    expect(creativeReferencesDir()).not.toMatch(/Offscript-creatives-generation/i);
  });
});

describe('creativeReferencesAvailable', () => {
  it('reflects the real on-disk state of the runtime mirror', () => {
    expect(creativeReferencesAvailable()).toBe(existsSync(creativeReferencesDir()));
  });
});

describe('tryLoadCreativeReference', () => {
  it('returns undefined for a reference that does not exist, never throws', () => {
    expect(tryLoadCreativeReference('does-not-exist.md')).toBeUndefined();
  });

  it('loads the current methodology status and its incomplete judgment boundary', () => {
    const content = tryLoadCreativeReference('_PENDING.md');
    expect(content).toBeDefined();
    expect(content).toMatch(/pending|not yet|deferred/i);
  });
});

describe('loadCreativeReference — missing references fail clearly', () => {
  it('throws a specific, actionable error naming the missing reference', () => {
    expect(() => loadCreativeReference('composition-methodology.md')).toThrow(
      /composition-methodology\.md/
    );
  });

  it('the error points at _PENDING.md for context', () => {
    expect(() => loadCreativeReference('anything-missing.md')).toThrow(/_PENDING\.md/);
  });

  it('does not throw for a reference that exists', () => {
    expect(() => loadCreativeReference('_PENDING.md')).not.toThrow();
  });
});
