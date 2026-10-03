# Visual Proof Validation — native methodology (v1, ported 2026-08-12; extended to six questions
2026-08-12, same day, per HANDOFF-v3-composition-laws.md)

**What this is.** A brand-independent, implementation-independent statement of the **six**-question,
pre-render gate a creative's proposed composition must clear before any rendering happens — the
mechanism that stops a generic, attractive-but-unfocused dashboard concept before it costs a
render. Originally four questions (`HANDOFF-v2.md`); extended to six by
`HANDOFF-v3-composition-laws.md`'s Step 4 exit gate update — see "The six questions" and
"Provenance" below for exactly which questions come from which source. **What this is not**: a
scoring rubric, a post-render check, a pixel/image inspector, or a claim that this repository has a
working judgment engine — see "Non-goals" below.

## Purpose

Quoted directly from `HANDOFF-v2.md` lines 821-824: *"Four questions, answered against the
**Decision Record**, not pixels. Stage 4 *generated* the visible/hidden/crop decisions; this gate
*validates* them. It is what separates a tightly art-directed creative from an
attractive-but-generic dashboard hero — and it is cheap here, because nothing has been rendered
yet."* The gate exists to close a real, named gap: `HANDOFF-v2.md` line 106's own "12 tasks" table
diagnosed it as "no mandatory reasoning step before rendering," resolved by "`SKILL.md` Step 4
stage 4 + the 4-question exit gate." (The purpose quote itself says "four questions" — it is quoted
verbatim from `HANDOFF-v2.md`, unmodified; the gate's actual question count grew to six the
following day, per `HANDOFF-v3-composition-laws.md` — see "The six questions" below. The purpose
and the cheapness argument apply identically to all six.)

## Pre-render stage definition

Visual Proof Validation runs **exclusively pre-render**, against the source system's own
**Decision Record** — a structured intermediate artifact, originally 21 fields (`HANDOFF-v2.md`
lines 804-809), now **23 fields** after `HANDOFF-v3-composition-laws.md` inserted two new fields
(`surfaces=<n≤3>` and `roles=`, quoted in full in "Decision Record — v3 additions" below) —
**never against rendered pixels or HTML**. The source is explicit and repeated on this point:
"answered against the Decision Record, not pixels." This document and its runtime consumer preserve
that boundary exactly — see "Pre-render boundary" in "Non-goals" below. HANDOFF-v3 reaffirms this
boundary directly for its own two new questions: *"Both run on the **sketch**, before anything is
rendered"* (`HANDOFF-v3-composition-laws.md`, PART II §C2) — the same pre-render guarantee Q1-4
already carried, extended to Q5-6 without weakening.

## The six questions

Quoted verbatim, in full, preserving source numbering and wording exactly — nothing added, nothing
removed, nothing paraphrased:

**Q1-Q4 — original, `HANDOFF-v2.md` lines 828-830 (unchanged):**

1. Can someone understand the feature **without reading any body copy**?
2. Is there **exactly one** primary capability being communicated?
3. Is **every** visible UI component directly supporting that capability?
4. If **40% of the interface were cropped away**, would the message still be equally clear?

**Q5-Q6 — v3 additions, `HANDOFF-v3-composition-laws.md` PART II §C2 (added 2026-08-12, one day
after the original four):**

5. **Is every element nameable as hero / support / signal / subordinate context?** An element with
   no role is decoration — cut it.
6. **Would this still be a product creative on a flat grey background?** If removing the
   environment photo would leave "a card with an icon and some text," add real interface structure
   — **never decoration (rings/halos/dots) and never more data.**

**Why Q5/Q6 exist (quoted rationale, `HANDOFF-v3-composition-laws.md` PART I):** the surface-budget
law (2026-08-11, "normally 1, hard max 3 surfaces") pushed creatives toward fewer surfaces; the
following day, that push was found to overshoot into **beginner-minimal** creatives — "a card
holding a title and two lines, an isolated icon doing the hero's job, real interface logic replaced
by rings and dots." Q5 operationalizes, at the pre-render sketch stage, the source's own "1 HERO ·
2 SUPPORT · 3 SIGNAL — assign every element a role before composing" discipline: an element that
cannot be named hero/support/signal/subordinate-context is decoration, and decoration is exactly
what the surface-budget law was never meant to encourage. Q6 operationalizes, at the same pre-render
sketch stage, the source's own "the background is not the creative" discipline — a sketch-time
imagined version of the (separately, post-render) flat-background test described in
`HANDOFF-v3-composition-laws.md` PART II §B, which became Quality Bar item 11's own extension (see
"Relationship to Quality Bar" below). Q5 and Q6 are the source's direct, quoted **counterweight**
against the same failure the surface-budget law could invite if read alone — not a new, independent
concern, but the flip side of Q1-4's original "don't over-show" discipline: Q1-4 police *too much*
being shown; Q5-6 police *too little structural substance* being shown.

**Relationship to Q1-4:** all six questions share the same pre-render boundary, the same subject
(the Decision Record, never pixels), and — per the structural reading below — the same binary gate.
Q1-4 test message clarity, focus, and economy (does the creative say one thing, cleanly, without
excess). Q5-6 test structural legitimacy (does every visible element earn its place with a real
interface role; would the composition survive if its atmosphere/photo were stripped away). Neither
pair supersedes the other — HANDOFF-v3 states outright that reading the surface-budget law alone,
without its counterweight, "will get worse creatives than a reader who takes neither" (line 4-5) —
so all six questions must be read and answered together, not as two independent gates.

## Binary gate

`HANDOFF-v2.md` line 831: *"**Any "no" → rethink the composition before rendering**"*. There is no
partial credit, no numeric threshold, and no weighting between the questions — each is a strict
yes/no. **This rule is not restated verbatim by `HANDOFF-v3-composition-laws.md` for Q5/Q6** —
Q5 and Q6 are appended directly under the same "Step 4 exit gate — Visual Proof Validation" heading
as Q1-4, with no separate or alternate gate mechanism given anywhere in the source. Reading Q5/Q6 as
governed by the same binary any-"no"-fails rule as Q1-4 is therefore an **extension by structure**
(same gate, same heading, same pre-render stage, no distinguishing rule stated) — not an invented
rule, and flagged here explicitly as such, consistent with this repository's evidence-only
discipline. This remains structurally different from the 15-item Quality Bar's scored rubric (see
"Relationship to Quality Bar" below).

**A directly relevant nuance HANDOFF-v3 does state explicitly** (PART II §C, "Not changed" note):
*"Step 4a.3's measured-gate snippet is byte-identical to what PART IV shipped. No threshold moved.
This era added qualitative checks only."* This is direct, quoted confirmation that the
*numeric/measured* gates elsewhere in the source's own pipeline (`info`/`struct`/`space`/`minfs`
thresholds — a distinct, later, post-render mechanism from this document's own subject) are
untouched by v3; only this qualitative, pre-render gate gained two more qualitative questions. No
numeric scoring system is introduced anywhere in v3, and none is invented here.

## Failure semantics

Quoted from source: on a "no," the remedy for Q1-4 is to *"rethink the composition before rendering
(usually: move the camera closer, cut a component that belongs to a different capability, or raise
the focal's scale)."* Q5 and Q6 each carry their own remedy, stated directly in their own wording
(see "The six questions" above): a Q5 "no" means **cut the unnamed element** ("An element with no
role is decoration — cut it"); a Q6 "no" means **add real interface structure** ("never decoration
(rings/halos/dots) and never more data"). All three remedy statements share the same character:
failure is a signal to **revise the not-yet-rendered composition candidate** with a targeted, small
change — never a signal to render anyway and fix it in post, and never a signal to select a wholly
different approach from scratch.

## Evidence convention

Quoted from source (Q1-4): *"State the four answers in one short line alongside the sketch, then
proceed to Step 4a."* HANDOFF-v3 does not restate this convention with an updated count, but by the
same structural-extension reasoning as the binary gate above, the natural reading is **six answers,
stated in one short line** — the convention's *purpose* (a compact, human-readable, all-answers-
together evidence record, never a silent unrecorded pass/fail) is unaffected by the question count.
Any future implementation must preserve this: all six individual answers must remain visible, never
collapsed into a single opaque boolean (see the Request/Answer Contract reports, Sprint 10F/10G, for
how this repository represents four of the six today — the runtime contract has **not** yet been
extended to carry q5/q6, see "Current enforcement status" below).

## Relationship to Quality Bar

Quoted directly from `HANDOFF-v2.md` lines 665-669, stated by the source itself, not inferred by
this document: *"Before this bar runs, the sketch must clear the Visual Proof Validation gate...
That gate runs on the **sketch**, this bar runs on the **render** — the gate is what stops a
generic dashboard concept before it costs a render; this bar is what stops a weak execution of a
good one."* Visual Proof Validation and the (already-ported) Quality Bar (`QUALITY-BAR.md`, this
directory) are **sequential, distinct gates** at different stages, sharing no scoring mechanism:
this gate is now six unweighted binary questions on the pre-render Decision Record; the Quality Bar
is a 15-item score across 11 categories on the rendered output. `QUALITY-BAR.md` itself already
documents this gate as "not part of this document" (its own "Not part of this document" section,
Sprint 4) — this document is that separately-classified item, ported and extended on its own terms.

**v3 extended both sides of this split in parallel, on the same day, reinforcing the split rather
than blurring it:** `HANDOFF-v3-composition-laws.md` PART II §A2 records Quality Bar item 11
gaining "the flat-background test" (the same underlying idea as this document's own new Q6, but as
a *post-render*, actual-swap-and-re-render, mechanical-then-manual-verdict procedure — see
`HANDOFF-v3-composition-laws.md` PART II §B) and item 17 gaining its inverse (the "beginner-minimal"
post-render check, the same underlying idea as this document's own new Q5). The pre-render/
post-render split this section quotes from `HANDOFF-v2.md` therefore held exactly, on both sides,
through this extension — direct, reinforcing evidence, not a coincidence: Q5/Q6 are the *sketch-time
imagined* versions of checks that also gained *render-time actual* counterparts in the Quality Bar,
the same day, by the same source.

## Relationship to Camera Selection

**Q4 is the source-confirmed intended mechanism for Camera Selection's still-deferred "closest
camera that proves the claim" judgment.** Q4's exact framing — "if 40% of the interface were
cropped away, would the message still be equally clear?" — is the operational test for
over-showing, textually mirrored by Quality Bar item 14 ("Economical framing... the closest
[camera] that still proves the belief") and by `CAMERA-SELECTION.md`'s own "Limitations" section,
which already names Visual Proof Validation as the capability its belief-semantic half depends on.
The documented relationship is **candidate-then-validate**, not select-from-evidence: a camera
candidate is chosen first (by whatever process selects one — today, `selectCamera()`'s section-
aware bias, or a future upstream authoring step), and Q4 validates whether that candidate is
economical enough; a "no" triggers revision ("move the camera closer"), not a fresh selection from
validation evidence. **This document does not implement that relationship** — Camera Selection
(`camera-selection.ts`) is unmodified by this port; the relationship is recorded here only as an
architectural fact for a future sprint. **`HANDOFF-v3-composition-laws.md` introduces no new
Camera-related law** — `camera=` is untouched in its Decision Record template; this section is
unaffected by the v3 extension.

## Relationship to Composition

Q2 ("exactly one primary capability") and Q3 ("every visible component supports it") **partially
inform** — but do not by themselves decide — Composition Intelligence's still-deferred `hierarchy`
value (`single-focal` vs. `focal+counterpoint` vs. `sequence`): a creative that clears Q2/Q3 is
compatible with a `single-focal` treatment, but the four original questions never name `hierarchy`
or its vocabulary directly, and no original question addresses `density`, `breathing room`,
`rhythm`, `dominant surface`, or `supporting surfaces` at all. **This document does not select or
validate any Composition Intelligence value** — `composition-camera-bias.ts` and the rest of
Composition Intelligence are unaffected and unmodified by this port.

**v3's Q5 partially informs — and does not by itself decide — the same `hierarchy` question, via a
different and closer route than Q2/Q3:** Q5's per-element role-nameability test (hero/support/
signal/subordinate context) is the pre-render sketch-time counterpart of the new Decision Record
`roles=` field (see "Decision Record — v3 additions" below); a composition where every element
resolves to a single unambiguous `hero` plus supporting roles is compatible with `single-focal`, but
Q5 never names `hierarchy` directly and does not decide among its three values. **v3's new Decision
Record field `surfaces=<n≤3>` is related to, but not stated by any source as equivalent to,**
Composition Intelligence's existing `supporting surfaces` value (`none`/`one-subordinate`/
`two-subordinate`, `HANDOFF-v2.md` §B-4) — no sentence in either `HANDOFF-v2.md` or
`HANDOFF-v3-composition-laws.md` equates a raw surface count to that three-value vocabulary, and
this document does **not** assume they are the same concept. This is recorded here as an **explicit
open question**, not resolved: see the Sprint 10H assessment (`.experiments/2026-08-12-creative-
generation-renderer-readiness/HANDOFF-V3-COMPOSITION-LAWS-ASSESSMENT.md` §20) for the full framing.
The `surfaces=<n≤3>` cap is, at most, an upper-bound *constraint* on whatever `supporting surfaces`
value is eventually chosen — never a rule that derives which of the three values is correct.

## Decision Record — v3 additions

`HANDOFF-v3-composition-laws.md` PART II §C1 adds two fields to the Decision Record's template,
inserted immediately after `feature=`, quoted exactly (diffed against the unchanged 21-field
template Sprint 10E already quoted in full):

```
belief= · capability= · feature= · surfaces=<n≤3> · components=[…]          ← surfaces= is NEW (2026-08-11)
roles= hero:<the dominant product object/state> · support:<what reinforces it> · signal:<the live detail>   ← roles= is NEW (2026-08-12)
proof= · visible=[…] · hidden=[…] · crop=                                    ← unchanged
camera= · archetype= · hierarchy= · density= · rhythm= · breathing= · dominant= · supporting=   ← unchanged, byte-identical to HANDOFF-v2.md
material= · env= (+framing) · accent= (because …) · status=[…] · data-viz= · furniture=[…]   ← unchanged
```

**`surfaces=<n≤3>`** — a plainly-stated count of every distinct card / panel / modal /
document-fragment / workflow-node in the composition, capped at a hard maximum of 3, "normally 1"
(`HANDOFF-v3-composition-laws.md` PART I §1, PART II §A1). It is a **constraint on the space of
valid compositions**, not a formula that derives the correct count from any other field — choosing
which value within `{1, 2, 3}` is correct for a given belief remains the same generation-time
judgment every other Decision Record field already requires.

**`roles=`** — a closed, per-element role vocabulary: `hero` (the dominant product object/state),
`support` (what reinforces it), `signal` (the live detail), plus an implicit fourth category named
only in Q5's own wording, `subordinate context` (`HANDOFF-v3-composition-laws.md` PART II §A1's
"1 HERO · 2 SUPPORT · 3 SIGNAL" bullet; PART II §C2's Q5). Every element in the composition must be
nameable under one of these four roles or it is decoration and should be cut (Q5). Like `surfaces=`,
this field's *vocabulary* is now documented; *populating* it for a specific composition — deciding
which element is the hero, which are support, which are signal — remains belief-semantic judgment.

**Are these fields required or optional?** The source presents both as mandatory parts of the
Decision Record template — the same status as every other field in it (`HANDOFF-v2.md`'s own
"Step 5 authors from this record and nothing else... if Step 5 ever needs a decision the record
doesn't contain, that is a bug in this layer," quoted in full in Sprint 10E's own readiness report
§3, applies unchanged to these two new fields).

**Are their semantics pre-render?** Yes — both are Decision Record fields, and the Decision Record
is, by definition and by this document's own "Pre-render stage definition" section above, a
pre-render artifact. Q5 (which reads `roles=`) and Q6 both explicitly "run on the sketch, before
anything is rendered."

**Are they part of the Decision Record, or only validation context?** They are Decision Record
fields — generation-time outputs of the composition-authoring step, the same category as
`hierarchy=`, `density=`, `camera=`, and every other field already in the template (Sprint 10E §7's
"generation-time outputs, not intake-time inputs" classification applies identically). They are
**not** `CreativeIntent` fields, and this document does not propose making them so. **No runtime
Decision Record object exists anywhere in this repository** — this section documents the
*methodology's* field additions only; see "Non-goals" below for the explicit statement that no
schema, persistence, or producer wiring was created by this port.

## Current enforcement status

**Native as of Sprint 10F** (2026-08-12): the four-question version of this document and its
runtime contract (`offscript/creative-generation/src/visual-proof-validation.ts`) were first ported.
**Extended as of this sprint** (Sprint 10I, same day): this document now describes **six**
questions and the two new Decision Record fields, per `HANDOFF-v3-composition-laws.md`.

**A deliberate, explicit gap, stated plainly so it is never mistaken for an oversight: the runtime
contract (`visual-proof-validation.ts`) has NOT been updated by this sprint.**
`VisualProofValidationAnswer` still models exactly `q1`/`q2`/`q3`/`q4`/`passed`/`evidence` — it
carries no `q5`/`q6` field, and `VisualProofValidationRequest` carries no `surfaces`/`roles`-shaped
context. This is intentional: this sprint is methodology-first, mirroring the exact discipline every
prior methodology port in this program has followed (document, then mirror, then — in a later,
separately-scoped sprint — the typed contract). The next sprint must evolve the TypeScript answer
shape and request contract to carry all six questions' worth of data before any real judgment
executor (still not designed in code, per Sprint 10G) could honestly answer Q5/Q6. Until then: **no
semantic judgment is automated by this port** — none of the six questions can be answered by
anything in this repository except genuine belief-semantic reasoning, human or LLM, and no such
mechanism exists yet in `creative-generation`. What exists today is: (1) this methodology document,
now covering all six questions and both new Decision Record fields, (2) a typed request/answer
contract covering **only** q1-q4 (Sprint 10F, unchanged this sprint), (3) a deterministic
**scripted stub** that proves that four-question contract's plumbing using caller-supplied answers,
never its own invented judgment, and (4) a pure mapping from a (possibly absent) four-question
answer to `CreativeArtifact.validation`'s existing shape. `producer.ts` is **not** wired to call any
of this — see "Non-goals" below.

## Provenance

- `HANDOFF-v2.md` lines 801-819 — the original 21-field Decision Record this gate validates
  against.
- `HANDOFF-v2.md` lines 820-833 — the original four questions, the gate rule, failure semantics, and
  the evidence convention, quoted in full above.
- `HANDOFF-v2.md` line 106 — the "12 tasks" gap table entry naming the problem this gate resolves.
- `HANDOFF-v2.md` lines 665-669 — the source's own statement distinguishing this gate from the
  Quality Bar.
- `HANDOFF-v3-composition-laws.md` PART I — the surface-budget law (2026-08-11) and the minimal≠
  empty counterweight (2026-08-12), the rationale behind Q5/Q6.
- `HANDOFF-v3-composition-laws.md` PART II §A1 — the four new `_STYLE.md` discipline bullets,
  including the "1 HERO · 2 SUPPORT · 3 SIGNAL" role-naming discipline Q5 operationalizes and the
  "background is not the creative" discipline Q6 operationalizes.
- `HANDOFF-v3-composition-laws.md` PART II §A2 — the Quality Bar item 11/17 extensions, the
  post-render counterparts of this document's own Q5/Q6.
- `HANDOFF-v3-composition-laws.md` PART II §B — the flat-background test's full verdict rule and
  execution method (post-render; not ported into this document's own runtime, see "Non-goals").
- `HANDOFF-v3-composition-laws.md` PART II §C1 — the Decision Record's two new fields, quoted in
  full in "Decision Record — v3 additions" above.
- `HANDOFF-v3-composition-laws.md` PART II §C2 — Q5 and Q6, quoted in full above, and the "grew from
  four questions to six" / "Both run on the sketch" statements.
- `HANDOFF-v3-composition-laws.md` PART III — the `struct`-cannot-tell-decoration-from-logic
  finding, direct evidence against ever substituting a numeric proxy for this gate's own judgment.
- `.experiments/2026-08-12-creative-generation-renderer-readiness/VISUAL-PROOF-VALIDATION-READINESS-REPORT.md`
  — Sprint 10E's assessment that traced the original methodology, established its distinctness from
  Quality Bar, and identified the exact minimal input contract this port's request contract uses.
- `.experiments/2026-08-12-creative-generation-renderer-readiness/VISUAL-PROOF-VALIDATION-IMPLEMENTATION-REPORT.md`
  — Sprint 10F's report, documenting the original four-question contract and scripted stub.
- `.experiments/2026-08-12-creative-generation-renderer-readiness/JUDGMENT-EXECUTION-SEAM-DESIGN-REPORT.md`
  — Sprint 10G's judgment-execution seam design, whose planned contract evolution (N+1) this sprint's
  methodology update is a documented prerequisite for.
- `.experiments/2026-08-12-creative-generation-renderer-readiness/HANDOFF-V3-COMPOSITION-LAWS-ASSESSMENT.md`
  — Sprint 10H's assessment, which first traced HANDOFF-v3's Q5/Q6 growth and recommended exactly
  this methodology-only port as the prerequisite step before any contract change.
- `.experiments/2026-08-12-creative-generation-renderer-readiness/HANDOFF-V3-VISUAL-PROOF-METHODOLOGY-PORT-REPORT.md`
  — this sprint's own report, documenting exactly this update.
- `CAMERA-SELECTION.md` (this directory) — the deferred belief-semantic judgment this gate's Q4 is
  the confirmed future mechanism for.

## Non-goals — explicit, so nothing here is mistaken for more than it is

- **This document does not perform judgment.** All six questions are native methodology text; no
  automated answer to any of them exists anywhere in this repository.
- **This document does not change the runtime TypeScript contract.** `VisualProofValidationRequest`,
  `VisualProofValidationAnswer`, and `VisualProofValidationExecutor` (`visual-proof-validation.ts`)
  are unmodified by this port and still model exactly four questions (q1-q4) — extending them to six
  is deliberately deferred to a future, separately-scoped sprint, so that methodology and code do not
  silently diverge without an explicit, visible, documented reason (this section).
- **The current scripted stub is not a real judgment engine**, and still only covers q1-q4. It
  requires the caller to supply four answers explicitly and performs no reasoning over `belief`,
  `feature`, or `mustInclude` content — it exists only to prove the (still four-question) request/
  answer contract and the pass/fail derivation work end to end, for tests and future plumbing
  experiments.
- **Producer integration is deferred.** `offscript/creative-generation/src/producer.ts` is unmodified
  and makes no call into this methodology's runtime contract.
- **Full Decision Record persistence is deferred**, now for 23 fields rather than 21 — most of its
  fields (including the two new v3 fields) depend on subsystems (full Composition Intelligence,
  Material Library, Color Intelligence) that remain DEFER. Only the narrow subset the four *original*
  questions actually need (`belief`, `feature`, `mustInclude` — already present on `CreativeIntent`)
  is represented in the runtime contract today, as the request contract, not as a persisted record.
  **No Decision Record object, schema, or persistence mechanism was created by this port** — this
  document only describes the methodology's own field additions.
- **The flat-background test's execution procedure was not ported into this repository's runtime.**
  `HANDOFF-v3-composition-laws.md` PART II §B's Python swap snippets reference the external source
  system's own CSS variable/class conventions — porting them verbatim would misrepresent this
  repository's own (still placeholder) renderer, which does not share those conventions. The
  *verdict rule* (Q6, above) is ported; the *execution mechanism* is deliberately not.
- **Approval gating is not decided.** Whether a failed Visual Proof Validation should block
  `approveArtifact()` or merely inform a human reviewer is an open product/architecture decision,
  explicitly left open by the renderer-readiness program and untouched by this port.
- **The judgment-execution mechanism (LLM subagent, human review, hybrid, or another approach) is
  not decided here.** That is separate, future architecture work (Sprint 10G's design, not yet
  implemented).
