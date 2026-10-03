# Creative Quality Bar — native methodology (v1, ported 2026-08-11)

**What this is.** A brand-independent, implementation-independent statement of the 15
creative-quality principles distilled from the external Creative Generation system's own
pass/fail rubric. **What this is not**: a validator, a doctor rail, or a rewrite of Offscript's
existing website-generation validation (`offscript/src/operators/`, `offscript/src/review/`,
`offscript/src/generate/source-fidelity.ts`) — see "Relationship to existing Offscript validation" below
for why those are a genuinely different concern, not a naming coincidence to merge.

## Source

External system: an already-working Creative Generation system, referenced here for methodology
only, never as a runtime dependency. Exact source located and read directly (not guessed):
- **Authoritative full wording:** `Reference/_STYLE.md`, section `## Quality bar (the pass/fail
  gate — draft critique in Step 4a, final verify in Step 6)`, items 1–15.
- **Cross-reference confirming this is the canonical source** (not an independent second copy):
  `CLAUDE.md` line 30 — "the full rubric is the 15 pass/fail items in 11 categories in
  `Reference/_STYLE.md`." `WORKFLOW.md` §8 reproduces a condensed summary of the same 15 items and
  states explicitly "Full wording lives in `Reference/_STYLE.md`."
- **Distinct, related, NOT ported here:** the "Visual Proof Validation" gate (4 questions, run on
  the pre-render sketch, `SKILL.md` Step 4 exit) is a separate methodology item, explicitly listed
  as its own future-sprint category in the Sprint 3 boundary report's classification table — not
  part of this port.

## How to read each item

Every item below carries: the **native rule** (brand/system-independent, standalone), its
**classification**, the **exact external source line**, a **translation note** (what changed and
why — nothing is silently rewritten), and its **enforcement status today**. Where a rule depends
on a methodology this sprint explicitly excludes (Composition Intelligence, Camera System,
Material Library, Color Intelligence, Feature Mapping, Benchmark retrieval), the rule's *intent*
is preserved here but marked **not yet enforceable** — no enforcement mechanism was invented to
make it artificially executable today.

---

### 1. One claim, stated
**Native rule:** State the single claim the creative makes, as one sentence, before composing.
Every visible element must argue that claim; an element arguing something else is deleted, not
shrunk.
**Classification:** PORT
**Source:** `_STYLE.md` item 1.
**Translation note:** Already brand- and system-independent as written; no change needed.
**Enforcement today:** Evaluable now, by judgment (human or LLM review against the stated claim).

### 2. Show real activity, mid-process — not an idealized end-state
**Native rule:** Depict something genuinely happening — a state mid-transition, with mixed or
imperfect results (never everything simultaneously perfect/complete). Avoid a static, fully
"solved" snapshot.
**Classification:** ADAPT
**Source:** `_STYLE.md` item 2 ("A fragment of real product UI, captured mid-action... mixed
states... never all-green").
**Translation note:** The external wording assumes the creative genre is always a software-product
screenshot ("app chrome," "full-app screenshot fails"). That genre assumption is the external
system's current implementation choice, not a universal creative-quality requirement — stripped
here. The underlying principle (real, mid-process, mixed-state activity beats an idealized static
result) is retained as the native rule.
**Enforcement today:** Evaluable now, by judgment.

### 3. Composition stays disciplined — nothing crowds the claim
**Native rule:** Keep element count no higher than what the claim needs; anything present but not
essential should visually recede, not compete. If text must shrink below legibility to fit
everything, the composition holds too much — reduce content, don't shrink type to compensate.
**Classification:** ADAPT
**Source:** `_STYLE.md` item 3 ("Element count matches the declared `density` band [Composition
Intelligence]; 15 is the hard cap... off-claim text greeked to grey bars").
**Translation note:** The specific "density band" lookup and the numeric "15-element hard cap" are
mechanisms of Composition Intelligence (explicitly out of scope this sprint) — dropped. The
underlying discipline principle (don't overload the frame; legibility loss signals overcrowding)
is retained.
**Enforcement today:** Evaluable now, by judgment (no numeric cap enforced without Composition
Intelligence).

### 4. The focal point must dominate — the 2-second test
**Native rule:** One element must be unmissably the largest and most prominent. At a glance (or at
thumbnail scale), the claim should still land. If the eye has nowhere obvious to go first, or the
claim is lost at thumbnail size, it fails.
**Classification:** PORT
**Source:** `_STYLE.md` item 4.
**Translation note:** Already brand- and system-independent; the specific pixel threshold ("≥
~22px") was dropped as an implementation detail of one rendering context, keeping the scale-
dominance principle itself.
**Enforcement today:** Evaluable now, by judgment.

### 5. Generous whitespace is a floor, not a suggestion
**Native rule:** At least roughly 40% of the canvas should read as open, uncluttered space. The
subject should float in a calm field — never fill the frame edge-to-edge.
**Classification:** ADAPT
**Source:** `_STYLE.md` item 5 ("Whitespace matches the declared `breathing room` band
[Composition Intelligence]... 40% air is the absolute floor regardless of band").
**Translation note:** The source states the 40% figure as an absolute floor that holds
*regardless* of the Composition-Intelligence-specific "band" — so the floor itself is already
system-independent and is kept verbatim; only the band-comparison framing (which requires the
excluded system) was dropped.
**Enforcement today:** Evaluable now, by judgment (a numeric measurement tool could formalize the
40% figure later; none exists today).

### 6. Process and transformation need visible connective tissue
**Native rule:** When a creative claims a process, sequence, or transformation, show the
connection explicitly — connectors, convergence, a partially-complete sequence. Never imply a
process merely by placing elements near each other.
**Classification:** PORT
**Source:** `_STYLE.md` item 6.
**Translation note:** Already brand- and system-independent; no change needed.
**Enforcement today:** Evaluable now, by judgment.

### 7. Each new creative should be a meaningful departure from your own recent work
**Native rule (restated; not yet enforceable):** A new creative should differ meaningfully from
your own immediately-preceding output — in more than surface coat-of-paint terms — not read as a
near-duplicate of what you just made.
**Classification:** DEFER
**Source:** `_STYLE.md` item 7 ("Varies from the recent log [`Output/_LOG.md`]: a different
archetype and camera... plus ≥2 of canvas shape / material / focal object / density changed").
**Translation note:** The entire enforcement mechanism (comparing against a running log, using
archetype/camera/material/density vocabulary) belongs to the external system's Benchmark Retrieval
+ Composition/Camera/Material Intelligence — all explicitly out of scope this sprint. The
underlying principle is real and worth preserving in the methodology, but no native mechanism
exists to check it yet.
**Enforcement today:** Not yet possible. Depends on a future Benchmark Retrieval capability
(explicitly deferred).

### 8. Palette restraint — one accent doing all the emphasis work
**Native rule:** Favor a light-dominant, restrained field with a small dark anchor. Use exactly
one accent hue for every emphasis moment, plus at most two status hues (for state, not brand
emphasis) drawn from the project's own established palette. An accent must never double as a
status color, and a status color must never carry brand emphasis.
**Classification:** ADAPT
**Source:** `_STYLE.md` item 8 ("Palette discipline... the accent the Color Intelligence table
assigns to this `feature=` row... zero off-brand hues... Accent and status must not cross").
**Translation note:** The mechanism for *choosing which* accent hue (a Color Intelligence lookup
table keyed to a Feature Mapping row) is out of scope this sprint — dropped. The restraint
*structure* itself (one accent, ≤2 status hues, accent/status never cross, stay within the
project's established palette) is brand-agnostic and retained. "The project's own established
palette" replaces the source's Example Brand-specific "brand's ramp" language — this is intentionally
generic; the actual palette for any given project is a brand-governance concern
(`design/website/brand-pack/` for Example Brand website work — see "Brand independence" below), not
this document's job to name.
**Enforcement today:** Evaluable now for the restraint *structure* (one accent, ≤2 status, no
crossing), by judgment. Not yet possible for "is this the *correct* accent" — depends on a future
Color Intelligence capability.

### 9. Craft consistency — tokens over literals, restrained voice
**Native rule:** Use only established design tokens for radius, elevation, and borders — no
one-off bespoke values. Keep machine-readable or interface-adjacent text in a clearly distinct,
functional register (e.g. monospace). Microcopy should be short, concrete, and outcome-specific —
never generic marketing language, exclamation points, or emoji.
**Classification:** ADAPT
**Source:** `_STYLE.md` item 9 ("token scale only... three-level elevation ladder... mono for
machine text... microcopy short and outcome-numeric per `Brand/voice.md`'s UI rules — no banned
words... no marketing headline or CTA").
**Translation note:** The pointer to `Brand/voice.md` (a Example Brand-specific, single-brand file)
and its unspecified "banned words" list are brand-governance content, not a universal quality
rule — dropped per "Brand independence" below; a future project's own voice/copy governance layer
is where that belongs, not this document. The structural craft principles (tokens not literals,
distinct register for machine text, restrained functional microcopy) are retained as universal.
**Enforcement today:** Evaluable now, by judgment.

### 10. Art-directed, not templated — the gut check
**Native rule:** Does this look pulled from a generic template library, or does it carry at least
one specific, considered, slightly unexpected detail? A creative that is entirely safe/expected
defaults fails this check even if every other rule technically passes.
**Classification:** PORT
**Source:** `_STYLE.md` item 10.
**Translation note:** Already brand- and system-independent; no change needed. The specific example
details (a hand-drawn mark, a real photo avatar) were kept as illustrative examples only, not a
closed list.
**Enforcement today:** Evaluable now, by judgment — inherently a qualitative gut-check, not
expected to ever be mechanically enforceable, and that's acceptable (per this sprint's own
"some criteria may remain judgment-based" instruction).

### 11. The focal surface must visually separate from its environment
**Native rule (restated; not yet enforceable):** The focal element should visibly separate from
its background field through a deliberate surface treatment — never by degrading the background
itself (blurring, re-grading, washing it out).
**Classification:** DEFER
**Source:** `_STYLE.md` item 11 ("The pop scrim is on... the card visibly separates from the
field... one of Materials A–E... any degradation of the environment... is an automatic fail per
the Environment Law").
**Translation note:** The specific mechanism (a named scrim overlay, a closed set of five "legal"
material recipes, an "Environment Law" forbidding any background alteration) all belong to the
external system's Material Library — explicitly out of scope. The underlying principle
(separate the subject from its background deliberately, don't degrade the background to achieve
it) is preserved but cannot be evaluated without a native Material Library concept.
**Enforcement today:** Not yet possible. Depends on a future Material Library capability
(explicitly deferred).

### 12. Strong hierarchy contrast between hero claim and supporting text
**Native rule:** Establish a clear, large jump in scale between the hero-scale focal claim (a
number or headline) and supporting micro-text — a strong contrast ratio, with no in-between
half-steps.
**Classification:** ADAPT
**Source:** `_STYLE.md` item 12 ("Hero-scale contrast + live-capture furniture... type snaps to
exactly three registers... hero ≥4× the micro... ≥2 pieces of interaction residue... place the UI
mid-use").
**Translation note:** "Live-capture furniture" (cursor, tooltip, kbd hints) assumes the same
software-product-screenshot genre flagged in item 2 — a genre choice, not a universal hierarchy
rule, dropped here. The typographic hierarchy principle (large, clear contrast between hero and
micro registers) is genre-independent and retained.
**Enforcement today:** Evaluable now, by judgment.

### 13. Every visible element belongs to the one capability being argued
**Native rule (restated; not yet enforceable):** Every visible element should belong to the single
capability the creative argues — nothing present that belongs to an unrelated capability.
**Classification:** DEFER
**Source:** `_STYLE.md` item 13 ("Feature Focus... [Feature Mapping]... A component from another
row is off-claim — delete it, don't shrink it").
**Translation note:** This item is, in the source's own words, *literally* the Feature Mapping
system — a closed vocabulary of capability "rows" and which components each licenses, explicitly
out of scope this sprint. **Analysis worth recording:** this item is best understood as one
*specific enforcement mechanism* for item 1's broader "one claim, every element argues it"
principle — Feature Mapping is a way of *checking* item 1's rule, not a separate concern from it.
Preserved here as its own item (to stay traceable to the source 1:1), but a future methodology
sprint should consider whether it's really a corollary of item 1 rather than an independent rule.
**Enforcement today:** Not yet possible. Depends on a future Feature Mapping capability
(explicitly deferred).

### 14. Choose the most economical framing that still proves the claim
**Native rule (restated; not yet enforceable):** Choose the closest, most economical framing/scale
that still proves the claim. If a tighter framing would prove it just as well, showing more is a
fail — you're showing more than the claim needs.
**Classification:** DEFER
**Source:** `_STYLE.md` item 14 ("Camera Accuracy... the closest [camera] that still proves the
belief").
**Translation note:** The underlying discipline (don't over-show) is real and general, but the
source's mechanism assumes a defined, closed vocabulary of framing distances (a Camera System),
explicitly out of scope this sprint.
**Enforcement today:** Not yet possible. Depends on a future Camera System capability (explicitly
deferred).

### 15. Read as the same underlying subject as your closest precedent
**Native rule (restated; not yet enforceable):** A new creative should read as the same underlying
subject as its closest prior precedent within the same capability — consistent visual vocabulary
and language — while the *composition* differs. The product must not appear to change; only its
presentation should.
**Classification:** DEFER
**Source:** `_STYLE.md` item 15 ("Benchmark Similarity... the `feature=` retrieval... same
component vocabulary, same radius/elevation/type language, same environment treatment, same accent
logic").
**Translation note:** Requires both a benchmark/precedent-retrieval mechanism and a capability
classification (Feature Mapping) to know what counts as "the same precedent" — both explicitly out
of scope this sprint.
**Enforcement today:** Not yet possible. Depends on future Benchmark Retrieval + Feature Mapping
capabilities (explicitly deferred).

---

## Classification summary

| # | Item | Classification | Enforcement today |
|---|---|---|---|
| 1 | One claim, stated | PORT | Evaluable now |
| 2 | Real activity, mid-process | ADAPT | Evaluable now |
| 3 | Composition discipline | ADAPT | Evaluable now |
| 4 | Focal dominance | PORT | Evaluable now |
| 5 | Whitespace floor (≥40%) | ADAPT | Evaluable now |
| 6 | Connective tissue for process | PORT | Evaluable now |
| 7 | Departure from recent work | DEFER | Not yet — needs Benchmark Retrieval |
| 8 | Palette restraint | ADAPT | Structure evaluable now; correctness not yet — needs Color Intelligence |
| 9 | Craft consistency | ADAPT | Evaluable now |
| 10 | Art-directed, not templated | PORT | Evaluable now (judgment-only, permanently) |
| 11 | Focal/environment separation | DEFER | Not yet — needs Material Library |
| 12 | Hierarchy contrast | ADAPT | Evaluable now |
| 13 | Single-capability focus | DEFER | Not yet — needs Feature Mapping |
| 14 | Economical framing | DEFER | Not yet — needs Camera System |
| 15 | Precedent consistency | DEFER | Not yet — needs Benchmark Retrieval + Feature Mapping |

**4 PORT · 6 ADAPT · 5 DEFER · 0 DROP · 0 UNKNOWN.** No criterion was dropped outright — every one
of the 15 had a genuine, evidence-backed reason to exist; DEFER items keep their methodology text
and only defer *enforcement*, per this sprint's explicit instruction not to drop what merely can't
be checked yet.

## Brand independence

Every native rule above is written without reference to Example Brand-specific values (hex codes,
the Example Brand voice/banned-words list, the Example Brand environment-photo set, or Example Brand's
specific accent-selection table). Where the source tied a rule to a Example Brand-specific pointer
(`Brand/voice.md`, "the brand's ramp"), this document says "the project's own established
palette/voice governance" instead — generic phrasing pointing at *whatever* brand-governance layer
a given project uses, not a Example Brand one. **This document does not duplicate
`design/website/brand-pack/`, does not create a `design/creative/brand-pack/`, and does not copy any
brand asset.** Per Sprint 2's findings, `design/website/brand-pack/` remains the one authoritative
Example Brand asset source; a future Example Brand creative project consumes it the same way website
generation already does — this document is silent on *which* palette/voice a project uses, only on
*how disciplined* its use of whatever palette/voice it has should be.

## Relationship to existing Offscript validation

Checked directly against `offscript/src/operators/` (the doctor rail operators) and
`offscript/src/generate/source-fidelity.ts` — **no true overlap, confirmed by evidence, not by
naming**:
- `source-fidelity.ts` measures whether *generated website copy* traces back to *brief content* —
  a content-provenance/completeness concern, unrelated to visual creative craft.
- `brand-fidelity-scan.ts`, `accent-saturation-budget.ts` and similar operators validate a
  *generated multi-section website's* CSS-token/brand compliance across the whole document — a
  different unit of measurement (a website, not a single flat creative), a different mechanism
  (render-measured CSS inspection), and a different governing document (`COMPOSE.md`/
  `COMPOSITION.md`, not this Quality Bar). The *spirit* overlaps mildly with item 8 (both care
  about staying on-palette), but the *rule* does not.
- `website-composition-grammar.ts`'s "one focal" / "accent ≤20%" rules are the tree-decidable half
  of `COMPOSE.md §C`, scoped to *one `<section>` band of a website* — a coincidental naming overlap
  with items 4 and 8 above, not a shared rule (different unit: a section band vs. a whole flat
  creative; different governing document; different mechanism).
- No file anywhere in `offscript/src/`, `offscript/docs/`, or `offscript/resources/` (outside this sprint's
  own output) mentions "quality bar," "15-item," or "17-item" — confirmed by direct grep; the
  hypothesis that an existing "17-item validation bar" might exist and require reconciliation was
  checked and found false.

**Conclusion: keep them separate.** This document and Offscript's existing validation measure
different things at different units of granularity for different artifact types. No merge is
warranted.

## Not part of this document

The Visual Proof Validation gate (4 pre-render questions, `SKILL.md` Step 4 exit) is a distinct,
related methodology item — explicitly not ported this sprint (see Sprint 3's boundary report
classification table, which already lists it as its own separate future category).
