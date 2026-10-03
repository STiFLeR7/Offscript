/**
 * Stage 3 — Generate: authoring seam.
 *
 * Parallel to src/actuator.ts / src/actuators/scripted.ts / src/actuators/subagent.ts
 * but for the CREATE step (no input HTML — produces a fragment FROM a plan item).
 *
 * Structure mirrors the actuator seam exactly:
 *   - AuthoringRequest  ≡  ActuationRequest  (curated, minimal — not the whole DesignContext)
 *   - Author.author()   ≡  Actuator.harden()  (one async seam method)
 *   - scriptedAuthor    ≡  scriptedActuator   (deterministic double for CI / smoke tests)
 *   - createSubagentAuthor ≡ createSubagentActuator (real LLM-dispatch path)
 *   - defaultScriptedAuthor → factory for the CI scripted double
 *
 * GUARDRAIL — scripted author is a double, NOT evidence:
 *   The scripted path produces hand-written token-var()-only fragments that score
 *   systematic-ratio ≈ 1.0 by construction. This is a pipeline smoke-test; it is
 *   NOT proof the engine generates on-brand work. The non-circular ratio proof
 *   (Phase 4) must come from the in-session LLM-authored artifact, which can make
 *   off-brand choices the rails actually catch.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PlanItem, SectionReasoning } from './types.js';
import type { ComponentKnowledgeContext } from './semantic-author-context.js';
import type { Finding } from '../operator.js';
import { richExemplarPointer } from './author-contract.js';
import { deriveContentSignal } from './content-signal.js';
import { REASONING_FIELDS, hasReasoning, validateReasoning } from './section-reasoning.js';
import { brandOwnedRegionsFor } from './brand-owned-regions.js';

// ── Curated request ───────────────────────────────────────────────────────────
// Mirror ActuationRequest's minimalism — do NOT pass the whole DesignContext.

/** What the author is asked to produce for one plan item. */
export interface AuthoringRequest {
  /** The plan item: archetype, intent, tokenRoles, anchor. */
  item: PlanItem;
  /**
   * The section's own SECTION_INTELLIGENCE.md §3.N excerpt, resolved from its
   * archetype (generate/playbook-anchors.ts). Empty for collateral archetypes
   * (no website playbook entry). The scripted author ignores it; the LLM seam
   * renders it as a `## Section intelligence` block.
   */
  guidance: string;
  /** brief.oneLiner — the one-sentence product/deliverable description. */
  oneLiner: string;
  /** brief.tone — the communication tone for the deliverable. */
  tone: string;
  /**
   * The brief body's per-section copy matched to THIS section (PlanItem.content,
   * resolved by attachBriefContent in plan.ts). The section's actual substance:
   * the headlines, steps, numbers, and named facts the brief specified. The LLM
   * seam renders it as a `## Section content` block framed as authoritative — the
   * author TYPESETS this substance (rephrasing for voice) instead of inventing it.
   * Absent on floor-padding sections, content-less briefs, and any section the
   * brief body did not cover; the scripted author ignores it.
   */
  briefContent?: string;
  /**
   * Rail findings the PREVIOUS authoring pass left on THIS item's section
   * (mapped by anchor id — see mapFindingsToItems in reauthor-loop.ts). Mirrors
   * ActuationRequest.priorViolations: the violation-aware re-authoring channel.
   * Absent / empty on the first pass and on every pass for a clean item — so the
   * scripted author (which ignores findings) stays a deterministic 1-pass no-op.
   * The LLM author reads these and FIXES them — "better, not different" (it must
   * not trade a finding for new slop or drop a section; the loop's governance
   * guards enforce that). Only section-attributed findings land here; document
   * -global brand findings (brand-fidelity-scan, accent-saturation-budget, …) are
   * a document-level concern, not item-targeted.
   */
  priorFindings?: Finding[];
  /**
   * The once-per-run shared house author contract (buildAuthorContract). Same
   * string on every item in a run. createSubagentAuthor writes it ONCE to
   * <dispatchDir>/_AUTHOR_CONTRACT.md and each request.md points at that file
   * (rather than embedding the whole contract per section) — heavy governance
   * paid once, the per-section request stays curated. Present for collateral AND
   * website (each track's contract); absent on the scripted path and for deck
   * (the scripted author ignores it).
   */
  houseContract?: string;
  /**
   * The curated archetype-matched exemplar fragment (selectExemplar) — "match
   * this rhythm and density; do NOT clone." Short, so embedded inline in the
   * request.md. Track-aware (collateral + website resolve their own fragment
   * set); absent on the scripted path and when no fragment is curated yet.
   */
  exemplar?: string;
  /**
   * The per-page ASSIGNED lead composition (assignComposition) — the distinct
   * layout this page must use, rotated by index so the deck does not read as one
   * template repeated (anti-monotony). The author builds around THIS, not the
   * exemplar's structure. Absent on the scripted path and for website (its
   * archetypes are heterogeneous, so no rotation is assigned).
   */
  composition?: string;
  /**
   * Option 1 — the single content-routed exemplar path to STUDY for THIS section
   * (author-contract.ts `routedStudyPointer`), e.g. `diagrams/process.html` for a
   * process page. Surfaces a PRECISE on-disk exemplar (routing, not transport — the
   * fragment is never inlined) so a rich-content page is pointed at the matching gold
   * standard, not a directory. Collateral only; absent for generic shapes / website /
   * the scripted path. The author opens it on disk and rebuilds in the brand.
   */
  studyPointer?: string;
  /**
   * Path C (website): the REAL catalog `data-crf` fragment chosen for this section
   * (PlanItem.fragmentId → loadFragmentHtml). This is the band the author EDITS IN
   * PLACE — keep its structure, classes, and `data-crf` scoping (never strip its
   * `<style>`); replace ONLY the placeholder copy with the brief substance. When
   * present it inverts the dispatch from "author from scratch (exemplar = rhythm,
   * do not clone)" to "start from THIS fragment". Absent on collateral (authors from
   * scratch) and until P3 wires the website paste path; the scripted double pastes it
   * verbatim, the in-session author edits its copy.
   */
  baseFragment?: string;
  /**
   * Sprint 5 — a ready-to-embed `data:` URI extracted from `item.creativeArtifact`'s own
   * self-contained HTML (see `creative-artifact-consumption.ts::extractArtifactVisual`),
   * resolved by `author.ts` BEFORE dispatch so the author never touches a filesystem path.
   * Absent whenever `item.creativeArtifact` is absent (the common case; Creative Artifact
   * consumption is off by default) or when the referenced artifact carried no extractable
   * visual. The scripted author embeds it verbatim as an `<img>` carrying
   * `data-creative-artifact-id`/`data-creative-artifact-digest` (mechanically greppable
   * proof of consumption); the LLM seam is free to compose it into the section instead of
   * pasting it bare, but the two attributes above are the contract a doctor rail or test
   * can rely on regardless of which author produced the markup.
   */
  creativeArtifactImage?: string;
}

/** The authoring seam: given one AuthoringRequest, return an HTML fragment. */
export interface Author {
  author(req: AuthoringRequest): Promise<string>;
}

/**
 * Dispatch seam for the subagent author: given a fully curated AuthoringRequest,
 * return the HTML fragment. In CI this is a deterministic double. In the live
 * in-session run it is fulfilled by a Claude subagent authoring the section per
 * the request file.
 */
export type AuthorDispatch = (req: AuthoringRequest) => Promise<string>;

// ── Exhaustion policy ─────────────────────────────────────────────────────────
type Exhausted = 'last' | 'passthrough';

// ── scriptedAuthor ─────────────────────────────────────────────────────────────
/**
 * A deterministic {@link Author} double for tests and the pipeline smoke path.
 * Structural mirror of scriptedActuator:
 *   - a single string   → always returned;
 *   - an array          → returned in call order; `onExhausted` decides after exhaustion
 *                         ('last' replays the final entry, 'passthrough' returns '');
 *   - a function        → full control, given the request and the 0-based call index.
 */
export function scriptedAuthor(
  script: string | string[] | ((req: AuthoringRequest, call: number) => string),
  onExhausted: Exhausted = 'last',
): Author {
  let call = 0;
  return {
    async author(req: AuthoringRequest): Promise<string> {
      const index = call++;
      if (typeof script === 'function') return script(req, index);
      if (typeof script === 'string') return script;
      if (index < script.length) return script[index];
      return onExhausted === 'last' ? script[script.length - 1] : '';
    },
  };
}

// ── createSubagentAuthor ──────────────────────────────────────────────────────
/**
 * A real-author {@link Author}. Writes a human-readable dispatch request to
 * `<dispatchDir>/<item-id>.request.md`, then delegates to the injected `dispatch`
 * and returns its HTML fragment. The seam is unchanged from Author — this fills
 * the real implementation behind it; scriptedAuthor remains the CI double.
 */
export function createSubagentAuthor(opts: {
  dispatchDir: string;
  dispatch: AuthorDispatch;
  /** write the `<item-id>.request.md` brief (default true). */
  writeRequestFile?: boolean;
  /**
   * W21 — semantic author CONSUMPTION (opt-in; default false). When true, AND the plan item carries
   * componentKnowledge (W20 transport), the request gains a `## How to use Component Knowledge`
   * DIRECTIVE telling the in-session author to REALIZE that knowledge (Purpose/Character/Contract/
   * Judgement) into copy — as guidance, never reproduced. Default false ⇒ the request is byte-identical
   * to W20 (transport only). The scripted author never renders a request, so this never affects it.
   */
  consumeComponentKnowledge?: boolean;
}): Author {
  const writeRequestFile = opts.writeRequestFile ?? true;
  const consumeComponentKnowledge = opts.consumeComponentKnowledge ?? false;
  /** Shared house contract is written ONCE per run, not per section. */
  const contractFile = '_AUTHOR_CONTRACT.md';
  let contractWritten = false;
  return {
    async author(req: AuthoringRequest): Promise<string> {
      if (writeRequestFile) {
        fs.mkdirSync(opts.dispatchDir, { recursive: true });
        // Write the once-per-run shared contract the first time we see one.
        if (req.houseContract && !contractWritten) {
          fs.writeFileSync(path.join(opts.dispatchDir, contractFile), req.houseContract, 'utf8');
          contractWritten = true;
        }
        // Path C (website): drop the chosen catalog fragment as <id>.base.html so the
        // subagent edits a REAL file in place (rather than authoring blank). The
        // request points the author at it; the author edits it → <id>.response.html.
        if (req.baseFragment) {
          fs.writeFileSync(
            path.join(opts.dispatchDir, `${req.item.anchor.id}.base.html`),
            req.baseFragment,
            'utf8',
          );
        }
        // Sprint 6: drop the selected Creative Artifact's data: URI as a sibling file
        // (never inlined into the markdown request — can be tens of KB of base64). The
        // author is told to embed these EXACT bytes, never a re-fetched/regenerated asset.
        if (req.creativeArtifactImage && req.item.creativeArtifact) {
          fs.writeFileSync(
            path.join(opts.dispatchDir, `${req.item.anchor.id}.creative-artifact.txt`),
            req.creativeArtifactImage,
            'utf8',
          );
        }
        const reqPath = path.join(opts.dispatchDir, `${req.item.anchor.id}.request.md`);
        const contractRef = req.houseContract ? contractFile : undefined;
        fs.writeFileSync(
          reqPath,
          renderAuthorRequest(req, contractRef, consumeComponentKnowledge),
          'utf8',
        );
      }
      return opts.dispatch(req);
    },
  };
}

// Violation-aware re-authoring block — only rendered when the previous pass left
// findings on THIS item's section. Phrased as "fix, don't redesign": the loop's
// governance guards reject any "fix" that trades a rail finding for new slop or drops a
// section, so the brief must steer the author that way.
function buildFindingsBlock(priorFindings: Finding[]): string[] {
  if (priorFindings.length === 0) return [];
  return [
    `## Rail findings to FIX (previous pass left these on this section)`,
    ``,
    ...priorFindings.map((f) => `- **${f.id}** (${f.outcome}): ${f.description}`),
    ``,
    `Fix these rail findings **without introducing slop, off-token colours, or`,
    `structural drift** — *better, not different*. Keep every existing landmark,`,
    `section, and heading; resolve only what the findings above call out. Do not`,
    `add generic stock-semantic colours or off-token hex, and do not drop or`,
    `re-rank content to "clean" a finding.`,
    ``,
  ];
}

// House-contract pointer — read once per run; keeps this per-section request curated.
function buildContractBlock(contractRef?: string): string[] {
  if (!contractRef) return [];
  return [
    `## House contract — READ FIRST`,
    ``,
    `Read **\`${contractRef}\`** (this file's sibling in the dispatch dir) before authoring.`,
    `It carries the brand voice, composition discipline, the density target (complete,`,
    `never sparse), the component cheat-sheet, the data-viz idioms, the layout + fit`,
    `budget, and the hard rails. This section brief layers the specifics on top.`,
    ``,
  ];
}

// Assigned composition — the distinct layout THIS page must use (anti-monotony).
function buildCompositionBlock(composition?: string): string[] {
  if (!composition) return [];
  return [
    `## Assigned composition — BUILD THE PAGE AROUND THIS LAYOUT`,
    ``,
    `${composition}`,
    ``,
    `This is your lead layout for this page. Do NOT default to a numbered list unless that`,
    `is what is assigned above. The reference exemplar below shows house QUALITY and rhythm,`,
    `NOT the layout to copy.`,
    ``,
  ];
}

// Option 1 — content-routed study pointer: the single best-matched governed exemplar
// for THIS section's content shape (relational → a diagram; spatial → a system illustration).
// Pure routing — names an on-disk file to STUDY, never inlines it. Surfaces precise
// intelligence to any rich-content page, not just the flagship.
function buildStudyPointerBlock(studyPointer?: string): string[] {
  if (!studyPointer) return [];
  // W54 — Data Visualization parity: a chart pointer (routedStudyPointer's
  // `data-visualization/...` branch) is realized per README-DATA-VIZ.md as a doc-scoped
  // `.viz-*` chart or metric visualization — NOT necessarily inline SVG in a `.cr-graphic`
  // (the diagram/spatial framing below). Detected from the pointer's own path prefix, so
  // no new field/parameter is needed and the diagram/spatial wording is untouched.
  const isChart = studyPointer.startsWith('data-visualization/');
  const substance = isChart ? 'data-heavy' : 'relational/spatial';
  const realizeLine = isChart
    ? 'Realize it per README-DATA-VIZ.md — a doc-scoped `.viz-*` chart or metric visualization (never invented data).'
    : 'Realize the visual as inline SVG in a `.cr-graphic`.';
  return [
    `## Study this governed exemplar — routed to THIS page's content (open on disk; do NOT clone)`,
    ``,
    `This page's substance is ${substance}, so the house corpus has a matching gold`,
    `standard. Open it, study its **composition, hierarchy, layering, and focal strategy**,`,
    `then author your OWN on-palette version with this brief's content (discard its colours/`,
    `fonts/content — rebuild in the brand). ${realizeLine}`,
    ``,
    `\`resources/design_processes/collateral/exemplars/${studyPointer}\``,
    ``,
  ];
}

// WS5 — flagship visual page: the one collateral page allowed the relaxed (~150mm)
// visual budget, pointed at the specific gold exemplar to STUDY (never clone).
function buildFlagshipBlock(item: PlanItem): string[] {
  if (!item.flagshipVisual) return [];
  // W53 — prefer the transported PresentationIntent's source signal (see plan.ts / author.ts);
  // falls back to a fresh derivation when transport is off/absent, so behaviour is unchanged.
  const signal = item.presentationIntent?.source ?? deriveContentSignal(item);
  const pointer = richExemplarPointer(item.composition ?? '', signal, 'collateral');
  const lines = [
    `## Flagship: yes — this is THE flagship visual page`,
    ``,
    `Make the rich diagram/illustration the DOMINANT element. The ≤40mm inline-diagram cap`,
    `is relaxed for THIS page only: the \`.cr-graphic\` may run up to ~150mm tall as the page`,
    `hero, with a short headline + one framing line and NO supporting band. It still must fit`,
    `the ~265mm usable box — a4-bounds still FAILS on overflow, so size the visual to fit.`,
  ];
  if (pointer) {
    lines.push(
      ``,
      `**Study this gold exemplar** (do NOT clone — author your OWN on-brand, on-palette version):`,
      `\`resources/design_processes/collateral/exemplars/${pointer}\``,
    );
  }
  lines.push(``);
  return lines;
}

// Section content — the brief's per-section substance (the WHAT). Framed as
// authoritative so the author TYPESETS it (rephrasing for voice) rather than
// inventing content. The §3.N guidance above is the generic HOW; this is the
// specific WHAT for this section, so it sits last before How-to-respond — the
// freshest, most specific instruction.
function buildContentBlock(briefContent?: string): string[] {
  if (!briefContent || briefContent.trim() === '') return [];
  return [
    `## Section content — author THIS substance (do not invent competing facts)`,
    ``,
    `The brief specifies the following copy and facts for this section. Render THIS`,
    `substance: keep every listed point, every number, every named stage/command, in`,
    `this order. Rephrase the wording into the brand voice/tone — but do NOT add`,
    `competing facts, drop points, soften specifics into generic filler, or invent`,
    `testimonials, metrics, logos, or names the brief did not provide. Where the brief`,
    `marks something a placeholder/illustrative, keep it visibly marked — never ship it`,
    `as a real claim.`,
    ``,
    briefContent.trim(),
    ``,
  ];
}

// Path C base fragment — "edit THIS pasted band in place." Inverts the author from
// scratch-authoring to copy-editing a real catalog fragment. Embedded inline so the
// subagent can edit it directly (it is also dropped as <id>.base.html). When present,
// it REPLACES the "reference exemplar — do not clone" framing (which is contradictory
// here: this fragment IS the thing to start from).
function buildBaseFragmentBlock(baseFragment?: string): string[] {
  if (!baseFragment) return [];
  return [
    `## Base fragment — EDIT THIS IN PLACE (start here; do NOT author from scratch)`,
    ``,
    `This is the real catalog \`data-crf\` band curated for this section (also written beside`,
    `this brief as \`${'`'}<id>.base.html${'`'}\`). **Start from it and edit it in place:**`,
    `- **Keep its structure, its house \`.cr-*\`/utility classes, and its \`data-crf\` wrapper +`,
    `  scoped \`<style>\` block EXACTLY** — that scoping is what lets bands coexist without`,
    `  colliding. NEVER strip the wrapper or its \`<style>\`, and do not rename its \`data-crf\`.`,
    `- **Replace ONLY the copy** — headlines, body, labels, numbers, link text — with THIS`,
    `  brief's substance (see Section content below). Swap placeholder/donor words for the`,
    `  brief's real facts; keep every structural element, class, and the band's surface.`,
    `- Adjust counts only to fit the brief's content (e.g. 3 feature items → the brief's 2),`,
    `  reusing the fragment's own item markup — never inventing a new component or off-token colour.`,
    ``,
    '```html',
    baseFragment,
    '```',
    ``,
  ];
}

// P43 — Brand-owned regions: the sole BrandOwnedRegions (P42) consumer. Only meaningful
// alongside a base fragment (Path C edit-in-place) — resolves the SAME fragmentId already
// used to select/load that fragment against the P42 registry, verbatim (no registry change).
// Absent fragmentId or no declared regions ⇒ nothing rendered (byte-identical to before P43).
// Removes a real ambiguity in buildBaseFragmentBlock above: "keep every structural element"
// vs. "replace ONLY the copy" leaves a logo <img> or a footer copyright line genuinely
// ambiguous — this block resolves that ambiguity for exactly the elements P41/P42 evidenced.
function buildBrandOwnedRegionsBlock(fragmentId: string | undefined): string[] {
  if (!fragmentId) return [];
  const regions = brandOwnedRegionsFor(fragmentId);
  if (!regions || regions.length === 0) return [];
  const lines = [
    `## Brand-owned elements in this fragment — Example Brand's identity, not structure`,
    ``,
    `The base fragment above is Example Brand's OWN vendored markup. The elements below are its`,
    `house identity (a logo mark, legal copy, or a mention of its own name) — NOT reusable`,
    `structure to keep as-is. Replace or genericize each one for THIS product (see "product"`,
    `in Context above) — never ship Example Brand's own name, wordmark, or copyright line in`,
    `this section:`,
    ``,
  ];
  for (const r of regions) {
    const locator = r.selector ? `\`${r.selector}\`` : `the text "${r.textAnchor}"`;
    lines.push(`- **${r.kind}** at ${locator} — ${r.description}`);
  }
  lines.push(``);
  return lines;
}

// Sprint 6 — Creative Artifact: a selection already made upstream (item.creativeArtifact) is
// available for THIS section. Points the author at the sibling file holding the exact data:
// URI (never inlined here — can be tens of KB) and requires the two data-creative-artifact-*
// attributes survive verbatim, so consumption stays mechanically greppable regardless of which
// author produced the markup (mirrors minimalFragment's own scripted-path embedding, Sprint 5).
function buildCreativeArtifactBlock(
  item: PlanItem,
  creativeArtifactImage: string | undefined,
): string[] {
  if (!creativeArtifactImage || !item.creativeArtifact) return [];
  const ref = item.creativeArtifact;
  const file = `${item.anchor.id}.creative-artifact.txt`;
  return [
    `## Creative Artifact — an approved visual is already selected for this section`,
    ``,
    `A Creative Artifact (id \`${ref.id}\`, digest \`${ref.artifactDigest}\`) was selected for this`,
    `section before authoring began. Its exact, ready-to-embed \`data:\` URI is in this file's`,
    `sibling **\`${file}\`** (not inlined here — it can be tens of KB of base64).`,
    ``,
    `- Embed it as an \`<img>\` or CSS \`background-image\`, composed naturally into this`,
    `  section's layout — do not paste it bare if the section calls for something more composed.`,
    `- Use the sibling file's content **verbatim** as the \`src\`/\`url()\` value — never`,
    `  truncate, re-encode, or regenerate it, and do not invent, fetch, or rehost a different`,
    `  image in its place.`,
    `- Carry both \`data-creative-artifact-id="${ref.id}"\` and`,
    `  \`data-creative-artifact-digest="${ref.artifactDigest}"\` on the element you embed it`,
    `  on — this is the mechanical proof a validation rail relies on.`,
    `- It must not be dropped: this artifact was already chosen as relevant to this section.`,
    ``,
  ];
}

// Curated exemplar — "match this rhythm/density; do NOT clone." Embedded inline (short).
function buildExemplarBlock(exemplar?: string): string[] {
  if (!exemplar) return [];
  return [
    `## Reference exemplar (for QUALITY and rhythm — do NOT clone this layout)`,
    ``,
    `- **Compose the house \`.cr-*\` classes the exemplar uses** (\`.cr-band-*\` surface, \`.cr-h-*\` /`,
    `  \`.cr-eyebrow\` / \`.cr-num-display\` type ramp, \`.cr-btn*\`, \`.cr-card\`, \`.cr-p*\`). Author bespoke`,
    `  CSS ONLY for section-unique layout (grid / positioning) — never to re-style a heading, button,`,
    `  card, or surface the house already defines.`,
    `- **The exemplar's WORDS are another product's** — never reuse its copy, headlines, numbers, or`,
    `  logos. Author THIS brief's content in THIS product's voice.`,
    ``,
    '```html',
    exemplar,
    '```',
    ``,
  ];
}

// W2 — Section Intent: transport the OPTIONAL reasoning channel (the WHY) into the request.
// Rendered ONLY when PlanItem.reasoning is present; absent ⇒ nothing emitted (byte-identical to
// pre-W2). This sprint never GENERATES reasoning — it exposes what a producer already attached.
// Fail-loud: a malformed channel throws before the request is written (never repaired, never
// inferred). Fields render verbatim, in the canonical REASONING_FIELDS order — never synthesized,
// rewritten, summarized, or collapsed. The Title-case labels are the request's presentation only.
const SECTION_INTENT_LABEL: Record<(typeof REASONING_FIELDS)[number], string> = {
  role: 'Role',
  selectionRationale: 'Selection rationale',
  orderingRationale: 'Ordering rationale',
  transition: 'Transition',
  relationships: 'Relationships',
  communicationObjective: 'Communication objective',
};
function buildSectionIntentBlock(reasoning: SectionReasoning | undefined): string[] {
  if (!hasReasoning(reasoning)) return [];
  const problems = validateReasoning(reasoning);
  if (problems.length > 0) {
    throw new Error(`authoring-seam: malformed section reasoning — ${problems.join('; ')}.`);
  }
  const lines: string[] = [`## Section Intent`, ``];
  for (const field of REASONING_FIELDS) {
    const value = reasoning[field];
    if (typeof value === 'string' && value.trim() !== '') {
      lines.push(`- **${SECTION_INTENT_LABEL[field]}:** ${value}`);
    }
  }
  lines.push(``);
  return lines;
}

// W20 — Component Knowledge: transport the OPTIONAL semantic author context (the component's
// authored Purpose / Character / Contract / Judgement) into the request, VERBATIM. Rendered ONLY
// when PlanItem.componentKnowledge is present; absent ⇒ nothing emitted (byte-identical to pre-W20).
// Pure transport — the Author MAY read it; the seam never summarizes, interprets, or rewrites it.
// Sections render in their authored order, markdown preserved exactly.
function buildComponentKnowledgeBlock(ck: ComponentKnowledgeContext | undefined): string[] {
  if (!ck || ck.sections.length === 0) return [];
  const lines: string[] = [`## Component Knowledge`, ``];
  for (const section of ck.sections) {
    lines.push(`### ${section.name}`, ``, section.markdown, ``);
  }
  return lines;
}

// W21 — Component Knowledge CONSUMPTION directive. The in-session subagent author is the FIRST
// consumer of the W20 transport block above. This directive is the consuming logic: it tells the
// author to REALIZE the component's authored Purpose / Character / Contract / Judgement into the
// section's copy — as guidance, never as content. It is a SIBLING of the transport block, never an
// edit to it: the `## Component Knowledge` bytes are unchanged. Rendered ONLY when consumption is
// enabled AND the item carries knowledge; otherwise nothing emitted (byte-identical to W20). The
// scripted author never renders a request, so consumption can never touch the deterministic path.
function buildComponentKnowledgeConsumeBlock(
  ck: ComponentKnowledgeContext | undefined,
  consume: boolean,
): string[] {
  if (!consume || !ck || ck.sections.length === 0) return [];
  return [
    `## How to use Component Knowledge (guidance — realize it, do NOT reproduce it)`,
    ``,
    `The **Component Knowledge** above is the design team's authored understanding of THIS`,
    `component. Treat it as guidance for your judgement — never as content, instructions, or a`,
    `checklist:`,
    ``,
    `- **Realize it; do not reproduce it.** Let **Purpose** shape what the headline and`,
    `  subheading promise; let **Character** set the copy tone and rhythm; let **Contract**`,
    `  decide what proof/evidence this section must carry; let **Judgement** steer the CTA and`,
    `  keep you clear of the misuse it names.`,
    `- **Never copy, quote, paraphrase, or echo the Component Knowledge wording** into the output.`,
    `  It is not body copy — the reader of the page must never see these sentences.`,
    `- It is **not mandatory.** Where the brief's substance and this guidance disagree, the`,
    `  brief's facts win. Author THIS brief's content, informed by this understanding of the`,
    `  component — not a restatement of it.`,
    ``,
  ];
}

/**
 * Render an authoring dispatch request as a readable markdown brief for the subagent.
 * `contractRef`, when given, is the relative filename of the once-per-run shared house
 * contract sibling (see createSubagentAuthor) the author must read first.
 *
 * Orchestration skeleton: the four conditional sections are built by the named
 * `build*Block` helpers above; the fixed Context / Token-roles / How-to-respond
 * sections stay inline here.
 */
function renderAuthorRequest(
  req: AuthoringRequest,
  contractRef?: string,
  consumeComponentKnowledge = false,
): string {
  const tokenList =
    req.item.tokenRoles.length > 0
      ? req.item.tokenRoles.map((t) => `  - \`var(${t})\``).join('\n')
      : '  _(none specified)_';

  return [
    `# Offscript author dispatch — section: ${req.item.anchor.id}`,
    ``,
    ...buildContractBlock(contractRef),
    ...buildFindingsBlock(req.priorFindings ?? []),
    `## Context`,
    ``,
    `- **archetype:** \`${String(req.item.archetype)}\``,
    `- **anchor:** \`#${req.item.anchor.anchor}\``,
    req.item.anchor.landmark ? `- **landmark:** \`${req.item.anchor.landmark}\`` : null,
    `- **intent:** ${req.item.intent}`,
    `- **product (one-liner):** ${req.oneLiner}`,
    `- **tone:** ${req.tone}`,
    ``,
    // W2: the reasoning channel (the WHY), surfaced only when populated; absent ⇒ byte-identical.
    ...buildSectionIntentBlock(req.item.reasoning),
    // W20: the component's authored semantic knowledge (Purpose/Character/Contract/Judgement),
    // surfaced verbatim only when populated; absent ⇒ byte-identical. Transport only.
    ...buildComponentKnowledgeBlock(req.item.componentKnowledge),
    // W21: the consumption directive — realize the knowledge above into copy. Sibling of the
    // transport block (never edits it); rendered only when consumption is enabled AND knowledge
    // is present; otherwise byte-identical to W20.
    ...buildComponentKnowledgeConsumeBlock(req.item.componentKnowledge, consumeComponentKnowledge),
    `## Token roles (all colours must be var() — no hardcoded hex)`,
    ``,
    tokenList,
    ``,
    req.guidance
      ? `## Section intelligence\n\n${req.guidance}\n`
      : `## Section intelligence\n\n_(no per-section excerpt — ground in the house contract above and brand tokens)_\n`,
    ``,
    ...buildContentBlock(req.briefContent),
    ...buildCompositionBlock(req.composition),
    ...buildStudyPointerBlock(req.studyPointer),
    ...buildFlagshipBlock(req.item),
    ...buildCreativeArtifactBlock(req.item, req.creativeArtifactImage),
    // Path C: when a base fragment is present, edit-in-place REPLACES the
    // "exemplar = rhythm, do not clone" framing (it would contradict "start here").
    ...(req.baseFragment
      ? [...buildBaseFragmentBlock(req.baseFragment), ...buildBrandOwnedRegionsBlock(req.item.fragmentId)]
      : buildExemplarBlock(req.exemplar)),
    `## How to respond`,
    ``,
    req.baseFragment
      ? `Return the base fragment above with its COPY edited to this brief's substance:`
      : `Author a self-contained HTML fragment for this section:`,
    req.baseFragment
      ? `- Keep the \`data-crf\` wrapper, every house class, and the scoped \`<style>\` block intact — edit copy only.`
      : `- Semantic landmark: use the anchor id \`${req.item.anchor.id}\` on the element.`,
    !req.baseFragment && req.item.anchor.landmark
      ? `- Landmark role: emit \`role="${req.item.anchor.landmark}"\` (or the native HTML element).`
      : null,
    `- Every colour value must be a \`var(--token)\` from the brand token set.`,
    `- Follow the house contract: on-brand voice, complete (never sparse) density, house`,
    `  components + brand furniture, data-viz idioms where the data supports them.`,
    `- No hardcoded hex, no framework, no external dependencies.`,
    `- Output only the HTML fragment (no \`<!doctype>\`, no \`<html>\`, no \`<head>\`).`,
    ``,
  ]
    .filter((l): l is string => l !== null)
    .join('\n');
}

// ── defaultScriptedAuthor ─────────────────────────────────────────────────────
/**
 * Factory for the default minimal scripted author used on the CI/scripted path.
 *
 * HARD CONSTRAINT (from architecture): the scripted author is MINIMAL-VALID, not a
 * template design engine. Its ONLY job is to emit just enough valid, token-driven,
 * semantically-anchored markup to prove the pipeline assembles + self-contains +
 * carries tokens deterministically. It is NOT a designer and NOT a template library.
 *
 * One `<section>` per plan item:
 *   - id and anchor from item.anchor
 *   - role from item.anchor.landmark (if set; footer → contentinfo)
 *   - heading from item.intent (HTML-escaped)
 *   - inline style from item.tokenRoles (all var(--token) — no hardcoded hex)
 *
 * CIRCULAR-PROOF WARNING: a hand-written var()-only fragment scores systematic-ratio
 * ≈ 1.0 BY CONSTRUCTION. This is a smoke-test, NOT the headline ratio proof. The
 * non-circular proof requires the in-session LLM-authored artifact (Phase 4).
 */
export function defaultScriptedAuthor(): Author {
  return scriptedAuthor((req: AuthoringRequest) => minimalFragment(req));
}

// ── pasteVerbatimAuthor (Path C website smoke double) ─────────────────────────
/**
 * The website Path-C scripted double: paste the chosen catalog fragment VERBATIM (no
 * copy edit). It proves shell-rooted assembly + the curation gate deterministically —
 * NOT production copy (the donor fragment's own placeholder words remain; the
 * in-session LLM author is what edits copy to the brief). For an item with no
 * `baseFragment` (collateral, or a website item before the paste path is wired) it
 * falls back to minimalFragment so the double is safe on every track.
 *
 * CIRCULAR-PROOF WARNING: pasting a hand-curated on-brand fragment scores well BY
 * CONSTRUCTION — this is a pipeline smoke-test, not evidence the engine authors
 * on-brand copy. The non-circular proof is the cold in-session edit (the request.md
 * "edit THIS in place" path), asserted via the editing-author harness in tests.
 */
export function pasteVerbatimAuthor(): Author {
  return scriptedAuthor((req: AuthoringRequest) =>
    req.baseFragment ? req.baseFragment + creativeArtifactMarkup(req) : minimalFragment(req),
  );
}

/**
 * The mechanically-greppable Creative Artifact marker (Sprint 5, extracted Sprint 6 so both
 * scripted doubles — minimalFragment and pasteVerbatimAuthor — embed the identical shape).
 * Empty string when no artifact is selected/resolved, so both callers stay byte-identical
 * to their pre-Sprint-5/6 output in the common case.
 */
function creativeArtifactMarkup(req: AuthoringRequest): string {
  if (!req.creativeArtifactImage || !req.item.creativeArtifact) return '';
  return (
    `\n  <img data-creative-artifact-id="${escapeHtml(req.item.creativeArtifact.id)}" ` +
    `data-creative-artifact-digest="${escapeHtml(req.item.creativeArtifact.artifactDigest)}" ` +
    `src="${escapeHtml(req.creativeArtifactImage)}" alt="">`
  );
}

/** Escape the minimal set that breaks an HTML text node or attribute. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Minimal-valid fragment for one plan item.
 * Single `<section>` with semantic anchor, optional role, heading, and a tiny
 * inline style block using only token var() refs. Nothing more.
 */
function minimalFragment(req: AuthoringRequest): string {
  const { item } = req;
  const id = item.anchor.id;
  const roleAttr = item.anchor.landmark ? ` role="${escapeHtml(item.anchor.landmark)}"` : '';
  const heading = escapeHtml(item.intent);
  const archLabel = escapeHtml(String(item.archetype));

  // P2 A1: stamp the chosen component/surface (website only — collateral never sets these,
  // so its output stays byte-identical). The website-composition-limits rail reads these.
  const variantAttr = item.componentVariant
    ? ` data-cr-component="${escapeHtml(item.componentVariant)}"`
    : '';
  const surfaceAttr = item.surfaceRole
    ? ` data-cr-surface="${escapeHtml(item.surfaceRole)}"`
    : '';

  // Build inline style from tokenRoles — only var() refs, no hardcoded hex.
  // Each token role is referenced exactly once. For well-known patterns, we
  // bind to the natural CSS property; for others, we forward via a CSS variable
  // passthrough so every role is provably referenced in the markup.
  const styleRules: string[] = [];
  const bound = new Set<string>();
  for (const role of item.tokenRoles) {
    if (/bg|background/.test(role) && !bound.has('background')) {
      styleRules.push(`background: var(${role})`);
      bound.add('background');
    } else if (/fg|foreground|text/.test(role) && !bound.has('color')) {
      styleRules.push(`color: var(${role})`);
      bound.add('color');
    } else if (/font|type/.test(role) && !bound.has('font-family')) {
      styleRules.push(`font-family: var(${role})`);
      bound.add('font-family');
    } else {
      // Unrecognized role: forward as a CSS variable passthrough so the
      // token reference is provably in the markup.
      styleRules.push(`--${role.replace(/^-+/, '')}: var(${role})`);
    }
  }
  // Always include a fallback if no roles were bound.
  if (styleRules.length === 0) {
    styleRules.push('/* no token roles bound */');
  }
  const inlineStyle = styleRules.join('; ');

  const artifactMarkup = creativeArtifactMarkup(req);

  return (
    `<section id="${id}"${roleAttr}${variantAttr}${surfaceAttr} data-archetype="${archLabel}" style="${inlineStyle}">\n` +
    `  <h2>${heading}</h2>${artifactMarkup}\n` +
    `</section>`
  );
}
