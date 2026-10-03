# Creative Camera → Density/Breathing Starting Bias — native methodology (v1, ported 2026-08-12)

**What this is.** The one deterministic, table-driven sub-component of Creative Generation's
wider Composition Intelligence system (`HANDOFF-v2.md` §B-4) — the numeric-adjacent relationship
between an already-selected `camera` value and the **starting point** for two of Composition
Intelligence's seven declared values: **creative-generation density** and **creative-generation
breathing room**. The qualifiers ("creative-generation density," "creative-generation breathing
room," "creative-generation composition") are used deliberately throughout this document instead
of the bare words, to avoid any ambiguity with Offscript's own, entirely unrelated page-level systems
that happen to share vocabulary — see "Distinction from Offscript's own composition/spatial concepts"
below. **What this is not**: the final density or breathing-room decision, a hierarchy or rhythm
mechanism, a Material Library consumer, or any part of full Composition Intelligence beyond this
one narrow slice — see "Scope" below for the precise boundary.

## Scope

This document ports **exactly one** relationship out of Composition Intelligence's much larger
seven-value system (hierarchy · density · rhythm · breathing room · camera · dominant surface ·
supporting surfaces): the documented fact that an already-selected camera value sets a **starting
point** for creative-generation density and creative-generation breathing room, which "intent may
adjust one step" from. This document does **not** state how that one-step adjustment is decided
(belief-semantic judgment, out of scope — see "Deferred" below), and does not touch hierarchy,
rhythm, dominant surface, or supporting-surface count at all.

## Source

External evidence: `HANDOFF-v2.md` (repo root of `offscript`, untracked, read as historical
evidence only — the Creative Generation Renderer Readiness assessment
(`.experiments/2026-08-12-creative-generation-renderer-readiness/REPORT.md`) §5 confirmed this
document describes an external, non-`offscript` engine and introduces no runtime dependency on it).
Exact source located and quoted directly, not guessed:

- **The bias relationship itself:** `HANDOFF-v2.md`, the sentence immediately following §B-4's
  Composition Intelligence numeric-translation table: *"**Camera sets the starting
  density/breathing**, then intent may adjust one step."*
- **First identified as a distinct, independently-portable candidate by:** the Composition
  Intelligence Readiness assessment
  (`.experiments/2026-08-12-creative-generation-renderer-readiness/COMPOSITION-INTELLIGENCE-READINESS-REPORT.md`
  §9, §11, §12) — that report's own §12 "Ready Subset" is this document's direct mandate.
- **The camera vocabulary itself:** already ported by Sprint 10B, `CAMERA-SELECTION.md` (this
  directory) and `creative-intent-exporter/src/intent/types.ts:12` — this document does not
  re-derive or restate camera selection; it consumes an already-resolved camera value as its sole
  input.
- **Distinct, related, NOT ported here:** the rest of Composition Intelligence (hierarchy, rhythm,
  dominant surface, supporting surfaces, and the *final* density/breathing decision) remains
  DEFER — see the Composition readiness report §11 for the full per-field classification.

## The exact five-row bias table

Preserved exactly as documented — no normalization, no invented sixth row, no converted numeric
values:

| `camera` value | Density starting bias | Breathing starting bias |
|---|---|---|
| `macro` | `minimal` | `generous` |
| `component` | `minimal–moderate` | `generous` |
| `workflow` | `moderate` | `standard` |
| `product` | `moderate–populated` | `standard` |
| `establishing` | `moderate` | `generous` |

**Range preservation note:** `component`'s and `product`'s density bias are compound source values
(`minimal–moderate`, `moderate–populated`) — two adjacent bands joined by an en dash in the source
itself. This document does not split, average, round, or otherwise normalize these into a single
band; the compound string is the documented value, preserved verbatim.

## This is a starting point, not a final decision

Quoted directly: camera "sets the **starting** density/breathing, then intent may adjust **one
step**." Two consequences, both binding on this document's runtime consumer:

1. **The bias this document exposes is never asserted as the final creative-generation density or
   creative-generation breathing-room value.** A real creative's actual declared density/breathing
   may legitimately differ from this starting bias by one documented step — that adjustment
   decision requires judging what the creative's specific belief needs, which is belief-semantic
   judgment (Visual Proof Validation), explicitly out of scope for this document and its runtime
   consumer.
2. **No mechanism in this document evaluates whether a one-step adjustment is justified.** That is
   intentional, not an oversight — inventing such a rule without source grounding would violate
   this program's standing "never invent a heuristic" discipline (the same discipline
   `CAMERA-SELECTION.md` applied to the stated-reason override clause it also declines to
   arbitrate).

## Provenance

- `HANDOFF-v2.md`, the sentence following §B-4's numeric-translation table — the bias relationship
  and its exact five-row values.
- `.experiments/2026-08-12-creative-generation-renderer-readiness/COMPOSITION-INTELLIGENCE-READINESS-REPORT.md`
  §9 (Composition ↔ Camera relationship — established the "Camera ↓ Composition" direction this
  document implements one slice of), §11 (PORT/ADAPT/DEFER matrix — classified this exact
  relationship as the one PORT-NOW candidate), §12 (Ready Subset — this document's direct mandate),
  §17 (Recommended Next Sprint — named this port precisely).
- `CAMERA-SELECTION.md` (this directory) — the upstream camera value this document's sole input
  depends on.

## Enforcement status

**Newly enforceable as of Sprint 10D** (2026-08-12): `offscript/creative-generation/src/producer.ts`
now consults this document (via `getCompositionCameraBias()`) for every artifact it produces,
exposing the resulting density/breathing starting bias as a transparent, deterministic trace in the
rendered HTML — never as a claim about the creative's actual final density or breathing-room
values, which remain undeclared by this producer.

## Deferred

Explicitly, by name, remaining out of scope for this document and its runtime consumer:

- **Final creative-generation density selection** and **final creative-generation breathing-room
  selection** — the belief-semantic "does the intent adjust one step" judgment.
- **Hierarchy**, **rhythm**, **dominant surface**, and **supporting-surface count** — the other
  four of Composition Intelligence's seven declared values; none are addressed by this document at
  all.
- **Full Composition Intelligence** as a system — this document is one narrow, evidence-backed
  slice of it, not a step toward silently completing the rest by accretion.
- **Material Library** — not consulted, referenced, or required anywhere in this document or its
  runtime consumer. The one composition field that does depend on Material Library (`dominant
  surface`) is untouched by this port.
- **Visual Proof Validation**, **Color Intelligence**, **Benchmark Retrieval**, and **Decision
  Record persistence** — all remain DEFER, unaffected by this port.

## Distinction from Offscript's own composition/spatial concepts

The Composition Intelligence Readiness report (§2, §4) traced three internally distinct Offscript
systems that also use the word "composition": the website composition router
(`offscript/src/generate/website-composition.ts`, section-to-catalog-variant routing across a
multi-section page), the knowledge-repository Composition Engine
(`offscript/src/knowledge/composition.ts`, graph-topological asset ordering), and the Spatial Governed
Model (`offscript/src/generate/reasoning/spatial-consumption.ts`), whose own authored categories happen
to include ones literally named `density` and `composition` (page-scoped reasoning-evidence
categories, never a per-creative declared value). **None of these are what this document means by
"creative-generation density" or "creative-generation composition."** This document's density and
breathing-room bias apply to exactly one standalone creative's internal layout, never to a website
section, a page, or a knowledge-repository asset graph. Nothing in this document, or in
`composition-camera-bias.ts`, names a Offscript archetype, a website section id, a `PlanItem` field, or
a Spatial Model category — the two vocabularies remain functionally unconnected, this document
merely makes the naming distinction explicit so a future reader never conflates them.

## Relationship to Website Generation

**This document governs a single creative's internal starting-bias decision — never a website
section, never a Offscript layout choice, never anything Website Generation's own selection or
authoring machinery reads.** Website Generation's own systems
(`offscript/src/generate/creative-artifact-consumption.ts` and related code) are unmodified and
unreferenced by this document or by `composition-camera-bias.ts`. This document's output (a
density/breathing starting-bias pair) stays internal to `creative-generation`'s own rendered
`visual.html`, never reaching `PlanItem` or Website Generation's selection logic — the same
boundary `FEATURE-MAPPING.md` and `CAMERA-SELECTION.md` already established and this document
preserves exactly.
