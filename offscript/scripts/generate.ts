/**
 * Offscript generate engine — Phase 4 (CR-validate wired). P03: Platform Harness Consumption.
 *
 * Native resources/-grounded generation pipeline (§8):
 *   Brief → Stage 1 Context-Understanding
 *         → Stage 2 Adaptive-Design-Intelligence
 *         → Stage 3 Generate (writes index.html)
 *         → Stage 4 CR-validate (writes score.json)  ← LIVE (Phase 4)
 *
 * P03 — PLATFORM HARNESS CONSUMPTION: this script is now a thin harness frontend
 * (P01 §13 / P02 / P03). Every exit decision (`process.exit`) is derived from a
 * `HarnessRunResult` built via `buildHarnessRunResult`/`exitCodeFor`
 * (`src/platform-harness.ts`) instead of the ad hoc literals it used before P03,
 * and a `HarnessStageSequencer` records the eight harness checkpoints (input →
 * context → generate → validate → review → metrics → report → exit) as they are
 * reached — 'review' is never recorded here (no human-in-the-loop step on this
 * path; only harden-review.ts has one), which the sequencer permits (gaps are
 * fine; regressions and repeats are not). NOTHING ALGORITHMIC MOVED: buildContext
 * / plan / author / the Stage-4 loop are the exact same functions, called in the
 * exact same order, with the exact same arguments, as before P03 — the harness
 * owns SEQUENCING and the exit-status boundary only, never generation, planning,
 * selection, or validation. The former inline `runValidateLoop` (Stage 4 driver)
 * moved verbatim to `src/generate/validate-loop-driver.ts#runValidateAndReport`
 * so it is independently testable and can RETURN its computed HeadlineStatus
 * (P02's `HarnessReportResult`) instead of discarding it — see that module's
 * header for the two orchestration-only differences from the original inline body.
 *
 * Stage 3 calls authorDocument() with defaultScriptedAuthor() — the
 * scripted/smoke path that proves the pipeline assembles + self-contains +
 * carries tokens deterministically. In-session LLM authoring (the real path)
 * uses createSubagentAuthor() and is the non-circular proof for Phase 4.
 *
 * CIRCULAR-PROOF NOTE (bank here — do not erase):
 *   The scripted author is a DOUBLE, not evidence. Although the authored body is
 *   var()-only (systematic by construction), the full-document score on the
 *   scripted path measures ~0.57 — NOT ≈1.0 — because house-CSS warnings land
 *   in the denominator and residual detect findings count against the ratio.
 *   This is a pipeline smoke-test, NOT proof the engine generates on-brand work.
 *   The non-circular ratio proof must come from the in-session LLM-authored
 *   artifact, which can make off-brand choices the rails actually catch.
 *
 * Stage 4 bounded regenerate loop:
 *   The loop cap (MAX_PASSES = 2) and TARGET_SYSTEMATIC_RATIO are provisional.
 *   They are empirical stand-ins, to be tuned against the real LLM-authored
 *   Example Brand artifact. On the scripted path the TARGET is NOT met (~0.57 vs
 *   0.8); the loop attempts pass 2 but the no-progress guard stops it
 *   immediately (deterministic author → identical html). The "goal met" branch
 *   is dead on the scripted path and is only exercised by the LLM-authored path.
 *   Violation-aware re-authoring (feeding rail findings back into the authoring
 *   seam as priorViolations) is the LLM-path extension that firms up when the
 *   in-session Author lands.
 *
 * Usage:  npx tsx scripts/generate.ts <client> [--track website|collateral|deck]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  resolveWorkingDir,
  projectReferencesDir,
  DEFAULT_CLIENT,
  intentBriefPath,
  designProcessesDir,
  resolveBrandContract,
} from '../src/paths.js';
import { resolveTrack } from '../src/track-resolve.js';
import { buildContext as buildDesignContext } from '../src/generate/context.js';
import { plan as buildPlan, serializeSections, serializeRulebook } from '../src/generate/plan.js';
import {
  readSectionUsage,
  writeSectionUsage,
  recordSectionUsage,
  EMPTY_SECTION_USAGE,
} from '../src/generate/section-usage.js';
import { authorDocument } from '../src/generate/author.js';
import {
  defaultScriptedAuthor,
  createSubagentAuthor,
  pasteVerbatimAuthor,
} from '../src/generate/authoring-seam.js';
import type { Author, AuthorDispatch, AuthoringRequest } from '../src/generate/authoring-seam.js';
// ── WS9b: constitution-by-selection website pipeline (all dormant modules, now activated) ──
import { buildAuthorContract } from '../src/generate/author-contract.js';
import { loadFragmentHtml, loadFragmentCatalog } from '../src/generate/catalog.js';
import { assembleWebsitePage, type WebsiteBand } from '../src/generate/website-assembly.js';
import { serializeCurationComment } from '../src/generate/curation.js';
import { websiteShell } from '../src/generate/website-shell.js';
import { runValidatePageGate, foldCurationGate } from '../src/generate/catalog-gate.js';
import { flattenWebsite } from '../src/flatten/flatten-website.js';
import { applySiteMetadata, loadSiteMetadata } from '../src/generate/site-metadata.js';
import { buildRenderingIRArtifact } from '../src/generate/rendering-ir-export.js';
import { readSubagentResponse, assertResponsesComplete } from '../src/generate/subagent-response.js';
import { loadArtifactInventoryForClient, assignCreativeArtifacts, extractVisualFromLocation } from '../src/generate/creative-artifact-consumption.js';
import { runValidateAndReport, type ReviewPackageBuilder } from '../src/generate/validate-loop-driver.js';
import { resolveDeliverableFilename } from '../src/generate/deliverable-filename.js';
import { writeIntentBrief } from '../src/generate/intent-brief.js';
import { defaultScriptedDirector } from '../src/generate/intent-director.js';
import { enrichPlanWithGovernedReasoning } from '../src/generate/reasoning/reasoning-orchestrator.js';
import { loadGovernanceDrafts, deriveGovernanceModels, GOVERNANCE_PACK_FILENAME } from '../src/generate/reasoning/governance-pack.js';
import { applyConstitutionalGovernance } from '../src/generate/reasoning/constitutional-consumption.js';
import { tryCrossTrackGovernance } from '../src/cross-track-governance.js';
import { selectRealizationAuthor } from '../src/generate/realization-routing.js';
import { resolveGovernedActivation } from '../src/generate/governed-activation.js';
import { digest } from '../src/knowledge/digest.js';
import type { DerivedModelSet } from '../src/knowledge/derivation/models.js';
import type { DesignContext } from '../src/generate/types.js';
import type { AuthoringPlan } from '../src/generate/types.js';
import type { Finding } from '../src/operator.js';
import {
  createHarnessExecutionContext,
  createHarnessStageSequencer,
  buildHarnessRunResult,
} from '../src/platform-harness.js';
import type { HarnessReportResult } from '../src/platform-harness.js';
// ── G1-S4 — native generation entry from persisted Project Readiness (G1-S3) ──
import { readProjectReadiness } from '../src/project/readiness-store.js';
import { resolveGenerationEntry, nativeReviewPackage, type GenerationEntry } from '../src/project/generation-orchestration.js';
import { buildReviewPackageFromContract, doctorContractFromLegacy } from '../src/project/doctor-contract-adapter.js';
import type { ProjectReadiness } from '../src/project/readiness.js';

// ─── Arg parsing ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const clientArg = args.find((a) => !a.startsWith('--'));
const client = clientArg ?? DEFAULT_CLIENT;
const track = resolveTrack(args);

// ─── Resolve working dir ─────────────────────────────────────────────────────
// The dir is created AFTER Stage 1 succeeds (below), so a blocked-deck run —
// which throws in buildContext — leaves no empty directory behind. Resolved
// BEFORE the skip-clean guard (P03) purely so the Platform Harness execution
// context — which needs client/track/outDir together — can be built once and
// reused by every exit path, including the earliest (skip). resolveWorkingDir
// only reads (existsSync checks) — reordering it ahead of the guard changes
// nothing observable.
const outDir = resolveWorkingDir(client, track);

// P47 — cross-page novelty: read this deliverable's persisted section-usage history (slug→prior-use
// count) as an EXPLICIT selection input, co-located with sections.md / index.html in the working dir.
// Website only (the fragment catalog is website-only). Absent store ⇒ empty ⇒ the first generation is
// byte-identical to the pre-P47 baseline; the variety shift appears once history has accumulated. The
// READ never depends on the working dir existing yet (existsSync ⇒ empty when absent).
const sectionUsageFile = join(outDir, 'section-usage.json');
const sectionUsageHistory = track === 'website' ? readSectionUsage(sectionUsageFile) : EMPTY_SECTION_USAGE;

// ─── P03 — Platform Harness orchestration context ─────────────────────────────
const harnessCtx = createHarnessExecutionContext({ client, track, outDir });
const stageSeq = createHarnessStageSequencer();
stageSeq.record('input');

// ─── Skip-clean guard — no client directory at all ────────────────────────────
// Mirror harden.ts's isKit() spirit: if the client has no references dir at all,
// there is nothing to generate against. Exit cleanly so CI stays green.
const refsDir = projectReferencesDir(client);
if (!existsSync(refsDir)) {
  console.log(
    `No project directory for client "${client}" — skipping.\n` +
      `  (expected: ${refsDir})\n` +
      `  Run \`/offscript init ${client}\` to scaffold the client workspace,\n` +
      `  then drop a brief.md into projects/${client}/references/.`,
  );
  process.exit(buildHarnessRunResult({ context: harnessCtx, outcome: 'skipped' }).exitCode);
}

// ─── G1-S4 — native generation entry (persisted-readiness governed) ───────────
// The CLI now BEGINS from the persisted ProjectReadiness (G1-S3) when present. It OWNS artifact loading;
// the Generation Engine's `resolveGenerationEntry` owns the decision: NATIVE (build the GenerationContract
// EXACTLY ONCE from persisted readiness via beginGeneration, governed by the P54 admission gate + the
// contract scope) or LEGACY (no readiness ⇒ the existing DesignContext path, unchanged). The CLI never
// synthesizes readiness:
//   • readiness.json ABSENT       → legacy compatibility path (byte-identical to pre-G1).
//   • readiness.json INVALID      → fail closed (bad JSON / schema) — never silently regenerated.
//   • present but NOT READY       → fail closed (the readiness gate refuses admission).
//   • present but track unadmitted→ fail closed (the contract scope refuses the deliverable).
// On the native path the render tier below still runs UNCHANGED with the same {client, track} — the
// contract-admitted identity equals the legacy one, so outputs are byte-identical; the contract is the
// execution authority at the CLI boundary, not a behavioural change to rendering.
let persistedReadiness: ProjectReadiness | null;
try {
  persistedReadiness = readProjectReadiness(client);
} catch (err) {
  console.error(
    `\n[readiness] persisted readiness is present but INVALID — failing closed (not regenerating).\n  ${(err as Error).message}`,
  );
  process.exit(buildHarnessRunResult({ context: harnessCtx, outcome: 'context-failed' }).exitCode);
}
let entry: GenerationEntry;
try {
  entry = resolveGenerationEntry({ client, track, readiness: persistedReadiness });
} catch (err) {
  console.error(
    `\n[readiness] persisted readiness does not admit this run — failing closed.\n  ${(err as Error).message}`,
  );
  process.exit(buildHarnessRunResult({ context: harnessCtx, outcome: 'context-failed' }).exitCode);
}

// ─── G2-S1 — native render driver: the render tier's execution-identity source ────
// The render driver (validate-loop-driver) no longer originates the ReviewPackage's {client, track};
// it delegates to THIS builder. NATIVE: `nativeReviewPackage` sources identity from the frozen
// GenerationContract (the P55→G1 native path promoted into production). LEGACY: the compatibility
// bridge sources it from the DesignContext's {client, track}. Both are byte-identical (the native
// identity equals the legacy one), so this changes the identity ORIGIN, never the emitted bytes.
let reviewPackageBuilder: ReviewPackageBuilder;
if (entry.mode === 'native') {
  const gen = entry.generation;
  console.log(
    `[generate] NATIVE execution — GenerationContract ${gen.orchestration.contractId} ` +
      `built from persisted readiness (admitted: ${gen.orchestration.contract.scope.included.join(', ')}).`,
  );
  reviewPackageBuilder = (runtime) => nativeReviewPackage(gen, track, runtime);
} else {
  console.log(`[generate] LEGACY compatibility path — ${entry.reason}.`);
  reviewPackageBuilder = (runtime) =>
    buildReviewPackageFromContract(doctorContractFromLegacy({ client, deliverables: [track] }), track, runtime);
}

// ─── Governance enablement (W15/W16) ─────────────────────────────────────────
// Load the per-client Governed Producer output ONCE, early — its presence is the single switch that
// gates (a) governed reasoning enrichment, (b) W16 brief-aware selection, and (c) W16 realization
// routing. Absent ⇒ governanceEnabled=false ⇒ every W16/W15 behaviour is off ⇒ byte-identical default.
// Fail-loud on a malformed pack (loadGovernanceDrafts) surfaces here, before any stage runs.
const govDrafts = loadGovernanceDrafts(join(refsDir, GOVERNANCE_PACK_FILENAME));
const governanceEnabled = govDrafts !== undefined;

// ─── Author selection (scripted default; in-session subagent on opt-in) ──────
// Mirrors the OFFSCRIPT_ACTUATOR=1 gate in scripts/actuate.ts. Default → the
// deterministic scripted double (CI/headless). OFFSCRIPT_AUTHOR=subagent → the real
// in-session authoring path: createSubagentAuthor writes one <item-id>.request.md
// per plan item into <outDir>/dispatch/, and the dispatch reads the subagent's
// authored fragment back from <item-id>.response.html (written by the orchestrating
// Claude session). C1 fail-loud gate: a missing response is NOT silently stubbed.
// Because authorDocument authors items SEQUENTIALLY, the first run still writes EVERY
// <item-id>.request.md — the dispatch records each missing response (subagentMissing)
// and returns a non-scoring placeholder so the pass completes — and then the run FAILS
// LOUD via assertResponsesComplete (before any score is written), listing all missing
// sections at once. Same two-phase shape as actuate.ts's <pass>.response.html.
// Both tracks author from scratch via the deterministic scripted double on the CI/headless
// path (a smoke-test proving assembly + scoring); the real design lands on the subagent path.
function scriptedDoubleForTrack(): Author {
  // WS9b: the website path is constitution-by-selection — the scripted double pastes the
  // reconstructed catalog band VERBATIM (proves shell-rooted assembly + the curation gate
  // deterministically). Collateral authors from scratch via the minimal scripted double.
  return track === 'website' ? pasteVerbatimAuthor() : defaultScriptedAuthor();
}

// C1 collector — sections whose <id>.response.html was missing during the authoring
// pass. Populated by the subagent dispatch; asserted (fail-loud) after the full pass,
// before Stage-4 scoring. Module scope so both selectAuthor and the call site see it.
const subagentMissing: string[] = [];

// W16 Goal 1 — realization routing. The scripted author is RETAINED as deterministic infrastructure
// (CI, regression, offline, byte-identical verification); the subagent (LLM) author is the production-
// quality realization path that regenerates copy/proof/CTA from the brief. WEBSITE routes through the
// explicit switch (governance disabled → scripted; governance enabled + production author available →
// subagent). COLLATERAL keeps its existing env-only opt-in unchanged (website-first; collateral
// byte-identical). `productionAuthorAvailable` = the in-session subagent seam is opted in.
const productionAuthorAvailable = process.env.OFFSCRIPT_AUTHOR === 'subagent';
// W21 — semantic author CONSUMPTION. Layered on W20's transport (OFFSCRIPT_SEMANTIC_AUTHOR). When on,
// the subagent author's request gains a `## How to use Component Knowledge` directive telling the
// in-session LLM to realize Purpose/Character/Contract/Judgement into copy. Only the subagent author
// consumes it; the scripted author never renders a request, so the deterministic path stays
// byte-identical regardless of this flag's state. No transport change — the W20 block is unchanged.
// W67: defaults to governance-pack presence, same precedence as W19/W24/W30/cadence/Presentation
// Intent above (resolveGovernedActivation) — an explicit OFFSCRIPT_SEMANTIC_AUTHOR_CONSUME value always
// overrides in either direction; absent ⇒ follows `governanceEnabled`. Ungoverned runs stay
// byte-identical (governanceEnabled=false ⇒ off, same as before).
const semanticAuthorConsumeEnabled = resolveGovernedActivation(
  process.env.OFFSCRIPT_SEMANTIC_AUTHOR_CONSUME,
  governanceEnabled,
);
const useSubagent =
  track === 'website'
    ? selectRealizationAuthor({ governanceEnabled, productionAuthorAvailable }) === 'subagent'
    : productionAuthorAvailable;

function selectAuthor(): Author {
  if (!useSubagent) {
    return scriptedDoubleForTrack();
  }
  const dispatchDir = join(outDir, 'dispatch');
  const dispatch: AuthorDispatch = async (req) => {
    const id = req.item.anchor.id;
    const html = readSubagentResponse(
      id,
      (x) => existsSync(join(dispatchDir, `${x}.response.html`)),
      (x) => readFileSync(join(dispatchDir, `${x}.response.html`), 'utf8'),
    );
    if (html === null) {
      subagentMissing.push(id);
      return `<!-- OFFSCRIPT-MISSING-RESPONSE: ${id} -->`;
    }
    return html;
  };
  return createSubagentAuthor({
    dispatchDir,
    dispatch,
    consumeComponentKnowledge: semanticAuthorConsumeEnabled,
  });
}

const selectedAuthor = selectAuthor();
const authorLabel = useSubagent
  ? `in-session subagent (LLM authoring${semanticAuthorConsumeEnabled ? ', semantic consumption ON' : ''})`
  : 'scripted (pipeline smoke; in-session LLM authoring is the real path)';

console.log(`Offscript generate — author: ${authorLabel}`);
console.log(`  client:  ${client}`);
console.log(`  track:   ${track}`);
console.log(`  outDir:  ${outDir}\n`);

// ─── Stage 1: Context-Understanding ─────────────────────────────────────────
// buildContext owns brief-loading (missing → stub, malformed → throws), brand
// resolution, and governance loading. Throws on deck (blocked), missing brand
// tokens, or a malformed brief; the caller catches and exits non-zero.
function buildContext(): DesignContext {
  // G2-S2 — execution identity is sourced from `entry.identity` (the GenerationContract's compatibility
  // projection on the native path; the compat bridge on the legacy path), NOT from raw argv. DesignContext
  // thus TRANSPORTS the contract-owned identity; it no longer originates it. Byte-identical: entry.identity
  // .{client,track} equals argv {client,track} by construction (the contract admitted this run). Every
  // downstream consumer of context.client/track (provenance manifest, rulebook, brand/brief resolution)
  // transitively receives the contract-owned identity, unchanged.
  const ctx = buildDesignContext(entry.identity.client, entry.identity.track);
  const tokenCount = ctx.tokens.customProps.size;
  const playbookCount = ctx.governance.sectionIntelligence.size;
  const brandLabel = ctx.brandSource === 'default' ? 'reference defaults' : 'client brand';
  console.log(`[Stage 0/1] Brief: "${ctx.brief.oneLiner}"`);
  console.log(
    `[Stage 1] Context-Understanding — ${tokenCount} tokens (${brandLabel}), ` +
      `${playbookCount} playbook anchors, ` +
      `${ctx.governance.playbooks.size} governance docs`,
  );
  return ctx;
}

// ─── Stage 2: Adaptive-Design-Intelligence ────────────────────────────────────
// Turn the DesignContext into an AuthoringPlan (ordered items with archetype,
// anchor, tokenRoles, intent), persisted as sections.md + rulebook.md.
// W16 — plan BUILD only (no serialization). W16 Goal 2: `governedSelection` turns on brief-aware
// fragment selection when governance is enabled (different briefs → different variants); disabled ⇒
// catalog-order tiebreak ⇒ byte-identical. The recipe is serialized LATER (persistRecipe), AFTER the
// governed-reasoning enrich, so sections.md/rulebook.md record the enriched plan (W16 Goal 4a).
// W19 — semantic selection consumer. W60: defaults to governance-pack presence (mirroring
// `realization-routing.ts`'s author-selection precedent) — an explicit OFFSCRIPT_SEMANTIC_SELECTION
// value always overrides in either direction; absent ⇒ follows `governanceEnabled`. Ungoverned runs
// stay byte-identical (governanceEnabled=false ⇒ off, same as before). When on, the authored
// component body (Choose-when / Avoid-when / Composition) breaks otherwise-tied selection choices.
const semanticSelectionEnabled = resolveGovernedActivation(
  process.env.OFFSCRIPT_SEMANTIC_SELECTION,
  governanceEnabled,
);
// W20 — semantic author context transport (attaches PlanItem.componentKnowledge, keyed on the
// selected fragmentId). W67: defaults to governance-pack presence, same precedence as
// W19/W24/W30/cadence/Presentation Intent above (resolveGovernedActivation) — an explicit
// OFFSCRIPT_SEMANTIC_AUTHOR value always overrides in either direction; absent ⇒ follows
// `governanceEnabled`. Ungoverned runs stay byte-identical (governanceEnabled=false ⇒ off, same as
// before). Collateral is unaffected either way — buildCollateralPlan never reads this option.
const semanticAuthorContextEnabled = resolveGovernedActivation(
  process.env.OFFSCRIPT_SEMANTIC_AUTHOR,
  governanceEnabled,
);
// W24 — family-knowledge selection consumer. W60: defaults to governance-pack presence, same
// precedence as W19 above. When on, the candidate's canonical family (the W23 abstract-role layer)
// breaks otherwise-tied selection choices as a SECONDARY discriminator below structural / governance
// / adjacency / W19 component semantics.
const familySelectionEnabled = resolveGovernedActivation(
  process.env.OFFSCRIPT_FAMILY_SELECTION,
  governanceEnabled,
);
// W30 — mission/audience selection consumer. W60: defaults to governance-pack presence, same
// precedence as W19/W24 above. When on, each candidate's derived mission/audience profile is the
// FINAL quality discriminator (below structural / governance / adjacency / W19 / W24, above catalog
// order) — it breaks otherwise-tied selection choices.
const missionSelectionEnabled = resolveGovernedActivation(
  process.env.OFFSCRIPT_MISSION_SELECTION,
  governanceEnabled,
);
// W33/W34 — the Soft-Band Cascade W16 tolerance δ (W32). δ=0 is the studied production default
// (W34: "Keep δ=0" — no δ>0 cleared the evidence bar); this ALREADY matches W60's required
// precedence (env override > built-in default) with no code change — an explicit
// OFFSCRIPT_W16_BAND_DELTA always wins; absent, δ stays 0 regardless of governance state (W34 did not
// recommend tying δ's default to governance presence, only its own studied value). Non-negative
// integer; applies to the composition router and the fragment picker.
const w16BandDelta = Math.max(0, Math.trunc(Number(process.env.OFFSCRIPT_W16_BAND_DELTA ?? '0')) || 0);

// W50 Track 3 — presentation cadence (surface-only visual rhythm). W63: defaults to governance-pack
// presence, same precedence as W19/W24/W30 above (resolveGovernedActivation) — an explicit
// OFFSCRIPT_RHYTHM_CADENCE value always overrides in either direction; absent ⇒ follows
// `governanceEnabled`. Ungoverned runs stay byte-identical (governanceEnabled=false ⇒ off, same as
// before). W62 measured this activates exactly the adjacent same-archetype/same-surface repeats real
// governed clients already have, with no other effect (surface/variant only; archetype/order/count
// untouched).
const rhythmCadenceEnabled = resolveGovernedActivation(process.env.OFFSCRIPT_RHYTHM_CADENCE, governanceEnabled);

// W52-58 — Presentation Intent (collateral only). W63: defaults to governance-pack presence, same
// precedence as above. When on, `computePresentationIntent` (including W57's StatsPage structural
// rule) attaches to every collateral item; W62 measured this activates on real content exactly once
// (a StatsPage stats stamp) with no composition/archetype/count change, and — truthfully — causes one
// verification warning in scripted-author mode (the routed chart is not yet realized by the scripted
// double). That warning is correct rail behaviour, not suppressed or special-cased here.
const presentationIntentEnabled = resolveGovernedActivation(
  process.env.OFFSCRIPT_PRESENTATION_INTENT,
  governanceEnabled,
);

// W70 — Website Visual Discovery (website only, Foundation stage). Mirrors W52's OWN Foundation-
// stage precedent exactly: a plain, default-off flag — NOT resolveGovernedActivation — since there
// is no consumer yet to activate (governed-default activation is a later, separate sprint, per W68
// §7.6's own "governed default deferred" note). Absent/false ⇒ no field attached ⇒ byte-identical.
const websiteVisualDiscoveryEnabled = process.env.OFFSCRIPT_WEBSITE_VISUAL_DISCOVERY === '1';

// P24 — Content Capacity (website only, Foundation stage). Mirrors W70's OWN Foundation-stage
// precedent exactly: a plain, default-off flag — NOT resolveGovernedActivation — since nothing
// consumes the transported field yet (no planner, author, renderer, or validator reads it this
// sprint; see docs/internals/P23-CONTENT-CONTRACT-V2-ARCHITECTURE.md §5.3/§9). Absent/false ⇒ no
// field attached ⇒ byte-identical. Also inert with the flag ON against today's real repository,
// since no component has yet authored `## Content Capacity` (corpus authoring is deferred).
const contentCapacityEnabled = process.env.OFFSCRIPT_CONTENT_CAPACITY === '1';

function plan(context: DesignContext): AuthoringPlan {
  const authoringPlan = buildPlan(context, {
    governedSelection: governanceEnabled,
    semanticSelection: semanticSelectionEnabled,
    semanticAuthorContext: semanticAuthorContextEnabled,
    familySelection: familySelectionEnabled,
    missionSelection: missionSelectionEnabled,
    w16BandDelta,
    rhythmCadence: rhythmCadenceEnabled,
    presentationIntent: presentationIntentEnabled,
    websiteVisualDiscovery: websiteVisualDiscoveryEnabled,
    contentCapacity: contentCapacityEnabled,
    sectionUsageHistory, // P47 — cross-page novelty (empty ⇒ byte-identical baseline)
  });
  console.log(
    `[Stage 2] Adaptive-Design-Intelligence — ${authoringPlan.items.length} items ` +
      `(${new Set(authoringPlan.items.map((i) => i.archetype)).size} distinct archetypes` +
      `${governanceEnabled ? ', brief-aware selection ON' : ''}` +
      `${semanticSelectionEnabled ? ', semantic selection ON' : ''}` +
      `${semanticAuthorContextEnabled ? ', semantic author context ON' : ''}` +
      `${familySelectionEnabled ? ', family selection ON' : ''}` +
      `${missionSelectionEnabled ? ', mission selection ON' : ''}` +
      `${rhythmCadenceEnabled ? ', rhythm cadence ON' : ''}` +
      `${presentationIntentEnabled ? ', presentation intent ON' : ''}` +
      `${websiteVisualDiscoveryEnabled ? ', website visual discovery ON' : ''}` +
      `${contentCapacityEnabled ? ', content capacity ON' : ''})`,
  );
  // Sprint 6 — wires Sprint 5's already-built Creative Artifact consumer into the real CLI
  // entrypoint (it previously only ran from a side demo script). Default-off
  // (OFFSCRIPT_CREATIVE_ARTIFACT_CONSUMPTION unset ⇒ byte-identical to before this line existed).
  // Selection is the SAME deterministic lexical term-overlap this repo already ships — no new
  // logic here, only wiring the caller-side assignment step at the point Sprint 5's own pipeline
  // diagram already placed it: after plan(), before author().
  if (process.env.OFFSCRIPT_CREATIVE_ARTIFACT_CONSUMPTION === '1') {
    const inventory = loadArtifactInventoryForClient(client);
    authoringPlan.items = assignCreativeArtifacts(authoringPlan.items, inventory);
    const rejected = inventory.filter((e) => e.integrityInvalid);
    console.log(
      `[Stage 2] Creative Artifact inventory — ${inventory.length} discovered, ` +
        `${rejected.length} integrity-rejected, ` +
        `${authoringPlan.items.filter((i) => i.creativeArtifact).length} selected`,
    );
    for (const e of rejected) {
      console.log(`           rejected: ${e.artifact.id} — ${e.integrityInvalid}`);
    }
  }
  if (rhythmCadenceEnabled) {
    const adj = authoringPlan.warnings?.filter((w) => w.startsWith('Rhythm adjustment:')) ?? [];
    if (adj.length > 0) {
      console.log(`[Stage 2] Presentation cadence — ${adj.length} surface adjustment(s):`);
      for (const line of adj) console.log(`           ${line}`);
    }
  }
  return authoringPlan;
}

// W16 Goal 4a — persist the recipe AFTER the governed-reasoning orchestrator. When governance is
// disabled the orchestrator no-ops, so the plan is unchanged and these bytes are identical to pre-W16;
// when enabled, sections.md records the governed order and rulebook.md records the governed reasoning.
function persistRecipe(authoringPlan: AuthoringPlan, context: DesignContext): void {
  const sectionsPath = join(outDir, 'sections.md');
  const rulebookPath = join(outDir, 'rulebook.md');
  writeFileSync(sectionsPath, serializeSections(authoringPlan), 'utf8');
  writeFileSync(rulebookPath, serializeRulebook(authoringPlan, context.client), 'utf8');
  console.log(`  sections.md: ${sectionsPath}`);
  console.log(`  rulebook.md: ${rulebookPath}`);
}

// ─── Stage 3: Generate (scripted author — pipeline smoke; in-session LLM authoring is the real path) ──
// CIRCULAR-PROOF NOTE: this scripted path scores systematic-ratio ~0.57 (measured), NOT ≈1.0 —
// the scripted author leaves real rail gaps. It is a pipeline smoke-test, NOT the headline ratio
// proof. The non-circular proof (Phase 4) must come from the in-session LLM-authored artifact.
async function author(
  authoringPlan: AuthoringPlan,
  context: DesignContext,
  findingsByItem?: Map<string, Finding[]>,
): Promise<{ html: string; warnings: string[] }> {
  console.log(`[Stage 3] Generate — ${authorLabel}`);
  return authorDocument(authoringPlan, context, selectedAuthor, findingsByItem);
}

// ─── Stage 3 (website): constitution-by-selection assembly (WS9b activation) ───
// Replaces the author-from-governance website path (the EA-004 deviation) with the
// recovered pipeline, reusing every dormant module exactly as built:
//   per item → loadFragmentHtml(fragmentId) [WS3 reconstructed scoped band]
//            → author seam edits it IN PLACE (baseFragment; scripted double pastes verbatim)
//   bands → assembleWebsitePage (WS6) over the WS4 shell + the curation comment + behaviour.
// Returns the MULTI-FILE assembled page; the gate (WS7) validates it and flatten (WS8) makes
// it self-contained, both wired in the website branch of the run below. Collateral never
// reaches this — it keeps authorDocument unchanged.
async function assembleWebsiteBySelection(
  authoringPlan: AuthoringPlan,
  context: DesignContext,
  authorImpl: Author,
  findingsByItem?: Map<string, Finding[]>,
): Promise<{ html: string; warnings: string[] }> {
  console.log(`[Stage 3] Generate (constitution-by-selection) — ${authorLabel}`);
  const warnings: string[] = [];
  const houseContract = buildAuthorContract(context);
  const bands: WebsiteBand[] = [];
  for (const item of authoringPlan.items) {
    if (!item.fragmentId) continue; // every website archetype is selected (ARCHETYPE_TO_SERVES is total); defensive skip
    const baseFragment = loadFragmentHtml(item.fragmentId); // WS3 reconstructed scoped data-crf band
    const priorFindings = findingsByItem?.get(item.anchor.id);
    // Sprint 6 — same resolution author.ts already performs for authorDocument's path;
    // this is the OTHER website authoring entrypoint (Path C, constitution-by-selection), so it
    // needs its own copy of this gated, default-off step to reach the same mechanical result.
    const creativeArtifactImage =
      process.env.OFFSCRIPT_CREATIVE_ARTIFACT_CONSUMPTION === '1' && item.creativeArtifact
        ? extractVisualFromLocation(item.creativeArtifact.location)
        : undefined;
    const req: AuthoringRequest = {
      item,
      guidance: item.sectionGuidance ?? '',
      oneLiner: context.brief.oneLiner,
      tone: context.brief.tone,
      ...(houseContract ? { houseContract } : {}),
      baseFragment, // inverts the seam to "edit THIS band in place" (buildBaseFragmentBlock)
      ...(item.content ? { briefContent: item.content } : {}),
      ...(priorFindings && priorFindings.length > 0 ? { priorFindings } : {}),
      ...(creativeArtifactImage ? { creativeArtifactImage } : {}),
    };
    const editedBand = await authorImpl.author(req);
    bands.push({
      html: editedBand,
      slug: item.fragmentId,
      id: item.anchor.id,
      archetype: String(item.archetype),
    });
  }

  // House behaviour library (reveal / count-up / active-nav) — WS6 inlines it before </body>.
  let behaviourScript: string | undefined;
  const behaviorPath = join(designProcessesDir('website'), 'behavior.js');
  if (existsSync(behaviorPath)) {
    behaviourScript = readFileSync(behaviorPath, 'utf8');
  } else {
    warnings.push(
      `website behaviour: behavior.js not found at ${behaviorPath} — ships without the ` +
        `reveal/count-up/active-nav library (CSS hooks degrade to their visible resting state).`,
    );
  }

  const html = assembleWebsitePage({
    bands,
    curationComment: serializeCurationComment(authoringPlan.items),
    shell: websiteShell(context.brief.oneLiner),
    behaviourScript,
    title: context.brief.oneLiner,
  });
  return { html, warnings };
}

// ─── W3 Stage-0: Director Creation Seam (the producer of the Intent Brief) ────
// Create the IntentBrief ONLY when absent, then persist it via S1's writeIntentBrief so
// buildContext below replays it (write-path ≡ read-path = intentBriefPath). The DEFAULT
// scripted director is inert (create → null → no write), so context.intentBrief stays
// undefined and the whole W3 chain stays dormant — real runs are byte-identical to pre-S0.
// The real subjective creation arrives only via an in-session createSubagentDirector
// (not wired here). Creation reasons; S1 persists/replays; plan() consumes — no overlap.
const intentBriefFilePath = intentBriefPath(client, track);
if (!existsSync(intentBriefFilePath)) {
  const createdIntentBrief = await defaultScriptedDirector().create({ client, track });
  if (createdIntentBrief !== null) writeIntentBrief(intentBriefFilePath, createdIntentBrief);
}

// ─── Run the pipeline ────────────────────────────────────────────────────────
stageSeq.record('context');
let context: DesignContext;
try {
  context = buildContext();
} catch (err) {
  console.error(`\n[Stage 1] Context-Understanding failed:\n  ${(err as Error).message}`);
  process.exit(buildHarnessRunResult({ context: harnessCtx, outcome: 'context-failed' }).exitCode);
}
// Stage 1 succeeded — safe to create the working dir now (the blocked-deck path
// exited above, leaving nothing behind). All subsequent stages write here.
mkdirSync(outDir, { recursive: true });
// Stage 2 (Adaptive-Design-Intelligence / planning) has no dedicated harness slot —
// per platform-harness.ts's own header, it folds into the harness's single 'generate'
// checkpoint alongside Stage 3 authoring (P02's mapping: Generate → author.ts /
// website-composition.ts already implies Planning happens on the way there).
stageSeq.record('generate');
const authoringPlan = plan(context);

// ─── Stage 2b: Governed Reasoning (W13 — the single production reasoning path) ──
// The seven World-A Governance Models enrich PlanItem.reasoning through ONE orchestrator, applied in
// the canonical authored descent (Communication → Information → Progression → Spatial → Mechanism →
// Visual → Experience Character — WORLD-B-EVOLUTION-ARCHITECTURE.md §6 / GOVERNANCE-GATES). This is the
// only reasoning populator on the production path; it supersedes the W3/W4 per-section producer loop,
// eliminating the dual pipeline (W12 H2). Governed reasoning is DISABLED by default — no model set is
// wired here, so the orchestrator no-ops and the plan (sections.md, rulebook.md), the author requests,
// and every downstream byte are identical to pre-W13. It is ENABLED by an in-session Governed Producer
// (World-A deriveModels with a subagent deriver) supplying `governanceModels`; that opt-in is
// intentionally NOT wired in the default path (same shadow→opt-in discipline as W4–W11).
// Program Y (Y4) — the cross-track constitutional pre-pass. Independent of governance-drafts.json
// (a different, repo-level gate: presence of the two ported resources/design_principles/
// documents, not a per-client pack) — runs BEFORE the seven-model orchestration below so its
// evidence becomes the first clause of communicationObjective, with the seven models' own
// contributions appended after (constitution precedence, per Y3). Absent documents ⇒ no-op ⇒
// byte-identical (the disabled default) — reasoning-orchestrator.ts is untouched either way.
applyConstitutionalGovernance(authoringPlan, {
  creativeDirection: tryCrossTrackGovernance('CREATIVE_DIRECTION'),
  inheritedConstitution: tryCrossTrackGovernance('INHERITED_CREATIVE_CONSTITUTION'),
});
// W15 — derive the seven Governance Models from the early-loaded per-client pack and feed the
// orchestrator. Absent pack ⇒ undefined ⇒ orchestrator no-op ⇒ byte-identical (the disabled default).
const governanceModels: DerivedModelSet | undefined = govDrafts
  ? await deriveGovernanceModels(govDrafts, context.brief, digest(`offscript:repo:${client}`))
  : undefined;
const govResult = enrichPlanWithGovernedReasoning(authoringPlan, { models: governanceModels });
console.log(
  govResult.enabled
    ? `  [governance] ENABLED — 7 models, consumers applied: ${govResult.applied.join(' → ')}`
    : `  [governance] disabled (no ${GOVERNANCE_PACK_FILENAME}) — byte-identical`,
);

// W16 Goal 4a — NOW persist the recipe (sections.md + rulebook.md) so it records the enriched plan
// (governed order + governed reasoning). Disabled ⇒ enrich was a no-op ⇒ bytes identical to pre-W16.
persistRecipe(authoringPlan, context);

// P47 — record THIS generation's selected sections into the persisted history so the NEXT generation
// for this deliverable diversifies away from them (the cross-page novelty pressure the picker's
// `recent` key consumes). Pure update (recordSectionUsage never mutates `sectionUsageHistory`), written
// only on the website track — selection is finalized here (plan() set every item.fragmentId).
if (track === 'website') {
  const selectedSlugs = authoringPlan.items
    .map((i) => i.fragmentId)
    .filter((s): s is string => !!s);
  writeSectionUsage(sectionUsageFile, recordSectionUsage(sectionUsageHistory, selectedSlugs));
  console.log(`  section-usage.json: recorded ${selectedSlugs.length} section(s) → ${sectionUsageFile}`);
}

// Stage-3 author dispatch — WS9b: website is constitution-by-selection (select → reconstruct
// → edit-in-place → shell-rooted assembly); collateral stays author-from-governance. The same
// callback shape drives both the initial author and the loop's re-author.
const authorFn = (
  findingsByItem?: Map<string, Finding[]>,
): Promise<{ html: string; warnings: string[] }> =>
  track === 'website'
    ? assembleWebsiteBySelection(authoringPlan, context, selectedAuthor, findingsByItem)
    : author(authoringPlan, context, findingsByItem);

const { html, warnings } = await authorFn();
if (warnings.length > 0) {
  for (const w of warnings) console.warn(`  [Stage 3] warning: ${w}`);
}

// C1 fail-loud gate — the authoring pass above ran every plan item sequentially, so
// every <id>.request.md is now written; refuse to score if any <id>.response.html was
// missing (subagent path only). Throws before any index.html / score.json is written.
if (useSubagent) assertResponsesComplete(subagentMissing);

// The deployable html is written first; runValidateAndReport writes score.json next.
// If validate throws, the process exits non-zero (uncaught) — so a *successful*
// (exit 0) run always leaves both files; there is no exit-0 html-without-score state.
// (Website: this initial write is the multi-file assembly; the loop's WS8 flatten
// post-process overwrites it with the self-contained deployable.)
// Deliverable Naming — resolved ONCE here (before the first write) from the brief's own brand
// name (falling back to the client id), auto-versioned so a regeneration never overwrites a
// prior deliverable. Threaded into runValidateAndReport below so the final flattened write
// targets this SAME file, never a re-derived (and possibly different) name.
const deliverableFilename = resolveDeliverableFilename(outDir, context.brief.brand, client);
const idxPath = join(outDir, deliverableFilename);
writeFileSync(idxPath, html, 'utf8');
console.log(`\nWritten: ${idxPath}  (${Buffer.byteLength(html, 'utf8').toLocaleString()} bytes)`);

// Stage 4 (CR-validate) → the driver ALSO composes run health (Metrics) and the headline
// report (Report) in one pass (src/generate/validate-loop-driver.ts). Those two harness
// checkpoints are therefore recorded together, immediately after it returns — coarser-
// grained than a true per-stage boundary would be, but honest: it does not claim a
// measurement precision the current (fused) implementation doesn't have. Decomposing
// Validate/Metrics/Report into independently-invoked stages is Deferred Work (P03 report).
stageSeq.record('validate');
let report: HarnessReportResult;
if (track === 'website') {
  // WS9b activation: fold the WS7 curation gate into validate + WS8 flatten as post-process.
  const catalog = loadFragmentCatalog();
  report = await runValidateAndReport(html, authoringPlan, context, {
    outDir,
    useSubagent,
    author: authorFn,
    reviewPackageBuilder,
    deliverableFilename,
    gateFold: (h, base) => foldCurationGate(base, runValidatePageGate(h, catalog), authoringPlan),
    postProcess: (h) => {
      // WS8 flatten → self-contained deployable, then inject the fully PROJECT-OWNED metadata head.
      // The rendering engine ALWAYS produces output for a valid Brief — there is no publication /
      // authorization / governance gate here; publication governance is an external concern.
      // P40 — track-aware brand routing: the shipped deliverable's final <style> embed resolves
      // through the SAME central resolveBrandContract(client, track) every other site uses, so a
      // client's own colors_and_type.css (when supplied) is what actually ships. For example-brand
      // (no override) this resolves to the identical designProcessesDir('website') path as before.
      const flat = flattenWebsite({ html: h, baseDir: resolveBrandContract(client, track) });
      const out = applySiteMetadata(flat.html, { client, brief: context.brief });
      return { html: out, warnings: [...flat.warnings] };
    },
  });
} else {
  // P03: the collateral call site now passes its own author closure explicitly — the
  // driver no longer supplies an implicit default (see validate-loop-driver.ts header).
  // Same closure the old inline default constructed; only now visible at the call site.
  report = await runValidateAndReport(html, authoringPlan, context, {
    outDir,
    useSubagent,
    author: (findingsByItem) => author(authoringPlan, context, findingsByItem),
    reviewPackageBuilder,
    deliverableFilename,
  });
}

// C1 — Rendering IR export: an official Offscript Core output artifact alongside index.html, built
// from the SAME authoringPlan/brief Stage 3 just authored from — never re-derived, never touched
// if authoring/validate fails above. Website only gets siteMetadata (matching the existing
// applySiteMetadata track-gating, generate.ts:664); collateral has no siteMetadata concept today.
const rirArtifact = buildRenderingIRArtifact(
  authoringPlan,
  context.brief,
  track === 'website' ? loadSiteMetadata(client) : undefined,
);
const rirPath = join(outDir, 'rendering-ir.json');
writeFileSync(rirPath, rirArtifact.serialized, 'utf8');
console.log(`  rendering-ir.json: ${rirPath}`);

stageSeq.record('metrics');
stageSeq.record('report');

stageSeq.record('exit');
const result = buildHarnessRunResult({
  context: harnessCtx,
  outcome: 'completed',
  headlineStatus: report.status,
});
process.exit(result.exitCode);
