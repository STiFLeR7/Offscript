# Creative Feature Mapping — native methodology (v1, ported 2026-08-12)

**What this is.** A brand-independent, implementation-independent statement of which interface
components belong to each of `CreativeIntent`'s seven `feature` values — the rule that keeps a
generated creative's visible UI scoped to the single capability it argues, instead of becoming an
arbitrary dashboard. **What this is not**: a website component catalog, a Offscript section-selection
mechanism, or a description of literal rendered pixels — see "Relationship to Website Generation"
below for why those are a different concern entirely.

## Source

External evidence: `HANDOFF-v2.md` (repo root of `offscript`, untracked, read as historical
evidence only — the Creative Generation Renderer Readiness assessment
(`.experiments/2026-08-12-creative-generation-renderer-readiness/REPORT.md`) §5 confirmed this
document describes an external, non-`offscript` engine and introduces no runtime dependency on it).
Exact source located and quoted directly, not guessed:

- **Authoritative wording:** `HANDOFF-v2.md` §B-7 ("NEW section — Feature Mapping"), the literal
  markdown block that engine's own `Reference/_STYLE.md` was patched to carry, headed
  `## Feature Mapping (intent → the components that belong)`.
- **Cross-reference confirming this is the primary content, not a second independent copy:**
  `HANDOFF-v2.md` §B-8 ("Benchmark consultation") states "`feature=` values come from the Feature
  Mapping table's seven rows" — the same seven rows reproduced below.
- **Distinct, related, NOT ported here:** Benchmark Retrieval (which keys off `feature=` but adds
  its own retrieval procedure), Camera System, Composition Intelligence, Material Library, and
  Color Intelligence remain DEFER — see the renderer-readiness assessment §13 for the full matrix.

## The seven-row mapping

**Rule (inclusion + exclusion, quoted from the source, translated only to drop the Example Brand-
specific "narrative" framing):** every visible component in a creative must come from the chosen
feature's row, and must directly support the claim. A component from another row is off-claim —
delete it, don't shrink it. This is what stops "arbitrary dashboard" output: the *feature* is
chosen first, and surrounding UI is added only where that feature's row licenses it.

| `feature` value | Source label | Components that belong |
|---|---|---|
| `automation` | Automation | workflow builder · execution status · automation timeline · success notification |
| `search` | Search / retrieval | search bar · results · filters · suggestions |
| `analytics` | Analytics | charts · KPI cards · trend lines · comparisons |
| `security` | Security | permissions · audit logs · verification status · alerts |
| `collaboration` | Collaboration | comments · assignments · mentions · activity feed · presence |
| `ai-intelligence` | AI intelligence | insight card · recommendation panel · AI summary · confidence score · suggested actions |
| `configuration` | Configuration | settings panel · toggle / segmented control · form fields · scope selector · a preview of the effect |

The `feature` column values are `CreativeIntent`'s own closed enum
(`creative-intent-exporter/src/intent/types.ts`) — this document does not invent a parallel
vocabulary; it maps the existing contract values to their component lists.

**Component-count note (preserved exactly, not normalized):** four rows (`automation`, `search`,
`analytics`, `security`) list exactly four components; three rows (`collaboration`,
`ai-intelligence`, `configuration`) list exactly five. The source table is not uniform, and this
document does not truncate or pad any row to force a uniform count — doing so would be inventing
methodology, not preserving it.

**The late-added `configuration` row (preserved verbatim from the source):** `configuration` was
not in the original methodology. It was added because an approved creative in the external
system's own corpus had nowhere to be classified — "the corpus correcting the law." Recorded here
so a future reader understands this row's provenance differs from the other six, not because the
row itself is any less authoritative today.

## Universal methodology vs. implementation

This document states **what belongs to each feature** — brand-agnostic, renderer-agnostic content.
It does not state **how** a producer should render those components, what they should look like,
or in what layout — that is Composition Intelligence's job (still DEFER; see the renderer-readiness
assessment §6). The runtime implementation that reads this document
(`offscript/creative-generation/src/feature-mapping.ts`) is a thin parser over this table — it contains
no independent copy of the component lists; this document is the sole source of truth for them.

## Enforcement status

**Newly enforceable as of Sprint 10A** (2026-08-12): `offscript/creative-generation/src/producer.ts`
now consults this table (via `componentsForFeature()`) for every artifact it produces, and stamps
`generation.methodologyVersion: 'feature-mapping-v1'` on the result. Quality-Bar item 13 ("Feature
Focus" — see `QUALITY-BAR.md` in this directory), previously "not yet enforceable... depends on a
future Feature Mapping capability," is enforceable in principle as of this port — no scoring
automation exists yet, so it remains a judgment check for now, but the underlying data dependency
it was blocked on is resolved.

## Brand / system independence

Every component name above is generic interface vocabulary (a "search bar," a "KPI card," a
"toggle") — no Example Brand-specific string, brand asset, or brand token appears anywhere in this
document. This document contains no absolute filesystem path and no dependency, reference, or
import statement pointing at the external Creative Generation system — it is pure prose content,
portable to any brand and, per this repository's own portability requirement, portable from
`D:/offscript` to `D:/EXAMPLE BRAND/Offscript/offscript-portable` unchanged.

## Relationship to Website Generation

**This document governs a single creative's internal component vocabulary — never a website
section, never a Offscript fragment catalog entry, never a section→artifact mapping.** Nothing in this
table names a Offscript archetype, a website section id, or a client project. Website Generation's own
component/fragment selection (`offscript/src/generate/catalog.ts` and related selection machinery) is
an entirely separate system, unmodified and unreferenced by this document or by
`feature-mapping.ts`. The boundary the renderer-readiness assessment established (§14) — Creative
Generation reasons about one creative; Website Generation reasons about a multi-section website —
is preserved exactly: this document's output (a component list) stays internal to
`creative-generation`'s own rendered `visual.html`, never reaching `PlanItem` or Website
Generation's selection logic.
