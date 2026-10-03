/**
 * G5-S1 — Canonical Brief Audit: a READ-ONLY validator that reports the canonical brief-authored evidence
 * facts a brief is missing. It repairs nothing and evaluates no readiness — it identifies malformed
 * canonical INPUTS so a project can eventually participate in native execution.
 *
 * Why these three fields: migration's operator surface (`--asset`/`--approve`) can supply only asset and
 * approval blockers. The evidence facts a brief must carry itself — and that migration therefore CANNOT
 * recover — are the readiness policy's `minEvidence` (`brand`, `audience` → major `evidence:*`) and its
 * `niceToHaveEvidence` (`tone` → minor `optional:tone`). A brief missing any of them is permanently
 * NOT_MIGRATABLE until the brief is repaired (major → NOT_READY; minor tone → PARTIALLY_READY; neither
 * admits). That is exactly the four blocked projects G4-S1 found — all missing `tone`.
 *
 * Faithfulness: the audit parses with the UNMODIFIED `parseBrief` and tests presence with the UNMODIFIED
 * `hasValue` — the SAME predicate `buildBriefSession` uses to decide whether a field becomes a confirmed
 * fact. So "missing" here is byte-identical to what produces the readiness blocker; the audit never
 * reimplements or relaxes readiness evaluation, and introduces no new abstraction over it.
 */
import { parseBrief, type Brief } from '../generate/brief.js';
import { hasValue } from './evidence.js';

/** One canonical evidence gap that migration cannot supply — with its minimal textual repair. */
export interface BriefDefect {
  /** The canonical brief field that is missing/empty. */
  readonly field: string;
  /** The readiness blocker this gap produces (`evidence:<field>` or `optional:<field>`). */
  readonly blockerId: string;
  /** `major` (required evidence → NOT_READY) or `minor` (optional enrichment → PARTIALLY_READY). */
  readonly severity: 'major' | 'minor';
  /** The minimal textual repair to the brief frontmatter. */
  readonly repair: string;
  /** Why the repair restores canonical readiness. */
  readonly reason: string;
}

/** The read-only canonical-brief audit result. */
export interface CanonicalBriefAudit {
  /** True iff the brief carries every non-supplyable canonical evidence fact (no defects). */
  readonly canonical: boolean;
  readonly defects: BriefDefect[];
}

/**
 * The non-supplyable canonical evidence facts a migratable brief must carry, in report order. Grounded in
 * `ruleReadinessPolicy`: `minEvidence` (brand, audience) + `niceToHaveEvidence` (tone). This list is the
 * single coupling point to the policy — if the policy's evidence set changes, this is the line to update.
 */
const NON_SUPPLYABLE_EVIDENCE: ReadonlyArray<{ field: string; severity: 'major' | 'minor'; blockerId: string; read: (b: Brief) => unknown }> = [
  { field: 'brand', severity: 'major', blockerId: 'evidence:brand', read: (b) => b.brand },
  { field: 'audience', severity: 'major', blockerId: 'evidence:audience', read: (b) => b.audience },
  { field: 'tone', severity: 'minor', blockerId: 'optional:tone', read: (b) => b.tone },
];

/**
 * Audit a brief's canonical inputs — read-only. Reports each non-supplyable evidence fact the brief is
 * missing (the gaps that keep a project NOT_MIGRATABLE). Pure over the brief text.
 */
export function auditCanonicalBrief(briefText: string): CanonicalBriefAudit {
  const brief = parseBrief(briefText);
  const defects: BriefDefect[] = [];
  for (const f of NON_SUPPLYABLE_EVIDENCE) {
    if (hasValue(f.read(brief))) continue;
    defects.push({
      field: f.field,
      blockerId: f.blockerId,
      severity: f.severity,
      repair: `Add a \`${f.field}:\` line to the brief frontmatter with the project's ${f.field}.`,
      reason:
        f.severity === 'minor'
          ? `\`${f.field}\` is optional enrichment; absent it yields the minor \`${f.blockerId}\` blocker → PARTIALLY_READY (not admitted). Migration cannot supply it (it is not an asset/approval), so the project stays NOT_MIGRATABLE until the brief carries \`${f.field}\`.`
          : `\`${f.field}\` is required evidence; absent it yields the major \`${f.blockerId}\` blocker → NOT_READY (not admitted). Migration cannot supply it (it is not an asset/approval), so the project stays NOT_MIGRATABLE until the brief carries \`${f.field}\`.`,
    });
  }
  return { canonical: defects.length === 0, defects };
}
