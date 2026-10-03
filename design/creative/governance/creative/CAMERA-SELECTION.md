# Creative Camera Selection — native methodology (v1, ported 2026-08-12)

**What this is.** A brand-independent, implementation-independent statement of the five camera
distances a creative can be shot from, and the *rule* that governs which one to pick — "the
closest camera that still proves the claim." **What this is not**: a literal spatial/lens
rendering system, a Offscript website-selection mechanism, or a claim-by-claim verifier — see
"Methodology vs. rendering" and "Enforcement status" below for the boundary this document does
and does not cross.

## Source

External evidence: `HANDOFF-v2.md` (repo root of `offscript`, untracked, read as historical
evidence only — the Creative Generation Renderer Readiness assessment
(`.experiments/2026-08-12-creative-generation-renderer-readiness/REPORT.md`) §5 confirmed this
document describes an external, non-`offscript` engine and introduces no runtime dependency on it).
Exact source located and quoted directly, not guessed:

- **The five distances + the selection rule:** `HANDOFF-v2.md` §B-6 ("NEW section — Camera
  System"), the literal markdown block headed `## Camera System (choose a distance, don't default
  to one)`.
- **The section-aware starting bias:** `HANDOFF-v2.md` §B-9 ("NEW section — Section-aware
  composition"), headed `## Section-aware composition (placement biases camera + density)`.
- **The verification criterion:** `HANDOFF-v2.md` §B-14, Quality-Bar item 14, "Camera Accuracy."
- **Where camera selection sits in the source system's own generation sequence:** `HANDOFF-v2.md`,
  the "Creative Intelligence Layer" walkthrough, Step 5 ("Camera selection").
- **Distinct, related, NOT ported here:** Composition Intelligence (which also declares a `camera`
  value as one of seven Composition values — a different, still-DEFER concern; see "Relationship
  to Composition Intelligence" below), Material Library, Color Intelligence, and Benchmark
  Retrieval remain DEFER — see the renderer-readiness assessment §13 for the full matrix.

## The five camera values

`CreativeIntent.camera`'s closed enum (`creative-intent-exporter/src/intent/types.ts`) already
carries these five values verbatim — this document does not invent a parallel vocabulary; it
documents what each value means and when it is appropriate, quoted from the source:

| `camera` value | Meaning | Appropriate for |
|---|---|---|
| `establishing` | Broader product context, high environment visibility; the environment does real work. | Hero moments, the product-in-its-world shot. |
| `product` | One complete product surface — a single screen or view, enough to read the app as a whole. **The riskiest camera** — one step from the full-app-screenshot trap; every off-claim region must be greeked. | A claim that genuinely needs to read as one whole screen. |
| `workflow` | One complete workflow end to end. | Feature explanation, where the sequence itself is the point. |
| `component` | One isolated feature — a card, panel, settings group, table, modal. | A claim carried by a single interface piece. |
| `macro` | One interaction — a prompt, a button, a toggle, an insight, a single input, a notification. Maximum clarity, minimum surface. | The claim that lands from the smallest possible proof. |

## The selection rule

Quoted directly from `HANDOFF-v2.md` §B-6:

> **Rule:** pick the *closest* camera that still proves the claim. If the belief lands from one
> insight card, don't show the dashboard behind it. If it lands from one modal, don't show the
> page. Every step back from Macro must be earned by something the claim actually needs.

"Closest" reads along the list above from `macro` (nearest) toward `establishing` (farthest) —
each step away from `macro` must be justified by something the claim genuinely requires, not
taken by default.

## The "closest camera proves the claim" principle — and its limit

The rule above is a **belief-semantic judgment**: it requires reading the creative's specific
`belief` text and deciding whether a narrower camera would still communicate it. That judgment is
exactly what the source system's own Step 4 ("Visual proof selection") and its pre-render "Visual
Proof Validation gate" exist to make (`HANDOFF-v2.md` §B-14's own framing: "this bar runs on the
*render*... the gate is what stops a generic dashboard concept before it costs a render"). Visual
Proof Validation is an explicit, separate DEFER item in this repository (see the renderer-readiness
assessment §13 and this sprint's own STRICT STOP) — **this document and its runtime consumer do
not perform belief-semantic judgment.** That is not a gap in this port; it is the boundary of what
this sprint was scoped to do.

What this document **does** make available, deterministically and without semantic judgment, is
the one sub-component of the rule that is itself table-driven, not judgment-driven: the
section-aware starting bias below.

## The section-aware starting bias (the deterministic sub-rule)

Quoted from `HANDOFF-v2.md` §B-9 and referenced directly by Step 5 of the Creative Intelligence
Layer walkthrough ("if Step 1 gave a placement, start from the Section-aware bias"). When a
creative's intended placement (`CreativeIntent.section`) is known, it sets the *starting* camera —
"not a template — a bias the composition can argue its way out of":

| `section` value | Placement label | Camera bias |
|---|---|---|
| `hero` | Hero | `establishing` |
| `feature` | Feature section | `workflow` |
| `benefit` | Benefit section | `component` |
| `cta` | CTA | `macro` |
| `social` | Social | `component`, `macro` |
| `collateral` | Collateral | `workflow`, `establishing` |

**Bias-width note (preserved exactly, not normalized):** four rows (`hero`, `feature`, `benefit`,
`cta`) bias to exactly one camera; two rows (`social`, `collateral`) bias to a documented pair of
two cameras. The source table is not uniform, and this document does not collapse either pair to a
single value — doing so would be inventing methodology, not preserving it.

## Decision precedence — what this methodology can and cannot arbitrate

Quality-Bar item 14 ("Camera Accuracy," `HANDOFF-v2.md` §B-14) states the full verification
criterion: the declared camera must be the closest one that proves the belief, **and** it must
match the section-aware bias for the declared placement, **"unless a stated reason overrides
it."** Two consequences for this port:

1. **The declared `camera` on a `CreativeIntent` is the outcome of a decision that has already
   been made upstream** (the source system logs it as `camera=` on the very line
   `creative-intent-exporter` reads) — this methodology does not re-decide it from nothing. What
   this port adds is the ability to check that declared value against the one deterministic
   signal available: the section bias.
2. **A mismatch between the declared camera and its section bias is not, by itself, a fail** — the
   source explicitly allows a "stated reason" override. Evaluating whether a stated reason is
   valid is, again, belief-semantic judgment (Visual Proof Validation), out of scope here. This
   document's runtime consumer therefore reports the match/mismatch as a transparent signal, never
   as a pass/fail verdict.

**No additional tie-breaking rule is invented beyond what is stated above.** The source names
exactly one deterministic input (the section bias) and one non-deterministic override (a stated
reason); this document does not fabricate a third rule to resolve cases the source leaves to
judgment.

## Provenance

- `HANDOFF-v2.md` §B-6 — the five camera values + the selection rule.
- `HANDOFF-v2.md` §B-9 — the section-aware starting bias table.
- `HANDOFF-v2.md` §B-14, Quality-Bar item 14 — the verification criterion, including the
  stated-reason override clause.
- `HANDOFF-v2.md`, Creative Intelligence Layer walkthrough, Step 5 — confirms the section bias is
  consulted as the *starting point* for camera selection, not the final answer.
- `creative-intent-exporter/src/intent/types.ts` — confirms `Camera` (5 values) and `Section` (6
  values, matching this document's placement rows exactly) are already the frozen `CreativeIntent`
  contract vocabulary; this document maps existing contract values, it does not invent new ones.

## Enforcement status

**Newly enforceable as of Sprint 10B** (2026-08-12): `offscript/creative-generation/src/producer.ts`
now consults this document (via `selectCamera()`) for every artifact it produces, exposing the
declared camera, the section-derived bias, and whether they match as a transparent, deterministic
decision trace (see "Relationship to Website Generation" below for where that trace does and does
not travel). Quality-Bar item 14 ("Camera Accuracy") is **partially enforceable** as of this port:
the section-bias half of the criterion is now mechanically checkable; the belief-semantic half
("is this genuinely the closest camera that proves the claim") remains a judgment check, blocked
on the still-DEFER Visual Proof Validation capability — same status this item had before this
sprint, honestly unchanged for that half.

## Limitations

- **No belief-semantic verification.** As stated above, this methodology cannot determine whether
  a declared camera actually proves a given belief — only whether it matches the mechanical
  section bias. Claiming otherwise would overstate this port.
- **No "recent log tail" anti-sameness check.** `HANDOFF-v2.md` §B-6/§B-7's "must differ from the
  recent `_LOG.md` tail" requirement depends on session state (what was recently produced) that
  this repository's per-artifact, stateless producer does not track. This is a real, named gap —
  not implemented, not simulated, not invented around.
- **No stated-reason override evaluation.** A documented mismatch between declared camera and
  section bias is surfaced as data, never resolved to a verdict, because evaluating an override
  reason is itself belief-semantic judgment.
- **Fallback for an unrecognized `camera` or `section` value is an engineering choice, not a
  sourced rule.** Real `CreativeIntent` records always carry a valid, non-empty `camera` (it is a
  required wire field); the source methodology never documents what to do with an invalid one. The
  runtime consumer's behavior for that case (documented in its own module comment) is a deliberate
  fail-safe, not a claim about source methodology.

## Methodology vs. rendering

This document states **which camera a creative should be shot from and why** — it does not state
**how** to actually compose or render that camera distance (lens simulation, crop geometry,
environment integration). That remains Composition Intelligence's job (still DEFER). The current
producer (`offscript/creative-generation/src/producer.ts`) remains the same deterministic placeholder
renderer described in its own module header — this port makes camera *selection* traceable, not
camera *rendering* real.

## Relationship to Composition Intelligence

`HANDOFF-v2.md` §B-4 documents a **second, unrelated use of the word "camera"**: one of seven
Composition Intelligence values declared per-creative (hierarchy · density · rhythm · breathing
room · **camera** · dominant surface · supporting surfaces) — a compositional-variety concern
(vary the camera from the recent log, alongside archetype/material/focal/density), not a
claim-proof concern. That is Composition Intelligence's field, remains fully DEFER, and is
**not** what this document or `selectCamera()` implement. This document's `camera` is exclusively
`CreativeIntent.camera` — the Camera *System* (§B-6/§B-9/item 14), a single closed-enum contract
field already present today.

## Relationship to Website Generation

**This document governs a single creative's internal shot-distance decision — never a website
section, never a Offscript layout choice, never a section→camera mapping for Website Generation's own
selection logic.** Nothing in this table names a Offscript archetype, a website section id, or a
client project. Website Generation's own selection machinery
(`offscript/src/generate/creative-artifact-consumption.ts` and related code) is unmodified and
unreferenced by this document or by `camera-selection.ts`. The boundary the renderer-readiness
assessment established (§14) — Creative Generation reasons about one creative; Website Generation
reasons about a multi-section website — is preserved exactly: this document's output (a camera
choice + a match signal) stays internal to `creative-generation`'s own rendered `visual.html`,
never reaching `PlanItem` or Website Generation's selection logic.
