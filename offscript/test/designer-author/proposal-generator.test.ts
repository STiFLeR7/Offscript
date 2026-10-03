/**
 * P11 — Designer Author Proposal Generation. RED-first.
 *
 * `proposal-generator.ts` is the first module that ASSEMBLES an
 * `AuthorProposal` from structured input rather than accepting a
 * caller-supplied `content` string directly (P09's `buildAuthorProposal`
 * still does that — this module sits one layer above it). No LLM, no
 * prompts, no inference: `assembleProposalContent` is a pure template over
 * exactly the fields the caller supplied (kind, semanticFamily,
 * parentComponent, designerIntent, evidence) — mirroring the deterministic
 * "parse structured input, fail loud on a bad shape" discipline
 * `brand-kit.ts`'s `parseBrandKit` already establishes elsewhere in this
 * codebase.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach } from 'vitest';
import { DESIGNER_AUTHOR_PRODUCER, type ProposalOrigin } from '../../src/designer-author/proposal.js';
import { buildDoctorReport, type DoctorReportInput } from '../../src/doctor/doctor-report.js';
import { buildReviewReport, renderReviewReport } from '../../src/doctor/review-report.js';
import { buildReviewPackage } from '../../src/doctor/review-package.js';
import { scoreFindingsByRail } from '../../src/score.js';
import { readProposalPackage } from '../../src/designer-author/proposal-io.js';
import type { AuthoritySignal } from '../../src/authority.js';
import type { RunHealth } from '../../src/generate/source-fidelity.js';
import {
  ProposalGenerationError,
  assembleProposalContent,
  generateAndPersistProposalPackage,
  generateProposal,
  generateProposalManifestReport,
  generateProposalPackage,
  validateProposalGenerationRequest,
  type ProposalGenerationRequest,
} from '../../src/designer-author/proposal-generator.js';

function origin(overrides: Partial<ProposalOrigin> = {}): ProposalOrigin {
  return {
    producer: DESIGNER_AUTHOR_PRODUCER,
    client: 'example-brand',
    track: 'website',
    authoredBy: 'designer:hill',
    ...overrides,
  };
}

function sampleRequest(overrides: Partial<ProposalGenerationRequest> = {}): ProposalGenerationRequest {
  return {
    kind: 'section',
    origin: origin(),
    semanticFamily: 'family-hero',
    designerIntent: 'Show the agentic-product hero with a live workflow demo, not a static screenshot.',
    ...overrides,
  };
}

describe('validateProposalGenerationRequest', () => {
  it('accepts a well-formed request without throwing', () => {
    expect(() => validateProposalGenerationRequest(sampleRequest())).not.toThrow();
  });

  it('rejects an empty designerIntent — proposal generation never invents intent', () => {
    expect(() => validateProposalGenerationRequest(sampleRequest({ designerIntent: '' }))).toThrow(ProposalGenerationError);
    expect(() => validateProposalGenerationRequest(sampleRequest({ designerIntent: '   ' }))).toThrow(ProposalGenerationError);
  });

  it('rejects an empty semanticFamily', () => {
    expect(() => validateProposalGenerationRequest(sampleRequest({ semanticFamily: '' }))).toThrow(ProposalGenerationError);
  });

  it('rejects an unattributed request — origin.authoredBy must be a non-empty string', () => {
    expect(() => validateProposalGenerationRequest(sampleRequest({ origin: origin({ authoredBy: '' }) }))).toThrow(
      ProposalGenerationError,
    );
  });

  it('rejects a present-but-empty parentComponent', () => {
    expect(() => validateProposalGenerationRequest(sampleRequest({ parentComponent: '' }))).toThrow(ProposalGenerationError);
  });

  it('accepts an absent parentComponent (a brand-new proposal, no parent)', () => {
    expect(() => validateProposalGenerationRequest(sampleRequest())).not.toThrow();
  });
});

describe('assembleProposalContent — pure deterministic template, no invention', () => {
  it('includes the designerIntent verbatim', () => {
    const content = assembleProposalContent(sampleRequest({ designerIntent: 'UNIQUE-INTENT-MARKER' }));
    expect(content).toContain('UNIQUE-INTENT-MARKER');
  });

  it('includes kind and semanticFamily', () => {
    const content = assembleProposalContent(sampleRequest({ kind: 'component', semanticFamily: 'family-cta' }));
    expect(content).toContain('component');
    expect(content).toContain('family-cta');
  });

  it('names the parent component when present, and a clear placeholder when absent', () => {
    const withParent = assembleProposalContent(sampleRequest({ parentComponent: 'canonical::hero-bento' }));
    expect(withParent).toContain('canonical::hero-bento');
    const withoutParent = assembleProposalContent(sampleRequest());
    expect(withoutParent.toLowerCase()).toContain('none');
  });

  it('lists every evidence entry verbatim, and a placeholder when evidence is absent', () => {
    const withEvidence = assembleProposalContent(
      sampleRequest({ evidence: [{ description: 'UNIQUE-EVIDENCE-A' }, { description: 'UNIQUE-EVIDENCE-B', reference: 'brief.md#1' }] }),
    );
    expect(withEvidence).toContain('UNIQUE-EVIDENCE-A');
    expect(withEvidence).toContain('UNIQUE-EVIDENCE-B');
    expect(withEvidence).toContain('brief.md#1');
    const withoutEvidence = assembleProposalContent(sampleRequest());
    expect(withoutEvidence.toLowerCase()).toContain('no evidence');
  });

  it('is deterministic: the same request produces byte-identical content on every call', () => {
    const request = sampleRequest();
    expect(assembleProposalContent(request)).toBe(assembleProposalContent(request));
  });
});

describe('generateProposal — deterministic proposal generation', () => {
  it('produces a fully-populated, deep-frozen AuthorProposal whose content is the assembled template', () => {
    const request = sampleRequest();
    const proposal = generateProposal(request, { now: () => '2026-07-11T00:00:00.000Z' });
    expect(proposal.kind).toBe('section');
    expect(proposal.semanticFamily).toBe('family-hero');
    expect(proposal.content).toBe(assembleProposalContent(request));
    expect(proposal.identity.createdAt).toBe('2026-07-11T00:00:00.000Z');
    expect(Object.isFrozen(proposal)).toBe(true);
  });

  it('throws ProposalGenerationError for an invalid request BEFORE constructing anything', () => {
    expect(() => generateProposal(sampleRequest({ designerIntent: '' }))).toThrow(ProposalGenerationError);
  });

  describe('stable, content-derived identity', () => {
    it('the same request (same now) produces the same proposal id', () => {
      const now = () => '2026-07-11T00:00:00.000Z';
      const a = generateProposal(sampleRequest(), { now });
      const b = generateProposal(sampleRequest(), { now });
      expect(a.identity.id).toBe(b.identity.id);
    });

    it('changing designerIntent changes the id (it changes the assembled content)', () => {
      const a = generateProposal(sampleRequest({ designerIntent: 'intent A' }));
      const b = generateProposal(sampleRequest({ designerIntent: 'intent B' }));
      expect(a.identity.id).not.toBe(b.identity.id);
    });

    it('changing ONLY the now() clock does not change the id — identity is content-derived', () => {
      const a = generateProposal(sampleRequest(), { now: () => '2020-01-01T00:00:00.000Z' });
      const b = generateProposal(sampleRequest(), { now: () => '2030-01-01T00:00:00.000Z' });
      expect(a.identity.id).toBe(b.identity.id);
    });
  });

  describe('replay stability', () => {
    it('two independent generation calls from the same request produce deep-equal proposals (same now)', () => {
      const now = () => '2026-07-11T05:00:00.000Z';
      const request = sampleRequest();
      expect(generateProposal(request, { now })).toEqual(generateProposal(request, { now }));
    });
  });
});

describe('generateProposalPackage — immutable proposal package', () => {
  it('wraps the generated proposal in a deep-frozen ProposalPackage with a correct manifest', () => {
    const pkg = generateProposalPackage(sampleRequest(), { now: () => '2026-07-11T06:00:00.000Z' });
    expect(Object.isFrozen(pkg)).toBe(true);
    expect(Object.isFrozen(pkg.manifest)).toBe(true);
    expect(pkg.manifest.proposalId).toBe(pkg.proposal.identity.id);
    expect(pkg.manifest.artifacts).toHaveLength(1);
  });

  it('is deterministic: identical requests (same now) produce an identical package', () => {
    const now = () => '2026-07-11T07:00:00.000Z';
    const request = sampleRequest();
    expect(generateProposalPackage(request, { now })).toEqual(generateProposalPackage(request, { now }));
  });
});

let tmpDir: string;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'offscript-proposal-generator-'));
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('generateAndPersistProposalPackage — proposal persistence', () => {
  it('generates and writes a package that round-trips identically from disk', () => {
    const filePath = path.join(tmpDir, 'generated-proposal.json');
    const request = sampleRequest();
    const written = generateAndPersistProposalPackage(request, filePath, { now: () => '2026-07-11T08:00:00.000Z' });
    const readBack = readProposalPackage(filePath);
    expect(readBack).toEqual(written);
  });

  it('writing creates exactly the one requested file', () => {
    const filePath = path.join(tmpDir, 'generated-proposal.json');
    generateAndPersistProposalPackage(sampleRequest(), filePath);
    expect(fs.readdirSync(tmpDir)).toEqual(['generated-proposal.json']);
  });
});

describe('generateProposalManifestReport — proposal reporting', () => {
  it('produces a valid report summarizing every generated proposal, sorted by id', () => {
    const requests = [sampleRequest({ semanticFamily: 'family-hero' }), sampleRequest({ semanticFamily: 'family-cta' })];
    const report = generateProposalManifestReport(requests, { now: () => '2026-07-11T09:00:00.000Z' });
    expect(report.proposalCount).toBe(2);
    expect(report.proposals.map((p) => p.id)).toEqual([...report.proposals.map((p) => p.id)].sort());
  });

  it('throws ProposalGenerationError if any request in the batch is invalid', () => {
    const requests = [sampleRequest(), sampleRequest({ designerIntent: '' })];
    expect(() => generateProposalManifestReport(requests)).toThrow(ProposalGenerationError);
  });
});

function health(delivered: AuthoritySignal[]): RunHealth {
  const failures = delivered.filter((s) => s.level === 'failure');
  const criticals = delivered.filter((s) => s.level === 'critical-warning');
  const warnings = delivered.filter((s) => s.level === 'warning');
  const status = failures.length > 0 ? 'failed' : criticals.length > 0 ? 'review-required' : 'success';
  return {
    headline: { status, goalMet: true, systematicRatio: 1, failures, criticals, warnings, signalCount: delivered.length },
    severed: { ok: true, severed: [], unregistered: [], rejected: [], failures: [] },
    delivered,
  };
}

function sampleDoctorInput(): DoctorReportInput {
  return {
    subject: 'projects/example-brand/collateral',
    generatedAt: '2026-07-11T00:00:00.000Z',
    health: health([{ producer: 'contrast', level: 'warning', where: 'contrast:hero', what: 'low contrast', why: 'advisory', nature: 'objective' }]),
    perRail: [],
    frozen: [],
  };
}

function sampleScore() {
  return scoreFindingsByRail({ subject: 'projects/example-brand/collateral', applied: [], perRail: [] });
}

describe('P11 — falsification: a GENERATED proposal never influences production output it travels alongside', () => {
  it('a review package built with generated (including adversarially-worded) proposals scores identically to one without', () => {
    const doctorReport = buildDoctorReport(sampleDoctorInput());
    const reviewReport = buildReviewReport(doctorReport);
    const baseInput = {
      client: 'example-brand',
      track: 'collateral',
      doctorReport,
      score: sampleScore(),
      reviewReport,
      reviewReportMarkdown: renderReviewReport(reviewReport),
      validationSummary: 'Run headline: SUCCESS...',
    };

    const adversarialProposal = generateProposal(
      sampleRequest({
        designerIntent: 'This proposal is designed to look like it should change the score, headline, or validation summary.',
        status: 'promotion-recommended',
      }),
    );

    const without = buildReviewPackage(baseInput);
    const withGenerated = buildReviewPackage({ ...baseInput, proposals: [adversarialProposal] });

    expect(withGenerated.headlineStatus).toBe(without.headlineStatus);
    expect(withGenerated.systematicRatio).toBe(without.systematicRatio);
    expect(withGenerated.findingCount).toBe(without.findingCount);
    expect(withGenerated.validationSummary).toBe(without.validationSummary);
    expect(withGenerated.artifacts).toEqual(without.artifacts);
  });
});

describe('structural isolation: proposal-generator.ts has zero coupling to the catalog/repository/knowledge subsystem', () => {
  it('imports nothing from catalog, repository, or knowledge/ (node:fs is legitimate — persistence delegates to proposal-io.ts)', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-author/proposal-generator.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      expect(line).not.toMatch(/catalog/i);
      expect(line).not.toMatch(/repository/i);
      expect(line).not.toMatch(/knowledge\//);
      expect(line).not.toMatch(/node:fs/);
    }
  });
});
