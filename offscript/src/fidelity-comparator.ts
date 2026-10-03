import type { Root, Element } from 'hast';
import type { Finding, OperatorContext } from './operator.js';
import { visitElements } from './working-rep.js';
import { brandFidelityScan } from './operators/brand-fidelity-scan.js';

/**
 * Fidelity / non-regression comparator (spec §3 fidelity; resolves §9 metric
 * shape). A deterministic role-level structural signature of a document, and a
 * drift diff between the immutable reference and a candidate (the actuator's
 * output). Drift = a STRUCTURAL REGRESSION of the reference — never a byte or
 * pixel diff. Additive / byte-level changes do not trip it.
 *
 * Out of scope (deliberate, YAGNI): detecting "dragged toward premium restraint"
 * — that loudness-side concern is owned by the anti-slop rail + posture bounds.
 */

const LANDMARK_TAGS = new Set(['header', 'nav', 'main', 'aside', 'footer']);
const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

function classOf(el: Element): string {
  const c = el.properties?.className;
  return typeof c === 'string' ? c : Array.isArray(c) ? (c as string[]).join(' ') : '';
}

export interface FidelitySignature {
  landmarkRoles: string[];
  sectionCount: number;
  /**
   * Count of `.cr-page` elements — the collateral A4-page unit. Drift criterion
   * in `detectFidelityDrift`: a dropped page = lost content. Website documents
   * carry no `.cr-page`, so this stays 0 and never trips website fidelity.
   */
  pageCount: number;
  /**
   * h1..h6 in document order. Captured for inspection only — deliberately NOT a
   * drift criterion in `detectFidelityDrift` (an actuator may legitimately
   * re-rank a heading while clearing a rail). Wired in only if a future need
   * proves heading-outline regressions are worth gating.
   */
  headingOutline: string[];
  archetypeTags: string[];
  offTokenColors: string[];
}

export function signatureOf(tree: Root, ctx: OperatorContext): FidelitySignature {
  const landmarks = new Set<string>();
  let sectionCount = 0;
  let pageCount = 0;
  const headingOutline: string[] = [];
  const archetypeTags = new Set<string>();

  visitElements(tree, (el: Element) => {
    const tag = el.tagName;
    if (LANDMARK_TAGS.has(tag)) landmarks.add(tag);
    if (tag === 'section') sectionCount += 1;
    if (/\bcr-page\b/.test(classOf(el))) pageCount += 1;
    if (HEADING_TAGS.has(tag)) headingOutline.push(tag);
    const arch = el.properties?.dataArchetype;
    if (typeof arch === 'string' && arch !== '') archetypeTags.add(arch);
  });

  // Reuse the brand-fidelity oracle for off-token traceability — its finding ids
  // are `brand-fidelity-scan:<value>`; we keep the bare colour values.
  const offTokenColors = brandFidelityScan
    .detect(tree, ctx)
    .map((f) => f.id.replace(/^brand-fidelity-scan:/, ''))
    .sort();

  return {
    landmarkRoles: [...landmarks].sort(),
    sectionCount,
    pageCount,
    headingOutline,
    archetypeTags: [...archetypeTags].sort(),
    offTokenColors,
  };
}

/**
 * Compare a candidate against the immutable reference. Emit one `escalated`
 * finding per structural regression. An empty array means the candidate stayed
 * faithful (bounds, not bytes).
 */
export function detectFidelityDrift(
  reference: Root,
  candidate: Root,
  ctx: OperatorContext,
): Finding[] {
  const ref = signatureOf(reference, ctx);
  const cand = signatureOf(candidate, ctx);
  const findings: Finding[] = [];

  // 1. Landmark roles removed.
  for (const role of ref.landmarkRoles) {
    if (!cand.landmarkRoles.includes(role)) {
      findings.push({
        id: `fidelity:landmark-removed:${role}`,
        description: `landmark <${role}> present in the reference is missing from the actuator output — structural drift`,
        outcome: 'escalated',
      });
    }
  }

  // 2. Section count decreased.
  if (cand.sectionCount < ref.sectionCount) {
    findings.push({
      id: `fidelity:section-count:${ref.sectionCount}->${cand.sectionCount}`,
      description: `section count dropped from ${ref.sectionCount} (reference) to ${cand.sectionCount} (output) — content removed`,
      outcome: 'escalated',
    });
  }

  // 2b. Collateral page count decreased (a .cr-page removed).
  if (cand.pageCount < ref.pageCount) {
    findings.push({
      id: `fidelity:page-count:${ref.pageCount}->${cand.pageCount}`,
      description: `collateral page count dropped from ${ref.pageCount} to ${cand.pageCount} — a .cr-page was removed.`,
      outcome: 'escalated',
    });
  }

  // 3. Archetype tags removed.
  for (const tag of ref.archetypeTags) {
    if (!cand.archetypeTags.includes(tag)) {
      findings.push({
        id: `fidelity:archetype-removed:${tag}`,
        description: `archetype "${tag}" assigned in the reference is missing from the output — role reassignment drift`,
        outcome: 'escalated',
      });
    }
  }

  // 4. New off-token colours (traceability regression). Removing off-token
  //    colours improves traceability and is allowed.
  const refOff = new Set(ref.offTokenColors);
  for (const color of cand.offTokenColors) {
    if (!refOff.has(color)) {
      findings.push({
        id: `fidelity:off-token:${color}`,
        description: `off-token colour ${color} introduced by the actuator (not in the reference) — token-traceability regression`,
        outcome: 'escalated',
      });
    }
  }

  return findings;
}
