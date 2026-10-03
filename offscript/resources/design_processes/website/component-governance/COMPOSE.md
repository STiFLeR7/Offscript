# COMPOSE.md — the ASSEMBLE layer

**What this is.** A grammar for **building a *new* section by mixing fragments from
several components** — the card grid from one, the headline from another, the proof
block from a third — and keeping it coherent. This is the "visual-designer brain": it
turns "20% bento, 30% features, 50% testimonial" into a concrete, rule-checked layout.

It works on top of [`COMPOSITION.md`](COMPOSITION.md) (which is for *selecting* whole
components). Here you don't select a whole component — you **harvest blocks** from any
donor and reassemble them.

> **Composing is optional — not a hard rule.** If a whole section already fits the brief —
> its own category, or a cross-category pick from [`COMPOSITION.md`](COMPOSITION.md) — just
> use it as-is. Reach for composing only when **no whole component fits**, or when you want
> **fresh variety** on a long page. Most sections won't need this file; the ones that do are
> where it earns its keep. See "Pick your approach" at the top of `COMPOSITION.md`.
>
> **Repetition is not a compose trigger.** Rotating between *equally-fitting whole components*
> (run `node tools/selection-diversity.js`) is the first defence against sameness — compose for
> *fresh* variety only when no whole component fits the brief's angle, not merely to avoid
> reusing a component you've used before.

**The compose procedure (read top to bottom):**
0. Composing must arrive here via a **Curation Table row** whose mode is *compose* with a
   "no fragment serves this intent" (or variety) reason — see `SKILL.md` "Building a page"
   step 3. Never compose ad hoc.
1. Name the **section intent** → pick its **skeleton** (§B). The skeleton is a list of slots.
2. For each slot, pull a **block** from any **donor** in the **Block Library** (§A).
   Different slots can come from different donors — that's the point. **Harvest the
   markup/CSS from the donor's pre-scoped copy in `fragments/<name>.html`** (cleaner to
   lift than the raw preview page; `fragments/manifest.json` lists every donor's blocks).
3. Assign each block a **weight** (FOCAL / SUPPORT / AMBIENT) using the **focal-weight
   model** (§D). Exactly one block is FOCAL.
4. Run the **Composition Grammar** (§C) — a pass/fail checklist. Fix anything that fails.
5. Generate fresh HTML, re-skinning every borrowed block to the section's surface, accent,
   and type families (grammar rule 10). See the **worked recipes** (§E) for full examples.
   **Wrap the whole composed section in `<div data-composed="<intent>">…</div>`** — this marker
   is what tells `tools/validate-page.js` the band is a *deliberate composition* (traced to a
   `compose`-mode Curation-Table row) and not un-curated AI-slop. A composed band with no marker,
   or with no matching `compose` row, **fails** the curation gate (see `SKILL.md` step 6).

> **Maintenance contract.** When you add a component to `preview/`: add its row to
> `COMPOSITION.md`'s catalog, run `node tools/build-fragments.js` (regenerates
> `fragments/` + `manifest.json` automatically), and list the blocks it donates here (§A)
> if it should serve as a compose donor. §A enumerates the *named, vetted* donors; the
> manifest's per-component `blocks` field covers the whole catalog.

---

## §A. Block Library (the molecules + donor map)

A **block** is a reusable visual molecule a designer can lift out of a component and drop
into another section. "Donors" name where to copy the markup/CSS from. "Focal?" = whether
the block can legitimately be the section's single dominant element (grammar rule 2).

| Block | What it is | Surface affinity | Focal? | Donor components (copy from) |
| --- | --- | --- | --- | --- |
| `headline-cluster` | eyebrow + 2–3-line headline + sub | any | yes | `feature-trio`, `hero-*`, `mission-reveal`, `stat-cards`, `cta-band` |
| `body-copy` | lede / paragraph block | any | no | most sections; clean source: `feature-trio`, `value-stats` |
| `card-grid` | N equal cards in a row | base/rest | yes | `feature-trio`, `stat-cards`, `team-grid`, `latest-news`, `integration-grid` |
| `bento-tiles` | mixed-size tiles on one grid | any | yes | `feature-bento`, `testimonial-bento`, `value-stats`, `hero-bento` |
| `stat-block` | one big count-up number + caption | any | yes | `stat-cards`, `stat-tiles`, `value-stats`, `testimonial-stack`, `outcome-stats` |
| `stat-row` | 3–4 inline metrics + hairline dividers | rest/base | yes | `stat-band`, `value-prop`, `outcome-stats`, `about-value` |
| `quote-card` | portrait + quote + attribution | any | yes | `testimonial-stack/slider/bento`, `reviews-carousel`, `case-carousel`, `results-proof` |
| `creative-panel` | **RETIRED** — was a decorated panel + inner mock card. The system no longer authors creative; use `media-frame` with a placeholder instead (`creatives.md`). | — | — | — |
| `accordion-list` | single-open expandable list | base/rest | yes | `faq-split`, `faq-single`, `faq-centered`, `feature-accordion`, `feature-steps` |
| `tab-bar` | tab strip that swaps one panel | base | no | `tabbed-showcase`, `pricing-tabbed`, `hero-agent` |
| `comparison-matrix` | factor × column check grid | base | yes | `compare-table`, `comparison` |
| `pricing-card` | plan card (price + features + CTA) | rest/base | yes | `pricing`, `pricing-packages`, `pricing-tabbed`, `subscription-faq` |
| `logo-row` | row/wall of client/partner logos | any | no | `logo-strip`, `logo-marquee`, `backed-by`, `integration-grid`, `results-proof` |
| `media-frame` | the container holding a section's primary content block — a supplied image/screenshot, or (by default) a **structural placeholder** reserving its position. Its corner treatment and ratio are component styling. | any | yes | `hero-bento`/`lending`/`agent`, `get-started`, `how-it-works`, `case-carousel`, `resources-*`, `team-*` |
| `placeholder` | a labelled reservation of a creative asset's position — photography, product screenshot, editorial visual, dashboard. Declares position/ratio/spacing/alignment only, **never the creative** (`creatives.md`). | any | yes | authored from the brand pack's placeholder primitive; no donor |
| `section-marker` | two hard-cornered squares spanning the content width, used as a PAIR that brackets a major section — one at its opening, one at its close, both in that section's accent (orange first, then blue) | any | no | authored from the brand pack's marker primitive; no donor |
| `list-rows` | stacked icon+label rows | any | no | `sticky-cards`, `how-it-works`, `pricing`, `contact-methods`, `integration-grid` |
| `cta-row` | headline + primary button | any | no | `cta-banner`, `cta-band`, `buttons`, and nearly every section |
| `form-block` | labelled fields + submit | base/figure | yes | `contact-form`, `contact-us`, `book-demo`, `demo-modal`, `footer-cta/dark/orbit` |
| `chip-row` | row of tag / industry / category chips | any | no | `industry-chips`, `hero-bento/lending`, `latest-insights`, `value-stats`, `feature-steps` |
| `step-rail` | numbered vertical step nav | any | no | `sticky-cards`, `how-it-works`, `get-started`, `feature-steps` |
| `toggle-control` | segmented Monthly/Yearly-style switch | base/rest | no | `pricing`, `subscription-faq`, `hero-actions` |
| `gauge-progress` | conic gauge / bar meter / progress | base/contrast | no | `agent-status`, `customer-story`, `outcome-stats` |
| `divider` | hairline rule — a single weight, structural only. *(The `divider*` atoms' "textured transition band" is v2 language and does not survive: a texture used to mark a hand-off is a texture used as an element, which `rulebooks/visual-language.md` §2 forbids. Surface material is uniform and marks nothing — §1.1.)* | any | no | `divider*` atoms; hairlines in `feature-trio`, `value-prop`, `faq-centered` |
| `nav-bar` | top nav (logo + links + primary action) | any | no | `nav`, every `hero-*`, `footer-links` |
| `footer-columns` | multi-column link grid | base/contrast | no | `footer-dark/orbit/mega/cta/links` |

*Every block above names ≥1 donor that exists in the `COMPOSITION.md` catalog — no orphan
blocks.*

---

## §A2. Section Composition Archetypes (decide this FIRST)

**Before any slot is filled, a section declares how it fundamentally communicates.** Everything
downstream — the skeleton, the blocks, the creative's proportion, presence and anchor, the rhythm, the
measures — governs a section *once you know what kind of section it is*. Without this, that decision
is improvised, and text→media, media→text and interleaved arrangements can all satisfy every other
rule while delivering completely different experiences.

| Archetype | How the section communicates |
|---|---|
| **Editorial Split** | an argument and its evidence held side by side; the reader reads across |
| **Editorial Stack** | a single vertical argument; the reader reads down, one idea at a time |
| **Text First** | the claim carries the meaning; the creative confirms it |
| **Immersive Landscape** | an environment entered before it is read; feeling precedes explanation |
| **Media First** | the creative carries the meaning; text supports what is already understood |
| **Product Showcase** | the artifact leads and the copy attends it |
| **Storytelling Composition** | a story built around one visual moment; the reader is led through it |
| **Narrative Flow** | a sequence the reader moves through; each part opens onto the next |
| **Proof Layout** | measured claims whose arrangement is the evidence; the reader verifies |
| **Feature Comparison** | parallel options weighed factor by factor; the structure *is* the message |

*This table and §A2.2 are one vocabulary in two views — the sentence here, the predicates there — and
they are listed in the same order so a drift between them reads as a mismatch rather than as a
reordering. Until 2026-07-29 this table held eight rows and still named `Immersive Hero`, two
revisions after the row was renamed and its focal weight changed; the introduction to a closed
vocabulary is exactly where a stale name survives longest, because nothing selects against prose.*

**These are communication archetypes, not layouts — and the distinction is load-bearing.**
`COMPOSITION.md` also carries a column called "archetype", and it is the *other* kind: `centered-stack`,
`two-col-text+creative`, `n-up-card-grid`, `table-matrix` describe **geometry**, not intent.

That is not a hypothetical collision; it is a defect this section exists to fix. A closing call to
action tagged `centered-stack` produced a centred stack — a layout tag made a communication decision
because nothing sat above it to make that decision first.

The relationship is two-tier and runs one way only:

```
Section Composition Archetype     how this section communicates      ← decided first
            ↓ selects
Layout archetype (COMPOSITION.md) what shape that takes
            ↓ selects
Skeleton · blocks · creative proportion/presence/anchor · rhythm · measures
```

**A declared archetype must constrain what follows it.** An archetype that any layout could satisfy
is decoration, not a decision.

### §A2.1 — The behavioural contract (what an archetype actually declares)

A name and a sentence do not constrain a render. **Each archetype is a behavioural contract**: a
fixed anatomy, every field of which is either a **predicate** — something the render either satisfies
or fails — or is **explicitly marked rationale**. A field that is neither is a declaration that
constrains nothing, which is the thing this section exists to prevent.

**The contract binds vocabulary that already exists.** It introduces no new spatial concepts: it
states, per archetype, which value of each already-governed vocabulary is permitted. Where a concept
has an owner, the contract **references** it and never restates it.

**A section declares six things before it composes, and they are ordered.** Until 2026-07-29 the
contract began at the archetype, which meant two sections could declare the same archetype and the
same register and still be different pieces of communication with no way to say so. The declaration
now opens above the archetype and closes below it:

```
HIERARCHY  →  INTENT  →  ARCHETYPE  →  REGISTER  →  SIGNATURE  →  DENSITY
how much      why it     how it        how it       what makes    how
it matters    exists     communicates  feels        it memorable  concentrated
```

**The order is one-way and load-bearing.** Hierarchy governs the scale, space and emphasis
everything below inherits, so it cannot be decided after the parts are chosen. Intent determines which
slots the section must contain (§B.1), so it cannot be decided after the parts are placed. Reasoning in
any other order produces a well-made section whose importance and purpose were settled by what
happened to be put in it — which is the same defect §A2 exists to prevent, one level up.

**Hierarchy and Intent are the two that cannot be inferred from the render.** Every other field can
be read back off the page. These two are claims about the page's argument, so they are declared
explicitly or they do not exist — and a section that declares neither is not a modest section, it is
an unowned one.

| Field | Kind | Vocabulary it binds (owner) |
|---|---|---|
| **Hierarchy** — the section's narrative importance | predicate | `hero` · `primary` · `secondary` · `supporting` · `technical` · `proof` · `closing` |
| **Intent** — the advance this section exists to make | predicate | `educate` · `persuade` · `explain` · `prove` · `compare` · `build-trust` · `inspire` · `convert` · `orient` · `close` |
| **Signature** — the one thing this section is remembered for | predicate | the signature vocabulary (§A2.4) |
| **Density** — how concentrated the unit is | predicate | `low` · `medium` · `high` (`SECTION_LAYOUT.md` §10) |
| **Focal weight** — what carries the section's one argument | predicate | FOCAL / SUPPORT / AMBIENT (§D) |
| **Composition character** — how the whole is perceived | predicate | single-focus · dual-focus · distributed (`SECTION_LAYOUT.md` §13) |
| **Reading flow** — the movement the field supports | predicate | linear · split · guided · exploratory (`SECTION_LAYOUT.md` §11) |
| **Containment** — how held or released the unit is | predicate *(derived)* | contained · partial · expansive · full-width (`SECTION_LAYOUT.md` §9) |
| **Creative presence** — the creative's compositional authority | predicate | the presence shares (`rulebooks/creatives.md`) |
| **Creative anchor** — where the creative sits | predicate | the seven anchors (`rulebooks/creatives.md`) |
| **Forbidden states** — the enumerated exclusions | predicate | per contract, below |
| **Relationship** — why the parts need each other | **rationale** | — |
| **Render outcome** — what you should see if it worked | **rationale** | — |
| **Failure** — the one observable condition that means it collapsed | predicate | the archetype's headline negative control |

*Forbidden states, the failure, and the positive fields are three jobs, not one idea written three
times: the permitted values, the enumerated exclusions, and the single condition that names the
archetype's collapse. Where a failure is exactly the negation of a forbidden state it is written
once, in the failure, and the forbidden list does not repeat it.*

**Containment is derived, and is marked so deliberately.** It is real and it is stated — an author
composing a section needs to know whether the unit is held or released — but it follows from presence
and anchor rather than being independently observable: a creative is full-width *because* it bleeds,
and contained *because* it is incidental. It is therefore verified **through** those two, and it is
excluded from the distinctness signature in §A2.2 so that one decision is never counted twice.

**Dominance is not a field here.** Which part commands the field is owned by `SECTION_LAYOUT.md` §12
(spatially) and `VISUAL_LANGUAGE.md` §8 (perceptually), and the creative's own weight is deliberately
called **presence**, never dominance (`rulebooks/creatives.md`). The contract binds those; it does
not re-decide them. The **margin** that makes dominance decisive rather than marginal is a threshold,
and it lives in §C.14.

### §A2.2 — The ten contracts

The predicate half of every contract, in one table. **This table is the archetype system**: two rows
that read the same are two archetypes that are the same.

| Archetype | Focal weight | Character | Flow | Containment | Creative presence | Creative anchor |
|---|---|---|---|---|---|---|
| **Editorial Split** | typography | single-focus | split | contained | `s` | `left` · `right` |
| **Editorial Stack** | typography | single-focus | linear | contained | **none** | — |
| **Text First** | typography | single-focus | linear | contained | `xs` | `inline` |
| **Immersive Landscape** | creative (as subject) | single-focus | guided | full-width | `xl` | `bleed` |
| **Media First** | creative | single-focus | linear | expansive | `l`–`xl` | `bleed` |
| **Product Showcase** | creative | single-focus | linear | partial | `l` | `framed` |
| **Storytelling Composition** | creative | single-focus | guided | partial | `l` | `left` · `right` |
| **Narrative Flow** | structure | distributed | guided | contained | `xs` | `inline` |
| **Proof Layout** | structure | single-focus | linear | contained | `s` | `inline` |
| **Feature Comparison** | structure | distributed | exploratory | expansive | **none**–`xs` | `inline` |

**Ten rows, and the two additions are additions to the vocabulary, not to the count.** The
2026-07-29 direction named twelve composition archetypes. Ten of those twelve were already here
under other names or as instances of a row, and mapping them was the work — a name with no distinct
signature constrains nothing, which §A2.1 forbids. The mapping is recorded in `DECISION-REGISTER.md`
DR-11 and summarized here:

| Direction's name | What it is |
|---|---|
| Editorial Split · Media First · Comparison Layout | already present |
| **Immersive Landscape** | **renames Immersive Hero.** Its focal weight also changes — *creative as **subject***, not as surface. See DR-7: a photograph is never a surface behind text, so the archetype survives as a full-bleed creative that carries no type. The name follows the change rather than surviving it. |
| Narrative Left · Narrative Right | **anchor values** of Editorial Split, which already binds `left`·`right`. Promoting them would produce two rows differing in one dimension and make their parent redundant. |
| Process Layout · Timeline Composition | two names for **Narrative Flow**. A sequence the reader moves through is one contract, whether its beats are steps or dates. |
| Feature Stack | **Editorial Stack.** |
| Full-width Editorial | **Editorial Stack** in a section marked full-bleed (§C.4's second documented exception). Containment is *derived* from creative presence and anchor, and Editorial Stack has no creative — so there is nothing to derive a wider containment from. The width is a property of the section's well, not of the contract, and routing it through §C.4 is what keeps the derivation honest. |
| **Proof Layout** | **new row.** Closest to Product Showcase, and distinct from it where it matters: evidence leads through its *structure* — a set of measured claims — not through a staged artifact. It is the first `structure` archetype that is `single-focus`; the other two are `distributed`, which is what makes proof read as a list of facts rather than as one argument. |
| **Storytelling Composition** | **new row.** A story built around one visual moment. Creative-focal like Media First and Product Showcase, and separated from both by `guided` flow: the reader is *led through* the moment rather than shown it. Separated from Immersive Landscape by presence and anchor — it composes beside the copy at `l`, where Immersive Landscape *is* the section at `xl`. |

**Media First loses the `floating` anchor.** The direction refuses floated creative outright —
*"never float screenshots · never centre screenshots by default"* — and `floating` was the only
anchor in the vocabulary that expressed *placed nowhere in particular*. Media First keeps `bleed`,
which is a decision; `floating` was the absence of one. The anchor vocabulary itself is narrowed in
`rulebooks/creatives.md`.

**No two rows may be identical. If a contract edit makes two rows match, the edit does not ship** —
see §A2.3.

**The presence bands already carry these semantics, and the contract simply holds each archetype to
its own** — `xs` incidental, `s` supporting (*the copy leads*), `m` co-equal (*a true split*), `l`
leading (*the creative carries*), `xl` dominant (*the creative IS the section*). Editorial Split
takes `s` for exactly that reason: an argument beside its evidence is still an argument leading.

**Two vocabulary values are deliberately left unbound, and it is the same gap twice.** No archetype
takes the `m` presence band, and none takes `SECTION_LAYOUT.md` §13's **dual-focus** character —
because both describe two co-equal centres, and §C.2 permits exactly one FOCAL block per section. A
co-equal split is the failure Editorial Split names, not a composition any archetype wants. This is
recorded rather than engineered around: if a genuine two-centre archetype is ever needed, §C.2 is
what has to be reopened first, and that is a deliberate decision rather than a side effect.

**Text First is not creative-less.** §A2 defines it as *the claim carries the meaning; the creative
confirms it* — a confirming creative is present and subordinate. Only **Editorial Stack** is a single
vertical argument with no creative at all. Reading Text First as "no creative" collapsed it into
Editorial Stack and cost the system one of its eight distinctions.

The rationale half, per archetype:

- **Editorial Split** — *Relationship:* the evidence must be seen while the argument is read; either
  alone is weaker. *Render outcome:* two columns, typography unmistakably leading, the creative
  beside it as evidence, whitespace holding them apart rather than a gutter dividing them.
  *Forbidden:* equal visual weight between the two sides · centre alignment · a creative wider than
  the headline's measure. *Failure:* the two sides read as co-equal, so the reader cannot tell which
  is the argument.
- **Editorial Stack** — *Relationship:* one idea at a time; anything beside the argument competes
  with it. *Render outcome:* a single narrow column, generous vertical air, nothing to look across
  at. *Forbidden:* any creative · any side-by-side division of the field. *Failure:* a creative
  appears, and the vertical argument becomes a split.
- **Text First** — *Relationship:* the claim stands on its own; the creative is corroboration the
  reader meets after believing it. *Render outcome:* the claim leads at full editorial weight; a
  small creative sits in the flow beneath or within it, clearly secondary. *Forbidden:* a creative
  at or above supporting presence · a creative placed before the claim in reading order.
  *Failure:* the creative reaches co-equal presence, and the section becomes a split.
- **Immersive Landscape** — *Relationship:* the environment must be felt before anything is read, and
  it is felt **beside** the reading rather than beneath it. *Render outcome:* a full-bleed creative
  that is the section — entered, not looked at — with the type in its own band above or below, never
  on it. *Forbidden:* a contained well around the creative · **any type over the creative, anywhere
  on it** — there is no quiet region exception, because a photograph is not a surface (DR-7) ·
  a creative below dominant presence. *Failure:* the creative reads as a backdrop behind a normal
  section — wallpaper, not an environment.
  *(Renamed from Immersive Hero, and the rename followed a change of substance: the creative is the
  **subject**, not the surface. The prior wording — "type occupying its quiet region" — described the
  arrangement DR-7 retired, and survived here after the row itself had changed.)*
- **Media First** — *Relationship:* the creative carries the meaning; the words name what was already
  understood. *Render outcome:* the creative dominates and breaks its container; the copy is brief
  and beneath it. *Forbidden:* a creative held inside the content well at supporting presence ·
  copy that leads the creative in reading order. *Failure:* the creative accompanies the copy rather
  than carrying the section.
- **Product Showcase** — *Relationship:* the artifact is the subject and the copy attends it.
  *Render outcome:* one framed artifact, deliberately staged and held, with the copy in attendance.
  *Forbidden:* an unframed or bleeding creative · more than one artifact given equal standing.
  *Failure:* the artifact is one of several comparable items, so nothing is being shown.
- **Storytelling Composition** — *Relationship:* the story and its one visual moment need each other —
  the creative is what the telling is *about*, and the copy is what makes it legible. *Render
  outcome:* a leading creative held beside the copy, the reader carried through it in a guided path
  rather than shown it and left. *Forbidden:* more than one visual moment · a creative that bleeds
  (that is Immersive Landscape, where the creative *is* the section) · a sequence of comparable
  moments (that is Narrative Flow). *Failure:* the creative is decoration beside a story that would
  read identically without it.
- **Narrative Flow** — *Relationship:* each part opens onto the next; no part is the destination.
  *Render outcome:* a sequence the eye is led along, each step small and none dominant.
  *Forbidden:* a single dominant creative · a step given focal weight over the sequence.
  *Failure:* one step dominates and the sequence stops being a movement.
- **Proof Layout** — *Relationship:* the claims corroborate each other; each is weaker alone, and the
  *arrangement* is what makes them read as a body of evidence rather than as assorted numbers.
  *Render outcome:* a set of measured claims composed as one argument — the structure leading, no
  single claim staged above the others, a small creative attending at most. *Forbidden:* a claim
  given focal weight over the set · a creative at leading presence or above · claims the reader is
  invited to choose between (that is Feature Comparison — proof is not weighed, it is verified).
  *Failure:* the claims read as a list of facts rather than as one argument, which is the exact line
  separating this row from the other two `structure` archetypes.
- **Feature Comparison** — *Relationship:* the structure *is* the message; the reader weighs, so the
  field must be even by design. *Render outcome:* a parallel structure read across, options
  comparable at a glance. *Forbidden:* an emphasized option that is not the declared distinction ·
  a creative at supporting presence or above. *Failure:* the options are not comparable, so no
  weighing is possible.

**Distributed character and one focal block are not in conflict.** `distributed` describes the
*whole's* perception (`SECTION_LAYOUT.md` §13); §C.2's one FOCAL block still holds, and in these two
archetypes the FOCAL block **is the structure** — the sequence, the matrix — not one item inside it.

### §A2.3 — The regression rule (uniqueness is protected, not achieved once)

Distinctness won once decays silently: an edit to one contract can quietly make it identical to
another, and nothing would notice.

> **Every contract change must regenerate the archetype comparison matrix. If uniqueness decreases,
> the change does not ship.**

The matrix is the §A2.2 predicate table, emitted from the render by the verifier and **committed** as
an artifact, so a uniqueness regression appears as a diff rather than as a judgment call.

### §A2.4 — The other five declarations

The archetype is the third of six fields (§A2.1). The other five bind closed vocabularies, listed
here because a vocabulary that lives only in a verifier is a vocabulary nobody can author against.

**Hierarchy — the section's narrative importance.** `hero` · `primary` · `secondary` · `supporting` ·
`technical` · `proof` · `closing`. Hierarchy governs the typographic scale a section reaches for, how
much space it is given, how much visual weight it may take, how large its creative may be, and how
emphatic its call to action is. It is declared first because everything below inherits from it.

*Why this exists at all:* without it, every section competes for the same amount of attention and
gets it. `SECTION_LAYOUT.md` §10 already requires density to rest and peak across a progression, and
§12 already requires dominance to be decisive — but both reason *within* and *between* sections, and
neither can express that this section matters less than that one. A page of correctly-composed
sections at uniform importance is the flat page those rules were written to prevent, arrived at
without breaking either of them.

**Intent — the advance the section exists to make.** `educate` · `persuade` · `explain` · `prove` ·
`compare` · `build-trust` · `inspire` · `convert` · `orient` · `close`. Intent determines **which
slots the section must contain and which it may not** (§B.1) — the archetype arranges them — and it
binds the section to its beat in the page's declared narrative arc (`PAGE_STRUCTURE.md` §5.1).

*Intent and archetype answer different questions and are routinely confused.* Intent is **why the
section exists**; archetype is **how it communicates**. Two sections can both be `editorial-split`
and be doing entirely unrelated work — one comparing, one persuading — and nothing in the contract
could say so until Intent was declared. The reverse also holds: one intent may be served by several
archetypes, and choosing between them is a composition decision, not a restatement of the intent.

**Register — how the section feels.** `editorial` · `quiet` · `immersive` · `technical` · `human` ·
`confident` · `narrative` · `instructional` · `reflective` · `closing`. Owned by
`rulebooks/editorial-art-direction.md`, which binds a permitted band per archetype and holds the
adjacency predicate: **no two adjacent sections declare the same register.**

**Signature — the one thing the section is remembered for.** `section-marker` · `floating-icon` ·
`orange-corner` · `editorial-photography` · `embedded-screenshot` · `architectural-whitespace` ·
`colour-interruption` · `editorial-overlap` · `pull-quote` · `large-statistic`.

**The same signature never appears identically in consecutive sections.** Variation is what produces
personality; a signature repeated down a page stops being a signature and becomes a template. This is
the same shape as the register adjacency rule and for the same reason — sameness is only visible
across neighbours, never within one unit.

*A section is never remembered solely for its headline.* A section whose only distinguishing feature
is its words has not been composed; it has been filled.

**Density — how concentrated the unit is.** `low` (editorial, generous whitespace) · `medium`
(explanation) · `high` (technical). Owned by `SECTION_LAYOUT.md` §10, which governs how density must
rest and peak across the progression. The vocabulary is here because the *declaration* is part of the
contract; the *rhythm* it participates in is not this file's to decide.

Paired with the hard count in §C: **no section carries more than four competing information
groups.** Density says how concentrated the unit is *meant* to be; the count says what it may not
exceed regardless. A `high`-density section is still four groups, composed tightly — not five.

---

## §B. Section Skeletons (slots per intent)

A skeleton is a vertical sequence of **slots**. `[block]` = required, `[block]?` =
optional, `A | B` = pick one block class for that slot. Fill each slot from any donor.

**Every skeleton may open with `[section-marker]?`** — once, at the section's beginning, when the
section opens a major movement of the page. It is omitted from each line below only to keep them
readable; it is never a second marker mid-section.

### §B.1 — Intent requires the slots; Archetype arranges them

**A skeleton is never picked by name.** It is produced by two decisions that are already made, in the
order the declaration already fixes — Intent before Archetype (§A2.1):

> **Intent determines which slots must be present. Archetype determines how they are arranged.**

Intent is a claim about what the section must *contain*: a section that exists to `prove` without an
evidence slot has not failed to look right, it has failed to be what it declared. Archetype is a claim
about *arrangement*: whether those slots are held side by side, stacked, sequenced, staged or bled.
Neither field can answer the other's question, and until 2026-07-29 both were documented as choosing
the skeleton — see `DECISION-REGISTER.md` DR-21.

| Intent | Slots it requires | Slots it forbids |
|---|---|---|
| **orient** | a heading · an action or a way onward | — |
| **educate** | a heading · a body that carries the explanation | an action as the section's conclusion |
| **explain** | a heading · a structure whose parts are ordered | an unordered set where sequence is the meaning |
| **persuade** | a heading that makes the claim · support beneath it | — |
| **prove** | a heading · **evidence** — measured, attributed, or shown | a claim with nothing standing behind it |
| **compare** | a heading · **two or more parallel options**, evenly weighted | an emphasized option that is not the declared distinction |
| **build-trust** | **attribution** — a named voice, a named source, or a named party | anonymous proof (an unattributed quote or logo proves nothing) |
| **inspire** | a heading, and little else | supporting apparatus that explains the statement away |
| **convert** | a heading · **an action** — a call or a capture | more than one competing action |
| **close** | a heading · **exactly one** action | anything the reader is asked to consider instead of act on |

**The forbidden column is the half that makes this a predicate.** A required slot can be satisfied by
adding something; a forbidden one can only be satisfied by not having done it. Together they make a
declared intent checkable against the render, which is what §A2.1 requires of every field.

*Two slots recur and are deliberately not listed above: `[section-marker]?` opens any section that
opens a movement of the page, and `[headline-cluster]` is required by every intent — a section
without a heading has no declared subject.*

**The thirteen skeletons below are realizations, not a menu.** Each is a common (intent × archetype)
pairing, recorded because it is useful. Two of them may fit the same slot list; which one is right
follows from the archetype, never from its name — and the name is a page label, which is exactly the
kind of tag §A2 already found making a communication decision it had no standing to make.

**The preferred order inside a skeleton** is marker → heading → supporting body → primary content, on
the deterministic rhythm in `rulebooks/visual-language.md` §17. A skeleton that reorders those four
needs a reason. Note what that rhythm now says: the **marker is separated from the heading by the
section's largest opening gap**, because the marker introduces the section and the heading begins the
narrative — two moments, never one attached pair — while the heading and its supporting body bind
tightly as a single cluster.

- **Hero** — `[nav-bar]` + `[headline-cluster]` + `[cta-row | form-block]` + `[media-frame | bento-tiles | chip-row]?` + `[logo-row]?`
- **Feature** — `[headline-cluster]` + `[proof: card-grid | bento-tiles | accordion-list+media-frame | tab-bar+media-frame | step-rail]` + `[highlight: stat-block]?` + `[nudge: quote-card]?` + `[cta-row]?`
- **Stats / outcomes** — `[headline-cluster]` + `[stat-block ×N | stat-row | bento-tiles]` + `[gauge-progress]?` + `[cta-row]?`
- **Social proof** — `[headline-cluster]?` + `[logo-row | card-grid]` + `[stat-row | quote-card]?`
- **Comparison** — `[headline-cluster]` + `[comparison-matrix | pricing-card ×N]`
- **Process** — `[headline-cluster]` + `[step-rail + (media-frame | list-rows)]` + `[cta-row]?`
- **Pricing** — `[headline-cluster]` + `[toggle-control]?` + `[pricing-card ×N | bento-tiles]` + `[logo-row | accordion-list]?`
- **FAQ** — `[headline-cluster]` + `[accordion-list]` + `[media-frame]?`
- **CTA** — `[headline-cluster]` + `[body-copy]?` + `[cta-row | form-block]` + `[media-frame]?`
- **Contact** — `[headline-cluster]` + `[form-block]` + `[list-rows | media-frame]?`
- **Team** — `[headline-cluster]` + `[card-grid of media-frame+name]` + `[body-copy]?`
- **Resources** — `[headline-cluster]` + `[card-grid of media-frame+title | carousel]` + `[chip-row]?`
- **Testimonials** — `[headline-cluster]?` + `[quote-card ×N | bento-tiles]` + `[stat-block]?` + `[logo-row]?`

Wherever a `media-frame` slot is filled and no supplied asset exists, it holds a **placeholder** —
never an invented artifact (`rulebooks/creatives.md`).

The same skeleton, filled from three different donors, produces a section that exists in
**none** of the 79 files. That is the unlock.

---

## §C. Composition Grammar (the designer brain — pass/fail)

These are the [README](README.md) design-charter rules turned into a combination
checklist. **A recombination ships only if it clears all twenty-two.**

1. **One surface per band.** The whole section sits on exactly one surface role, never two. Re-skin
   donor blocks onto the chosen role (rule 10). The page holds **one surface** by default; `rest` is
   the raised surface a card sits on, and `contrast` is an **accent surface used as a deliberate
   emphasis moment** — not a rotating cadence. `figure` is dormant, and the dark tier with it.
   **A surface's *material* is not a second surface.** Branded surfaces carry a fixed, shared texture
   treatment that makes them read as printed rather than digital; it is uniform, marks nothing and
   separates nothing, so a treated band still satisfies this rule. It attaches to a surface **by what
   that surface is** — currently the closing CTA banner and creative surfaces — and is never a
   composition choice. *(The rule is `rulebooks/visual-language.md` §1.1; the assets, order, blends
   and opacities live in the brand pack.)*
2. **One focal block.** Exactly one block is FOCAL (largest scale / the single accent).
   Everything else is SUPPORT or AMBIENT. Two focal blocks = the section has no point.
3. **Rhythm from the named roles.** A section opening uses the three **named rhythm roles**, not
   generic steps chosen at the point of use: **opening** (marker → heading), **cluster**
   (heading → supporting copy), **content** (cluster → primary content). Elsewhere, gaps between
   major blocks use the larger steps and gaps within a block the smaller ones. Only scale steps — no
   arbitrary values.
   **The rule is the ORDER, not the numbers: opening > content > cluster, at every viewport.** Equal
   gaps fail this rule even though every value is on the scale — spacing distributed evenly because
   steps exist is the failure, and it is what an unnamed rhythm produces every time. Whitespace is
   part of the communication hierarchy, not leftover room.
   Never compress a section opening, and **never collapse a section because its content is short** —
   short content produces a calm, open composition, not a shrunken one. *(The measures live in the
   brand pack.)*
4. **Grid coherence.** Horizontal layout is a **page** concern — owned once and inherited, never
   re-declared per section. Every section aligns to the **canonical content well** by wrapping its
   content in the single page-composition primitive (`.cr-well` in the brand pack); a section does
   **not** set its own content width, **page gutter**, or outer container (`SECTION_LAYOUT.md` §16
   forbids it — that is Foundation execution). The only two exceptions are the **narrow reading
   well** (`.cr-well--narrow`, for FAQ / editorial sections) and a **deliberately-marked
   full-bleed** — content omits the well and runs edge to edge, with intent (marquee,
   divider). Never introduce a second page-level container. *(The well widths and gutter live in
   the brand pack; the gutter is responsive there — centralized on the primitive, not per section.)*

   **Edges that share a role are held to 1px.** `VISUAL_LANGUAGE.md` §27.15 makes execution precision
   a condition of perception and defers the tolerance here: within a section, blocks at the same
   structural level share a common leading edge, and a drift beyond a single pixel is a defect rather
   than a rounding artifact. Sub-pixel drift from a fractional layout is not a violation; a block that
   sets its own inset is. *(This is the measurable half of "what shares a role shares an edge"; the
   obligation is upstream and names no value.)*

   **Content width is governed independently of layout width, and there are four widths, not one.**
   *Container* frames the page. *Layout* is the licence to occupy that full container, granted only to
   components that genuinely require it — comparison tables, dashboards, card grids, feature matrices,
   and a creative that leads its section. *Title measure* holds headlines, hero messaging, CTA
   headlines and large editorial statements. *Body measure* holds paragraphs, supporting copy,
   descriptions and CTA copy.
   **Editorial content never inherits layout width**, and never expands merely because horizontal
   space exists. Headlines and supporting copy intentionally occupy **different** measures — that
   transition is the section's visual hierarchy, not an inconsistency to tidy up.

   **There are exactly TWO text measures, and they share a default — DR-14, DR-15.** Title and body
   both take the narrow value. The wide value is a **release valve** a title reaches for *because the
   type wrapped to a third line*, and for no other reason; a cap at any other value is a third width.
   The body measure used to be a *band* a composition selected within, which is how a third value
   survived; it is a single cap now. Neither a section nor a component chooses a text width — it
   chooses which of the two roles its content is, and whether the valve is warranted.

   **The title→body narrowing is no longer a hierarchy mechanism.** It cannot be, with both at one
   default. Hierarchy comes from scale, weight and space (§C.17's focal exclusivity, and the rhythm
   roles) — the mechanisms this grammar already leans on everywhere else.
   *(Both values live in the brand pack. The harness checks every rendered cap against them, and
   checks the valve: a title held wide while rendering in fewer than three lines fails, because the
   trigger cannot be expressed in CSS but can be measured on the render.)*
5. **Accent budget ≤20%, ONE DOMINANT accent, and at most THREE accent moments per section.**
   Across the *whole* section, accent covers ~one-fifth at most; one accent word in the headline max.
   The palette carries several accents; a section picks **one to lead** and every other accent
   present is subordinate to it. No off-palette near-hues. An accent used as a **surface** must take
   its recorded paired foreground; an accent used as **text** must be one the palette clears for
   text. *(The accents, their pairings, and which clear for text live in the brand pack.)*

   **The count is not the budget, and neither substitutes for the other.** ≤20% governs *area*; the
   count governs *occurrence*. Orange → orange → purple → green → blue down one section clears the
   budget comfortably — each mark is tiny — and is exactly the scattering this rule exists to stop.
   Conversely three moments in one accent covering a third of the band fails the budget while
   satisfying the count. *(`DECISION-REGISTER.md` DR-1 was open on precisely the gap between them:
   a deliberate multi-surface set — a metric row in white, blue and purple — is three moments with
   one dominant, and legitimate; the rule that could not tell it apart from scattering was a rule
   stated without a count.)*

   **The area budget has exactly one exemption, and it must be declared.** A section that *is* an
   accent surface — a full-bleed accent band, at the page's end or as a deliberate immersive moment —
   is exempt from ≤20% by construction: it is almost entirely chromatic and that is the point. The
   exemption belongs to a section that **declares itself** an accent surface; it never applies because
   a section happened to exceed the budget. An exemption that applies silently is not an exemption, it
   is a hole. The count, the dominance rule and the pairing rules all continue to apply inside such a
   band.

   **And the budget has a floor as well as a ceiling.** A page on which colour never lands anywhere
   satisfies every ceiling in this rule and has failed the grammar completely. At least one accent
   moment exists somewhere across the page. *(A ceiling with no floor drifts to grey and reports itself
   compliant — `foundation/COLOUR.md` §16.)*

   **Colour roles are assignments, not suggestions.** Each accent has jobs it may do and jobs it may
   not; orange in particular is **never a large surface, a card fill or a page background** — it is a
   marker, a corner, a floating icon, a small highlight, a micro-interaction.
   *(The role table lives in `foundation/COLOUR.md`; the values live in the brand pack.)*

   **Colour never establishes a component's identity.** A component is what its semantic role,
   hierarchy and interaction make it — never what it is filled with. Colour reinforces hierarchy; it
   never creates it. This is why the button tiers below are defined without reference to a hue, and why
   an emphasis fill is a *variant* of a tier rather than a tier of its own.
   **Action tiers are semantic — the primary action is not a colour.** A component is what its
   semantic role, hierarchy and interaction make it, so the tiers are defined without reference to a
   hue:

   | Tier | Form |
   |---|---|
   | **Primary** | the high-contrast dark pill — the default for the highest-priority action |
   | **Primary, emphasis variant** | an emphasis-accent fill with its recorded paired foreground |
   | **Secondary** | neutral outline |
   | **Tertiary** | text only |

   **The emphasis variant is bounded, and the bound is not optional.** At most **one** emphasis-filled
   action per page, and only where it *is* that page's highest-priority action. Anywhere else, the dark
   pill. Without the bound, an emphasis fill becomes the default primary by drift — every page has a
   most-important action, so a permission with no limit is a redesign of the button rather than a
   variant of it. This is also why the variant sits under a tier instead of being a tier: an emphasis
   fill changes how loudly the primary action speaks, never *which* action is primary.

   That narrows exactly one clause of the orange rule above — a single small filled control is not "a
   large surface" — and leaves the rest standing: no accent band, no accent card fill, no accent page
   background. *(`DECISION-REGISTER.md` DR-25 records the reversal and its scope. The fill and its
   paired foreground are brand-pack values; the harness counts emphasis-filled actions per page.)*

   **Every section declares its own background.** Background selection is a decision, not an
   inheritance — a section never acquires a surface by accident. The page ground exists only beneath
   sections that have not declared otherwise, and a section with no declaration is a section nobody
   decided. *(The surface tokens and the default page ground are brand-pack values.)*

   **A dark section is one of those declarations, and it is rationed.** Dark is a compositional device,
   not a theme: permitted for a hero, a closing band, a footer, an immersive or full-bleed media
   moment, a product reveal or a narrative transition — and **at most two per page**. Never for general
   content, forms, long-form reading, or as section-to-section alternation. *(See
   `rulebooks/visual-language.md` §15.)*
6. **No depth.** Separation comes from whitespace, typography, scale, alignment, fills and hairline
   rules — and from nothing else. **No shadow, no glass, no backdrop blur, no glow, no depth
   simulation.** The brand pack retains deprecated elevation tokens so nothing breaks; referencing
   them fails this rule rather than satisfying it. *(The hairline and stroke values live in the
   brand pack.)*
7. **One display tier.** A section has one headline size from the ramp; smaller ramp steps
   *frame* it (eyebrow, caption) — they don't compete. Don't stack two adjacent ramp steps as
   co-equal headlines.
8. **One sanctioned icon set only**, at the matching stroke weight for each icon size. No emoji,
   no custom glyphs. Only sanctioned unicode is `→` in CTA labels. *(The icon family and its
   size→stroke pairings live in the brand pack.)*
9. **Hover only on real controls.** Buttons, links, tabs, accordions, sliders react.
   Static cards and informational blocks never do.
10. **Donor lift — what a donor actually donates.** A donor gives you **structural composition,
    information hierarchy and semantic intent**. That is the whole list.
    **Everything visual comes from current governance, never from the donor**: spacing and rhythm,
    marker placement, CTA layout, component styling, colour, surface, radius, depth, type families,
    visual balance, imagery treatment and creative placement.
    "Lift the structure, not the skin" was too generous a boundary — *structure* was read to include
    the donor's spacing, its centred closing band and where it put its creative, and those are
    precisely the decisions the current direction replaced. **Treat every donor as a structural
    reference, never a visual exemplar.** The job is not to recreate it; it is to author the section
    as though it had been designed today.
    Never carry a donor's `contrast` surface into a `base` section, or its voice/copy across.
    *(The type families live in the brand pack.)*

11. **Creative-First Composition.** A creative's **proportion, presence and placement are decided
    before the surrounding layout** — never fitted to the space left over. Proportion comes from the
    four approved ratios; presence from the approved shares; placement from the approved anchors.
    An invented ratio, a hand-picked width, or an ad-hoc arrangement fails this rule.
    **Layout adapts to the creative; the creative never adapts to available space** — if a layout
    cannot accommodate an approved ratio, the layout changes. A placeholder carries the same three
    properties as the creative it reserves. *(The vocabularies live in `rulebooks/creatives.md`; the
    values in the brand pack.)*

12. **A section is composed, not filled — and this binds heroes and closing bands too.**
    The section establishes its own spatial rhythm and the content *inhabits* it. Content occupies an
    editorial portion, not the full width. **The composition is intentional, and the two differ:** a
    hero is asymmetric because it points somewhere; a closing band is **centred**, with equal vertical
    padding, because the page is over and everything converges on one ask. The failure named here was
    never centring — it was the **slack rectangle**, content adrift in a tall box with nobody owning
    the space, and that is answered by the band's tight proportion. The marker BRACKETS the section — one at the opening, one at the
    close, both the same colour. A section either takes the bracket or takes no marker at all;
    half a bracket opens something it never closes. Colour priority: orange, then blue, then the
    remaining accents.
    **Surface first:** a large branded surface reads as an **environment** before it reads as a
    layout. Background treatment establishes atmosphere, typography establishes hierarchy, components
    occupy the environment. **Never reverse that order** — and surface treatment stays secondary to
    typography, which carries the section's hierarchy.
    A closing band that is a centred text block inside a coloured rectangle fails this rule.

13. **A delivered creative is SELECTED from the approved library — never sourced, generated or
    modified.** Environmental imagery comes from the canonical Brand Pack library and nowhere else:
    not a stock source, not a generated stand-in, not another file in the repository because nothing
    in the library quite fit. Selection is by **name**, never by path — a URL at a call site can
    point anywhere, and every such value looks legitimate.
    **Never distort to meet a ratio.** A real asset rarely arrives at an approved proportion, so it
    is **cropped at a governed focus**, and the focus travels with the asset rather than being
    re-picked per section. If no crop survives the ratio the composition needs, choose another asset
    or change the layout — never invent a proportion, and never stretch.
    **The asset is never treated in place.** Atmosphere is built above an untouched image, by the
    system.
    **And a text surface keeps the contrast measurement it replaces** — putting a photograph behind
    copy that was measured against flat colour is a legibility failure this rule catches, not a
    styling preference. *(The library, the focus values and the measurement live in
    `brand-pack/ASSETS.md`; the doctrine in `rulebooks/creatives.md`.)*

14. **The decisive margin — dominance is measured, not asserted.** `SECTION_LAYOUT.md` §7/§12 and
    `VISUAL_LANGUAGE.md` §8 all require dominance to be **decisive, not marginal**; that is an
    obligation with no number, and an obligation with no number is satisfied by a 51/49 split. **The
    floor is 1.5×: the FOCAL block occupies at least one and a half times the composed area of the
    largest non-focal block in its section.** Below that the section has a ranking, not a focal
    point, and §C.2 is met in letter only.
    **It applies to every element, not to type** — a creative, a matrix, a stat block or a headline
    cluster can each be the focal block, and the margin is read the same way for all of them.
    Two exemptions, both structural rather than convenient: a **`distributed`** composition
    (`SECTION_LAYOUT.md` §13) is a field of comparable parts *by declaration* — there the FOCAL
    block is the structure itself (the sequence, the matrix), and the margin is measured against
    the largest block **outside** that structure, never between its own steps or columns; and a
    section whose archetype declares **no creative** measures the margin among its remaining blocks.
    *(The obligation lives upstream; only the floor is here. A section that cannot reach the floor
    has too many competing parts — the answer is omission, not a smaller margin.)*

15. **The six declarations are present, and Hierarchy and Intent are declared rather than inferred.**
    A section states its hierarchy, intent, archetype, register, signature and density before it
    composes (§A2.1). Four of the six can be read back off a render; **hierarchy and intent cannot**,
    because they are claims about the page's argument rather than properties of its geometry. A
    section missing either is not a modest section, it is an unowned one.
    *(A missing declaration records as `None` and fails. It must never default to a value — a default
    inside a predicate reports a choice nobody made, and the check then reads as passing forever.)*

16. **Every section serves a beat of the page's declared narrative arc.**
    `PAGE_STRUCTURE.md` §5.1 requires the page to declare its arc before selecting anything. A
    section that serves no beat does not belong on the page, however well composed it is. This is the
    only rule that can remove a section which is individually defensible — objectives (§9 there) test
    whether a unit contributes, never whether the page needs the contribution.

17. **Focal exclusivity — typography and imagery never both lead.**
    §C.2 requires exactly one FOCAL block; this names the case that keeps slipping past it. **If
    typography is dominant, imagery is supporting; if imagery is dominant, typography is supporting.
    Never two primary focal objects.** A large headline beside a large image satisfies "one FOCAL
    block" on a technicality — one of them is tagged FOCAL — while reading as two centres competing,
    which is the perceptual failure `VISUAL_LANGUAGE.md` §8 names as Weak Dominance.
    **A dominant visual anchor holds 55–75% of the composition.** Below 55% it is not leading;
    above 75% there is no composition left for it to lead, only a full-bleed creative — which is a
    different archetype (`immersive-landscape`), not a larger version of this one.
    *(Measured against the composition, never against the creative's own container — that reference
    is the whole point, and `foundation/ILLUSTRATION.md` records what happens when it slips.)*

18. **No more than four competing information groups per section.**
    Prefer fewer, stronger elements. A section's declared density (`low` · `medium` · `high`) says how
    concentrated it is *meant* to be; this says what it may not exceed regardless. A `high`-density
    section is four groups composed tightly, never five composed loosely.
    *(This is the countable half of `design-charter.md`'s "dashboard effect" and of §C.14's decisive
    margin: a section that cannot reach the 1.5× floor usually fails this rule first, and the answer
    to both is omission.)*

19. **Cards are differentiated unless comparison is the point.**
    **Cards never appear as a perfectly identical repeated grid unless the section's archetype is
    `feature-comparison`**, where parallel structure *is* the message. Everywhere else they carry
    differentiated behavioural intent — large / small / accent / neutral — rather than 1 · 1 · 1 · 1.
    *(This reverses the standing "card stacks lay out as equal N-up rows"; see `DECISION-REGISTER.md`
    DR-9. It was already half-enforced by accident: §C.14's focal margin fails a three-equal-card grid
    unless the section declares `distributed`, so the rule and the grammar were in tension and the
    grammar was quietly winning.)*

20. **A CTA concludes a composition; it never interrupts one.**
    A call to action is placed where narrative momentum turns into action — **never inserted because
    a section happens to contain information**. Its placement follows its kind: a **closing** CTA is
    centred, a **section** CTA aligns with the composition it closes, a **supporting** CTA is embedded
    inside the content it belongs to, and a **hero** CTA sits with the narrative rather than after it.
    *(This is also where the centred closing band stops being an exception to §C.12's asymmetry and
    becomes a rule: centring is the shape of convergence, and convergence is what a closing CTA is.)*

21. **The composition survives collapse.**
    Every rule in this section is evaluated at every viewport, not only at the widest. A composition
    that holds at 1440 and dissolves at 390 was composed once, for one screen. Specifically: the
    **dominant anchor stays dominant** (its share is a share of the composition at every width), the
    **narrative order never changes**, the **hero keeps its breathing room**, **large photography never
    becomes a thumbnail**, and **differentiated cards do not flatten into a repeated stack**.
    *(Responsiveness was previously implied rather than governed — the harness rendered three
    viewports and asserted almost nothing about composition across them.)*

22. **Generation is complete only after editing.**
    A composed section is not finished; it is a draft. Before it ships, remove anything that does not
    strengthen communication — **prefer subtraction over addition**. Duplicate cards, duplicate
    headings, duplicate colours, duplicate accents, duplicate layouts and duplicate icons are removed
    rather than balanced. **If removing an element improves hierarchy, remove it.**
    Then answer the finalisation questions: does the section have one dominant focal point · is every
    component necessary · does it read as art-directed rather than assembled · would removing one
    component improve clarity · is the whitespace intentional · is there a memorable moment. **If any
    answer is no, the composition is regenerated, not patched.**
    *(This is the rule that makes the other twenty-one consequential. Without a regenerate trigger a
    failed composition still ships, and every check above becomes a report rather than a gate. A
    finished page should feel inevitable rather than assembled.)*

---

## §C2. Order of decision (what is settled before what)

Every rule above assumes the one above it is already answered. Read top-down, this is the order a
section is composed in — and the reason the list has this shape is that each step **constrains** the
next, so taking them out of order means improvising a decision that was about to be made for you.

```
Creative Direction                     what this website IS
        ↓
Narrative Arc                          the shape the page's progression must make      (PAGE_STRUCTURE §5.1)
        ↓
Section Declaration                    hierarchy · intent · archetype ·                (§A2.1)
                                       register · signature · density
        ↓
Creative-First Composition             the creative is settled BEFORE the layout       (§C.11)
        ↓
Composition Grammar                    the pass/fail rules the assembly must clear     (§C)
        ↓
Creative Vocabulary                    proportion · presence · placement
        ↓
Select from the approved library       WHICH approved asset, and why this one          (§C.13)
        ↓
Brand Pack                             the values that realize all of the above
        ↓
Compose the section
        ↓
EDIT                                   remove what does not strengthen it              (§C.22)
        ↓
Render
```

**Two steps were added on 2026-07-29, one at each end, and both change the shape of the pipeline
rather than adding a constraint inside it.**

The **arc** goes above everything because the chain previously began at the section: a page could
compose ten faultless sections and have no account of what they added up to. Sections are now
*selected to serve the arc*, which is what lets a page say why a section is there — and, harder,
why one is not.

The **edit** goes below `compose` because until it existed, generation ended at assembly. Every rule
in §C could pass on a section carrying one component too many, because no step in this chain was
responsible for taking anything away. Designers do not only create; they remove. A pipeline whose
last act is `compose` produces pages that are complete and unresolved — everything justified,
nothing subtracted. **Prefer subtraction over addition** is not a stylistic preference here; it is
the phase that was missing.

*Note that `EDIT` follows `compose` and precedes `render`, which means it operates on a composed
section and not on a plan. Editing an outline removes intentions; editing a composition removes
elements, which is the only place the question "does removing this improve the hierarchy?" has an
observable answer.*

**Imagery is an input to composition, not a decoration applied after it.** A section laid out first
and photographed second is the failure mode: it produces a slot of leftover space, and then an image
stretched to fill it. That is Creative-First Composition read backwards.

---

## §D. Focal-weight model (what "20 / 30 / 50" actually means)

A designer doesn't split a section into equal thirds — they allocate **visual weight**.
Every block gets one of three weights:

| Weight | Role | Gets | Typical blocks |
| --- | --- | --- | --- |
| **FOCAL** | carries the section's one argument | largest scale, the single accent, most area | one `bento-tiles` / `stat-block` / `media-frame` / `card-grid` / `comparison-matrix` |
| **SUPPORT** | substantiates the focal | medium scale, neutral fill | `stat-row`, secondary `card-grid`, `quote-card`, `list-rows` |
| **AMBIENT** | frames / nudges / closes | small, quiet, edges of the eye-path | `headline-cluster` (often), `logo-row`, `chip-row`, `cta-row`, `divider` |

Read the user's "**20% bento / 30% features / 50% testimonial**" as: *which donor supplies
the FOCAL block, and roughly how the remaining area splits between SUPPORT and AMBIENT* —
e.g. testimonial as the SUPPORT mass, a feature card-grid as a second SUPPORT, a single
bento tile as the FOCAL accent. Enforced by grammar rule 2 (exactly one FOCAL).

---

## §E. Worked recipes (proof it composes)

Each recipe assembles a section from **multiple donor components**, maps every block to its
donor + file, sets the focal-weight, and passes the §C grammar.

### Recipe 1 — "Feature, mixed" (the acceptance case — 4 donors)
**Intent:** Feature showcase. **Surface:** `rest`.

| Slot | Block | Weight | Donor (copy from) |
| --- | --- | --- | --- |
| intro | `headline-cluster` | AMBIENT | `feature-trio` → `preview/component-feature-trio.html` |
| proof | `bento-tiles` (3 mixed tiles) | **FOCAL** | `feature-bento` → `preview/component-feature-bento.html` |
| highlight | `stat-block` (one big count-up) | SUPPORT | `stat-cards` → `preview/component-stat-cards.html` |
| nudge | `quote-card` (portrait + 1-line quote) | SUPPORT | `testimonial-stack` → `preview/component-testimonial-stack.html` |
| close | `cta-row` | AMBIENT | `cta-banner` → `preview/component-cta-banner.html` |

**Grammar pass:** one surface (`rest`) ✓ · one FOCAL (bento) ✓ · the major-gap rhythm step
between blocks ✓ · content well honoured ✓ · accent only on the bento's one metric + the CTA ≤20% ✓ ·
restrained depth ✓ · single display tier (the section-head step) ✓ · sanctioned icon set ✓ · hover on CTA only ✓
· stat/quote re-skinned from `contrast` → `rest` (rule 10) ✓.
→ A feature section that exists in none of the 79 files, drawn from **4 donors**.

### Recipe 2 — "Outcome close" (3 donors, contrast)
**Intent:** Stats/outcomes → closing. **Surface:** `contrast`.

| Slot | Block | Weight | Donor |
| --- | --- | --- | --- |
| head | `headline-cluster` (inverse) | AMBIENT | `cta-band` → `preview/component-cta-band.html` |
| proof | `stat-block ×3` (count-up, contrast cards) | **FOCAL** | `stat-cards` → `preview/component-stat-cards.html` |
| meter | `gauge-progress` | SUPPORT | `agent-status` → `preview/component-agent-status.html` |
| close | `cta-row` (primary action) | AMBIENT | `buttons` → `preview/component-buttons.html` |

**Grammar pass:** single `contrast` surface ✓ · one FOCAL (the stat trio) ✓ · accent = the three
numbers + one action ✓ · no depth ✓ · gauge re-skinned to `contrast` ✓.

### Recipe 3 — "Proof + plans" (3 donors, base)
**Intent:** Comparison/pricing. **Surface:** `base`.

| Slot | Block | Weight | Donor |
| --- | --- | --- | --- |
| head | `headline-cluster` | AMBIENT | `pricing-tabbed` → `preview/component-pricing-tabbed.html` |
| matrix | `comparison-matrix` | **FOCAL** | `compare-table` → `preview/component-compare-table.html` |
| trust | `logo-row` (monochrome) | AMBIENT | `backed-by` → `preview/component-backed-by.html` |

**Grammar pass:** one `base` surface ✓ · FOCAL = the matrix, highlight column the only
accent ✓ · content well honoured ✓ · hairline rows, restrained depth ✓ · logos re-skinned monochrome ✓.

### Recipe 4 — "Story hero" (3 donors, base)
**Intent:** Hero that *shows* proof. **Surface:** `base`.

| Slot | Block | Weight | Donor |
| --- | --- | --- | --- |
| nav | `nav-bar` | AMBIENT | `nav` → `preview/component-nav.html` |
| pitch | `headline-cluster` + `cta-row` | SUPPORT | `hero-actions` → `preview/component-hero-actions.html` |
| show | `media-frame` (placeholder reserving the visual's position) | **FOCAL** | `hero-agent` → `preview/component-hero-agent.html` |
| proof | `logo-row` | AMBIENT | `logo-strip` → `preview/component-logo-strip.html` |

**Grammar pass:** one `base` surface ✓ · FOCAL = the creative panel ✓ · one display tier
(the hero step) ✓ · accent = the CTA + one headline word ✓ · panel re-skinned to the brand
`figure` treatment, no off-palette near-hue ✓.

---

*Selecting whole components instead of assembling? Use [`COMPOSITION.md`](COMPOSITION.md).*
