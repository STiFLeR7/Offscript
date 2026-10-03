# Creative Environment Library — native methodology (v1, ported 2026-08-12)

**What this is.** A brand-independent, implementation-independent statement of the seven
environment photographs a creative may be set against, and the *rule* that governs how one is
used — "select which photo, choose its framing, never degrade it." **What this is not**: a
selection heuristic that decides *which* environment a given creative should use, a Material
Library recipe, or a claim that knowing an environment's identity by itself answers Visual Proof's
Q6 — see "Relationship to Visual Proof Q6" and "Non-goals" below for the boundary this document
does and does not cross.

## Source

External evidence: `HANDOFF-v2.md` (repo root of `offscript`, untracked, read as historical
evidence only — the Creative Generation Renderer Readiness assessment
(`.experiments/2026-08-12-creative-generation-renderer-readiness/REPORT.md`) §5 confirmed this
document describes an external, non-`offscript` engine and introduces no runtime dependency on it).
Exact source located and quoted directly, not guessed:

- **The governing rule ("ENVIRONMENT LAW"):** `HANDOFF-v2.md` §A-3, a `Brand/_MAP.css`-side patch
  block headed `═══ ENVIRONMENT LAW (BRAND LAW — IMMUTABLE) ═══`.
- **The point-of-use restatement + the Material cross-reference:** `HANDOFF-v2.md` §B-11,
  `## The field` — the governing paragraph plus the "Glass comes from the Material Library, not
  from taste" bullet (that bullet is Material's own concern, quoted here only to show the two
  sections sit side by side without one defining the other).
- **The closed seven-value vocabulary itself:** `HANDOFF-v2.md` never gives the seven slugs their
  own semantic table — they appear only inside the Decision-Record / log-line field format (the
  `env=<cliffside-muted|dawn-haze|lake-mirror|massif-banded|massif-clear|ridges-distant|
  valley-deep>` enumeration, e.g. lines 852 and 1486-1487) and two worked examples (`env= dawn-haze`,
  `env= massif-banded`). This document's vocabulary table (below) preserves exactly those seven
  values and no others — it does not invent or borrow richer per-asset description from any other
  source.
- **Distinct, related, NOT ported here:** Material Library (still an unresolved design-team
  decision, see the Material Library Readiness Report), Color Intelligence, Composition
  Intelligence, and Camera System's own selection heuristic all remain out of scope — see
  "Relationship to Material" and "Non-goals" below.

## The seven-value vocabulary

| `EnvironmentSlug` | Asset filename |
|---|---|
| `cliffside-muted` | `env-cliffside-muted.jpg` |
| `dawn-haze` | `env-dawn-haze.jpg` |
| `lake-mirror` | `env-lake-mirror.jpg` |
| `massif-banded` | `env-massif-banded.jpg` |
| `massif-clear` | `env-massif-clear.jpg` |
| `ridges-distant` | `env-ridges-distant.jpg` |
| `valley-deep` | `env-valley-deep.jpg` |

The filename is the slug prefixed `env-` and suffixed `.jpg` — a deterministic naming rule, not a
free-form mapping; every one of the seven authoritative assets follows it exactly (verified by
direct file inspection, see "Asset resolution" below). This is a **closed** vocabulary: exactly
seven values, none invented, none borrowed from any other source's naming.

**Semantic description, honestly reported as absent from this source:** `HANDOFF-v2.md` itself
never states what each environment looks like or when to reach for it — it only names the seven
slugs as an enumerable field value. A separate, already-existing, richer per-asset table (mood,
best-fit ratio, focus point, purpose) exists in `design/website/brand-pack/ASSETS.md`, governed by
that track's own `governance/website/rulebooks/creatives.md` — but **whether Creative Generation's
own methodology should reference or duplicate that table is an explicitly open, unresolved
architecture question, not decided by this document.** This document intentionally carries only
the closed vocabulary and the governing rule; it does not import or restate `ASSETS.md`'s content.

## The finite-library rule — "select, never invent"

Quoted directly from `HANDOFF-v2.md` §A-3 ("ENVIRONMENT LAW — BRAND LAW, IMMUTABLE"):

> The generator MAY choose: which environment photo is used · how it is framed — the focus point
> and zoom — WITHIN a still-full-bleed field · how much of it is visible, in that same sense · how
> it supports the narrative.
>
> The generator MAY NOT independently: blur the environment · apply haze or fog · desaturate the
> environment · recolor or re-grade the background · reduce detail · introduce per-creative
> atmosphere treatments.

And restated at point of use (§B-11, `## The field`): *"Focus is achieved through composition,
never through degradation: no blur, no desaturation, no reduced detail, no haze/fog, no recolour
or re-grade, no per-creative atmosphere treatment."*

**The rule this document ports:** an environment is **selected from the seven values above**, its
framing (focus point/zoom) may be chosen, and its rendered pixels are never altered beyond that.
Nothing here licenses generating a new environment image, substituting a stock photograph, or
modifying an approved one's content. Selecting *which* environment a specific creative should use
is a separate, explicitly out-of-scope concern — see "Current selection status" below.

## Asset resolution

The seven assets are **not vendored into `creative-generation`**. They live at their existing,
already-authoritative location, `design/website/brand-pack/assets/imagery/environments/`, verified
this sprint (and the prior Environment Library Readiness Report) to contain all seven files, real,
valid, non-empty JPEGs, exact filename match. This document's runtime consumer
(`offscript/creative-generation/src/environment-library.ts`) resolves a governed
`EnvironmentSlug` to that same real file, computed relative to the repository root — never a copy,
never a second asset repository, never a machine-specific absolute path. `design/website/brand-pack`
remains the sole authoritative source; this document and its runtime consumer only *reference* it.

## Relationship to Material

Environment and Material are **sibling systems**, never one defined in terms of the other —
confirmed by direct source inspection, not assumption:

- `HANDOFF-v2.md` §B-10 (Material) and this document's own §A-3/§B-11 source sections are
  **separate**, each with its own governing law.
- The source's own "Brand Laws vs Composition Rules" spine lists *"environment rendering"* and
  *"the material system"* as two **parallel**, independently-stated immutable Brand Laws — never
  nested.
- The Decision Record carries `material=` and `env=` as **two distinct fields**, never a compound
  one.
- Neither this document nor `environment-library.ts` resolves, references, or depends on any
  Material Library recipe, radius, shadow, glass, or surface concept. **This is verified by
  isolation tests, not merely asserted** — see the Environment Library Implementation Report §10.

The still-unresolved Material Library design-team decision (documented in the Material Library
Readiness Report) is **not reopened, referenced as a blocker for this document's own scope, or
resolved here.** Environment's own readiness is independent of it.

## Relationship to Visual Proof Q6

Q6, quoted exactly (native `VISUAL-PROOF-VALIDATION.md`): *"Would this still be a product creative
on a flat grey background? If removing the environment photo would leave 'a card with an icon and
some text,' add real interface structure — never decoration (rings/halos/dots) and never more
data."*

**This document does not claim that knowing an environment's identity answers Q6.** Two prior
assessments (`ENVIRONMENT-LIBRARY-READINESS-REPORT.md`, `ENVIRONMENT-VISUAL-PROOF-CONTEXT-
READINESS-REPORT.md`) traced this precisely: Q6's own wording asks what *remains* once the
environment is imagined removed — a fact about components and material/surface treatment, neither
of which this document or its vocabulary produces. Bare environment identity, once a future
selector exists, would close only the "is an environment present, and which one" leg of Q6's
information requirement; it would never, by itself, let the gate honestly reach a verdict while
Material's own recipe content remains unresolved. **Any future integration must preserve Visual
Proof's existing honesty mechanism** (`insufficient_context`) — a real environment field is meant
to be *declinable*, never a forced "yes."

## Current selection status

**Selection is NOT implemented by this document or its runtime consumer.** No rule exists here, in
`HANDOFF-v2.md`, or anywhere else read by this program, that deterministically derives *which* of
the seven environments fits a given belief, feature, camera, or section — the source's own
"how it supports the narrative" language is a taste/fit judgment, not a formula (per the Environment
Library Readiness Report §6). A future belief-semantic selector is a distinct, larger, and
explicitly deferred capability — see "Non-goals."

## Non-goals

- **No semantic/belief-driven environment selection.** `selectEnvironment(intent)` — or any
  feature→environment, camera→environment, belief→environment, or section→environment function —
  does not exist in this package and is not implied by this document.
- **No LLM or human-review selection mechanism** of any kind.
- **No Composition Intelligence integration.** This document's vocabulary is not one of Composition
  Intelligence's seven declared values, and nothing here changes that.
- **No Visual Proof request contract change.** `VisualProofValidationRequest` carries no
  `environment` field as of this port — see the Environment → Visual Proof Context Readiness
  Report for the documented, not-yet-implemented, future shape.
- **No Revision Executor or Rethink Loop environment support.** Neither module recognizes or
  validates an environment value as of this port.
- **No Material Library work of any kind**, and no attempt to resolve Material's own unresolved
  design-team decision.
- **No rich environment metadata** (mood, framing guidance, per-asset semantic purpose) is carried
  by this document — see "The seven-value vocabulary" above for why that remains a separate, open
  question.

## Enforcement status

**Newly available as of this port**: `offscript/creative-generation/src/environment-library.ts`
recognizes the seven governed slugs and resolves each to its real, authoritative asset path. **Not
yet consulted by any producer, executor, or orchestrator** — `producer.ts`, `visual-proof-
validation.ts`, `visual-proof-judgment-executor.ts`, `visual-proof-revision-executor.ts`, and
`visual-proof-rethink-loop.ts` are all unmodified by this port and do not import this module.

## Provenance

- `HANDOFF-v2.md` §A-3 — the Environment Law (the governing select/frame/never-degrade rule).
- `HANDOFF-v2.md` §B-11 — the point-of-use restatement, `## The field`.
- `HANDOFF-v2.md`, the Decision-Record / log-line field format (the closed seven-value enumeration)
  and two worked examples (`env= dawn-haze`, `env= massif-banded`).
- `design/website/brand-pack/assets/imagery/environments/` — the seven real, authoritative assets
  this document's vocabulary maps to; verified present, valid, and exact-name-matched.
- `ENVIRONMENT-LIBRARY-READINESS-REPORT.md` and `ENVIRONMENT-VISUAL-PROOF-CONTEXT-READINESS-
  REPORT.md` (`.experiments/2026-08-12-creative-generation-renderer-readiness/`) — the two prior
  assessments this port implements the ready subset of.

## Relationship to Website Generation

**This document governs a single creative's internal environment choice — never a website
section, never a Offscript layout choice, never a section→asset mapping for Website Generation's own
selection logic.** The seven assets it references happen to live under `design/website/brand-pack/`
(the website track's own authoritative asset location, unmodified and unduplicated by this port),
but this document and its runtime consumer read that location only as a **file resolution target**,
never as an import of Website Generation code, a dependency on `offscript/src/`, or a reference to
`creative-artifact-consumption.ts`/`PlanItem`. The boundary the renderer-readiness assessment
established (§14) — Creative Generation reasons about one creative; Website Generation reasons
about a multi-section website — is preserved exactly: this document's output (an asset path) stays
internal to `creative-generation`, never reaching `PlanItem` or Website Generation's selection
logic.
