/**
 * P12 — Designer Author Proposal Review. RED-first.
 *
 * Proposal Review evaluates a proposal's OWN structural quality only: never
 * rendered HTML (a proposal is never rendered), never a validation rail (a
 * proposal never enters generate/validate.ts), never the catalog/knowledge
 * subsystem. Five deterministic dimensions, per the brief: metadata
 * completeness, semantic consistency, evidence completeness, proposal
 * structure, deterministic identity.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildAuthorProposal, DESIGNER_AUTHOR_PRODUCER, type AuthorProposal, type ProposalOrigin } from '../../src/designer-author/proposal.js';
import { generateProposalPackage } from '../../src/designer-author/proposal-generator.js';
import {
  reviewProposal,
  renderProposalReviewReport,
  type ProposalReviewReport,
} from '../../src/designer-author/proposal-review.js';

function origin(overrides: Partial<ProposalOrigin> = {}): ProposalOrigin {
  return {
    producer: DESIGNER_AUTHOR_PRODUCER,
    client: 'example-brand',
    track: 'website',
    authoredBy: 'designer:hill',
    ...overrides,
  };
}

function healthyProposal(overrides: Partial<Parameters<typeof buildAuthorProposal>[0]> = {}): AuthorProposal {
  return buildAuthorProposal(
    {
      kind: 'section',
      origin: origin(),
      semanticFamily: 'family-hero',
      content: 'A well-formed proposed hero section with a live workflow demo instead of a static screenshot.',
      evidence: [{ description: 'brief calls for an agentic-product hero', reference: 'brief.md#hero' }],
      ...overrides,
    },
    { now: () => '2026-07-12T00:00:00.000Z' },
  );
}

describe('reviewProposal — metadata completeness', () => {
  it('a fully-populated proposal has no metadata-completeness finding', () => {
    const report = reviewProposal(healthyProposal());
    expect(report.findings.some((f) => f.dimension === 'metadata-completeness')).toBe(false);
  });

  it('an unattributed proposal (origin.authoredBy empty) is flagged critical', () => {
    // buildAuthorProposal does not validate — this constructs the exact defensive
    // case Proposal Review exists to catch (a hand-built proposal that bypassed
    // P11's generator-level validation).
    const proposal = buildAuthorProposal({
      kind: 'section',
      origin: origin({ authoredBy: '' }),
      semanticFamily: 'family-hero',
      content: 'some content',
    });
    const report = reviewProposal(proposal);
    const finding = report.findings.find((f) => f.dimension === 'metadata-completeness');
    expect(finding?.severity).toBe('critical');
  });

  it('an empty semanticFamily is flagged critical', () => {
    const proposal = buildAuthorProposal({ kind: 'section', origin: origin(), semanticFamily: '', content: 'x' });
    const report = reviewProposal(proposal);
    expect(report.findings.some((f) => f.dimension === 'metadata-completeness' && f.severity === 'critical')).toBe(true);
  });
});

describe('reviewProposal — semantic consistency', () => {
  it('an overlay/variant proposal with no parentComponent is flagged advisory', () => {
    const proposal = healthyProposal({ kind: 'overlay', parentComponent: undefined });
    const report = reviewProposal(proposal);
    const finding = report.findings.find((f) => f.dimension === 'semantic-consistency');
    expect(finding?.severity).toBe('advisory');
  });

  it('a component/section proposal with no parentComponent is fine (no finding)', () => {
    const proposal = healthyProposal({ kind: 'component', parentComponent: undefined });
    const report = reviewProposal(proposal);
    expect(report.findings.some((f) => f.dimension === 'semantic-consistency')).toBe(false);
  });

  it('an overlay proposal WITH a parentComponent is fine (no finding)', () => {
    const proposal = healthyProposal({ kind: 'overlay', parentComponent: 'canonical::hero-bento' });
    const report = reviewProposal(proposal);
    expect(report.findings.some((f) => f.dimension === 'semantic-consistency')).toBe(false);
  });
});

describe('reviewProposal — evidence completeness', () => {
  it('zero evidence is flagged advisory', () => {
    const proposal = healthyProposal({ evidence: [] });
    const report = reviewProposal(proposal);
    const finding = report.findings.find((f) => f.dimension === 'evidence-completeness');
    expect(finding?.severity).toBe('advisory');
  });

  it('an evidence entry with an empty description is flagged concern', () => {
    const proposal = healthyProposal({ evidence: [{ description: '   ' }] });
    const report = reviewProposal(proposal);
    const finding = report.findings.find((f) => f.dimension === 'evidence-completeness' && f.severity === 'concern');
    expect(finding).toBeDefined();
  });

  it('well-formed evidence produces no finding', () => {
    const proposal = healthyProposal({ evidence: [{ description: 'a real description' }] });
    const report = reviewProposal(proposal);
    expect(report.findings.some((f) => f.dimension === 'evidence-completeness')).toBe(false);
  });
});

describe('reviewProposal — proposal structure', () => {
  it('empty content is flagged critical', () => {
    const proposal = healthyProposal({ content: '   ' });
    const report = reviewProposal(proposal);
    const finding = report.findings.find((f) => f.dimension === 'proposal-structure');
    expect(finding?.severity).toBe('critical');
  });

  it('very short content is flagged advisory', () => {
    const proposal = healthyProposal({ content: 'short' });
    const report = reviewProposal(proposal);
    const finding = report.findings.find((f) => f.dimension === 'proposal-structure');
    expect(finding?.severity).toBe('advisory');
  });

  it('reasonably long content produces no structure finding', () => {
    const report = reviewProposal(healthyProposal());
    expect(report.findings.some((f) => f.dimension === 'proposal-structure')).toBe(false);
  });
});

describe('reviewProposal — deterministic identity', () => {
  it('a genuine proposal (built via buildAuthorProposal) always passes identity verification', () => {
    const report = reviewProposal(healthyProposal());
    expect(report.findings.some((f) => f.dimension === 'deterministic-identity')).toBe(false);
  });

  it('a proposal with a tampered id (constructed outside buildAuthorProposal) is flagged critical', () => {
    const genuine = healthyProposal();
    const tampered: AuthorProposal = { ...genuine, identity: { ...genuine.identity, id: 'not-the-real-hash' } };
    const report = reviewProposal(tampered);
    const finding = report.findings.find((f) => f.dimension === 'deterministic-identity');
    expect(finding?.severity).toBe('critical');
  });

  it('a proposal whose content was altered without recomputing id is flagged critical', () => {
    const genuine = healthyProposal();
    const tampered: AuthorProposal = { ...genuine, content: 'a totally different, unreviewed body of content' };
    const report = reviewProposal(tampered);
    expect(report.findings.some((f) => f.dimension === 'deterministic-identity' && f.severity === 'critical')).toBe(true);
  });
});

describe('reviewProposal — overall reviewStatus reduction', () => {
  it('a fully healthy proposal is ready-for-review', () => {
    expect(reviewProposal(healthyProposal()).reviewStatus).toBe('ready-for-review');
  });

  it('any concern-level finding (no critical) yields needs-attention', () => {
    const proposal = healthyProposal({ evidence: [{ description: '' }] });
    expect(reviewProposal(proposal).reviewStatus).toBe('needs-attention');
  });

  it('any critical-level finding yields blocked', () => {
    const proposal = healthyProposal({ content: '' });
    expect(reviewProposal(proposal).reviewStatus).toBe('blocked');
  });

  it('advisory-only findings still yield ready-for-review (advisory is a note, not a block)', () => {
    const proposal = healthyProposal({ evidence: [] });
    expect(reviewProposal(proposal).reviewStatus).toBe('ready-for-review');
  });
});

describe('reviewProposal — determinism, ordering, replay stability', () => {
  it('same proposal (same now) produces a deep-equal report on every call', () => {
    const proposal = healthyProposal();
    const now = () => '2026-07-12T01:00:00.000Z';
    expect(reviewProposal(proposal, { now })).toEqual(reviewProposal(proposal, { now }));
  });

  it('changing ONLY the clock leaves findings/reviewStatus/subject identical, only generatedAt differs', () => {
    const proposal = healthyProposal({ evidence: [] });
    const a = reviewProposal(proposal, { now: () => '2020-01-01T00:00:00.000Z' });
    const b = reviewProposal(proposal, { now: () => '2030-01-01T00:00:00.000Z' });
    expect(a.findings).toEqual(b.findings);
    expect(a.reviewStatus).toBe(b.reviewStatus);
    expect(a.subject).toBe(b.subject);
    expect(a.generatedAt).not.toBe(b.generatedAt);
  });

  it('findings are sorted severity-desc then dimension-asc, deterministically', () => {
    const proposal = healthyProposal({ content: '', evidence: [] });
    const report = reviewProposal(proposal);
    const severityRank: Record<string, number> = { critical: 3, concern: 2, advisory: 1, informational: 0 };
    for (let i = 1; i < report.findings.length; i++) {
      const prevRank = severityRank[report.findings[i - 1]!.severity];
      const currRank = severityRank[report.findings[i]!.severity];
      expect(prevRank).toBeGreaterThanOrEqual(currRank);
    }
  });

  it('subject equals proposal.identity.id verbatim', () => {
    const proposal = healthyProposal();
    expect(reviewProposal(proposal).subject).toBe(proposal.identity.id);
  });

  it('is deep-frozen at every level', () => {
    const report = reviewProposal(healthyProposal({ evidence: [] }));
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.findings)).toBe(true);
    if (report.findings.length > 0) {
      expect(Object.isFrozen(report.findings[0])).toBe(true);
      expect(Object.isFrozen(report.findings[0]!.recommendation)).toBe(true);
    }
  });
});

describe('renderProposalReviewReport — proposal report generation', () => {
  it('renders subject, status, and every finding dimension/severity/recommendation', () => {
    const proposal = healthyProposal({ evidence: [] });
    const report = reviewProposal(proposal, { now: () => '2026-07-12T02:00:00.000Z' });
    const md = renderProposalReviewReport(report);
    expect(md).toContain(proposal.identity.id);
    expect(md).toContain(report.reviewStatus);
    expect(md).toContain('evidence-completeness');
  });

  it('renders a "no findings" placeholder when the proposal is fully healthy', () => {
    const md = renderProposalReviewReport(reviewProposal(healthyProposal()));
    expect(md.toLowerCase()).toContain('no findings');
  });

  it('is deterministic', () => {
    const report = reviewProposal(healthyProposal(), { now: () => '2026-07-12T03:00:00.000Z' });
    expect(renderProposalReviewReport(report)).toBe(renderProposalReviewReport(report));
  });
});

describe('P12 — proposal package integration', () => {
  it('reviewing a package-embedded proposal produces a report whose subject matches the manifest proposalId', () => {
    const pkg = generateProposalPackage({
      kind: 'section',
      origin: origin(),
      semanticFamily: 'family-hero',
      designerIntent: 'A live-demo hero variant.',
    });
    const report = reviewProposal(pkg.proposal);
    expect(report.subject).toBe(pkg.manifest.proposalId);
  });
});

describe('P12 — falsification: proposal review never touches production validation', () => {
  it('imports nothing from validation/reauthor/catalog/plan/overlay/governance rails', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-author/proposal-review.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      expect(line).not.toMatch(/generate\/validate\.js/);
      expect(line).not.toMatch(/reauthor-loop\.js/);
      expect(line).not.toMatch(/gate\.js/);
      expect(line).not.toMatch(/catalog/i);
      expect(line).not.toMatch(/repository/i);
      expect(line).not.toMatch(/knowledge\//);
      expect(line).not.toMatch(/generate\/plan\.js/);
      expect(line).not.toMatch(/overlay\.js/);
      expect(line).not.toMatch(/governance/i);
      expect(line).not.toMatch(/node:fs/);
    }
  });

  it('never renders or references HTML — reviewProposal never touches proposal.content as markup', () => {
    // A proposal review finding never quotes raw content back — it only ever
    // describes the CONTENT'S SHAPE (length, presence), never its markup.
    const proposal = healthyProposal({ content: '<script>alert(1)</script>'.repeat(1) + ' padding to pass length checks' });
    const report = reviewProposal(proposal);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('<script>');
  });
});
