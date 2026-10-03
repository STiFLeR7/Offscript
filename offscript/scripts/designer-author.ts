/**
 * Offscript Designer Author — standalone script (Foundation P32 + proposal generation P33 +
 * proposal review P34 + overlay-candidate translation P35 + overlay approval P36 + overlay
 * materialization P37 + overlay activation P38).
 *
 * Env-gated (OFFSCRIPT_DESIGNER_AUTHOR=1), mirroring scripts/actuate.ts's own OFFSCRIPT_ACTUATOR
 * pattern (P30/P31: this script is the direct structural analog to actuate.ts, minus its
 * in-place mutation of index.html/score.json — see docs/internals/
 * P31-DESIGNER-AUTHOR-SCRIPT-ARCHITECTURE.md §8 for why that one divergence is deliberate).
 *
 * P32 built the deterministic shell: CLI entry, argument parsing, input discovery, artifact
 * loading, execution context, a structured exit model, and console reporting. P33 added
 * `--step=propose`, reusing proposal-generator.ts / proposal-report.ts to generate and persist
 * a ProposalPackage + Markdown manifest report under <dir>/designer-author/. P34 added
 * `--step=review`, reusing proposal-io.ts / proposal-review.ts to read back that ProposalPackage,
 * review it, and persist proposal-review.json + proposal-review.md alongside it. P35 added
 * `--step=overlay`, reusing proposal-overlay.ts / proposal-overlay-package.ts /
 * proposal-overlay-io.ts to translate the (already-reviewed) proposal into an OverlayCandidate
 * and persist overlay-candidate-package.json. P36 added `--step=approve --reviewer=<name>
 * --status=approved|rejected --rationale="<why>"`, reusing overlay-approval.ts /
 * overlay-approval-package.ts / overlay-approval-io.ts to record a human decision and persist
 * overlay-approval-package.json. P37 added `--step=materialize`, reusing
 * overlay-materialization.ts / overlay-materialization-package.ts / overlay-materialization-io.ts
 * to materialize an (approved, matching) OverlayCandidate + OverlayApproval pair into a
 * MaterializedFrozenOverlay and persist overlay-materialization-package.json. P38 adds exactly
 * ONE more capability, reusing already-built Designer Author code (overlay-activation.ts /
 * overlay-activation-package.ts / overlay-activation-io.ts) rather than re-implementing it:
 * `--step=activate --activated-by=<name>` reads back the MaterializationPackage, records who/when
 * activated it, and persists overlay-activation-package.json; `--step=revoke --revoked-by=<name>
 * --reason="<why>"` reads that activation back and records a revocation (printed, not persisted —
 * see run-activate.ts's own header for why). Absent
 * `--step=propose|review|overlay|approve|materialize|activate|revoke`, behavior is unchanged from
 * P32 — a read-only summary, no writes at all.
 *
 * This script still consumes nothing at runtime, writes no Frozen overlay, mutates no overlay/,
 * dispatches no subagent, and depends on neither Platform Harness nor scripts/generate.ts. See
 * docs/internals/P31-DESIGNER-AUTHOR-SCRIPT-ARCHITECTURE.md §9 for the phases this still exists
 * to be extended by.
 *
 * Usage:
 *   OFFSCRIPT_DESIGNER_AUTHOR=1 npx tsx scripts/designer-author.ts [dir]
 *   OFFSCRIPT_DESIGNER_AUTHOR=1 npx tsx scripts/designer-author.ts [dir] --step=propose \
 *     --intent="<designer intent>" --family=<semantic family> --author=<name> \
 *     [--kind=component|section|variant|overlay] [--parent=<component>]
 *   OFFSCRIPT_DESIGNER_AUTHOR=1 npx tsx scripts/designer-author.ts [dir] --step=review
 *   OFFSCRIPT_DESIGNER_AUTHOR=1 npx tsx scripts/designer-author.ts [dir] --step=overlay
 *   OFFSCRIPT_DESIGNER_AUTHOR=1 npx tsx scripts/designer-author.ts [dir] --step=approve \
 *     --reviewer=<name> --status=approved|rejected --rationale="<why>"
 *   OFFSCRIPT_DESIGNER_AUTHOR=1 npx tsx scripts/designer-author.ts [dir] --step=materialize
 *   OFFSCRIPT_DESIGNER_AUTHOR=1 npx tsx scripts/designer-author.ts [dir] --step=activate \
 *     --activated-by=<name>
 *   OFFSCRIPT_DESIGNER_AUTHOR=1 npx tsx scripts/designer-author.ts [dir] --step=revoke \
 *     --revoked-by=<name> --reason="<why>"
 */
import { resolveWorkingDir, DEFAULT_CLIENT } from '../src/paths.js';
import { resolveTargetDir, getFlagValue, parseProposalKind, parseApprovalStatus, DesignerAuthorCliError } from '../src/designer-author/run-cli.js';
import {
  createDesignerAuthorExecutionContext,
  buildDesignerAuthorRunResult,
} from '../src/designer-author/run-context.js';
import { discoverRunArtifacts } from '../src/designer-author/run-artifacts.js';
import { runProposeStep } from '../src/designer-author/run-propose.js';
import { runReviewStep, DesignerAuthorReviewError } from '../src/designer-author/run-review.js';
import { runOverlayStep, DesignerAuthorOverlayError } from '../src/designer-author/run-overlay.js';
import { runApproveStep, DesignerAuthorApprovalError } from '../src/designer-author/run-approve.js';
import { runMaterializeStep, DesignerAuthorMaterializationError } from '../src/designer-author/run-materialize.js';
import { runActivateStep, runRevokeStep, DesignerAuthorActivationError } from '../src/designer-author/run-activate.js';

if (process.env.OFFSCRIPT_DESIGNER_AUTHOR !== '1') {
  console.log(
    `Designer Author: skipped (set OFFSCRIPT_DESIGNER_AUTHOR=1 to run). Read-only, opt-in — loads an ` +
      `already-completed scripts/generate.ts run's review-package.json/doctor-report.json and ` +
      `reports on it; generates no proposal. See ` +
      `docs/internals/P31-DESIGNER-AUTHOR-SCRIPT-ARCHITECTURE.md.`,
  );
  process.exit(0);
}

const args = process.argv.slice(2);
const dir = resolveTargetDir(args, resolveWorkingDir(DEFAULT_CLIENT, 'website'));

const context = createDesignerAuthorExecutionContext({ dir });
const discovery = discoverRunArtifacts(dir);
const result = buildDesignerAuthorRunResult({ context, discovery });

switch (discovery.status) {
  case 'invalid-directory':
    console.log(`Designer Author: no such directory: ${dir}`);
    break;
  case 'not-ready':
    console.log(
      `Designer Author: ${dir} has no completed generation run — missing ${discovery.missing.join(', ')}. ` +
        `Run 'npx tsx scripts/generate.ts <client> [--track website|collateral]' first.`,
    );
    break;
  case 'malformed-artifacts':
    console.log(
      `Designer Author: ${dir} has unreadable run artifact(s) — ${discovery.malformed.join(', ')}. Cannot proceed.`,
    );
    break;
  case 'ready': {
    const { reviewPackage, doctorReport } = discovery;
    console.log(`Designer Author`);
    console.log(`  dir:             ${dir}`);
    console.log(`  client / track:  ${reviewPackage.metadata.client} / ${reviewPackage.metadata.track}`);
    console.log(`  headline:        ${reviewPackage.headlineStatus}`);
    console.log(`  finding count:   review=${reviewPackage.findingCount}, doctor=${doctorReport.findingCount}`);
    console.log(`  replay identity: ${reviewPackage.metadata.replayIdentity.slice(0, 12)}…`);

    if (getFlagValue(args, 'step') === 'propose') {
      const intent = getFlagValue(args, 'intent');
      const family = getFlagValue(args, 'family');
      const authoredBy = getFlagValue(args, 'author');
      if (intent === undefined || family === undefined || authoredBy === undefined) {
        console.log(
          `\nDesigner Author: --step=propose requires --intent, --family, and --author.`,
        );
        process.exit(1);
      }
      try {
        const kind = parseProposalKind(getFlagValue(args, 'kind'));
        const parentComponent = getFlagValue(args, 'parent');
        const propose = runProposeStep(discovery, {
          intent,
          family,
          authoredBy,
          kind,
          ...(parentComponent !== undefined ? { parentComponent } : {}),
        });
        console.log(`\nDesigner Author — proposal generated (no review, no overlay, no dispatch)`);
        console.log(`  proposal id:            ${propose.proposalPackage.proposal.identity.id.slice(0, 12)}…`);
        console.log(`  proposal-package.json:  ${propose.proposalPackagePath}`);
        console.log(`  proposal-report.md:     ${propose.reportPath}`);
      } catch (err) {
        const message = err instanceof DesignerAuthorCliError || err instanceof Error ? err.message : String(err);
        console.log(`\nDesigner Author: proposal generation failed — ${message}`);
        process.exit(1);
      }
    } else if (getFlagValue(args, 'step') === 'review') {
      try {
        const review = runReviewStep(discovery);
        console.log(`\nDesigner Author — proposal reviewed (no overlay, no approval, no activation, no dispatch)`);
        console.log(`  review status:          ${review.reviewReport.reviewStatus}`);
        console.log(`  finding count:          ${review.reviewReport.findingCount}`);
        console.log(`  proposal-review.json:   ${review.reviewReportPath}`);
        console.log(`  proposal-review.md:     ${review.reviewMarkdownPath}`);
      } catch (err) {
        const message = err instanceof DesignerAuthorReviewError || err instanceof Error ? err.message : String(err);
        console.log(`\nDesigner Author: proposal review failed — ${message}`);
        process.exit(1);
      }
    } else if (getFlagValue(args, 'step') === 'overlay') {
      try {
        const overlay = runOverlayStep(discovery);
        console.log(`\nDesigner Author — overlay candidate translated (no approval, no materialization, no activation, no dispatch)`);
        console.log(`  candidate id:                    ${overlay.overlayCandidatePackage.translation.candidate.id}`);
        console.log(`  overlay-candidate-package.json:  ${overlay.overlayCandidatePackagePath}`);
      } catch (err) {
        const message = err instanceof DesignerAuthorOverlayError || err instanceof Error ? err.message : String(err);
        console.log(`\nDesigner Author: overlay candidate translation failed — ${message}`);
        process.exit(1);
      }
    } else if (getFlagValue(args, 'step') === 'approve') {
      const reviewer = getFlagValue(args, 'reviewer');
      const rationale = getFlagValue(args, 'rationale');
      if (reviewer === undefined || rationale === undefined) {
        console.log(`\nDesigner Author: --step=approve requires --reviewer, --status, and --rationale.`);
        process.exit(1);
      }
      try {
        const status = parseApprovalStatus(getFlagValue(args, 'status'));
        const approve = runApproveStep(discovery, { reviewer, status, rationale });
        console.log(`\nDesigner Author — overlay approval recorded (no materialization, no activation, no dispatch)`);
        console.log(`  decision:                        ${approve.approvalPackage.approval.decision.status}`);
        console.log(`  overlay-approval-package.json:   ${approve.approvalPackagePath}`);
      } catch (err) {
        const message =
          err instanceof DesignerAuthorApprovalError || err instanceof DesignerAuthorCliError || err instanceof Error
            ? err.message
            : String(err);
        console.log(`\nDesigner Author: overlay approval failed — ${message}`);
        process.exit(1);
      }
    } else if (getFlagValue(args, 'step') === 'materialize') {
      try {
        const materialize = runMaterializeStep(discovery);
        console.log(`\nDesigner Author — overlay materialized (no activation, no Frozen overlay write, no dispatch)`);
        console.log(`  materialized id:                     ${materialize.materializationPackage.materialization.materialized.id}`);
        console.log(`  overlay-materialization-package.json: ${materialize.materializationPackagePath}`);
      } catch (err) {
        const message = err instanceof DesignerAuthorMaterializationError || err instanceof Error ? err.message : String(err);
        console.log(`\nDesigner Author: overlay materialization failed — ${message}`);
        process.exit(1);
      }
    } else if (getFlagValue(args, 'step') === 'activate') {
      const activatedBy = getFlagValue(args, 'activated-by');
      if (activatedBy === undefined) {
        console.log(`\nDesigner Author: --step=activate requires --activated-by.`);
        process.exit(1);
      }
      try {
        const activate = runActivateStep(discovery, { activatedBy });
        console.log(`\nDesigner Author — overlay activated (no runtime consumption, no Frozen overlay write, no dispatch)`);
        console.log(`  activation id:                   ${activate.activationPackage.activation.id}`);
        console.log(`  overlay-activation-package.json: ${activate.activationPackagePath}`);
      } catch (err) {
        const message = err instanceof DesignerAuthorActivationError || err instanceof Error ? err.message : String(err);
        console.log(`\nDesigner Author: overlay activation failed — ${message}`);
        process.exit(1);
      }
    } else if (getFlagValue(args, 'step') === 'revoke') {
      const revokedBy = getFlagValue(args, 'revoked-by');
      const reason = getFlagValue(args, 'reason');
      if (revokedBy === undefined || reason === undefined) {
        console.log(`\nDesigner Author: --step=revoke requires --revoked-by and --reason.`);
        process.exit(1);
      }
      try {
        const revoke = runRevokeStep(discovery, { revokedBy, reason });
        console.log(`\nDesigner Author — overlay activation revoked (recorded, not persisted — see docs/internals/P38)`);
        console.log(`  revocation id:      ${revoke.revocation.id}`);
        console.log(`  revoked activation: ${revoke.revocation.activationId}`);
        console.log(`  revoked at:         ${revoke.revocation.revokedAt}`);
      } catch (err) {
        const message = err instanceof DesignerAuthorActivationError || err instanceof Error ? err.message : String(err);
        console.log(`\nDesigner Author: overlay activation revocation failed — ${message}`);
        process.exit(1);
      }
    }
    break;
  }
}

process.exit(result.exitCode);
