/**
 * P49 — Project Registry: discoverable, extensible project-type definitions.
 * The registry is the sole source of project families; adding a type is a definition,
 * never an orchestration edit (proven by registerProjectType working at runtime).
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  listProjectTypes,
  getProjectType,
  registerProjectType,
  _resetProjectRegistry,
  type ProjectType,
} from '../../src/project/project-registry.js';

afterEach(() => _resetProjectRegistry());

describe('P49 project registry', () => {
  it('ships the documented project families, each mapping to existing deliverable tracks', () => {
    const ids = listProjectTypes().map((p) => p.id);
    for (const id of ['website', 'brand-identity', 'collateral', 'presentation', 'social-campaign', 'full-brand-package']) {
      expect(ids).toContain(id);
    }
    // every declared deliverable is an existing engine track — the registry sits ABOVE tracks
    for (const p of listProjectTypes()) {
      expect(p.deliverables.length).toBeGreaterThan(0);
      for (const t of p.deliverables) expect(['website', 'collateral', 'deck']).toContain(t);
    }
  });

  it('getProjectType resolves a known type and throws loud on an unknown one', () => {
    expect(getProjectType('website').label.length).toBeGreaterThan(0);
    expect(() => getProjectType('no-such-type')).toThrow(/unknown project type/i);
  });

  it('is extensible: a new type registers and becomes discoverable with no orchestration change', () => {
    const custom: ProjectType = {
      id: 'newsletter',
      label: 'Email Newsletter',
      description: 'A recurring email layout.',
      deliverables: ['collateral'],
      requiredArtifacts: ['one-liner', 'audience'],
      optionalArtifacts: ['brand'],
      briefSources: ['manual', 'content-core'],
    };
    registerProjectType(custom);
    expect(listProjectTypes().map((p) => p.id)).toContain('newsletter');
    expect(getProjectType('newsletter').deliverables).toEqual(['collateral']);
  });

  it('rejects a duplicate id (drift guard)', () => {
    expect(() => registerProjectType(getProjectType('website'))).toThrow(/already registered/i);
  });
});
