# COMPOSITION.md — the SELECT layer

> **Resolved (2026-07-29) — the re-tagging project happened.** The note below deferred re-tagging 79
> entries as "a different project". That project is the **Capability profiles** section of this file:
> every one of the 79 now declares what its structure can communicate, in the vocabularies the page's
> own declaration speaks. Two consequences for the note that follows:
> 1. **Surface tags are superseded, not corrected.** What a layout *wants* is now carried by its
>    declared **Registers**, which is the vocabulary that governs felt treatment. The `Surface` column
>    is retained because the runtime still parses it; read it as legacy, and read the register.
> 2. **The dead `preview/` paths are fixed** — every row now points at the real file.
>
> ---
>
> **Drift note — surface tags and the realized catalog (2026-07-28).** Two things in this index have
> partly aged out and were **deliberately not re-tagged**, because re-tagging 79 entries is a
> different project from evolving the language:
> 1. **Surface tags.** The `light` / `ink` / `warm` (and `base` / `rest` / `contrast` / `figure`)
>    affinities assume a rotating multi-surface cadence. The current direction holds the page on
>    **one surface**; `rest` is the raised card surface, `contrast` is a **deliberate accent band**,
>    and `figure` and the dark tier are **dormant**. Read a surface tag as "this layout wants
>    distinct treatment", not as "use this background".
> 2. **The realized files.** Every row points at a component authored in the **previous** visual
>    language. They are valid for **structural composition, information hierarchy and semantic
>    intent** — which composition serves which intent — and for **nothing else**.
>    They are invalid for typography, colour, radius, depth, **spacing and rhythm, marker placement,
>    CTA layout, component styling, visual balance, imagery treatment and creative placement**.
>    "Valid for layout selection" was too broad a licence: *layout* was read to include the donor's
>    spacing, its centred closing band and where it put its creative — all decisions the current
>    direction replaced. **Every row is a structural reference, never a visual exemplar.** See
>    `brand-pack/exemplars/README.md` and `COMPOSE.md` §C rule 10.
>
> *(Pre-existing and also unfixed here: the catalog's paths point at a `preview/` directory that did
> not migrate; the files live in `brand-pack/exemplars/sections/`.)*

**What this is.** The authoritative index for *choosing* section components.
It is organised by **composition**, not by filename. Every component is tagged with the
section **intents it can serve** (the `Serves` column) and the reusable **blocks** it
donates — so "I need a feature section" resolves into *all* the layouts that fit, not
just the files named `component-feature-*`.

## Pick your approach (do this first)

This library is a **catalog / brain** for building landing-page sections — its job is to
justify the brief *with variety*, not to force any one method. Given a section brief,
choose the **simplest mode that satisfies it**, and escalate only when you need to:

1. **Use a section as-is** — a component already matches the brief (its own category or
   another). **Take it from the canonical Section Library, `../../../section-library/sections/<name>.html`**,
   and **edit it in place**: copy · media · icons · numbers · logos · CTA links. Its grid,
   layout, spacing, rhythm, hierarchy, component order and responsive behaviour are **not**
   editable — it is production-ready, and re-skinning it is how a library stops being one.
   *Most sections are this.*
2. **Cross-category pick** — no same-label component fits, but another category's *layout*
   does (e.g. a testimonial 3-col grid as a feature row). Use the **Section Playbook** below.
3. **Compose a new section** — no whole component fits, *or* you want fresh variety. Pull
   blocks from several donors and assemble per **[`COMPOSE.md`](COMPOSE.md)**.

**Rules of thumb:** default down this list (1 → 2 → 3). Composing is **optional, never a
mandate** — reach for a cross-category pick or a creative merge when a long page would
otherwise feel repetitive (variety is a feature), but if a clean as-is section says it
best, use it. The goal is always to serve the landing-page brief, not to mix for its own sake.

**Pick by intent-fit, then rotate among equals (anti-default-collapse).** The mode list above
is *select-vs-compose* — it is **not** a ranking of components, and the `Direction` column
describes *when* each component fits, **not** which one is "the default" (there is none).
1. **Best fit is the hard rule.** Choose the component that best serves *this brief's specific
   angle* — never a worse fit just to be different.
2. **Among equals, rotate.** When ≥2 components fit the intent equally and on-brand, prefer the
   one used **least** recently. Run `node tools/selection-diversity.js` first — it reports what
   recent pages picked per intent — and break the tie toward freshness. *Variety among equals,
   never a worse fit.* This is why the Curation Table's `reason` must say **why the chosen beat
   its top alternate for this brief**, not just cite generic meta (`SKILL.md` rule c).

**How to use it (read this before selecting):**
1. Decide the **section intent** you're building (Hero, Feature, Stats, …).
2. Go to the **Section Playbook** (bottom of this file) for that intent — it lists every
   candidate component across category labels, grouped by layout. (Machine-readable
   equivalent: filter `fragments/manifest.json` by `serves`.)
3. Pick by **layout fit + surface + the `Direction` column**, not by the component's
   filename. `Direction` is the tiebreaker — when to prefer a component, when to avoid
   it, what it pairs with. A component's category is its *origin*, not its only use.
   - **Machine-enforced limits.** A `Direction` cell may end with a `{…}` annotation —
     the *structured*, validator-checked subset of that prose. Keys: `maxPerPage:N`
     (use at most N times on a page), `avoidAdjacent:intent` (don't place next to a band
     serving that intent), `avoidAdjacentSurface:surface` (don't place next to a band of
     that surface), `minBands:N` (only on pages with ≥N total sections). `build-fragments.js`
     parses it into a `limits` object on the manifest; `validate-page.js` enforces it.
     The prose stays the human tiebreaker; the `{…}` is the part a machine can check.
4. **Record the choice in the Curation Table** (defined in `SKILL.md`, "Building a
   page" step 3): per section — intent, ≥2 candidates considered across labels, the
   chosen one, mode (as-is / cross-pick / compose), and a reason citing the meta. The
   table ships as an HTML comment at the top of the built page's `<main>`.
5. To *assemble a new section from fragments* of several components, switch to
   **`COMPOSE.md`** — it has the block library, slot-skeletons, and the composition grammar.

> **Maintenance contract.** When you add a new section to `preview/`: (1) append a row to
> the catalog below; (2) run **`node tools/build-fragments.js`** — it regenerates
> `fragments/` and `fragments/manifest.json` from `preview/` + this catalog, so the new
> component becomes pull-able automatically; (3) optionally list its donated blocks in
> `COMPOSE.md` §A if it should serve as a compose donor. This file (not the README) is the
> single source of truth for catalog *metadata*; `fragments/manifest.json` is generated
> from it and must never be edited by hand.

---

## Layout primitives (controlled vocabulary)

Every component is tagged with one (occasionally two) of these structural primitives.
This is the vocabulary the Playbook and `COMPOSE.md` reason over.

> **These are the LAYOUT tier — geometry, not intent.** They describe what shape a section takes,
> never how it communicates. That decision belongs one level up, to the **Section Composition
> Archetypes** in `COMPOSE.md` §A2 (Editorial Split · Editorial Stack · Text First · Immersive
> Landscape · Media First · Product Showcase · Storytelling Composition · Narrative Flow · Proof
> Layout · Feature Comparison), and it is made **first**: the communication archetype selects the
> layout primitive, never the reverse.
>
> This distinction is not pedantic. A closing call to action tagged `centered-stack` produced exactly
> that — a centred stack — because a geometry tag was left making a communication decision with
> nothing above it. Read a primitive as *"this is the shape that intent took"*, not as *"this is what
> the section should be"*.

| Primitive | Shape |
| --- | --- |
| `two-col-text+creative` | Copy on one side, a decorated / image creative panel on the other |
| `n-up-card-grid` | N equal cards in a row (3-up, 4-up) |
| `asymmetric-bento` | Mixed-size tiles on one grid |
| `accordion+creative` | An accordion list beside a swapping creative panel |
| `sticky-aside+stack` | A sticky numbered nav + scrolling stacked items |
| `tabs+swap-panel` | A tab bar that swaps one panel |
| `carousel/slider` | Auto- or manually-advancing slides |
| `split-row-card` | A wide card with internal columns |
| `table-matrix` | A multi-column comparison / plan grid |
| `centered-stack` | A centered headline + stacked content |
| `marquee` | An infinite horizontal logo/track scroll |
| `split-panel-form` | A form on one side, copy/creative on the other |
| `link-columns` | A multi-column link grid (footers) |
| `atom` | A standalone small piece (button, nav, divider) — not a full section |

**Surfaces (by role — values live in the brand pack):** `base` (the default page surface) · `rest` (a quieter
alternate surface for low-drama bands) · `contrast` (the inverted high-contrast surface for proof or closing beats) ·
`figure` (a decorated / imaged panel surface). One surface per band (see grammar in `COMPOSE.md`). *Which colours,
surfaces, and panel treatment each role resolves to — and any hue the palette reserves elsewhere — live in the
brand pack, paired with their why.*

**Interactions:** `static` · `reveal-only` (entrance fade only) · `accordion` · `tabs` ·
`carousel` · `slider` · `count-up` · `toggle` · `sticky-scroll` · `marquee` · `form` · `modal`.

---

## How a section is described (the five properties)

The primitives above are the geometry tier. **Five properties describe a section completely**, and
they are what the Layout Index and the Interaction Index are built from (DR-35 · DR-36 · DR-37):

| Property | What it says | Example |
|---|---|---|
| **Structure** | the main layout pattern — one of the 14 above | Grid |
| **Arrangement** | the specific version of that layout | `three-column-equal` |
| **Interaction** | what it does when used | `static` |
| **Reuse** | can it be reached for outside its original job | `reusable` |
| **Tags** | further architectural characteristics, for retrieval | `cards` · `icons` · `editorial` |

> **The description is authoritative** (DR-44). The business headings below exist for human browsing;
> the filename exists for identity; the description exists for retrieval. **Where any two disagree,
> the description is the source of truth, and a filename is derived from the description — never the
> reverse.**

**Three rules bound the vocabulary.**

1. **One field, one concept.** Arrangement is a *single canonical value* from its Structure's list —
   composite where the concept is composite (`three-column-equal`, never `three-column` plus a
   separate `equal`). Anything that is not *the version of the layout* is a Tag.
2. **A Tag must say something Structure, Arrangement and Interaction do not already say.** This
   excludes `carousel`, `sticky` and `scroll` — each is already a Structure **and** an Interaction,
   and the search behind them is answered by the Interaction Index. It admits `timeline` and
   `metrics`, which nothing else here can say.
3. **A value exists because the audit found sections it separates — never because it sounded useful.
   A new Structure, Arrangement or Tag is introduced only when the existing vocabulary cannot
   accurately describe a measured implementation** (DR-45).

### Structure — display names

Each of the 14 primitives carries a plain display name. The mapping is **one-to-one and lives only
here**; the engine vocabulary is unchanged, and the display name is a label on it, never a second
vocabulary.

| Shown as | Primitive | | Shown as | Primitive |
|---|---|---|---|---|
| Split Layout | `two-col-text+creative` | | Comparison Table | `table-matrix` |
| Grid | `n-up-card-grid` | | Centered Stack | `centered-stack` |
| Bento | `asymmetric-bento` | | Wide Card | `split-row-card` |
| Carousel | `carousel/slider` | | Form Split | `split-panel-form` |
| Accordion | `accordion+creative` | | Link Columns | `link-columns` |
| Tabs | `tabs+swap-panel` | | Marquee | `marquee` |
| Sticky Sidebar | `sticky-aside+stack` | | Atom | `atom` |

### Arrangement — per Structure

An arrangement legal for a Grid is meaningless for a Marquee, so the vocabulary is **owned by its
Structure**. Every value below separates at least two sections in the library.

| Structure | Arrangement values |
|---|---|
| Grid | `three-column-equal` · `four-column-equal` · `five-column-equal` · `four-column-unequal` |
| Split Layout | `balanced` · `asymmetric` |
| Bento | `feature-dominant` |
| Carousel | `cards` · `full-width` · `panels` |
| Sticky Sidebar | `sidebar-left` |
| Accordion | `panel-right` |
| Tabs | `panel-right` · `panel-below` |
| Comparison Table | `column-matrix` |
| Wide Card | `internal-columns` |
| Form Split | `balanced` · `asymmetric` |
| Link Columns | `four-column` · `five-column` · `inline-row` |
| Centered Stack | `single-column` |
| Marquee | `single-row` |
| Atom | `—` (an atom is not a composed field) |

> **Every value above is in use.** Six seeded values were dropped because the audit found no section
> they separate — `two-column-equal`, `three-column-unequal`, `even-tile`, `sidebar-right`,
> `panel-left`, `list-only`. That is rule 3 doing its job on this pass's own proposals: a value with
> nothing to distinguish is a value that will be reached for by feel. A `sidebar-right` layout ships
> the day one is authored, not before.

**Which grid decides the Structure** (DR-41): where a section carries two grids — and most do — **the
one holding the repeated content is the Structure**; where nothing repeats, the outermost division is.
An intro headline-and-sub above a body grid is near-universal, so it separates nothing and is recorded
as the Tag `intro-split` or `intro-stacked`, never as the Structure and never as the Arrangement.

### Tags

| Group | Values |
|---|---|
| content | `cards` · `metrics` · `portraits` · `logos` · `screenshot` · `quote` · `timeline` |
| visual | `bordered` · `full-bleed` · `dark-band` · `icon-led` |
| composition | `intro-split` · `pinned` |
| responsive | `stack-on-mobile` · `reflow-to-scroll` |

> **`editorial` was proposed and dropped.** No measured signal separates sections by it — every
> section in this library is editorial in tone, so the tag would have been true of all 79 and
> therefore useful for none. `chips`, `filled`, `intro-stacked` and `nested-grid` went the same way.
> A tag that cannot fail to apply is the retrieval equivalent of a check that cannot fail.

### Reuse

`reusable` · `purpose-bound`. A section is **purpose-bound** when its *behaviour or its position* is
its purpose — navigation, footers, forms and contact, disclosure sets, modals, and heroes, which open
the page by definition (*"Placement is derived from Role"*, below). Everything else is `reusable`, and
only a `reusable` section is ever a rename candidate.

The test is deliberately **not** "contains a `<nav>`": the exemplars carry page chrome for preview
purposes, and `<nav>` appears in `cta-band`, `sticky-sidebar-left-full-bleed` and `sticky-sidebar-left`, where it says nothing
about reuse.

### Naming a new specimen

A section authored under the current creative direction takes its filename **from its description**
(DR-42 · DR-43):

```
<structure>-<arrangement>[-<distinguishing term>]

grid-three-column-equal      split-asymmetric      carousel-cards
grid-four-column-equal       centered-stack        sticky-sidebar-left
```

Two terms are not always unique — `grid-four-column-equal-cards` and `grid-four-column-equal` both measure `repeat(4, 1fr)`. A
**third position** breaks the tie, taken in a fixed order so the result is deterministic:

```
Structure → Arrangement → still tied?
    1. content pattern    cards · metrics · portraits · logos
    2. visual pattern     editorial · bordered · filled
    3. interaction        accordion · carousel · sticky
  → still tied? duplication finding, never a -01 suffix
```

**The term must be one the rival does not also carry** — a term two tied sections share
distinguishes nothing. Where a section has no unshared term, it takes the **unmarked form**: the bare
`<structure>-<arrangement>`. So `grid-four-column-equal-cards` and `grid-four-column-equal` both measure `repeat(4, 1fr)`, and the
one that also has `cards` takes `grid-four-column-equal-cards` while the other takes
`grid-four-column-equal`. If *both* are unmarked, that is the duplication finding.

**A name never repeats a word.** `Sticky Sidebar` + `sidebar-left` is `sticky-sidebar-left`, not
`sticky-sidebar-sidebar-left`. Tokens already present are dropped, comparing singular forms so
`column` and `columns` count as one word.

Interaction is admissible as a filename term even though it may not be a Tag: a Tag may not repeat
Interaction because the profile already declares it, while a filename may borrow it because a
filename is an identifier, not a description.

**Style, fixed so names do not drift:** lowercase kebab-case · **complete words, never abbreviations**
(`grid-three-column`, not `grid-3col`) · singular nouns · no business, industry or page terminology ·
terms always in grammar order.

**Frozen sections keep their identities.** Renaming them is a migration this library declines (DR-40);
a frozen section is renamed only where its name **factually contradicts** its implementation.

### Who the grammar binds

> **The grammar above governs the specimens the modernization program authors. A frozen identity is
> outside its population, not failing it.**

The gate needs that population declared rather than inferred, because inferring it from *"does this
name conform"* would let a misnamed specimen escape by being misnamed — the negative control would
pass for the wrong reason. So the population is this list, and a section admitted under the lifecycle
rule (`section-library/README.md`) joins it in the same edit that adds its catalog row:

`accordion-panel-right` · `carousel-cards` · `grid-five-column-equal` · `grid-four-column-equal` ·
`grid-four-column-equal-cards` · `split-layout-asymmetric` · `sticky-sidebar-left` ·
`sticky-sidebar-left-full-bleed` · `tabs-panel-below` · `wide-card-internal-columns`

These ten are also in the **Former names** table below, and the two lists answer different questions
and must not be merged: that table records **what a section used to be called**, so historical
references still resolve; this one records **which names the grammar is entitled to judge**. A section
authored fresh under the grammar belongs here and has no former name at all.

*(DR-56. Before it, the gate applied the grammar to all 79 files and reported 69 findings — every
frozen identity the paragraph above exempts, and the only failing gate in the file.)*

### Former names

Ten specimens were renamed in the v2 → v3 modernization. **The v3 name is the identity.** The former
names are recorded here — not as aliases the resolver silently accepts, but so that pages, usage
records and cross-references written before the rename remain traceable to the section they used.

| Former name | Canonical name |
|---|---|
| `backed-by` | `grid-five-column-equal` |
| `case-carousel` | `carousel-cards` |
| `feature-accordion` | `accordion-panel-right` |
| `how-it-works` | `sticky-sidebar-left-full-bleed` |
| `stat-cards` | `grid-four-column-equal-cards` |
| `sticky-cards` | `sticky-sidebar-left` |
| `tabbed-showcase` | `tabs-panel-below` |
| `testimonial-stack` | `wide-card-internal-columns` |
| `value-prop` | `grid-four-column-equal` |
| `value-stats` | `split-layout-asymmetric` |

A former name does **not** resolve. Retrieval fails loudly on it, because a silent alias is how two
vocabularies survive in one system — which is the failure this table exists to close, not to reopen.

Note that `value-prop` is *also* a capability term (below) and remains one. The retired entry here is
the **section** formerly called `value-prop`; the capability of that name is untouched.

### The capability vocabulary (closed)

> **The capability vocabulary is owned by the Website Design System and evolves only through
> governance changes.**

A section's capability is the communication work it performs, never the shape it takes — the shape is
`Layout`. `Serves` draws only from this closed set:

`cta` · `comparison` · `contact` · `faq` · `feature` · `footer` · `hero` · `integrations` · `logos` ·
`nav` · `outcomes` · `pricing` · `process` · `resources` · `social-proof` · `stats` · `team` ·
`testimonials` · `transition` · `value-prop`

Adding a term is a governance decision, not an authoring convenience: without that rule
`problem-statement` · `problem` · `pain` · `pain-point` · `challenge` all arrive as separate
capabilities and selection can no longer tell duplicates apart. Qualifying prose belongs in
`Direction`, never in a `Serves` cell.

---

## Component catalog (all 79)

`Serves` is **generous by layout** — it lists intents the structure can carry, not just
the component's current copy. `Blocks` are the molecules a designer can lift out (defined
in `COMPOSE.md`). `Cat`: `section` = a full marketing band; `atom` = a standalone piece.

### Heroes

| Component | File | Cat | Layout | Surface | Interaction | Serves | Blocks | Direction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hero · bento | `../../../section-library/sections/hero-bento.html` | section | centered-stack, asymmetric-bento | base | reveal-only | hero, feature, logos, cta | nav-bar, chip-row, headline-cluster, body-copy, cta-row, logo-row, bento-tiles, media-frame | Product hero with a feature-tile bento; pick when you have 4+ real tiles to show. Reach for hero-lending (calm cards-under-hero), hero-actions (product toggle), or hero-agent (chat demo) when the story differs |
| Hero · lending | `../../../section-library/sections/hero-lending.html` | section | centered-stack, n-up-card-grid | base | reveal-only | hero, feature, logos, integrations | nav-bar, chip-row, headline-cluster, body-copy, cta-row, media-frame, logo-row | Calm credibility hero; pick when cards-under-hero proof beats a bento |
| Hero · AI Actions | `../../../section-library/sections/hero-actions.html` | section | two-col-text+creative | base | static, toggle | hero, feature, logos | nav-bar, headline-cluster, body-copy, cta-row, media-frame, toggle-control, logo-row | Hero that demos a product state toggle; needs a real screenshot |
| Hero · agent (chat demo) | `../../../section-library/sections/hero-agent.html` | section | two-col-text+creative, tabs+swap-panel | base | form, tabs, reveal-only | hero, feature, contact | nav-bar, headline-cluster, body-copy, form-block, media-frame, tab-bar | Conversational/AI hero with intent-capture form; avoid without a live-demo story |

### Features / value-prop

| Component | File | Cat | Layout | Surface | Interaction | Serves | Blocks | Direction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Feature trio | `../../../section-library/sections/feature-trio.html` | section | n-up-card-grid, two-col-text+creative | base | reveal-only | feature, value-prop, outcomes | headline-cluster, body-copy, card-grid, divider | 3-up equal cards for three peer items at a glance; reach for feature-bento (unequal/one tile dominates), stat-cards (capability-as-metric), or more-solutions (two-up) when items aren't peers {maxPerPage:1} |
| Feature bento | `../../../section-library/sections/feature-bento.html` | section | asymmetric-bento | base | reveal-only | feature, stats, integrations, value-prop | headline-cluster, bento-tiles, stat-block | Feature+stat hybrid; avoid adjacent to stat bands (numeric overload) {avoidAdjacent:stats} |
| Feature accordion | `../../../section-library/sections/accordion-panel-right.html` | section | accordion+creative | base | accordion | feature, faq, process, value-prop | headline-cluster, accordion-list, media-frame | Pick for 4–6 progressive details; interactive; avoid above the fold |
| Feature stack (pinned deck) | `../../../section-library/sections/feature-stack.html` | section | accordion+creative, two-col-text+creative | base | sticky-scroll | feature, value-prop | headline-cluster, body-copy, cta-row, media-frame | Cinematic pinned deck; long pages only; heavy motion — one per page {maxPerPage:1; minBands:5} |
| Feature steps (switcher) | `../../../section-library/sections/feature-steps.html` | section | tabs+swap-panel, accordion+creative | rest | tabs | feature, process, faq, value-prop | headline-cluster, body-copy, chip-row, step-rail, accordion-list, media-frame, cta-row | Step-by-step switcher; pick when the features ARE a sequence |
| Tabbed product showcase | `../../../section-library/sections/tabs-panel-below.html` | section | tabs+swap-panel, two-col-text+creative | base | tabs | feature, integrations, process, value-prop | tab-bar, headline-cluster, body-copy, media-frame, cta-row | 3–5 parallel use-cases shown one panel at a time; needs screenshots |
| Sticky cards | `../../../section-library/sections/sticky-sidebar-left.html` | section | sticky-aside+stack | base | sticky-scroll, reveal-only | process, feature, outcomes, value-prop | headline-cluster, step-rail, body-copy, media-frame, list-rows | Process-like feature walk; long-form storytelling; avoid on short pages {minBands:5} |
| More solutions (2-up) | `../../../section-library/sections/more-solutions.html` | section | two-col-text+creative, split-row-card | base | reveal-only | feature, value-prop, integrations | headline-cluster, body-copy, cta-row, media-frame, divider | Secondary 'also' features after the main grid; mid/low page |
| Value prop · proof stats | `../../../section-library/sections/split-layout-asymmetric.html` | section | two-col-text+creative, asymmetric-bento | base | count-up | stats, value-prop, feature, outcomes | headline-cluster, body-copy, stat-block, bento-tiles, cta-row, chip-row | Proof-forward value prop; pick when numbers carry the argument |
| Value prop · who we are | `../../../section-library/sections/value-who.html` | section | two-col-text+creative, n-up-card-grid | rest | count-up, reveal-only | value-prop, stats, team, outcomes, cta | headline-cluster, body-copy, stat-block, media-frame, chip-row, cta-row | Rest-surface 'who we are' + stats; bridges value and team intents |
| Value proposition (stat progression) | `../../../section-library/sections/grid-four-column-equal.html` | section | n-up-card-grid | base | count-up | stats, value-prop, outcomes | headline-cluster, stat-row, body-copy, divider | Minimal stat progression row; quick proof beat between heavier bands |
| About · value proposition | `../../../section-library/sections/about-value.html` | section | two-col-text+creative | rest | count-up, reveal-only | value-prop, stats, outcomes, team | headline-cluster, body-copy, media-frame, stat-row, list-rows, cta-row | About-page value band; editorial tone; pairs media + numbers |
| Mission reveal (scroll) | `../../../section-library/sections/mission-reveal.html` | section | centered-stack | base | sticky-scroll, reveal-only | value-prop, hero, cta | headline-cluster, body-copy | Single-statement scroll moment; manifesto pages; use once, max {maxPerPage:1} |

### Process / how-it-works

| Component | File | Cat | Layout | Surface | Interaction | Serves | Blocks | Direction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| How it works | `../../../section-library/sections/sticky-sidebar-left-full-bleed.html` | section | sticky-aside+stack | rest | sticky-scroll | process, feature | headline-cluster, step-rail, media-frame, list-rows | Canonical 3–4 step process; sticky rail rewards longer steps |
| Get started (steps + creative) | `../../../section-library/sections/get-started.html` | section | two-col-text+creative | base | reveal-only | process, feature, cta | headline-cluster, step-rail, cta-row, media-frame, divider | Closing-half process; lighter than how-it-works; pairs with CTA next |

### Stats / outcomes

| Component | File | Cat | Layout | Surface | Interaction | Serves | Blocks | Direction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Stat cards | `../../../section-library/sections/grid-four-column-equal-cards.html` | section | n-up-card-grid | contrast | count-up, reveal-only | stats, outcomes, social-proof, feature | headline-cluster, stat-block, card-grid | Contrast proof band, strong mid-page contrast beat; avoid two adjacent contrast bands {avoidAdjacentSurface:contrast} |
| Stat band | `../../../section-library/sections/stat-band.html` | section | two-col-text+creative, n-up-card-grid | rest | static, count-up | stats, outcomes, social-proof, feature | headline-cluster, stat-row, body-copy, cta-row | Quiet rest stat row; low-drama proof between base bands |
| Outcome · stats band | `../../../section-library/sections/outcome-stats.html` | section | two-col-text+creative, n-up-card-grid | rest | reveal-only | outcomes, stats, value-prop, social-proof | headline-cluster, body-copy, cta-row, stat-block, stat-row, gauge-progress | Outcome argument with gauges; pick when stats need narrative copy |
| Stat tiles | `../../../section-library/sections/stat-tiles.html` | atom | n-up-card-grid | rest, figure | static | stats, outcomes, social-proof, feature | stat-block, card-grid | Atom: drop-in stat tiles for composing into other bands |

### Social proof / logos

| Component | File | Cat | Layout | Surface | Interaction | Serves | Blocks | Direction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Logo strip (trusted by) | `../../../section-library/sections/logo-strip.html` | section | marquee | rest | marquee | logos, social-proof | logo-row, body-copy | Early trust marquee under the hero; logos only, no claims |
| Logo marquee | `../../../section-library/sections/logo-marquee.html` | section | marquee | contrast | marquee | logos, social-proof, integrations | headline-cluster, logo-row | Contrast logo marquee; pick when a contrast rhythm needs a proof beat |
| Backed by (investor wall) | `../../../section-library/sections/grid-five-column-equal.html` | section | n-up-card-grid | base | reveal-only | logos, social-proof | logo-row, divider | Investor wall for about/credibility pages; never invent names |
| Results & case study | `../../../section-library/sections/results-proof.html` | section | n-up-card-grid, asymmetric-bento | base | count-up | social-proof, outcomes, stats, testimonials, logos | headline-cluster, quote-card, media-frame, stat-block, logo-row | Case-study proof hybrid; one customer story anchoring the stats |

### Testimonials / case studies

| Component | File | Cat | Layout | Surface | Interaction | Serves | Blocks | Direction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Testimonial stack | `../../../section-library/sections/wide-card-internal-columns.html` | section | split-row-card | rest | count-up | testimonials, social-proof, stats | quote-card, stat-block, media-frame, headline-cluster, divider | Quote + metrics split card for one named customer; reach for testimonial-bento (multi-voice), testimonial-slider (long single quote), or results-proof (quote + stat + logo) for other proof shapes |
| Testimonial bento | `../../../section-library/sections/testimonial-bento.html` | section | asymmetric-bento | base | count-up | testimonials, social-proof, feature, stats | bento-tiles, quote-card, stat-block, media-frame, cta-row | Multi-voice bento; doubles as a feature grid cross-pick |
| Testimonial slider | `../../../section-library/sections/testimonial-slider.html` | section | two-col-text+creative, carousel/slider | base | slider | testimonials, social-proof, stats, outcomes | quote-card, headline-cluster, body-copy, stat-block, media-frame, cta-row | One voice at a time; pick for long quotes; manual slider |
| Reviews carousel | `../../../section-library/sections/reviews-carousel.html` | section | carousel/slider | base | carousel | testimonials, social-proof | quote-card, media-frame, cta-row, headline-cluster | Many short reviews; volume-of-love signal; auto carousel |
| Case study carousel | `../../../section-library/sections/carousel-cards.html` | section | carousel/slider | rest | carousel | testimonials, social-proof, outcomes, resources, feature | headline-cluster, media-frame, quote-card, stat-block, cta-row, nav-bar | Editorial case studies; resources cross-pick; heavier band |
| Customer stories (carousel) | `../../../section-library/sections/customer-story.html` | section | two-col-text+creative, carousel/slider | base | carousel | testimonials, social-proof, outcomes, stats | headline-cluster, quote-card, cta-row, media-frame, stat-block, logo-row, gauge-progress | Deep single story + outcomes; pick over slider when detail matters |

### Comparison

| Component | File | Cat | Layout | Surface | Interaction | Serves | Blocks | Direction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Compare table | `../../../section-library/sections/compare-table.html` | section | table-matrix | base | static | comparison, pricing, feature | comparison-matrix, headline-cluster | Us-vs-them or plan matrix; decision-stage pages |
| Comparison column | `../../../section-library/sections/comparison.html` | atom | table-matrix, split-row-card | base | static | comparison, pricing, feature | comparison-matrix, list-rows | Atom: single comparison column for composing |

### Pricing

| Component | File | Cat | Layout | Surface | Interaction | Serves | Blocks | Direction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Pricing (plans + toggle) | `../../../section-library/sections/pricing.html` | section | n-up-card-grid | rest | toggle | pricing | headline-cluster, pricing-card, toggle-control, cta-row, list-rows, logo-row, divider | 4-plan grid + billing toggle for equal, parallel plans; reach for pricing-packages (unequal bento offers), pricing-tabbed (plans split by persona), or subscription-faq (plans + FAQ in one band) {maxPerPage:1} |
| Pricing & packages (bento) | `../../../section-library/sections/pricing-packages.html` | section | asymmetric-bento | rest | reveal-only | pricing, comparison | headline-cluster, pricing-card, media-frame, list-rows, cta-row, divider | Bento pricing for unequal offers (services/packages) |
| Pricing · tabbed | `../../../section-library/sections/pricing-tabbed.html` | section | tabs+swap-panel | base | tabs | pricing, comparison, value-prop, feature | headline-cluster, tab-bar, pricing-card, body-copy, list-rows, cta-row, divider, quote-card | Tabbed audiences/tiers; pick when plans split by persona |
| Subscription (dashed cards + FAQ) | `../../../section-library/sections/subscription-faq.html` | section | n-up-card-grid, accordion+creative | contrast, base | toggle, accordion | pricing, faq | pricing-card, toggle-control, accordion-list, cta-row, divider, headline-cluster | Pricing + FAQ in one band; short pages where both must fit |

### FAQ

| Component | File | Cat | Layout | Surface | Interaction | Serves | Blocks | Direction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FAQ — split column | `../../../section-library/sections/faq-split.html` | section | accordion+creative | rest | accordion | faq, feature, process, value-prop | headline-cluster, accordion-list | FAQ with the heading aside; best for long lists (>6) that must stay scannable. Use faq-centered/faq-single for short or quiet lists, feature-accordion when answers carry a creative panel |
| FAQ — centered column | `../../../section-library/sections/faq-centered.html` | section | centered-stack | base | accordion | faq | headline-cluster, accordion-list, body-copy, divider | Compact centered FAQ; short lists (≤6) near page end |
| FAQ — single column | `../../../section-library/sections/faq-single.html` | section | centered-stack | base | accordion | faq | headline-cluster, accordion-list, body-copy | Minimal single column FAQ; quiet pages; no creative |
| FAQ row (chips) | `../../../section-library/sections/faq.html` | atom | centered-stack | base | static | faq | list-rows | Atom: chip-row FAQ teaser linking to a full FAQ |

### CTA (closing)

| Component | File | Cat | Layout | Surface | Interaction | Serves | Blocks | Direction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CTA banner | `../../../section-library/sections/cta-banner.html` | section | centered-stack | contrast | static | cta, contact, hero | headline-cluster, cta-row | Shortest contrast close; pick when the footer follows immediately |
| CTA band | `../../../section-library/sections/cta-band.html` | section | centered-stack | contrast | reveal-only | cta, contact, resources | headline-cluster, body-copy, link-columns, cta-row | Contrast close + link columns; near-footer hand-off |
| CTA orbit band | `../../../section-library/sections/cta-orbit.html` | section | two-col-text+creative | contrast, figure | reveal-only | cta, contact, hero | headline-cluster, body-copy, cta-row, media-frame | Decorated contrast/figure close; flagship pages; one orbit per page {maxPerPage:1} |
| CTA split (footer-reveal*) | `../../../section-library/sections/cta-footer-reveal.html` | section | two-col-text+creative | base | reveal-only | cta, contact, hero, footer | headline-cluster, body-copy, cta-row, chip-row, stat-block, media-frame | BASE-surface CTA split (despite the name); pick to close without going to contrast |
| Soft CTA (hero-horizon*) | `../../../section-library/sections/hero-horizon-light.html` | section | centered-stack | base | static | cta, hero | headline-cluster, cta-row | Soft base-surface CTA (despite 'hero' name); gentle mid-page or close |

\* Filename is misleading — `cta-footer-reveal` is a base-surface CTA split; `hero-horizon-light` is a centered base-surface CTA, not a hero.

### Contact / forms

| Component | File | Cat | Layout | Surface | Interaction | Serves | Blocks | Direction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Contact · form | `../../../section-library/sections/contact-form.html` | section | split-panel-form, two-col-text+creative | base | form, reveal-only | contact, cta | headline-cluster, body-copy, form-block, cta-row, media-frame | Form + reassurance split; the plain contact capture. Reach for contact-us (+ newsletter), contact-methods (method cards), book-demo (figure-surface sales band), or demo-modal (overlay) when the capture differs |
| Contact us + newsletter | `../../../section-library/sections/contact-us.html` | section | split-panel-form, two-col-text+creative | base, contrast | form | contact, cta | headline-cluster, body-copy, form-block, cta-row, media-frame | Contact + newsletter combo; pick when both captures are needed |
| Contact methods + form | `../../../section-library/sections/contact-methods.html` | section | two-col-text+creative, split-panel-form | base | form | contact | headline-cluster, body-copy, card-grid, list-rows, form-block, cta-row | Methods grid + form; support-style contact pages |
| Contact (page body) | `../../../section-library/sections/contact.html` | section | split-panel-form, centered-stack | base | form, reveal-only | contact, cta | headline-cluster, body-copy, chip-row, divider, form-block, cta-row | Full contact page body; standalone pages, not landing bands |
| Book a demo | `../../../section-library/sections/book-demo.html` | section | split-panel-form | figure | form | contact, cta | headline-cluster, body-copy, form-block, media-frame | Figure-surface demo-booking band; sales-led CTA replacement |
| AI demo modal | `../../../section-library/sections/demo-modal.html` | atom | split-panel-form | base | modal | cta, contact | headline-cluster, form-block, media-frame, agent-status, cta-row | Modal overlay; attach to any CTA; not a standalone band |

### Integrations

| Component | File | Cat | Layout | Surface | Interaction | Serves | Blocks | Direction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Integration grid | `../../../section-library/sections/integration-grid.html` | section | n-up-card-grid | contrast | reveal-only | integrations, logos, feature, resources | headline-cluster, card-grid, logo-row, list-rows, divider | Contrast integrations grid; pick when each integration needs copy |
| Integrations (marquee) | `../../../section-library/sections/integrations.html` | section | marquee, centered-stack | contrast | marquee | integrations, logos, cta | headline-cluster, body-copy, cta-row, logo-row | Contrast marquee + CTA; lighter than the grid; logos speak alone |

### Team / about

| Component | File | Cat | Layout | Surface | Interaction | Serves | Blocks | Direction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Team grid | `../../../section-library/sections/team-grid.html` | section | n-up-card-grid | base | reveal-only | team, feature, resources, testimonials | headline-cluster, body-copy, card-grid, media-frame | Portrait card grid (real photos required); reach for team-leadership (arch-crop, executive), team-visionaries (small 2-4 founders), or team-about (team + story) for other tones |
| Team leadership (arch) | `../../../section-library/sections/team-leadership.html` | section | n-up-card-grid | base | reveal-only | team, feature, resources, testimonials | headline-cluster, card-grid, media-frame, divider | Arch-crop leadership row; formal/executive tone |
| Team · who we are | `../../../section-library/sections/team-about.html` | section | n-up-card-grid | base | reveal-only | team, feature, resources, value-prop | headline-cluster, body-copy, card-grid, chip-row, quote-card, media-frame, divider | Team + story hybrid; about pages; richest team band |
| Team · visionaries | `../../../section-library/sections/team-visionaries.html` | section | n-up-card-grid | base | reveal-only | team, feature, resources, testimonials | headline-cluster, card-grid, media-frame | Minimal founders row; small teams (2–4) |

### Resources / insights / news

| Component | File | Cat | Layout | Surface | Interaction | Serves | Blocks | Direction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Latest insights | `../../../section-library/sections/latest-insights.html` | section | n-up-card-grid | rest | reveal-only | resources, feature, testimonials | headline-cluster, card-grid, media-frame, chip-row, cta-row | Rest-surface editorial article cards; the blog teaser. Reach for resources-insights (denser, base), latest-news (logo/date press), or resources-carousel (5+ items sliding) |
| Resources · insights grid | `../../../section-library/sections/resources-insights.html` | section | n-up-card-grid | base | reveal-only | resources, feature | headline-cluster, body-copy, card-grid, media-frame, chip-row, cta-row | Base-surface resources grid; denser than latest-insights |
| Latest news (press) | `../../../section-library/sections/latest-news.html` | section | n-up-card-grid | rest | static | resources, feature, social-proof | headline-cluster, body-copy, card-grid, cta-row, media-frame, logo-row, chip-row | Press/news row; logo + date driven; corporate pages |
| Resources carousel | `../../../section-library/sections/resources-carousel.html` | section | carousel/slider | base | carousel | resources, testimonials, feature | headline-cluster, media-frame, body-copy, cta-row | Sliding resources; pick when 5+ items must fit one band |

### Footers

| Component | File | Cat | Layout | Surface | Interaction | Serves | Blocks | Direction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Footer · contrast | `../../../section-library/sections/footer-dark.html` | section | link-columns, two-col-text+creative | contrast | reveal-only, form | footer, cta | headline-cluster, cta-row, footer-columns, form-block, list-rows, divider, nav-bar | Contrast footer with newsletter built in; reach for footer-mega (base-surface watermark, editorial), footer-orbit (decorated contrast), or footer-cta (figure-surface CTA+footer fusion) for a different close |
| Footer · orbit | `../../../section-library/sections/footer-orbit.html` | section | split-row-card, link-columns | contrast | form, reveal-only | footer, cta, contact | headline-cluster, body-copy, form-block, media-frame, footer-columns, list-rows | Decorated contrast footer; pairs with a quiet preceding band |
| Footer · mega (watermark) | `../../../section-library/sections/footer-mega.html` | section | link-columns | base | reveal-only | footer, cta | footer-columns, headline-cluster, cta-row, chip-row, list-rows, divider | Base-surface watermark mega-footer; editorial/brand-forward sites |
| Footer · CTA panel | `../../../section-library/sections/footer-cta.html` | section | centered-stack, link-columns | figure | static, form | cta, footer | headline-cluster, body-copy, cta-row, form-block, logo-row, footer-columns, divider | Figure-surface CTA+footer fusion; short pages, one-band close |
| Footer links | `../../../section-library/sections/footer-links.html` | atom | link-columns | base | static | footer, nav, resources | footer-columns, nav-bar | Atom: bare link columns for composing |

### Atoms & structural (in the catalog; excluded from the Playbook)

| Component | File | Cat | Layout | Surface | Interaction | Serves | Blocks | Direction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Buttons | `../../../section-library/sections/buttons.html` | atom | atom | base, contrast | static | cta | cta-row | Atom: canonical CTA styles; the source for every cta-row |
| Nav header | `../../../section-library/sections/nav.html` | atom | atom | contrast | static | nav | nav-bar, cta-row | Atom: the page nav; pair over the hero band |
| Industry chips | `../../../section-library/sections/industry-chips.html` | atom | link-columns | contrast | static | feature, integrations, nav, value-prop | chip-row, list-rows | Atom: industry chip rail; hero or feature garnish |
| Problem card | `../../../section-library/sections/problem-card.html` | atom | atom | contrast | static | feature, value-prop, outcomes | media-frame, headline-cluster, body-copy | Atom: single problem-statement card; compose into grids |
| Agent status (dashboard mock) | `../../../section-library/sections/agent-status.html` | atom | atom | base | static, count-up | stats, outcomes, feature | gauge-progress, stat-block, stat-row | Atom: dashboard mock; media-frame filler with live numbers |
| Figure divider | `../../../section-library/sections/divider.html` | atom | atom | figure | reveal-only | transition, cta | divider, cta-row | Figure-surface hand-off divider; base→contrast transitions; sparing |
| Halftone divider | `../../../section-library/sections/divider-halftone.html` | atom | atom | contrast | static | transition | divider | Contrast halftone hand-off into contrast bands; sparing |
| Pixel-dissolve divider | `../../../section-library/sections/divider-dissolve.html` | atom | atom | contrast | reveal-only | transition | divider | Pixel dissolve into contrast; playful pages only |
| Dither divider | `../../../section-library/sections/divider-dither.html` | atom | atom | contrast | reveal-only | transition | divider | Dither texture transition; retro/technical voice |
| Horizon divider | `../../../section-library/sections/divider-horizon.html` | atom | atom | contrast | reveal-only | transition, footer | divider | Horizon glow into the footer; final transition only |

> Dividers are **punctuation, used sparingly** — sections are still divided by *surface*,
> not rules. Reach for one only when a deliberate hand-off into a contrast band earns it.

---

# Capability profiles

**What this is.** The catalog above says what each component *is*. This says what each **structure is
capable of communicating** — and that is a different claim, made in a different vocabulary, for a
different purpose.

> **The catalog describes what each structure is capable of communicating — not what previous
> webpages happened to use it for.**

**Why it exists.** A page declares six things before it composes — hierarchy, intent, archetype,
register, signature, density (`COMPOSE.md` §A2.1). That is a complete statement of **demand**. Until
2026-07-29 the library had no **supply** statement to answer it with: it replied in page labels, and
only the first one was ever read. Measured against this catalog, the requirement `feature` was listed
by 31 sections and winnable by **7**; `comparison` was listed by 3 and winnable by **1**, so one
section answered it always. **The library was not over-used; it was under-declared** — a structure
able to carry eight kinds of information was permitted one word about itself. See
`DECISION-REGISTER.md` DR-16.

A profile answers in the vocabulary the demand already speaks, so selection becomes a **comparison**
rather than a lookup.

## How to read a profile

Twenty declared fields and two marked rationale. Every declared field draws on a closed vocabulary
owned elsewhere — this file binds them, it never authors them.

| Line | Declares | Vocabulary (owner) |
|---|---|---|
| **Leads with** | the advance the structure exists to make | intent — `COMPOSE.md` §A2.4 |
| **Also carries** | every other intent the structure can serve, **unordered** | intent — §A2.4 |
| **Emphasis** | what carries the argument | `typography` · `creative` · `structure` (`COMPOSE.md` §D) |
| **Relates** | the information relationships it can express | `INFORMATION_ARCHITECTURE.md` §7 |
| **Carries** | the kinds of information it can hold | `INFORMATION_ARCHITECTURE.md` §6 |
| **Density · Capacity · Pace · Load** | concentration · quantity composed for · speed · comprehension cost | `SECTION_LAYOUT.md` §10, §10.1, §11.1 · `COMMUNICATION_AND_PERCEPTION_SYSTEM.md` §11 |
| **Registers** | the felt registers it can take | `rulebooks/editorial-art-direction.md` §1 |
| **Role** | its narrative importance — placement derives from this | hierarchy — `COMPOSE.md` §A2.4 |
| **Follows · Precedes** | the information kinds it sits naturally after and before | `INFORMATION_ARCHITECTURE.md` §6 |
| **Media** | creative presence, anchor, and what the structure wants | `rulebooks/creatives.md` · `ASSETS.md` |
| **Envelope** | the *range* of communication problems this fixed structure can solve | the axes above + `COMPOSE.md` §A2.2 |
| **Addresses** | the reader postures it can speak to | `BRAND_EXPRESSION.md` §10.1 |
| **Distinct from** | its nearest structural neighbours, and what separates it from each | `COMPOSE.md` §A2.3, lifted |
| *Why it works* | **rationale** — where weight settles, how the eye travels, what the composition does to comprehension | — |
| *Reach for it · not when* | **rationale** — selection guidance | — |

**The two rationale lines are marked rationale and nothing scores against them.** Every other line is
a predicate that can be wrong. This is `COMPOSE.md` §A2.1's rule applied to the library: *a field is
either something a render can fail, or it is explicitly marked rationale; a field that is neither is
a declaration that constrains nothing.*

**Placement is derived from Role and is deliberately not a field of its own.** A `hero` structure
opens and a `closing` structure closes — declaring both independently creates two sources that can
disagree, and a library entry that declared a fixed slot would be making a decision that belongs to
the page (`PAGE_STRUCTURE.md`).

**Follows/Precedes name information, never sections.** That a structure carrying `proof` sits
naturally after one carrying `capability` is knowledge worth holding. That "results-proof follows
feature-trio" is a page template, and sequence arriving from convention is exactly what
`PAGE_STRUCTURE.md` §6 refuses. These lines are **probable, not mandatory**: they inform composition,
while the adjacency rules that can actually *fail* stay where they are — no two neighbours sharing a
register, the recovery successors, and the `{…}` limits in the catalog above.

## Three rules that govern how a profile is authored

**1 · Read the structure, not the name.** A profile is derived from what the layout does — where
weight settles, how information is grouped, what the eye is asked to do — never from the filename,
the demonstration copy, or the catalog category. Several files in this library are misnamed, and at
least one carries a label in its own markup that contradicts its filename. **Where the structure and
the name disagree, the structure is right.**

**2 · Declare the structure's range, never the demo's content.** A three-column field demonstrated
with product features can equally carry services, modules, principles, business units, phases or
responsibilities. The structure is identical; only the content changed. Capability follows the
structure.

**3 · Over-declaration is a defect, not generosity.**

> **No structure may win a selection because its profile is broader than the structure warrants.**

Every declared capability must be structurally warranted, and **Distinct from** is the enforcement: a
structure claiming a capability shared with a neighbour must say what separates it there. A profile
that claims everything is as wrong as one that claims nothing, and it is more damaging, because it
wins. **Envelope** exists so breadth is stated where it can be compared rather than accumulated
quietly — a structure is allowed to be a generalist, but it has to say so.

## The legacy `Serves` vocabulary, reconciled

The catalog's `Serves` column is the previous demand vocabulary — page labels, of which two
(`social-proof`, `outcomes`) were never asked for at all, making 27 listings and two whole sections
unreachable (DR-20). It is retained above because the runtime still reads it, and it maps onto intent:

| Legacy `Serves` | Intent |
|---|---|
| `hero` · `nav` | `orient` |
| `feature` · `resources` · `integrations` · `faq` | `educate` |
| `process` | `explain` |
| `grid-four-column-equal` | `persuade` |
| `stats` · **`outcomes`** | `prove` |
| **`social-proof`** · `logos` · `testimonials` · `team` | `build-trust` |
| `comparison` · `pricing` | `compare` |
| `cta` · `contact` | `convert` · `close` |
| `footer` | `orient` (a footer re-orients; it does not conclude) |
| `transition` · `transition-into-contrast` · `any-cta-row-source` | structural — no intent |

**This table is a port aid and an audit trail. It is not how a profile is authored.** Deriving intent
from a section's old page label would re-import the exact bias this pass exists to remove — the label
records what a section was first built to demonstrate. Intent is read from the structure (rule 1); the
table exists so that the transition is checkable and no legacy value is silently orphaned.

## The profiles (all 79)
## Heroes

#### `hero-bento` — Hero · bento
**Structure** Bento · **Arrangement** `feature-dominant` · **Interaction** `reveal-only`
**Reuse** `purpose-bound` · **Tags** `icon-led` · `cards` · `stack-on-mobile`
*Structure evidence* — the 1.62fr/1fr well IS the bento; unequal tiles, not a split (measured: two-track grid 1.62fr 1fr)
**Leads with** orient · **Also carries** educate · persuade · build-trust
**Emphasis** typography · **Relates** hierarchical · supporting · validation · **Carries** context · capability · validation
**Density** medium · **Capacity** small-set · **Pace** fast · **Load** light · **Registers** editorial · confident
**Role** hero · **Follows** — · **Precedes** problem · capability
**Media** presence `s`, anchor `framed` — wants real product tiles; a missing artifact holds a placeholder, never an invention
**Envelope** archetypes `editorial-stack` · `product-showcase` — hierarchy `hero` — density low–medium — capacity triad–small-set — registers editorial · confident
**Addresses** executive · enterprise · marketing
**Distinct from** `hero-lending` — proof sits *beside* the promise as unequal tiles, not beneath it as peer cards · `hero-actions` — states a capability rather than demonstrating one · `hero-agent` — carries no capture, so it opens without asking
*Why it works* — one headline holds the field alone, and the tiles below it are deliberately unequal, so the eye lands on the claim, falls to the largest tile, and reads the rest as corroboration rather than as a menu. The logo row closes the unit at the lowest visual weight on the page, which is why it reads as attribution and not as content.
*Reach for it* when the opening must both state a position and show four-or-so real things behind it. *Not when* the tiles would be invented, or when the promise is strong enough to stand with nothing under it — an empty bento is worse than no bento.

#### `hero-lending` — Hero · lending
**Structure** Centered Stack · **Arrangement** `single-column` · **Interaction** `reveal-only`
**Reuse** `purpose-bound` · **Tags** `icon-led` · `stack-on-mobile`
*Structure evidence* — centred hero; the 1fr 1fr 2fr is an inner metrics row (measured: body grid 1fr 1fr 2fr)
**Leads with** orient · **Also carries** build-trust · educate
**Emphasis** typography · **Relates** supporting · validation · **Carries** context · capability · validation
**Density** low · **Capacity** triad · **Pace** fast · **Load** light · **Registers** editorial · quiet · confident
**Role** hero · **Follows** — · **Precedes** problem · context
**Media** presence `s`, anchor `inline` — wants a calm supporting artifact, not a staged one
**Envelope** archetypes `editorial-stack` — hierarchy `hero` — density low — capacity paired–triad — registers editorial · quiet · confident
**Addresses** executive · enterprise
**Distinct from** `hero-bento` — peer cards *beneath* the promise rather than unequal tiles beside it, so nothing competes with the headline · `hero-horizon-light` — that structure has no proof layer at all
*Why it works* — the promise is given the field to itself and the proof is placed under it as equals, so the reader finishes the claim before meeting the evidence. Credibility arrives as a second beat rather than as a simultaneous one, which is what makes this the calm opening rather than the busy one.
*Reach for it* when the opening should reassure before it impresses, and three peer proofs will do it. *Not when* one item genuinely dominates — equal cards will flatten it.

#### `hero-actions` — Hero · AI actions
**Structure** Split Layout · **Arrangement** `balanced` · **Interaction** `static` · `toggle`
**Reuse** `purpose-bound` · **Tags** `icon-led` · `screenshot` · `stack-on-mobile`
*Structure evidence* — 1fr/1.06fr reads as balanced (measured: two-track grid 1fr 1.06fr)
**Leads with** orient · **Also carries** educate · persuade
**Emphasis** creative · **Relates** cause-and-effect · supporting · **Carries** capability · context · validation
**Density** medium · **Capacity** singular · **Pace** moderate · **Load** medium · **Registers** confident · technical
**Role** hero · **Follows** — · **Precedes** capability · process
**Media** presence `l`, anchor `framed` — **requires** a real product artifact; this structure has nothing to say without one
**Envelope** archetypes `product-showcase` · `editorial-split` — hierarchy `hero` — density medium — capacity singular — registers confident · technical
**Addresses** technical · enterprise · specialist
**Distinct from** `hero-bento` — demonstrates one product state rather than asserting several capabilities · `hero-agent` — shows the product working rather than inviting the reader into it · `tabs-panel-below` — one state held, not several offered
*Why it works* — the artifact is staged and held rather than decorated around, so the copy attends it instead of competing with it. The reader believes the capability because they are looking at it, which is a different act from being told and is why the copy can be this short.
*Reach for it* when a single product state carries the argument better than any sentence would. *Not when* the artifact does not exist — a placeholder in this structure removes the entire reason for it.

#### `hero-agent` — Hero · agent
**Structure** Split Layout · **Arrangement** `asymmetric` · **Interaction** `form` · `tabs` · `reveal-only`
**Reuse** `purpose-bound` · **Tags** `icon-led` · `stack-on-mobile`
*Structure evidence* — 44fr/56fr hero split; the form is a capture, not the subject (measured: <form> present; first grid 44fr 56fr)
**Leads with** orient · **Also carries** convert · educate
**Emphasis** creative · **Relates** cause-and-effect · dependency · **Carries** capability · context · decision-support
**Density** medium · **Capacity** singular · **Pace** moderate · **Load** medium · **Registers** human · confident
**Role** hero · **Follows** — · **Precedes** problem · capability
**Media** presence `l`, anchor `framed` — **requires** a live-demo artifact; carries a capture in the hero
**Envelope** archetypes `product-showcase` · `editorial-split` — hierarchy `hero` — density medium — capacity singular — registers human · confident
**Addresses** technical · operational · marketing
**Distinct from** `hero-actions` — the reader is invited to *act*, not shown a state · `contact-form` — the capture opens the page rather than closing it, so it asks before it has earned anything
*Why it works* — the capture sits inside the demonstration rather than after it, so the ask arrives at the moment of highest curiosity instead of at the end of an argument the reader may not finish. That is also its risk, and why it needs a demo real enough to justify asking this early.
*Reach for it* when the product is best understood by being addressed, and the intent is worth capturing at first contact. *Not when* the page has to earn the ask first — a hero that asks too early converts the already-convinced and loses everyone else.

## Features / value-prop

#### `feature-trio` — Feature trio
**Structure** Grid · **Arrangement** `three-column-equal` · **Interaction** `reveal-only`
**Reuse** `reusable` · **Tags** `screenshot` · `cards` · `stack-on-mobile`
*Structure evidence* — body grid repeat(3, 1fr)
**Leads with** educate · **Also carries** persuade · compare · explain
**Emphasis** structure · **Relates** supporting · hierarchical · **Carries** capability · solution · context · outcome
**Density** low · **Capacity** triad · **Pace** fast · **Load** light · **Registers** editorial · confident
**Role** primary · secondary · **Follows** problem · context · **Precedes** proof · outcome
**Media** presence **none**–`xs`, anchor `inline` — the structure carries it; imagery is optional and small
**Envelope** archetypes `editorial-stack` · `feature-comparison` — hierarchy primary–supporting — density low–medium — capacity triad — registers editorial · confident · instructional
**Addresses** executive · enterprise · marketing · operational
**Distinct from** `feature-bento` — three genuine *peers*, where the bento exists because one item dominates · `more-solutions` — three, not two, so it reads as a set rather than a choice · `grid-four-column-equal-cards` — the same geometry carrying claims rather than measures
*Why it works* — three is the smallest quantity that reads as a set rather than as a comparison, and the equal weighting is the message: these things are alike in kind and none outranks another. It is fast because there is nothing to weigh.
*Reach for it* whenever three things are genuinely peers — capabilities, services, pillars, phases, business units, principles, responsibilities. The content is interchangeable; the peer relationship is not. *Not when* one of the three matters more, when there are four or more, or when the reader is meant to choose between them.

#### `feature-bento` — Feature bento
**Structure** Bento · **Arrangement** `feature-dominant` · **Interaction** `reveal-only`
**Reuse** `reusable` · **Tags** `cards` · `stack-on-mobile`
*Structure evidence* — the 1fr/0.4fr sub-grid is the asymmetry (measured: spans=0 placed=0)
**Leads with** educate · **Also carries** persuade · prove
**Emphasis** structure · **Relates** hierarchical · supporting · **Carries** capability · outcome · proof · context
**Density** medium · **Capacity** small-set · **Pace** moderate · **Load** medium · **Registers** editorial · confident · technical
**Role** primary · **Follows** context · problem · **Precedes** proof · process
**Media** presence `xs`–`s`, anchor `inline`
**Envelope** archetypes `editorial-stack` · `proof-layout` — hierarchy primary–secondary — density medium–high — capacity small-set — registers editorial · confident · technical
**Addresses** enterprise · technical · marketing
**Distinct from** `feature-trio` — unequal tiles, so one item leads and the rest attend it · `split-layout-asymmetric` — capability with a measure attached, where value-stats is the measure itself · `grid-four-column-equal-cards` — mixed content, not a uniform metric field
*Why it works* — the unequal grid does the hierarchy that equal cards cannot: the largest tile is read first and the others are read as its context, so a set with a genuine centre keeps its centre. It carries a number well because the number sits inside a claim rather than beside it.
*Reach for it* when a set has a leader — a flagship module among modules, a principal market among markets, one capability that earns the section. *Not when* the items are true peers, and not next to a metric band; two numeric fields in sequence flatten both.

#### `accordion-panel-right` — Feature accordion
**Structure** Accordion · **Arrangement** `panel-right` · **Interaction** `accordion`
**Reuse** `reusable` · **Tags** `stack-on-mobile`
*Structure evidence* — catalog accordion; grid True
**Leads with** educate · **Also carries** explain · persuade
**Emphasis** structure · **Relates** hierarchical · dependency · supporting · **Carries** capability · context · solution · decision-support
**Density** medium · **Capacity** small-set · **Pace** slow · **Load** medium · **Registers** instructional · technical · editorial
**Role** secondary · technical · **Follows** capability · problem · **Precedes** proof · outcome
**Media** presence `s`, anchor `right` — one panel that changes with the open item
**Envelope** archetypes `editorial-split` — hierarchy secondary–technical — density medium — capacity small-set–large-set — registers instructional · technical · editorial
**Addresses** technical · operational · specialist
**Distinct from** `faq-split` — the same mechanism answering *depth* rather than *objections*; the reader is exploring, not doubting · `feature-steps` — items opened in any order, where steps have one order · `tabs-panel-below` — a changing panel beside a list rather than beneath a bar
*Why it works* — the reader chooses the depth, so the section can carry far more than it shows. The paired panel keeps the choosing from feeling like reading a list, and the closed rows hold the whole scope visible while only one thing is open.
*Reach for it* when four to six items each have detail worth having but not worth forcing, and the reader should decide which. *Not when* the items must be compared — a reader who can only see one at a time cannot weigh them — and never above the fold, where a collapsed list reads as an empty section.

#### `feature-stack` — Feature stack
**Structure** Centered Stack · **Arrangement** `single-column` · **Interaction** `sticky-scroll`
**Reuse** `reusable` · **Tags** `icon-led` · `pinned`
*Structure evidence* — sticky-scroll with no grid
**Leads with** persuade · **Also carries** educate · inspire
**Emphasis** creative · **Relates** transformational · hierarchical · **Carries** capability · solution · context
**Density** low · **Capacity** triad · **Pace** slow · **Load** medium · **Registers** narrative · immersive · confident
**Role** primary · **Follows** problem · context · **Precedes** proof · outcome
**Media** presence `l`, anchor `left` · `right` — one visual moment per panel
**Envelope** archetypes `storytelling-composition` — hierarchy primary — density low — capacity paired–triad — registers narrative · immersive · confident
**Addresses** executive · marketing
**Distinct from** `sticky-sidebar-left` — a held sequence of *full compositions*, where sticky-cards holds a rail beside flowing items · `sticky-sidebar-left-full-bleed` — cinematic rather than instructional; these panels are not steps and have no order to obey · `narrative-flow` structures generally — each panel is a destination, which a sequence's parts are not
*Why it works* — holding each panel still while the reader arrives gives a claim the time a scrolling band never gets. It is the most expensive structure in the library in attention, which is why one per page is a limit and not a guideline.
*Reach for it* on long pages where two or three claims each deserve a full moment. *Not when* the page is short, when there are more than three, or when a second held structure is already present — two cinematic moments cancel.

#### `feature-steps` — Feature steps
**Structure** Tabs · **Arrangement** `panel-right` · **Interaction** `tabs`
**Reuse** `reusable` · **Tags** `stack-on-mobile` · `timeline`
*Structure evidence* — catalog tabs
**Leads with** explain · **Also carries** educate · persuade
**Emphasis** structure · **Relates** dependency · cause-and-effect · **Carries** process · capability · context
**Density** medium · **Capacity** small-set · **Pace** moderate · **Load** medium · **Registers** instructional · technical
**Role** secondary · technical · **Follows** problem · capability · **Precedes** outcome · proof
**Media** presence `s`, anchor `right` — one artifact per step
**Envelope** archetypes `narrative-flow` — hierarchy secondary–technical — density medium — capacity triad–small-set — registers instructional · technical
**Addresses** technical · operational · enterprise
**Distinct from** `accordion-panel-right` — the items are *ordered*, so the reader is walked rather than browsing · `sticky-sidebar-left-full-bleed` — a switcher the reader drives, not a rail they scroll · `tabs-panel-below` — steps of one thing, not parallel alternatives
*Why it works* — the numbered rail keeps the whole sequence visible while one step is shown, so the reader always knows where they are in it. That is what separates a sequence from a set: position is part of the meaning.
*Reach for it* when features are really a progression — onboarding, a lifecycle, a maturity path, an implementation. *Not when* order does not matter; numbering an unordered set invents a dependency that is not there.

#### `tabs-panel-below` — Tabbed product showcase
**Structure** Tabs · **Arrangement** `panel-below` · **Interaction** `tabs`
**Reuse** `reusable` · **Tags** `icon-led` · `stack-on-mobile`
*Structure evidence* — catalog tabs
**Leads with** compare · **Also carries** educate · persuade
**Emphasis** creative · **Relates** contrasting · supporting · **Carries** capability · solution · context · decision-support
**Density** medium · **Capacity** small-set · **Pace** moderate · **Load** medium · **Registers** technical · confident
**Role** primary · secondary · **Follows** problem · context · **Precedes** proof · decision-support
**Media** presence `l`, anchor `right` — **requires** a real artifact per tab
**Envelope** archetypes `product-showcase` · `editorial-split` — hierarchy primary–secondary — density medium — capacity triad–small-set — registers technical · confident
**Addresses** technical · enterprise · operational · specialist
**Distinct from** `feature-steps` — parallel alternatives with no order, where steps have one · `pricing-tabbed` — showing *what each is*, not what each costs · `compare-table` — one option seen at a time, so the reader recalls rather than weighs
*Why it works* — the tab bar states the whole set as a single line while the panel gives one member the room to be shown properly. The reader gets scope and depth without the section paying for both at once.
*Reach for it* when three to five parallel offerings each need a real artifact and a paragraph. *Not when* the reader must compare them side by side — this structure hides the alternatives at the moment of choosing — or when the artifacts do not exist.

#### `sticky-sidebar-left` — Sticky cards
**Structure** Sticky Sidebar · **Arrangement** `sidebar-left` · **Interaction** `sticky-scroll` · `reveal-only`
**Reuse** `reusable` · **Tags** `icon-led` · `intro-split` · `stack-on-mobile` · `timeline`
*Structure evidence* — position:sticky; fixed first track 320px 1fr
**Leads with** explain · **Also carries** educate · persuade
**Emphasis** structure · **Relates** dependency · transformational · **Carries** process · capability · context · outcome
**Density** medium · **Capacity** small-set · **Pace** slow · **Load** medium · **Registers** narrative · instructional
**Role** secondary · **Follows** problem · context · **Precedes** outcome · proof
**Media** presence `s`, anchor `right`
**Envelope** archetypes `narrative-flow` — hierarchy secondary–primary — density medium — capacity triad–small-set — registers narrative · instructional
**Addresses** operational · technical · enterprise
**Distinct from** `sticky-sidebar-left-full-bleed` — a longer walk with more prose per stop; how-it-works is the compact canonical form · `feature-stack` — a rail held beside flowing items, not whole compositions held one at a time · `feature-steps` — scrolled through rather than clicked through
*Why it works* — the held rail turns a long scroll into a bounded journey: the reader can see how much is left, which is what makes a long-form sequence tolerable rather than endless.
*Reach for it* on long pages where a walk of three to six stops each needs real prose. *Not when* the page is short — the mechanism needs scroll length to exist at all.

#### `more-solutions` — More solutions
**Structure** Split Layout · **Arrangement** `balanced` · **Interaction** `reveal-only`
**Reuse** `reusable` · **Tags** `icon-led` · `stack-on-mobile`
*Structure evidence* — two-track grid 1fr 1fr
**Leads with** educate · **Also carries** persuade · orient
**Emphasis** structure · **Relates** supporting · contrasting · **Carries** capability · solution · context
**Density** low · **Capacity** paired · **Pace** fast · **Load** light · **Registers** editorial · quiet
**Role** supporting · **Follows** capability · solution · **Precedes** proof · decision-support
**Media** presence `s`, anchor `inline`
**Envelope** archetypes `editorial-split` · `editorial-stack` — hierarchy supporting–secondary — density low — capacity paired — registers editorial · quiet · confident
**Addresses** marketing · enterprise
**Distinct from** `feature-trio` — two, not three, so it reads as *also these* rather than as the set itself · `integration-grid` — adjacent offerings, not connected systems
*Why it works* — two items at reduced weight after a main set says *there is more here* without reopening the argument. Its restraint is the whole point: a second full feature grid would tell the reader the first one was incomplete.
*Reach for it* mid-to-low page, after the primary set, when two adjacent things deserve mention but not equal standing. *Not when* the two are as important as what preceded them — then they belonged in the main set.

#### `split-layout-asymmetric` — Value prop · proof stats
**Structure** Split Layout · **Arrangement** `asymmetric` · **Interaction** `count-up`
**Reuse** `reusable` · **Tags** `icon-led` · `metrics` · `stack-on-mobile`
*Structure evidence* — two-track grid minmax(0, 0.82fr) minmax(0, 1.18fr)
**Leads with** prove · **Also carries** persuade · educate
**Emphasis** structure · **Relates** validation · supporting · **Carries** proof · outcome · evidence · capability
**Density** medium · **Capacity** small-set · **Pace** moderate · **Load** medium · **Registers** confident · technical
**Role** proof · primary · **Follows** capability · solution · **Precedes** outcome · decision-support
**Media** presence `xs`–`s`, anchor `inline`
**Envelope** archetypes `proof-layout` — hierarchy proof–primary — density medium — capacity triad–small-set — registers confident · technical · editorial
**Addresses** executive · enterprise · marketing
**Distinct from** `grid-four-column-equal` — measures set inside claims, where value-prop is the bare progression of measures · `grid-four-column-equal-cards` — composed as one argument rather than as a uniform field of tiles · `outcome-stats` — proof offered, not an outcome argued through narrative copy
*Why it works* — each number arrives already attached to what it means, so the reader is never asked to do the interpretation themselves. That is why it can carry four measures without becoming a scoreboard.
*Reach for it* when the numbers *are* the argument and each needs a sentence to land. *Not when* the measures speak alone — the copy will read as padding.

#### `value-who` — Value prop · who we are
**Structure** Grid · **Arrangement** `three-column-equal` · **Interaction** `count-up` · `reveal-only`
**Reuse** `reusable` · **Tags** `metrics` · `intro-split` · `stack-on-mobile`
*Structure evidence* — body grid 1fr 1fr 1fr
**Leads with** build-trust · **Also carries** persuade · prove · orient
**Emphasis** typography · **Relates** supporting · validation · **Carries** context · proof · outcome · validation
**Density** medium · **Capacity** small-set · **Pace** moderate · **Load** light · **Registers** human · confident · editorial
**Role** secondary · **Follows** context · problem · **Precedes** proof · capability
**Media** presence `s`, anchor `left` · `right`
**Envelope** archetypes `editorial-split` — hierarchy secondary–primary — density low–medium — capacity triad–small-set — registers human · confident · editorial
**Addresses** executive · enterprise · marketing
**Distinct from** `about-value` — a *claim* about who we are with numbers attached, where about-value is an editorial passage that happens to carry them · `team-about` — the organisation as a position, not as people · `split-layout-asymmetric` — identity leading, measures supporting; value-stats reverses that
*Why it works* — the statement leads and the measures corroborate, so the section reads as a position held rather than a record presented. Trust here comes from the claim being specific enough to be checked, not from the numbers alone.
*Reach for it* when the page must establish who is speaking before it continues arguing. *Not when* the numbers are the point — that is `split-layout-asymmetric`.

#### `grid-four-column-equal` — Value proposition
**Structure** Grid · **Arrangement** `four-column-equal` · **Interaction** `count-up`
**Reuse** `reusable` · **Tags** `metrics` · `full-bleed` · `stack-on-mobile`
*Structure evidence* — body grid repeat(4, 1fr)
**Leads with** prove · **Also carries** persuade
**Emphasis** structure · **Relates** contrasting · supporting · **Carries** proof · outcome · evidence
**Density** low · **Capacity** small-set · **Pace** fast · **Load** light · **Registers** quiet · confident
**Role** proof · supporting · **Follows** capability · solution · **Precedes** outcome · decision-support
**Media** presence **none**, anchor —
**Envelope** archetypes `proof-layout` — hierarchy proof–supporting — density low — capacity triad–small-set — registers quiet · confident
**Addresses** executive · enterprise
**Distinct from** `split-layout-asymmetric` — bare measures with no claim wrapped around them · `stat-band` — a progression that *builds*, where the band is a flat row · `stat-tiles` — a full band, not a drop-in component
*Why it works* — it does one thing and leaves. Placed between two heavier sections it functions as punctuation that still carries evidence, which is rarer and more useful than it looks.
*Reach for it* as a quick proof beat between weightier bands. *Not when* the numbers need explaining — this structure gives them nowhere to be explained.

#### `about-value` — About · value proposition
**Structure** Split Layout · **Arrangement** `asymmetric` · **Interaction** `count-up` · `reveal-only`
**Reuse** `reusable` · **Tags** `metrics` · `stack-on-mobile`
*Structure evidence* — two-track grid 30fr 70fr
**Leads with** persuade · **Also carries** build-trust · prove · educate
**Emphasis** typography · **Relates** supporting · validation · transformational · **Carries** context · proof · outcome · validation
**Density** medium · **Capacity** continuous · **Pace** slow · **Load** medium · **Registers** editorial · reflective · human
**Role** secondary · **Follows** context · problem · **Precedes** proof · capability
**Media** presence `s`, anchor `left` · `right`
**Envelope** archetypes `editorial-split` · `editorial-stack` — hierarchy secondary — density medium — capacity continuous — registers editorial · reflective · human
**Addresses** executive · enterprise · marketing
**Distinct from** `value-who` — continuous prose that carries measures, where value-who leads with a claim and appends them · `mission-reveal` — an argument developed, not a single statement held
*Why it works* — it is the library's one structure where prose is allowed to run and still carry evidence, because the measures sit inside the passage rather than interrupting it. That makes it the right place for an argument that needs more than three sentences.
*Reach for it* on about-style pages, or wherever an argument genuinely needs paragraphs. *Not when* the point can be made in a headline — this structure will pad it.

#### `mission-reveal` — Mission reveal
**Structure** Centered Stack · **Arrangement** `single-column` · **Interaction** `sticky-scroll` · `reveal-only`
**Reuse** `reusable` · **Tags** `pinned`
*Structure evidence* — sticky-scroll with no grid
**Leads with** inspire · **Also carries** orient · persuade
**Emphasis** typography · **Relates** hierarchical · **Carries** context · solution
**Density** low · **Capacity** singular · **Pace** slow · **Load** light · **Registers** quiet · reflective · immersive
**Role** primary · hero · **Follows** problem · context · **Precedes** capability · solution
**Media** presence **none**, anchor —
**Envelope** archetypes `editorial-stack` — hierarchy hero–primary — density low — capacity singular — registers quiet · reflective · immersive
**Addresses** executive · marketing
**Distinct from** `cta-banner` — a statement that asks for nothing, where the banner asks · `hero-horizon-light` — held and revealed rather than simply centred · every other structure in this group — it is the only one that carries one sentence and nothing else
*Why it works* — the whole field given to a single statement makes the statement an event. It is the library's clearest instance of scarcity creating weight, and it fails immediately if repeated.
*Reach for it* once, where the page needs a moment that is felt rather than read. *Not when* the sentence is not worth a whole screen — an unremarkable line given this treatment reads as an overreach and costs the page its credibility.

## Process / how-it-works

#### `sticky-sidebar-left-full-bleed` — How it works
**Structure** Sticky Sidebar · **Arrangement** `sidebar-left` · **Interaction** `sticky-scroll`
**Reuse** `reusable` · **Tags** `icon-led` · `full-bleed` · `stack-on-mobile` · `timeline`
*Structure evidence* — position:sticky; fixed first track 300px 1fr
**Leads with** explain · **Also carries** educate
**Emphasis** structure · **Relates** dependency · cause-and-effect · transformational · **Carries** process · capability · context
**Density** medium · **Capacity** small-set · **Pace** slow · **Load** medium · **Registers** instructional · narrative
**Role** secondary · technical · **Follows** problem · capability · **Precedes** outcome · proof
**Media** presence `s`, anchor `right` — one artifact per stop
**Envelope** archetypes `narrative-flow` — hierarchy secondary–technical — density medium — capacity triad–small-set — registers instructional · narrative
**Addresses** operational · technical · enterprise
**Distinct from** `sticky-sidebar-left` — the compact canonical process; sticky-cards is its long-form cousin with more prose per stop · `feature-steps` — scrolled rather than switched, so the reader cannot skip ahead · `get-started` — explains the mechanism, where get-started prepares the ask
*Why it works* — a held rail beside flowing steps means the reader can always see both where they are and how far it goes, which is the one thing a sequence must supply and a plain list cannot. Longer steps reward it; short ones make the rail look like scaffolding around nothing.
*Reach for it* for the canonical three-to-four stage explanation — a workflow, an implementation, a lifecycle, an approval chain. *Not when* the stages are one line each.

#### `get-started` — Get started
**Structure** Split Layout · **Arrangement** `asymmetric` · **Interaction** `reveal-only`
**Reuse** `reusable` · **Tags** `icon-led` · `screenshot` · `timeline`
*Structure evidence* — two-track grid minmax(0, 0.82fr) minmax(0, 1.18fr)
**Leads with** explain · **Also carries** convert · educate
**Emphasis** structure · **Relates** dependency · cause-and-effect · **Carries** process · decision-support · context
**Density** medium · **Capacity** triad · **Pace** moderate · **Load** light · **Registers** instructional · confident
**Role** secondary · closing · **Follows** capability · outcome · **Precedes** decision-support · validation
**Media** presence `s`, anchor `right`
**Envelope** archetypes `narrative-flow` · `editorial-split` — hierarchy secondary–closing — density low–medium — capacity triad — registers instructional · confident
**Addresses** operational · marketing · enterprise
**Distinct from** `sticky-sidebar-left-full-bleed` — describes what *the reader* does next, not what the product does · `cta-band` — carries the steps to the action rather than only the action
*Why it works* — showing the path immediately before asking for it removes the unspoken objection *what would this actually involve*. It is a closing-half structure disguised as an explanatory one, and that is exactly its use.
*Reach for it* in the closing half, immediately before or fused with the ask. *Not when* the process is the subject of the page — it is too light to carry that.

## Stats / outcomes

#### `grid-four-column-equal-cards` — Stat cards
**Structure** Grid · **Arrangement** `four-column-equal` · **Interaction** `count-up` · `reveal-only`
**Reuse** `reusable` · **Tags** `metrics` · `cards` · `dark-band` · `stack-on-mobile`
*Structure evidence* — body grid repeat(4, 1fr)
**Leads with** prove · **Also carries** persuade
**Emphasis** structure · **Relates** validation · contrasting · **Carries** proof · outcome · evidence
**Density** high · **Capacity** small-set · **Pace** fast · **Load** light · **Registers** confident · technical
**Role** proof · **Follows** capability · solution · **Precedes** outcome · validation
**Media** presence **none**, anchor —
**Envelope** archetypes `proof-layout` — hierarchy proof — density medium–high — capacity triad–small-set — registers confident · technical
**Addresses** executive · enterprise
**Distinct from** `stat-band` — a deliberate peak where the band is a rest; the same measures, opposite rhythmic jobs · `grid-four-column-equal` — a field of tiles rather than a progression · `stat-tiles` — a whole band, not a component to compose with
*Why it works* — almost no words. A wall of measures at high contrast is the page's loudest claim precisely because it declines to argue, and the reader supplies the conclusion themselves.
*Reach for it* as the mid-page proof peak, when the numbers are strong enough to stand unexplained. *Not when* they need context — this structure has nowhere to put it — and never adjacent to another numeric band.

#### `stat-band` — Stat band
**Structure** Grid · **Arrangement** `four-column-equal` · **Interaction** `static` · `count-up`
**Reuse** `reusable` · **Tags** `metrics` · `intro-split` · `stack-on-mobile`
*Structure evidence* — repeat(4,1fr) stat row is the repeated content (measured: spans=0 placed=6)
**Leads with** prove · **Also carries** persuade · educate
**Emphasis** structure · **Relates** validation · supporting · **Carries** proof · outcome · context
**Density** low · **Capacity** small-set · **Pace** fast · **Load** light · **Registers** quiet · confident
**Role** proof · supporting · **Follows** capability · outcome · **Precedes** decision-support · validation
**Media** presence **none**, anchor —
**Envelope** archetypes `proof-layout` — hierarchy proof–supporting — density low — capacity triad–small-set — registers quiet · confident · editorial
**Addresses** executive · enterprise · marketing
**Distinct from** `grid-four-column-equal-cards` — low-drama where cards are a peak; reach for whichever the *rhythm* needs, since the content is interchangeable · `outcome-stats` — measures with a line of framing, not measures inside an argument
*Why it works* — it supplies evidence without spending the page's attention budget, which is what lets proof appear more than once without the page becoming a scoreboard.
*Reach for it* between base bands, or wherever proof is needed and a peak is not. *Not when* this is the page's only evidence — it is too quiet to carry that alone.

#### `outcome-stats` — Outcome · stats band
**Structure** Grid · **Arrangement** `four-column-equal` · **Interaction** `reveal-only`
**Reuse** `reusable` · **Tags** `stack-on-mobile`
*Structure evidence* — body grid repeat(4, 1fr)
**Leads with** prove · **Also carries** persuade · educate
**Emphasis** structure · **Relates** cause-and-effect · validation · transformational · **Carries** outcome · proof · evidence · context
**Density** medium · **Capacity** small-set · **Pace** moderate · **Load** medium · **Registers** confident · technical · editorial
**Role** proof · secondary · **Follows** problem · capability · **Precedes** validation · decision-support
**Media** presence `xs`, anchor `inline` — gauges and progress indicators, not imagery
**Envelope** archetypes `proof-layout` · `editorial-split` — hierarchy proof–secondary — density medium — capacity triad–small-set — registers confident · technical · editorial
**Addresses** executive · enterprise · operational
**Distinct from** `grid-four-column-equal-cards` — argues the outcome rather than displaying the measures · `split-layout-asymmetric` — outcome-led where value-stats is capability-led; the difference is whether the number is a *result* or a *property* · `results-proof` — no customer attribution; the claim is the organisation's own
*Why it works* — the copy states what changed and the measures show by how much, so cause and magnitude arrive together. That is a genuinely different act from presenting figures, and it is what lets this section carry a transformational claim.
*Reach for it* when the numbers describe a change and the change needs naming. *Not when* the measures are properties rather than results.

#### `stat-tiles` — Stat tiles *(atom)*
**Structure** Atom · **Arrangement** — · **Interaction** `static`
**Reuse** `reusable` · **Tags** —
*Structure evidence* — catalog cat=atom
**Leads with** prove · **Also carries** —
**Emphasis** structure · **Relates** validation · **Carries** proof · outcome · evidence
**Density** medium · **Capacity** small-set · **Pace** fast · **Load** light · **Registers** confident · technical · quiet
**Role** — *(an atom holds no narrative role; it inherits the role of the band it is composed into)* · **Follows** — · **Precedes** —
**Media** presence **none**, anchor —
**Envelope** contributes a measure group to any band; takes the register, density and hierarchy of its host
**Addresses** executive · enterprise
**Distinct from** `grid-four-column-equal-cards` · `stat-band` · `grid-four-column-equal` — those are complete bands with a heading and a rhythm of their own; this is the measure group alone, for composing into a band that already has both
*Why it works* — it is the smallest honest unit of evidence, which is what makes it composable: it can be added to a hero, a value band or a closing panel without importing a second heading or a second surface.
*Reach for it* when an existing band needs measures inside it. *Not as* a section — placed alone it is a band with no subject.

## Social proof / logos

#### `logo-strip` — Logo strip
**Structure** Marquee · **Arrangement** `single-row` · **Interaction** `marquee`
**Reuse** `reusable` · **Tags** `logos` · `full-bleed`
*Structure evidence* — infinite non-fading transform, no grid
**Leads with** build-trust · **Also carries** orient
**Emphasis** structure · **Relates** validation · **Carries** validation · evidence
**Density** low · **Capacity** large-set · **Pace** fast · **Load** light · **Registers** quiet
**Role** supporting · **Follows** context · capability · **Precedes** problem · capability
**Media** presence **none**, anchor — · **requires** real marks; an invented one is the most damaging content in the library
**Envelope** archetypes `editorial-stack` — hierarchy supporting — density low — capacity large-set — registers quiet · editorial
**Addresses** enterprise · executive · marketing
**Distinct from** `logo-marquee` — quiet where the marquee is a beat; the same marks doing opposite rhythmic work · `grid-five-column-equal` — customers rather than investors, and a moving rail rather than a wall · `integration-grid` — who uses it, not what it connects to
*Why it works* — it makes an assertion with no sentence attached, at the lowest visual weight available, which is why it can sit directly beneath a hero without competing with it. Motion keeps a long list from reading as a wall.
*Reach for it* early, under the opening, when borrowed credibility should arrive before the argument does. *Not when* the marks cannot be shown, and never with a claim attached — a strip that argues stops being a strip.

#### `logo-marquee` — Logo marquee
**Structure** Marquee · **Arrangement** `single-row` · **Interaction** `marquee`
**Reuse** `reusable` · **Tags** `logos` · `dark-band`
*Structure evidence* — infinite non-fading transform, no grid
**Leads with** build-trust · **Also carries** orient
**Emphasis** structure · **Relates** validation · **Carries** validation · evidence
**Density** low · **Capacity** large-set · **Pace** fast · **Load** light · **Registers** confident · immersive
**Role** proof · supporting · **Follows** capability · outcome · **Precedes** decision-support · validation
**Media** presence **none**, anchor — · **requires** real marks
**Envelope** archetypes `editorial-stack` — hierarchy proof–supporting — density low — capacity large-set — registers confident · immersive
**Addresses** enterprise · marketing
**Distinct from** `logo-strip` — a deliberate accent beat rather than a quiet under-hero band · `integrations` — who trusts it, not what it connects to
*Why it works* — the same marks that read as attribution under a hero read as a claim when given an accent band mid-page. Placement and treatment change what the identical content means, which is the clearest case in the library for reading a structure by its rhythmic job rather than its contents.
*Reach for it* when a run of quiet bands needs a proof beat and the marks are strong. *Not when* an accent band already sits adjacent.

#### `grid-five-column-equal` — Backed by
**Structure** Grid · **Arrangement** `five-column-equal` · **Interaction** `reveal-only`
**Reuse** `reusable` · **Tags** `logos` · `intro-split`
*Structure evidence* — body grid repeat(5, 1fr)
**Leads with** build-trust · **Also carries** orient
**Emphasis** structure · **Relates** validation · hierarchical · **Carries** validation · evidence · context
**Density** low · **Capacity** large-set · **Pace** fast · **Load** light · **Registers** quiet · confident
**Role** proof · supporting · **Follows** context · validation · **Precedes** context · capability
**Media** presence **none**, anchor — · **requires** real named parties
**Envelope** archetypes `feature-comparison` · `editorial-stack` — hierarchy proof–supporting — density low — capacity small-set–large-set — registers quiet · confident
**Addresses** executive · enterprise · specialist
**Distinct from** `logo-strip` — a still wall rather than a moving rail, because these marks are meant to be *read* individually · `team-grid` — the parties behind the organisation, not the people in it
*Why it works* — stillness is the decision. Investors and backers are read one at a time and weighed; a moving rail would make them scenery, and scenery cannot confer standing.
*Reach for it* on credibility and about pages where who stands behind the organisation matters. *Not on* conversion pages, where it answers a question nobody in a buying posture is asking.

#### `results-proof` — Results & case study
**Structure** Grid · **Arrangement** `four-column-unequal` · **Interaction** `count-up`
**Reuse** `reusable` · **Tags** `metrics` · `full-bleed` · `stack-on-mobile`
*Structure evidence* — body grid 1.3fr 0.82fr 1fr 0.88fr
**Leads with** prove · **Also carries** build-trust · persuade
**Emphasis** structure · **Relates** validation · cause-and-effect · **Carries** proof · evidence · outcome · validation
**Density** high · **Capacity** small-set · **Pace** moderate · **Load** medium · **Registers** confident · technical
**Role** proof · **Follows** capability · outcome · process · **Precedes** decision-support · validation
**Media** presence `s`, anchor `inline` — **requires** real attribution: a named party, real measures
**Envelope** archetypes `proof-layout` — hierarchy proof — density medium–high — capacity triad–small-set — registers confident · technical · editorial
**Addresses** executive · enterprise · operational
**Distinct from** `outcome-stats` — the claim is *attributed to a customer*, which is what makes it evidence rather than assertion · `wide-card-internal-columns` — measures leading with a voice attached, where the stack leads with the voice · `customer-story` — one story summarised, not narrated
*Why it works* — a named party, a measure and a mark in one field is the strongest single unit of proof the library holds, because each element covers the others' weakness: the voice makes the number credible, the number makes the voice specific, the mark makes both checkable.
*Reach for it* where one claim must be settled conclusively. *Not when* any element is missing — a case-study shape with an anonymous customer is weaker than the plain stat band it replaced.

## Testimonials / case studies

#### `wide-card-internal-columns` — Testimonial stack
**Structure** Wide Card · **Arrangement** `internal-columns` · **Interaction** `count-up`
**Reuse** `reusable` · **Tags** `metrics` · `quote`
*Structure evidence* — 200px/1fr/224px inside one card, not three peers (measured: body grid 200px minmax(0,1fr) 224px)
**Leads with** build-trust · **Also carries** prove · persuade
**Emphasis** structure · **Relates** validation · supporting · **Carries** validation · proof · outcome · evidence
**Density** medium · **Capacity** singular · **Pace** moderate · **Load** medium · **Registers** human · confident
**Role** proof · secondary · **Follows** capability · outcome · **Precedes** decision-support · validation
**Media** presence `s`, anchor `inline` — **requires** a named person and real measures
**Envelope** archetypes `editorial-split` · `proof-layout` — hierarchy proof–secondary — density medium — capacity singular — registers human · confident
**Addresses** enterprise · executive · operational
**Distinct from** `testimonial-bento` — one voice given the field, where the bento carries several · `results-proof` — the voice leads and the measures attend it; results-proof reverses that · `customer-story` — a quote with metrics, not a narrative
*Why it works* — one named voice beside its numbers is credible in a way a wall of quotes is not: the reader can attach the claim to a person and an outcome simultaneously. Giving it the whole field is what says *this one is real*.
*Reach for it* when one customer's endorsement carries more than five would. *Not when* breadth is the point — a single voice implies a single case.

#### `testimonial-bento` — Testimonial bento
**Structure** Bento · **Arrangement** `feature-dominant` · **Interaction** `count-up`
**Reuse** `reusable` · **Tags** `metrics` · `quote` · `full-bleed` · `stack-on-mobile`
*Structure evidence* — spans=2 placed=12
**Leads with** build-trust · **Also carries** prove · educate
**Emphasis** structure · **Relates** validation · supporting · hierarchical · **Carries** validation · proof · outcome · capability
**Density** high · **Capacity** small-set · **Pace** moderate · **Load** medium · **Registers** human · confident · editorial
**Role** proof · **Follows** capability · outcome · **Precedes** decision-support · validation
**Media** presence `xs`–`s`, anchor `inline` — **requires** real attribution on every voice
**Envelope** archetypes `proof-layout` · `editorial-stack` — hierarchy proof–primary — density medium–high — capacity small-set — registers human · confident · editorial
**Addresses** enterprise · marketing · operational
**Distinct from** `wide-card-internal-columns` — several voices unequally weighted, where the stack gives one the field · `reviews-carousel` — a composed set held still, not a volume signal in motion · `feature-bento` — the same unequal grid carrying voices rather than claims, and it works as a cross-pick in either direction
*Why it works* — unequal cells let one endorsement lead while the others establish that it is not the only one, so breadth and depth arrive together. That is the argument a flat wall of quotes cannot make.
*Reach for it* when several voices exist and one is strongest. *Not when* every voice is equally weak — the largest cell will expose it.

#### `testimonial-slider` — Testimonial slider
**Structure** Carousel · **Arrangement** `full-width` · **Interaction** `slider`
**Reuse** `reusable` · **Tags** `screenshot` · `quote` · `cards` · `stack-on-mobile`
*Structure evidence* — catalog interaction slider; js slider detected
**Leads with** build-trust · **Also carries** prove · persuade
**Emphasis** typography · **Relates** validation · supporting · **Carries** validation · proof · outcome
**Density** low · **Capacity** singular · **Pace** slow · **Load** light · **Registers** human · reflective
**Role** proof · secondary · **Follows** capability · outcome · **Precedes** decision-support · validation
**Media** presence `s`, anchor `left` · `right` — **requires** named voices
**Envelope** archetypes `editorial-split` — hierarchy proof–secondary — density low — capacity singular — registers human · reflective · quiet
**Addresses** executive · enterprise
**Distinct from** `reviews-carousel` — manually advanced and one long quote at a time, where the carousel moves on its own through short ones · `wide-card-internal-columns` — several available, one shown; the stack commits to one
*Why it works* — a long quote needs room and time, and manual advance gives the reader both. Auto-advance would take the quote away mid-sentence, which is why this structure and the carousel are not interchangeable despite sharing a mechanism.
*Reach for it* when the quotes are substantial and worth reading whole. *Not when* they are one line each — the mechanism will cost more attention than the content returns.

#### `reviews-carousel` — Reviews carousel
**Structure** Carousel · **Arrangement** `full-width` · **Interaction** `carousel`
**Reuse** `reusable` · **Tags** `icon-led` · `quote` · `cards`
*Structure evidence* — catalog interaction carousel; js slider detected
**Leads with** build-trust · **Also carries** persuade
**Emphasis** structure · **Relates** validation · **Carries** validation · evidence
**Density** medium · **Capacity** large-set · **Pace** fast · **Load** light · **Registers** human · confident
**Role** proof · supporting · **Follows** capability · outcome · **Precedes** decision-support · validation
**Media** presence `xs`, anchor `inline` — **requires** real reviews
**Envelope** archetypes `feature-comparison` · `editorial-stack` — hierarchy proof–supporting — density medium — capacity large-set — registers human · confident
**Addresses** marketing · operational
**Distinct from** `testimonial-slider` — volume is the signal, not depth; no individual review is meant to be dwelt on · `logo-strip` — named voices rather than marks, so it carries sentiment as well as attribution
*Why it works* — many short reviews in motion say *a lot of people think this* in a way that three carefully chosen quotes cannot, because the reader is meant to register quantity rather than read any one. That is why the motion is a feature here and a fault in the slider.
*Reach for it* when the argument is breadth of goodwill. *Not when* the reviews are few — a carousel of three exposes exactly how few there are.

#### `carousel-cards` — Case study carousel
**Structure** Carousel · **Arrangement** `cards` · **Interaction** `carousel`
**Reuse** `reusable` · **Tags** `full-bleed` · `stack-on-mobile`
*Structure evidence* — card slides, not full-width (measured: catalog interaction carousel; js slider detected)
**Leads with** build-trust · **Also carries** prove · educate
**Emphasis** creative · **Relates** validation · cause-and-effect · **Carries** validation · proof · outcome · context
**Density** medium · **Capacity** small-set · **Pace** moderate · **Load** medium · **Registers** editorial · narrative
**Role** proof · secondary · **Follows** capability · outcome · **Precedes** decision-support · validation
**Media** presence `l`, anchor `framed` — **requires** real case imagery and real outcomes
**Envelope** archetypes `storytelling-composition` · `product-showcase` — hierarchy proof–secondary — density medium — capacity small-set — registers editorial · narrative
**Addresses** enterprise · executive · marketing
**Distinct from** `customer-story` — several cases browsable, where customer-story commits to one in depth · `resources-carousel` — cases as evidence, not articles as material · `reviews-carousel` — a few substantial cases, not many short signals
*Why it works* — each slide is a whole composition, so browsing does not degrade into skimming. It is the heaviest proof structure in the library and earns that on pages where the buying decision genuinely turns on precedent.
*Reach for it* on decision-stage pages with real, visual cases. *Not on* short pages — it will dominate them.

#### `customer-story` — Customer stories
**Structure** Carousel · **Arrangement** `full-width` · **Interaction** `carousel`
**Reuse** `reusable` · **Tags** `intro-split` · `stack-on-mobile`
*Structure evidence* — flex:0 0 100% slides, auto-advancing (measured: catalog interaction carousel)
**Leads with** build-trust · **Also carries** prove · persuade · educate
**Emphasis** creative · **Relates** cause-and-effect · transformational · validation · **Carries** validation · outcome · proof · context · problem
**Density** high · **Capacity** singular · **Pace** slow · **Load** heavy · **Registers** narrative · human
**Role** proof · primary · **Follows** problem · capability · **Precedes** outcome · decision-support
**Media** presence `l`, anchor `left` · `right` — **requires** a real, complete, attributable story
**Envelope** archetypes `storytelling-composition` — hierarchy proof–primary — density medium–high — capacity singular — registers narrative · human · immersive
**Addresses** enterprise · executive · operational
**Distinct from** `carousel-cards` — one story narrated rather than several browsed · `wide-card-internal-columns` — the whole arc, not the endorsement at the end of it · `results-proof` — the story told, not its result summarised
*Why it works* — it is the only structure in the library that carries a complete before-and-after with a named party attached, which is why it is the heaviest thing here to read and the hardest to argue with. The load is real and must be paid for with rest afterwards.
*Reach for it* when one engagement is genuinely the argument. *Not when* the story is thin — this structure will make the thinness the subject.

## Comparison

#### `compare-table` — Compare table
**Structure** Comparison Table · **Arrangement** `column-matrix` · **Interaction** `static`
**Reuse** `reusable` · **Tags** `icon-led` · `bordered`
*Structure evidence* — subgrid master alignment
**Leads with** compare · **Also carries** educate · persuade
**Emphasis** structure · **Relates** contrasting · hierarchical · **Carries** decision-support · capability · risk · context
**Density** high · **Capacity** small-set · **Pace** slow · **Load** heavy · **Registers** technical · instructional
**Role** technical · secondary · **Follows** capability · decision-support · **Precedes** decision-support · validation
**Media** presence **none**, anchor —
**Envelope** archetypes `feature-comparison` — hierarchy technical–secondary — density high — capacity paired–small-set — registers technical · instructional
**Addresses** technical · enterprise · specialist · operational
**Distinct from** `pricing` — comparing *what things are*, not what they cost · `tabs-panel-below` — all options visible at once, which is the entire difference; a tabbed structure cannot support weighing · `feature-trio` — a matrix read across factors, not a set read as peers
*Why it works* — the structure *is* the message: an even field with no emphasised option is what makes weighing possible, and any emphasis destroys it. This is the library's clearest case of a layout whose neutrality is its function.
*Reach for it* whenever a reader must genuinely choose — plans, us-versus-alternative, build-versus-buy, approach against approach. The content is interchangeable; the act of weighing is not. *Not when* one option is meant to win — an emphasised column turns a comparison into an argument and the reader will notice.

#### `comparison` — Comparison column *(atom)*
**Structure** Atom · **Arrangement** — · **Interaction** `static`
**Reuse** `reusable` · **Tags** —
*Structure evidence* — catalog cat=atom
**Leads with** compare · **Also carries** —
**Emphasis** structure · **Relates** contrasting · **Carries** decision-support · capability
**Density** high · **Capacity** singular · **Pace** moderate · **Load** medium · **Registers** technical · instructional
**Role** — *(inherits the role of its host band)* · **Follows** — · **Precedes** —
**Media** presence **none**, anchor —
**Envelope** contributes one comparable column to a band that supplies the heading and the other columns
**Addresses** technical · enterprise · specialist
**Distinct from** `compare-table` — one column, not the matrix; alone it presents a position with nothing to weigh it against
*Why it works* — a comparison is built from parallel columns, and having the column as a unit is what lets a matrix be assembled from several donors rather than taken whole from one.
*Reach for it* when composing a comparison from parts. *Not as* a section — a single column is an assertion wearing the costume of a comparison.

## Pricing

#### `pricing` — Pricing · plans + toggle
**Structure** Grid · **Arrangement** `four-column-equal` · **Interaction** `toggle`
**Reuse** `reusable` · **Tags** `screenshot` · `cards` · `intro-split` · `full-bleed` · `stack-on-mobile`
*Structure evidence* — body grid repeat(4, 1fr)
**Leads with** compare · **Also carries** convert · educate
**Emphasis** structure · **Relates** contrasting · hierarchical · **Carries** decision-support · capability · context
**Density** high · **Capacity** small-set · **Pace** slow · **Load** heavy · **Registers** technical · confident
**Role** technical · closing · **Follows** capability · decision-support · **Precedes** decision-support · validation
**Media** presence **none**, anchor —
**Envelope** archetypes `feature-comparison` — hierarchy technical–closing — density high — capacity triad–small-set — registers technical · confident
**Addresses** operational · enterprise · marketing
**Distinct from** `pricing-packages` — equal parallel plans, where packages exist because the offers are unequal · `pricing-tabbed` — one axis of choice, not two · `compare-table` — what each costs, not what each is
*Why it works* — equal cards make plans comparable, and the toggle adds a second dimension without adding a second structure. It is the one place in the library where an identical repeated grid is correct, because comparison is the declared purpose.
*Reach for it* when plans are genuinely parallel and differ by tier. *Not when* the offers are shaped differently — equal cards will force unequal things into a false symmetry.

#### `pricing-packages` — Pricing & packages
**Structure** Bento · **Arrangement** `feature-dominant` · **Interaction** `reveal-only`
**Reuse** `reusable` · **Tags** `screenshot` · `cards` · `full-bleed` · `stack-on-mobile`
*Structure evidence* — spans=1 placed=0
**Leads with** compare · **Also carries** persuade · convert
**Emphasis** structure · **Relates** contrasting · hierarchical · **Carries** decision-support · capability · solution
**Density** medium · **Capacity** triad · **Pace** moderate · **Load** medium · **Registers** confident · editorial
**Role** technical · secondary · **Follows** capability · decision-support · **Precedes** decision-support · validation
**Media** presence `xs`–`s`, anchor `inline`
**Envelope** archetypes `editorial-stack` · `proof-layout` — hierarchy technical–secondary — density medium — capacity paired–triad — registers confident · editorial
**Addresses** enterprise · executive · marketing
**Distinct from** `pricing` — the offers are *unequal by nature*, so the grid must be too; forcing them into peer cards misrepresents them · `pricing-tabbed` — unequal in size rather than split by reader
*Why it works* — services and packages are rarely tiers of one thing, and an unequal grid tells the truth about that. The reader is being shown a range of engagements rather than a ladder, and the geometry says so before the copy does.
*Reach for it* for services, retainers, engagements — offers that differ in kind. *Not when* the offers really are tiers.

#### `pricing-tabbed` — Pricing · tabbed
**Structure** Tabs · **Arrangement** `panel-right` · **Interaction** `tabs`
**Reuse** `reusable` · **Tags** `icon-led` · `stack-on-mobile`
*Structure evidence* — catalog tabs
**Leads with** compare · **Also carries** orient · educate · convert
**Emphasis** structure · **Relates** contrasting · hierarchical · **Carries** decision-support · capability · context
**Density** high · **Capacity** small-set · **Pace** slow · **Load** heavy · **Registers** technical · human
**Role** technical · **Follows** decision-support · capability · **Precedes** decision-support · validation
**Media** presence **none**, anchor —
**Envelope** archetypes `feature-comparison` — hierarchy technical — density high — capacity triad–small-set — registers technical · human · confident
**Addresses** enterprise · operational · specialist
**Distinct from** `pricing` — plans split by *who is reading*, which is a second question before the first · `tabs-panel-below` — cost by persona, not capability by product
*Why it works* — it asks the reader to identify themselves before comparing, which is right when the plans genuinely differ by audience and wrong when they do not. Sorting by persona removes irrelevant options; inventing personas to justify tabs adds a decision nobody needed.
*Reach for it* when distinct reader kinds face genuinely different plans. *Not when* one plan set serves everyone.

#### `subscription-faq` — Subscription · plans + FAQ
**Structure** Grid · **Arrangement** `four-column-equal` · **Interaction** `toggle` · `accordion`
**Reuse** `reusable` · **Tags** `screenshot` · `cards` · `intro-split` · `stack-on-mobile`
*Structure evidence* — repeat(4,1fr) plan cards are the repeated content (measured: spans=0 placed=3)
**Leads with** compare · **Also carries** educate · convert
**Emphasis** structure · **Relates** contrasting · dependency · **Carries** decision-support · capability · risk · context
**Density** high · **Capacity** small-set · **Pace** slow · **Load** heavy · **Registers** technical · instructional
**Role** technical · closing · **Follows** decision-support · capability · **Precedes** validation · decision-support
**Media** presence **none**, anchor —
**Envelope** archetypes `feature-comparison` — hierarchy technical–closing — density high — capacity small-set — registers technical · instructional
**Addresses** operational · enterprise
**Distinct from** `pricing` — answers the objections in the same band rather than leaving them to a later one · `faq-split` — objections attached to a decision, not standing alone
*Why it works* — the questions a price raises are answered where the price is, so the reader does not have to hold a doubt while scrolling to find its answer. It is the densest band in the library and only justified when the page cannot afford two.
*Reach for it* on short pages where plans and objections must both fit. *Not on* long pages — separating them lets each breathe, and this structure is heavy enough to need the excuse.

## FAQ

#### `faq-split` — FAQ · split column
**Structure** Accordion · **Arrangement** `panel-right` · **Interaction** `accordion`
**Reuse** `purpose-bound` · **Tags** `stack-on-mobile`
*Structure evidence* — catalog accordion; grid True
**Leads with** educate · **Also carries** explain · build-trust
**Emphasis** structure · **Relates** dependency · contrasting · **Carries** risk · context · decision-support · validation
**Density** medium · **Capacity** large-set · **Pace** slow · **Load** medium · **Registers** instructional · technical
**Role** technical · supporting · **Follows** decision-support · capability · **Precedes** decision-support · validation
**Media** presence **none**–`xs`, anchor `inline`
**Envelope** archetypes `editorial-split` · `narrative-flow` — hierarchy technical–supporting — density medium — capacity small-set–large-set — registers instructional · technical
**Addresses** operational · technical · enterprise
**Distinct from** `faq-centered` — the heading held aside so a long list stays scannable; centred cannot do that past six · `faq-single` — a two-column field rather than one column · `accordion-panel-right` — the same mechanism answering *doubt* rather than curiosity
*Why it works* — moving the heading out of the flow means the list can run long without the section losing its subject. Objection-handling is the one job where quantity is a virtue, and this is the only FAQ structure that survives it.
*Reach for it* for more than six questions. *Not when* the list is short — the aside will look like a missing column.

#### `faq-centered` — FAQ · centered column
**Structure** Centered Stack · **Arrangement** `single-column` · **Interaction** `accordion`
**Reuse** `purpose-bound` · **Tags** —
*Structure evidence* — no grid in the base layer
**Leads with** educate · **Also carries** explain · build-trust
**Emphasis** typography · **Relates** dependency · **Carries** risk · context · decision-support
**Density** low · **Capacity** small-set · **Pace** moderate · **Load** light · **Registers** quiet · instructional
**Role** supporting · closing · **Follows** decision-support · capability · **Precedes** decision-support · validation
**Media** presence **none**, anchor —
**Envelope** archetypes `editorial-stack` — hierarchy supporting–closing — density low — capacity small-set — registers quiet · instructional
**Addresses** marketing · operational
**Distinct from** `faq-split` — short and centred, where split is long and asymmetric · `faq-single` — centred rather than left-aligned, which is why it reads as a closing beat rather than a body one
*Why it works* — centring a short list near the page end says *these are the last few things* — it settles rather than opens. That is a placement claim as much as a layout one.
*Reach for it* for six or fewer questions near the close. *Not when* the list will grow.

#### `faq-single` — FAQ · single column
**Structure** Centered Stack · **Arrangement** `single-column` · **Interaction** `accordion`
**Reuse** `purpose-bound` · **Tags** `icon-led`
*Structure evidence* — no grid in the base layer
**Leads with** educate · **Also carries** explain
**Emphasis** typography · **Relates** dependency · **Carries** risk · context · decision-support
**Density** low · **Capacity** large-set · **Pace** slow · **Load** light · **Registers** quiet · reflective
**Role** supporting · technical · **Follows** decision-support · capability · **Precedes** validation · decision-support
**Media** presence **none**, anchor —
**Envelope** archetypes `editorial-stack` — hierarchy supporting–technical — density low — capacity small-set–large-set — registers quiet · reflective · instructional
**Addresses** technical · specialist · operational
**Distinct from** `faq-centered` — left-aligned and quieter still; nothing about it asks to close the page · `faq-split` — one column, so a long list has no aside to anchor it
*Why it works* — it is the least eventful structure in the library, and that is the point: on a page with no room for another moment, questions can still be answered without the page acquiring one.
*Reach for it* on quiet pages, or where an FAQ is genuinely reference material. *Not when* the questions are load-bearing for the decision.

#### `faq` — FAQ row *(atom)*
**Structure** Atom · **Arrangement** — · **Interaction** `static`
**Reuse** `purpose-bound` · **Tags** —
*Structure evidence* — catalog cat=atom
**Leads with** orient · **Also carries** educate
**Emphasis** typography · **Relates** supporting · **Carries** context · decision-support
**Density** low · **Capacity** small-set · **Pace** fast · **Load** light · **Registers** quiet
**Role** — *(inherits the role of its host band)* · **Follows** — · **Precedes** —
**Media** presence **none**, anchor —
**Envelope** contributes a teaser row that points at answers held elsewhere
**Addresses** marketing · operational
**Distinct from** the three FAQ sections — it does not answer anything; it signals that answers exist and where
*Why it works* — naming the questions without opening them tells a hesitant reader that their doubt has been anticipated, at almost no cost in space.
*Reach for it* when a page must acknowledge questions it is not the right page to answer. *Not as* an FAQ — a row of questions with no answers anywhere is worse than silence.

## CTA (closing)

#### `cta-banner` — CTA banner
**Structure** Centered Stack · **Arrangement** `single-column` · **Interaction** `static`
**Reuse** `reusable` · **Tags** —
*Structure evidence* — no grid in the base layer
**Leads with** close · **Also carries** convert
**Emphasis** typography · **Relates** supporting · **Carries** decision-support · solution
**Density** low · **Capacity** singular · **Pace** fast · **Load** light · **Registers** closing · confident
**Role** closing · **Follows** outcome · validation · proof · **Precedes** — *(the footer follows)*
**Media** presence **none**, anchor —
**Envelope** archetypes `editorial-stack` — hierarchy closing — density low — capacity singular — registers closing · confident
**Addresses** marketing · executive
**Distinct from** `cta-band` — no link columns; the shortest possible close · `cta-orbit` — undecorated · `hero-horizon-light` — an accent band rather than a soft base one, so it concludes rather than invites
*Why it works* — one line and one action on an accent surface is unmistakable as an ending. Its brevity is what makes it read as arrival rather than as another section.
*Reach for it* when the footer follows immediately and the page has already made its case. *Not mid-page* — a conclusion placed in the middle stops the argument it interrupts.

#### `cta-band` — CTA band
**Structure** Centered Stack · **Arrangement** `single-column` · **Interaction** `reveal-only`
**Reuse** `reusable` · **Tags** —
*Structure evidence* — no grid in the base layer
**Leads with** close · **Also carries** convert · orient
**Emphasis** typography · **Relates** supporting · hierarchical · **Carries** decision-support · solution · context
**Density** medium · **Capacity** small-set · **Pace** fast · **Load** light · **Registers** closing · confident
**Role** closing · **Follows** outcome · validation · proof · **Precedes** —
**Media** presence **none**, anchor —
**Envelope** archetypes `editorial-stack` — hierarchy closing — density low–medium — capacity singular–small-set — registers closing · confident
**Addresses** marketing · enterprise
**Distinct from** `cta-banner` — carries onward links for readers not ready to act, which the banner deliberately does not · `footer-cta` — still a section; the footer remains separate
*Why it works* — it closes for the ready reader and hands off for the unready one in the same band, which is what makes it the safer close on pages serving a mixed audience.
*Reach for it* when the ask should not be the page's only exit. *Not when* a single action must be unmissable — the links dilute it.

#### `cta-orbit` — CTA orbit band
**Structure** Split Layout · **Arrangement** `asymmetric` · **Interaction** `reveal-only`
**Reuse** `reusable` · **Tags** `stack-on-mobile` · `dark-band`
*Structure evidence* — two-track grid minmax(0, 560px) 1fr
**Leads with** close · **Also carries** convert · inspire
**Emphasis** creative · **Relates** supporting · **Carries** decision-support · solution · context
**Density** low · **Capacity** singular · **Pace** moderate · **Load** light · **Registers** closing · immersive · confident
**Role** closing · **Follows** outcome · validation · **Precedes** —
**Media** presence `l`, anchor `right` — decorated; the treatment is the point
**Envelope** archetypes `editorial-split` · `storytelling-composition` — hierarchy closing — density low — capacity singular — registers closing · immersive · confident
**Addresses** marketing · executive
**Distinct from** `cta-banner` · `cta-band` — decorated rather than plain, and therefore an event; those two are conclusions, this is a finale · `cta-footer-reveal` — an accent surface rather than the base one
*Why it works* — the decoration makes the close feel like a destination rather than a stop. That is expensive, and it is why one per page is the limit: two finales is none.
*Reach for it* on flagship pages where the ending should be memorable. *Not on* routine pages, and never twice.

#### `cta-footer-reveal` — CTA split
**Structure** Split Layout · **Arrangement** `balanced` · **Interaction** `reveal-only`
**Reuse** `reusable` · **Tags** `full-bleed` · `stack-on-mobile`
*Structure evidence* — two-track grid minmax(0,1fr) minmax(0,1.04fr)
**Leads with** close · **Also carries** convert · build-trust
**Emphasis** typography · **Relates** supporting · validation · **Carries** decision-support · validation · context
**Density** medium · **Capacity** paired · **Pace** moderate · **Load** light · **Registers** confident · human
**Role** closing · **Follows** outcome · validation · **Precedes** —
**Media** presence `s`, anchor `right`
**Envelope** archetypes `editorial-split` — hierarchy closing — density medium — capacity singular–paired — registers confident · human · closing
**Addresses** enterprise · marketing
**Distinct from** the three accent closes — it stays on the base surface, so the page ends without a change of register · `contact-form` — an ask with reassurance beside it, not a capture
*Why it works* — a close that does not change surface keeps the ending in the same voice as the argument, which suits pages whose credibility is built on restraint. The reassurance beside the ask answers the last hesitation without a further section.
*Reach for it* when the page should conclude without raising its voice. *(The filename says hero and footer; it is neither — read the structure.)*

#### `hero-horizon-light` — Soft CTA
**Structure** Centered Stack · **Arrangement** `single-column` · **Interaction** `static`
**Reuse** `reusable` · **Tags** —
*Structure evidence* — no grid in the base layer
**Leads with** convert · **Also carries** inspire · close
**Emphasis** typography · **Relates** supporting · **Carries** decision-support · solution
**Density** low · **Capacity** singular · **Pace** fast · **Load** light · **Registers** quiet · confident
**Role** closing · supporting · **Follows** outcome · capability · **Precedes** decision-support · validation
**Media** presence **none**, anchor —
**Envelope** archetypes `editorial-stack` — hierarchy supporting–closing — density low — capacity singular — registers quiet · confident · closing
**Addresses** marketing · executive
**Distinct from** `cta-banner` — base surface and gentle, so it can sit *mid-page* without ending it — the one CTA structure in the library that can · `mission-reveal` — it asks; mission-reveal does not
*Why it works* — an invitation at low volume does not read as a conclusion, which is what lets a long page offer a way to act partway through without stopping. **The filename says hero; its own markup labels it a CTA. The structure is a CTA.**
*Reach for it* mid-page on long pages, or as a gentle close. *Not when* the ask must be decisive.

## Contact / forms

#### `contact-form` — Contact · form
**Structure** Form Split · **Arrangement** `asymmetric` · **Interaction** `form` · `reveal-only`
**Reuse** `purpose-bound` · **Tags** `stack-on-mobile`
*Structure evidence* — <form> present; first grid 62fr 38fr
**Leads with** convert · **Also carries** build-trust
**Emphasis** structure · **Relates** supporting · dependency · **Carries** decision-support · context · validation
**Density** medium · **Capacity** singular · **Pace** slow · **Load** medium · **Registers** human · confident
**Role** closing · **Follows** validation · outcome · **Precedes** —
**Media** presence `s`, anchor `right`
**Envelope** archetypes `editorial-split` — hierarchy closing — density medium — capacity singular — registers human · confident
**Addresses** operational · enterprise
**Distinct from** `contact-us` — one capture, not two · `contact-methods` — a form with reassurance beside it, not with alternatives beside it · `book-demo` — a general enquiry, not a scheduled sales motion
*Why it works* — reassurance placed beside the fields rather than above them answers hesitation at the moment it arises, which is while the reader is looking at the form and deciding whether to start.
*Reach for it* as the plain capture at the end of a page that has made its case. *Not when* the reader needs a choice of how to make contact.

#### `contact-us` — Contact us + newsletter
**Structure** Form Split · **Arrangement** `balanced` · **Interaction** `form`
**Reuse** `purpose-bound` · **Tags** `screenshot` · `stack-on-mobile`
*Structure evidence* — <form> present; first grid 1fr 1fr
**Leads with** convert · **Also carries** build-trust · orient
**Emphasis** structure · **Relates** contrasting · supporting · **Carries** decision-support · context
**Density** high · **Capacity** paired · **Pace** slow · **Load** medium · **Registers** human · confident
**Role** closing · **Follows** validation · outcome · **Precedes** —
**Media** presence `xs`–`s`, anchor `inline`
**Envelope** archetypes `editorial-split` — hierarchy closing — density medium–high — capacity paired — registers human · confident
**Addresses** marketing · operational
**Distinct from** `contact-form` — two captures at different commitment levels, which is a deliberate choice and not a busier version of one
*Why it works* — offering a low-commitment capture beside a high-commitment one keeps the not-yet-ready reader rather than losing them at the last band. The two asks must be visibly unequal or they compete.
*Reach for it* when both a direct enquiry and a standing subscription are worth having. *Not when* one ask must dominate.

#### `contact-methods` — Contact methods + form
**Structure** Form Split · **Arrangement** `balanced` · **Interaction** `form`
**Reuse** `purpose-bound` · **Tags** `icon-led` · `stack-on-mobile`
*Structure evidence* — <form> present; first grid 1fr 1fr
**Leads with** convert · **Also carries** orient · build-trust
**Emphasis** structure · **Relates** contrasting · supporting · **Carries** decision-support · context
**Density** medium · **Capacity** triad · **Pace** moderate · **Load** light · **Registers** human · instructional
**Role** closing · secondary · **Follows** validation · context · **Precedes** —
**Media** presence **none**–`xs`, anchor `inline`
**Envelope** archetypes `editorial-split` — hierarchy secondary–closing — density medium — capacity triad — registers human · instructional
**Addresses** operational · enterprise · specialist
**Distinct from** `contact-form` — the reader chooses *how* to make contact; a form-only structure decides that for them · `contact` — a band, not a whole page body
*Why it works* — different readers need different channels, and showing the choice removes the friction of a reader who will not use a form and cannot see an alternative. Support-shaped audiences need this; conversion-shaped ones rarely do.
*Reach for it* when the audience genuinely contacts in more than one way. *Not on* a marketing page where a single ask should be unmissable.

#### `contact` — Contact page body
**Structure** Form Split · **Arrangement** `asymmetric` · **Interaction** `form` · `reveal-only`
**Reuse** `purpose-bound` · **Tags** `stack-on-mobile`
*Structure evidence* — <form> present; first grid minmax(0, 0.72fr) minmax(0, 1.28fr)
**Leads with** convert · **Also carries** orient · educate
**Emphasis** structure · **Relates** supporting · dependency · **Carries** decision-support · context · validation
**Density** high · **Capacity** small-set · **Pace** slow · **Load** medium · **Registers** instructional · human
**Role** primary · hero · **Follows** — · **Precedes** validation · context
**Media** presence **none**–`xs`, anchor `inline`
**Envelope** archetypes `editorial-split` · `editorial-stack` — hierarchy hero–primary — density medium–high — capacity small-set — registers instructional · human
**Addresses** operational · enterprise
**Distinct from** every other structure here — it opens with the page's own top-level heading, which means it *is* the page rather than a band within one; the others are bands
*Why it works* — when contact is the destination rather than the conclusion, the capture deserves the page's opening weight instead of its closing weight. Reading this structure as a band is the error it invites.
*Reach for it* as a standalone contact page. *Not as* a closing band on a marketing page — it will outweigh what precedes it.

#### `book-demo` — Book a demo
**Structure** Form Split · **Arrangement** `asymmetric` · **Interaction** `form`
**Reuse** `purpose-bound` · **Tags** `screenshot` · `stack-on-mobile`
*Structure evidence* — <form> present; first grid 45fr 55fr
**Leads with** convert · **Also carries** persuade · prove
**Emphasis** creative · **Relates** supporting · cause-and-effect · **Carries** decision-support · capability · proof
**Density** high · **Capacity** singular · **Pace** slow · **Load** medium · **Registers** confident · technical
**Role** closing · **Follows** outcome · validation · **Precedes** —
**Media** presence `l`, anchor `framed` — **requires** a real product artifact beside the capture
**Envelope** archetypes `product-showcase` · `editorial-split` — hierarchy closing — density medium–high — capacity singular — registers confident · technical
**Addresses** enterprise · technical · executive
**Distinct from** `contact-form` — a sales-led ask that shows what the reader will be shown · `demo-modal` — a band, not an overlay · `hero-agent` — the same demonstration placed at the *end*, where it closes rather than opens
*Why it works* — putting the artifact beside the booking answers *what am I actually agreeing to see*, which is the objection that stops demo bookings. It is the heaviest close in the library and only justified on sales-led pages.
*Reach for it* when the demo is the conversion and the product can be shown. *Not when* the artifact does not exist — the capture is then just a longer contact form.

#### `demo-modal` — AI demo modal *(atom)*
**Structure** Atom · **Arrangement** — · **Interaction** `modal`
**Reuse** `purpose-bound` · **Tags** —
*Structure evidence* — catalog cat=atom
**Leads with** convert · **Also carries** educate
**Emphasis** structure · **Relates** dependency · supporting · **Carries** decision-support · capability · context
**Density** high · **Capacity** singular · **Pace** slow · **Load** medium · **Registers** technical · human
**Role** — *(an overlay holds no place in the progression; it attaches to an action elsewhere)* · **Follows** — · **Precedes** —
**Media** presence `s`, anchor `framed`
**Envelope** attaches to any action on any band; takes no surface, no rhythm slot and no register of its own
**Addresses** technical · operational
**Distinct from** every band here — it is not in the page's flow at all, and treating it as a section places a capture in the progression that the reader never asked to see
*Why it works* — deferring the fields until the reader has committed to the action keeps the page's flow clean while still capturing properly once intent exists.
*Reach for it* attached to a CTA whose capture would otherwise interrupt the page. *Not as* a standalone band.

## Integrations

#### `integration-grid` — Integration grid
**Structure** Grid · **Arrangement** `four-column-equal` · **Interaction** `reveal-only`
**Reuse** `reusable` · **Tags** `logos` · `full-bleed` · `stack-on-mobile`
*Structure evidence* — body grid repeat(4, 1fr)
**Leads with** educate · **Also carries** build-trust · prove
**Emphasis** structure · **Relates** dependency · supporting · **Carries** capability · context · validation
**Density** high · **Capacity** large-set · **Pace** moderate · **Load** medium · **Registers** technical · confident
**Role** technical · secondary · **Follows** capability · solution · **Precedes** decision-support · validation
**Media** presence **none**, anchor — · **requires** real marks
**Envelope** archetypes `feature-comparison` · `editorial-stack` — hierarchy technical–secondary — density high — capacity small-set–large-set — registers technical · confident
**Addresses** technical · operational · enterprise
**Distinct from** `integrations` — each connection carries a line of copy, which is the whole difference: this answers *what does it do with each*, the marquee answers *how many* · `logo-strip` — what it connects to, not who uses it
*Why it works* — a mark with a sentence beside it is a capability claim; a mark alone is a count. This structure exists for readers who are checking whether a specific system is covered, which is a different reader from the one being impressed by breadth.
*Reach for it* when the connections need explaining and a reader is checking for theirs. *Not when* the marks speak alone.

#### `integrations` — Integrations marquee
**Structure** Marquee · **Arrangement** `single-row` · **Interaction** `marquee`
**Reuse** `reusable` · **Tags** `logos` · `full-bleed`
*Structure evidence* — infinite non-fading transform, no grid
**Leads with** build-trust · **Also carries** educate · convert
**Emphasis** structure · **Relates** supporting · validation · **Carries** context · validation
**Density** low · **Capacity** large-set · **Pace** fast · **Load** light · **Registers** confident · immersive
**Role** supporting · proof · **Follows** capability · solution · **Precedes** decision-support · validation
**Media** presence **none**, anchor — · **requires** real marks
**Envelope** archetypes `editorial-stack` — hierarchy supporting–proof — density low — capacity large-set — registers confident · immersive
**Addresses** marketing · operational
**Distinct from** `integration-grid` — breadth as the argument, with no per-item copy · `logo-marquee` — systems connected to, not customers won; the geometry is shared and the claim is not
*Why it works* — for an ecosystem argument the count is the point, and motion carries a count better than a grid, which invites the reader to look for what is missing.
*Reach for it* when *how many* is the claim. *Not when* a reader needs to confirm a specific connection — motion makes scanning for one item actively hard.

## Team / about

#### `team-grid` — Team grid
**Structure** Grid · **Arrangement** `three-column-equal` · **Interaction** `reveal-only`
**Reuse** `reusable` · **Tags** `screenshot` · `portraits` · `cards` · `intro-split` · `stack-on-mobile`
*Structure evidence* — body grid repeat(3, minmax(0, 1fr))
**Leads with** build-trust · **Also carries** orient · educate
**Emphasis** structure · **Relates** supporting · hierarchical · **Carries** context · validation
**Density** medium · **Capacity** large-set · **Pace** fast · **Load** light · **Registers** human · editorial
**Role** secondary · supporting · **Follows** context · validation · **Precedes** context · decision-support
**Media** presence `s`, anchor `inline` — **requires** real photography of real people
**Envelope** archetypes `feature-comparison` · `editorial-stack` — hierarchy secondary–supporting — density medium — capacity small-set–large-set — registers human · editorial
**Addresses** enterprise · marketing · operational
**Distinct from** `team-leadership` — a whole team at even weight, where leadership is a formal, smaller, more deliberate row · `team-visionaries` — many rather than a founding few · `team-about` — people alone, with no story around them
*Why it works* — even weighting across a full team says the organisation is a group rather than a figurehead, which is a claim about how it works and not only about who is in it.
*Reach for it* when the size and evenness of the team is itself reassuring. *Not with* stock photography — invented people are the one failure here that cannot be recovered from. **The same geometry carries any peer set with a portrait; it is only a team structure because of what is put in it.**

#### `team-leadership` — Team leadership
**Structure** Grid · **Arrangement** `four-column-equal` · **Interaction** `reveal-only`
**Reuse** `reusable` · **Tags** `portraits` · `cards`
*Structure evidence* — body grid repeat(4, minmax(0, 1fr))
**Leads with** build-trust · **Also carries** orient
**Emphasis** structure · **Relates** hierarchical · validation · **Carries** context · validation
**Density** medium · **Capacity** small-set · **Pace** moderate · **Load** light · **Registers** confident · editorial · human
**Role** secondary · proof · **Follows** context · validation · **Precedes** context · decision-support
**Media** presence `s`, anchor `inline` — **requires** real, deliberately framed portraits
**Envelope** archetypes `feature-comparison` · `proof-layout` — hierarchy secondary–proof — density medium — capacity triad–small-set — registers confident · editorial · human
**Addresses** executive · enterprise
**Distinct from** `team-grid` — formal framing and fewer people, so each is read individually rather than as a group · `grid-five-column-equal` — the people accountable, not the parties behind them
*Why it works* — the deliberate crop makes these portraits read as standing rather than as staffing. Formality is the argument, which is why the framing cannot be relaxed without losing the point.
*Reach for it* where authority and accountability matter — enterprise, regulated, executive audiences. *Not on* pages where formality would read as distance.

#### `team-about` — Team · who we are
**Structure** Grid · **Arrangement** `four-column-equal` · **Interaction** `reveal-only`
**Reuse** `reusable` · **Tags** `portraits` · `cards` · `intro-split`
*Structure evidence* — body grid repeat(4, minmax(0, 1fr))
**Leads with** build-trust · **Also carries** persuade · educate · orient
**Emphasis** typography · **Relates** supporting · validation · transformational · **Carries** context · validation · capability
**Density** high · **Capacity** small-set · **Pace** slow · **Load** medium · **Registers** human · editorial · reflective
**Role** primary · secondary · **Follows** context · problem · **Precedes** capability · validation
**Media** presence `s`, anchor `inline` — **requires** real portraits
**Envelope** archetypes `editorial-stack` · `editorial-split` — hierarchy primary–secondary — density medium–high — capacity small-set — registers human · editorial · reflective
**Addresses** marketing · enterprise · executive
**Distinct from** the other three team structures — it is the only one carrying a *story*; the rest present people · `value-who` — people carrying the position, not the position carrying itself
*Why it works* — people and narrative in one band lets the reader attach the organisation's account of itself to the faces giving it, which is more persuasive than either alone and is why this is the richest band in the group.
*Reach for it* on about pages where the team and the story are one argument. *Not as* a roster — it is too heavy for that.

#### `team-visionaries` — Team · visionaries
**Structure** Grid · **Arrangement** `three-column-equal` · **Interaction** `reveal-only`
**Reuse** `reusable` · **Tags** `portraits` · `cards` · `stack-on-mobile`
*Structure evidence* — body grid repeat(3, 1fr)
**Leads with** build-trust · **Also carries** orient
**Emphasis** structure · **Relates** hierarchical · **Carries** context · validation
**Density** low · **Capacity** paired · **Pace** fast · **Load** light · **Registers** quiet · human
**Role** supporting · **Follows** context · validation · **Precedes** context · capability
**Media** presence `s`, anchor `inline` — **requires** real portraits
**Envelope** archetypes `editorial-stack` — hierarchy supporting — density low — capacity paired–small-set — registers quiet · human · editorial
**Addresses** marketing · executive
**Distinct from** `team-grid` — built for two-to-four, where a grid of four looks like a team that lost people · `team-leadership` — informal, so it reads as founders rather than as officers
*Why it works* — a small team shown small looks intentional; the same people in a grid built for twelve look depleted. Choosing the structure to match the count is the entire decision here.
*Reach for it* for founders and small teams. *Not when* the team is large enough to fill a grid.

## Resources / insights / news

#### `latest-insights` — Latest insights
**Structure** Grid · **Arrangement** `three-column-equal` · **Interaction** `reveal-only`
**Reuse** `reusable` · **Tags** `screenshot` · `cards` · `stack-on-mobile`
*Structure evidence* — body grid repeat(3, 1fr)
**Leads with** educate · **Also carries** build-trust · orient
**Emphasis** structure · **Relates** supporting · **Carries** context · capability · validation
**Density** medium · **Capacity** triad · **Pace** fast · **Load** light · **Registers** editorial · quiet
**Role** supporting · **Follows** validation · outcome · **Precedes** decision-support · context
**Media** presence `s`, anchor `inline` — **requires** real article imagery
**Envelope** archetypes `feature-comparison` · `editorial-stack` — hierarchy supporting–secondary — density medium — capacity triad — registers editorial · quiet
**Addresses** marketing · specialist
**Distinct from** `resources-insights` — fewer cards with more air; the same content at a different pace · `latest-news` — the organisation's own writing, not third-party coverage · `resources-carousel` — three held, not many sliding
*Why it works* — three article cards at a calm rhythm read as a considered selection rather than as an archive, which is what makes owned writing carry authority instead of volume.
*Reach for it* as the blog teaser near the page end. *Not when* there are more than three worth showing.

#### `resources-insights` — Resources · insights grid
**Structure** Grid · **Arrangement** `three-column-equal` · **Interaction** `reveal-only`
**Reuse** `reusable` · **Tags** `icon-led` · `screenshot` · `cards` · `intro-split` · `stack-on-mobile`
*Structure evidence* — body grid repeat(3, 1fr)
**Leads with** educate · **Also carries** orient
**Emphasis** structure · **Relates** supporting · hierarchical · **Carries** context · capability
**Density** high · **Capacity** small-set · **Pace** fast · **Load** light · **Registers** editorial · technical
**Role** supporting · technical · **Follows** validation · context · **Precedes** context · decision-support
**Media** presence `s`, anchor `inline`
**Envelope** archetypes `feature-comparison` — hierarchy supporting–technical — density high — capacity small-set — registers editorial · technical
**Addresses** specialist · technical · operational
**Distinct from** `latest-insights` — denser, for readers browsing rather than being offered · `resources-carousel` — everything visible at once, which is what a browsing reader needs
*Why it works* — a reader who came looking for material wants to see the range, not a curated three. Density is correct here for the same reason it is wrong on a marketing page.
*Reach for it* on resource and library pages. *Not as* a teaser — it will outweigh what it was meant to support.

#### `latest-news` — Latest news
**Structure** Grid · **Arrangement** `three-column-equal` · **Interaction** `static`
**Reuse** `reusable` · **Tags** `screenshot` · `cards` · `full-bleed` · `stack-on-mobile`
*Structure evidence* — body grid repeat(3, 1fr)
**Leads with** build-trust · **Also carries** educate
**Emphasis** structure · **Relates** validation · **Carries** validation · evidence · context
**Density** medium · **Capacity** triad · **Pace** fast · **Load** light · **Registers** confident · quiet · editorial
**Role** proof · supporting · **Follows** validation · outcome · **Precedes** context · decision-support
**Media** presence `xs`–`s`, anchor `inline` — **requires** real outlets, real dates, resolving links
**Envelope** archetypes `proof-layout` · `feature-comparison` — hierarchy proof–supporting — density medium — capacity triad–small-set — registers confident · quiet · editorial
**Addresses** enterprise · executive · marketing
**Distinct from** `latest-insights` — **third-party coverage, not owned writing**, and that is the whole distinction; the geometry is nearly identical and the claim is entirely different · `logo-strip` — outlets that wrote about it, not customers who bought it
*Why it works* — its authority comes from the sources rather than the copy, which is why it can be quiet and still carry weight. Dates are load-bearing: recency is part of the claim.
*Reach for it* when genuine coverage exists and is current. *Not when* the coverage is stale — an out-of-date press row argues the opposite of what it intends — and never with invented outlets.

#### `resources-carousel` — Resources carousel
**Structure** Carousel · **Arrangement** `panels` · **Interaction** `carousel`
**Reuse** `reusable` · **Tags** `cards` · `reflow-to-scroll`
*Structure evidence* — flex:1 1 0 panels that EXPAND in place; no advancing mechanism (measured: catalog interaction carousel)
**Leads with** educate · **Also carries** orient
**Emphasis** creative · **Relates** supporting · **Carries** context · capability
**Density** medium · **Capacity** large-set · **Pace** moderate · **Load** light · **Registers** editorial · narrative
**Role** supporting · **Follows** validation · context · **Precedes** context · decision-support
**Media** presence `l`, anchor `framed` — **requires** real imagery per item
**Envelope** archetypes `storytelling-composition` · `product-showcase` — hierarchy supporting–secondary — density medium — capacity large-set — registers editorial · narrative
**Addresses** marketing · specialist
**Distinct from** `latest-insights` — many items in one band's height, at the cost of showing one at a time · `carousel-cards` — material offered, not evidence presented
*Why it works* — it fits a long list into one band, trading simultaneity for space. That is the right trade when the reader is browsing and the wrong one when they are comparing.
*Reach for it* when five or more items must occupy one band. *Not when* three would do — a carousel of three advertises how little there is.

## Footers

#### `footer-dark` — Footer · contrast
**Structure** Link Columns · **Arrangement** `four-column` · **Interaction** `reveal-only` · `form`
**Reuse** `purpose-bound` · **Tags** `intro-split` · `full-bleed` · `stack-on-mobile` · `dark-band`
*Structure evidence* — repeat(4,1fr) link block; form is a newsletter capture (measured: <form> present; first grid 1fr auto)
**Leads with** orient · **Also carries** convert · build-trust
**Emphasis** structure · **Relates** hierarchical · supporting · **Carries** context · decision-support
**Density** high · **Capacity** large-set · **Pace** fast · **Load** light · **Registers** closing · confident
**Role** closing · **Follows** decision-support · validation · **Precedes** —
**Media** presence **none**, anchor —
**Envelope** archetypes `editorial-stack` · `feature-comparison` — hierarchy closing — density high — capacity large-set — registers closing · confident
**Addresses** enterprise · operational · marketing
**Distinct from** `footer-mega` — an accent surface, so the page ends with a change of register rather than a fade · `footer-orbit` — undecorated · `footer-cta` — a footer with a capture in it, not a fused CTA-and-footer
*Why it works* — the surface change marks the end of the argument, and the newsletter capture catches the reader who reached the bottom without acting. It is the default close because it does both jobs without a preceding CTA band.
*Reach for it* when the page has no separate closing band. *Not when* one already precedes it — two accent bands in sequence flatten each other.

#### `footer-orbit` — Footer · orbit
**Structure** Link Columns · **Arrangement** `inline-row` · **Interaction** `form` · `reveal-only`
**Reuse** `purpose-bound` · **Tags** `icon-led` · `full-bleed` · `stack-on-mobile` · `dark-band`
*Structure evidence* — flex link row, no column grid (measured: <form> present; first grid 1.08fr 0.92fr)
**Leads with** orient · **Also carries** convert
**Emphasis** creative · **Relates** hierarchical · supporting · **Carries** context · decision-support
**Density** medium · **Capacity** small-set · **Pace** moderate · **Load** light · **Registers** closing · immersive
**Role** closing · **Follows** decision-support · validation · **Precedes** —
**Media** presence `s`, anchor `right` — decorated
**Envelope** archetypes `editorial-split` — hierarchy closing — density medium — capacity small-set — registers closing · immersive · confident
**Addresses** marketing · executive
**Distinct from** `footer-dark` — decorated, so it is a moment rather than an exit · `cta-orbit` — the decorated ending *is* the footer, so the page does not spend two bands on one gesture
*Why it works* — a decorated footer lets the page end on a visual note without a separate finale band, which is why it wants a quiet band before it rather than a loud one.
*Reach for it* after a restrained closing band on a page that should end with character. *Not after* `cta-orbit` — the same gesture twice.

#### `footer-mega` — Footer · mega
**Structure** Link Columns · **Arrangement** `four-column` · **Interaction** `reveal-only`
**Reuse** `purpose-bound` · **Tags** `stack-on-mobile`
*Structure evidence* — grid 1fr 1fr 1fr 1.55fr
**Leads with** orient · **Also carries** build-trust
**Emphasis** structure · **Relates** hierarchical · **Carries** context
**Density** high · **Capacity** large-set · **Pace** fast · **Load** light · **Registers** editorial · quiet
**Role** closing · **Follows** decision-support · validation · **Precedes** —
**Media** presence **none**, anchor — · a watermark is treatment, not a creative
**Envelope** archetypes `editorial-stack` — hierarchy closing — density high — capacity large-set — registers editorial · quiet
**Addresses** enterprise · specialist · marketing
**Distinct from** `footer-dark` — stays on the base surface, so the page fades rather than concludes · `footer-links` — a whole footer with an identity, not the columns alone
*Why it works* — staying on the base surface lets a large site's navigation be comprehensive without the page ending in a slab. On editorial and brand-forward sites the watermark carries identity where a surface change would carry finality.
*Reach for it* on large sites, and on pages that should end quietly. *Not when* the ending needs to be decisive.

#### `footer-cta` — Footer · CTA panel
**Structure** Link Columns · **Arrangement** `five-column` · **Interaction** `static` · `form`
**Reuse** `purpose-bound` · **Tags** `intro-split` · `full-bleed` · `stack-on-mobile`
*Structure evidence* — repeat(5,1fr) link block; the form is a newsletter capture (measured: <form> present; first grid minmax(280px, 1fr) 2.05fr)
**Leads with** close · **Also carries** convert · orient
**Emphasis** structure · **Relates** hierarchical · supporting · **Carries** decision-support · context
**Density** high · **Capacity** large-set · **Pace** moderate · **Load** light · **Registers** closing · confident
**Role** closing · **Follows** outcome · validation · **Precedes** —
**Media** presence `xs`–`s`, anchor `inline`
**Envelope** archetypes `editorial-stack` — hierarchy closing — density high — capacity small-set–large-set — registers closing · confident
**Addresses** marketing · operational
**Distinct from** the other three footers — it *is* the closing band as well as the footer, so a page using it needs no separate CTA · `cta-band` — a footer that closes, not a close followed by a footer
*Why it works* — fusing the ask into the footer saves a whole band on a short page, where two closing bands would be most of what the reader remembers.
*Reach for it* on short pages that must close and hand off in one move. *Not on* long pages — the ask deserves its own band when there is room.

#### `footer-links` — Footer links *(atom)*
**Structure** Atom · **Arrangement** — · **Interaction** `static`
**Reuse** `purpose-bound` · **Tags** —
*Structure evidence* — catalog cat=atom
**Leads with** orient · **Also carries** —
**Emphasis** structure · **Relates** hierarchical · **Carries** context
**Density** high · **Capacity** large-set · **Pace** fast · **Load** light · **Registers** quiet
**Role** — *(inherits the role of its host)* · **Follows** — · **Precedes** —
**Media** presence **none**, anchor —
**Envelope** contributes the link columns to a footer that supplies identity, surface and capture
**Addresses** enterprise · operational
**Distinct from** the four footer sections — it carries no identity, no capture and no closing gesture; it is the wayfinding alone
*Why it works* — separating navigation from the footer's identity is what lets a footer be composed rather than adopted whole.
*Reach for it* when composing a footer. *Not as* a footer — a page that ends in bare columns has no ending.

## Atoms & structural

*An atom holds no narrative role and no rhythm slot of its own: it inherits the hierarchy, register
and density of the band it is composed into. Its **Envelope** therefore states what it contributes
rather than what it spans, and it is excluded from band selection — an atom placed alone is a section
with no subject.*

#### `buttons` — Buttons *(atom)*
**Structure** Atom · **Arrangement** — · **Interaction** `static`
**Reuse** `reusable` · **Tags** —
*Structure evidence* — catalog cat=atom
**Leads with** convert · **Also carries** —
**Emphasis** typography · **Relates** — · **Carries** decision-support
**Density** low · **Capacity** paired · **Pace** fast · **Load** light · **Registers** *inherits*
**Role** — · **Follows** — · **Precedes** —
**Media** presence **none**, anchor —
**Envelope** contributes the action to any band; the canonical source for every action row in the library
**Addresses** *inherits*
**Distinct from** every band — it is the action alone, and the library's single source for it, which is what keeps one page from carrying three button treatments
*Why it works* — actions must look identical everywhere or the reader learns nothing from the first one. Holding them in one place is what makes that true by construction.
*Reach for it* whenever a band needs an action. *Not as* a section.

#### `nav` — Nav header *(atom)*
**Structure** Atom · **Arrangement** — · **Interaction** `static`
**Reuse** `purpose-bound` · **Tags** —
*Structure evidence* — catalog cat=atom
**Leads with** orient · **Also carries** convert
**Emphasis** structure · **Relates** hierarchical · **Carries** context
**Density** medium · **Capacity** small-set · **Pace** fast · **Load** light · **Registers** *inherits*
**Role** — *(structural frame; it sits outside the progression rather than in it)* · **Follows** — · **Precedes** —
**Media** presence **none**, anchor —
**Envelope** contributes persistent orientation above the first band; never a beat of the page's argument
**Addresses** *inherits*
**Distinct from** every band — it is present regardless of what the page says, which is exactly why it serves no beat and must not be counted as one
*Why it works* — orientation that persists lets every band below it be about something other than where the reader is.
*Reach for it* on every page, paired over the opening band. *Not as* a section.

#### `industry-chips` — Industry chips *(atom)*
**Structure** Atom · **Arrangement** — · **Interaction** `static`
**Reuse** `reusable` · **Tags** —
*Structure evidence* — catalog cat=atom
**Leads with** orient · **Also carries** educate
**Emphasis** structure · **Relates** hierarchical · contrasting · **Carries** context · capability
**Density** low · **Capacity** large-set · **Pace** fast · **Load** light · **Registers** *inherits*
**Role** — · **Follows** — · **Precedes** —
**Media** presence **none**, anchor —
**Envelope** contributes a scannable set of named categories to a band that already has a subject
**Addresses** *inherits*
**Distinct from** `integration-grid` — names a set without explaining any member, which is what keeps it an atom rather than a band
*Why it works* — a chip rail says *these are the categories we mean* in one line, which is often all a reader needs to place themselves. **The set is interchangeable — industries, sectors, roles, regions, use cases; only the naming changed.**
*Reach for it* as a garnish under a hero or beside a feature set. *Not as* a section.

#### `problem-card` — Problem card *(atom)*
**Structure** Atom · **Arrangement** — · **Interaction** `static`
**Reuse** `reusable` · **Tags** —
*Structure evidence* — catalog cat=atom
**Leads with** orient · **Also carries** persuade
**Emphasis** typography · **Relates** cause-and-effect · contrasting · **Carries** problem · impact · risk
**Density** medium · **Capacity** singular · **Pace** moderate · **Load** light · **Registers** *inherits*
**Role** — · **Follows** — · **Precedes** —
**Media** presence `xs`, anchor `inline`
**Envelope** contributes one stated problem to a band; composes into grids where a set of problems is the argument
**Addresses** *inherits*
**Distinct from** every band here — **it is the only unit in the library that carries `problem` as its leading information kind**, which makes it the donor for any structure that must open on a difficulty rather than a capability
*Why it works* — a problem stated as a discrete unit can be set beside its solution, counted with others, or held alone. Most structures assume the difficulty is already understood; this one supplies it.
*Reach for it* when composing a problem set, or when a band must name a difficulty before answering it. *Not as* a section.

#### `agent-status` — Agent status *(atom)*
**Structure** Atom · **Arrangement** — · **Interaction** `static` · `count-up`
**Reuse** `reusable` · **Tags** —
*Structure evidence* — catalog cat=atom
**Leads with** prove · **Also carries** educate
**Emphasis** creative · **Relates** cause-and-effect · validation · **Carries** proof · capability · evidence
**Density** high · **Capacity** small-set · **Pace** moderate · **Load** medium · **Registers** *inherits*
**Role** — · **Follows** — · **Precedes** —
**Media** presence `s`, anchor `framed` — a structural mock, not a delivered creative
**Envelope** contributes a live-looking measure panel to a band that needs an artifact and has none
**Addresses** *inherits*
**Distinct from** `stat-tiles` — reads as a *system in operation* rather than as a record of results, which is a different claim made with similar content
*Why it works* — a panel that looks live implies continuity in a way a static figure cannot; the numbers appear to be a state rather than a summary.
*Reach for it* to fill an artifact slot where a real screenshot is unavailable and the claim is operational. *Not as* a section, and never presented as a real product screenshot.

#### `divider` — Figure divider *(atom)*
**Structure** Atom · **Arrangement** — · **Interaction** `reveal-only`
**Reuse** `reusable` · **Tags** —
*Structure evidence* — catalog cat=atom
**Leads with** orient · **Also carries** —
**Emphasis** structure · **Relates** — · **Carries** context
**Density** low · **Capacity** singular · **Pace** fast · **Load** light · **Registers** quiet
**Role** — *(punctuation; it serves no beat and must never be counted as one)* · **Follows** — · **Precedes** —
**Media** presence **none**, anchor —
**Envelope** contributes a hand-off between two bands of different surface
**Addresses** *inherits*
**Distinct from** the four patterned dividers — undecorated, so it marks a change without characterising it
*Why it works* — sections are separated by surface, not by rules, so a divider is only earned where a surface change alone would be abrupt.
*Reach for it* sparingly, at a deliberate hand-off. *Not as* a section, and not as routine punctuation between bands.

#### `divider-halftone` — Halftone divider *(atom)*
**Structure** Atom · **Arrangement** — · **Interaction** `static`
**Reuse** `reusable` · **Tags** —
*Structure evidence* — catalog cat=atom
**Leads with** orient · **Also carries** —
**Emphasis** structure · **Relates** — · **Carries** context
**Density** low · **Capacity** singular · **Pace** fast · **Load** light · **Registers** confident
**Role** — *(punctuation)* · **Follows** — · **Precedes** —
**Media** presence **none**, anchor —
**Envelope** contributes a graded hand-off *into* an accent band specifically
**Addresses** *inherits*
**Distinct from** `divider` — directional: it prepares the eye for a specific change rather than marking an unspecified one
*Why it works* — a gradient into the accent surface softens the single hardest transition on the page.
*Reach for it* immediately before an accent band. *Not* anywhere else — used generally it becomes texture.

#### `divider-dissolve` — Pixel-dissolve divider *(atom)*
**Structure** Atom · **Arrangement** — · **Interaction** `reveal-only`
**Reuse** `reusable` · **Tags** —
*Structure evidence* — catalog cat=atom
**Leads with** orient · **Also carries** —
**Emphasis** structure · **Relates** — · **Carries** context
**Density** low · **Capacity** singular · **Pace** fast · **Load** light · **Registers** immersive
**Role** — *(punctuation)* · **Follows** — · **Precedes** —
**Media** presence **none**, anchor —
**Envelope** contributes a characterised transition into an accent band
**Addresses** *inherits*
**Distinct from** `divider-halftone` — carries a distinct voice rather than only a gradient, so it is a stylistic commitment as well as a transition
*Why it works* — a transition with character makes the change feel authored. That is a benefit only on pages whose voice can carry it.
*Reach for it* on pages with a playful register. *Not on* restrained ones, where it will be the loudest thing present.

#### `divider-dither` — Dither divider *(atom)*
**Structure** Atom · **Arrangement** — · **Interaction** `reveal-only`
**Reuse** `reusable` · **Tags** —
*Structure evidence* — catalog cat=atom
**Leads with** orient · **Also carries** —
**Emphasis** structure · **Relates** — · **Carries** context
**Density** low · **Capacity** singular · **Pace** fast · **Load** light · **Registers** technical
**Role** — *(punctuation)* · **Follows** — · **Precedes** —
**Media** presence **none**, anchor —
**Envelope** contributes a textured transition with a technical voice
**Addresses** *inherits*
**Distinct from** `divider-dissolve` — technical rather than playful; the same job in a different register
*Why it works* — the texture reads as engineered, which suits pages whose subject is a system.
*Reach for it* on technical pages. *Not* as general punctuation.

#### `divider-horizon` — Horizon divider *(atom)*
**Structure** Atom · **Arrangement** — · **Interaction** `reveal-only`
**Reuse** `reusable` · **Tags** —
*Structure evidence* — catalog cat=atom
**Leads with** orient · **Also carries** —
**Emphasis** structure · **Relates** — · **Carries** context
**Density** low · **Capacity** singular · **Pace** fast · **Load** light · **Registers** closing
**Role** — *(punctuation, terminal)* · **Follows** — · **Precedes** —
**Media** presence **none**, anchor —
**Envelope** contributes the final transition into the footer, and only that
**Addresses** *inherits*
**Distinct from** the other dividers — it is **positional**: it means *the page is ending*, so using it mid-page tells the reader something untrue
*Why it works* — a transition that only ever appears in one place becomes a signal rather than a decoration; readers learn it after one page.
*Reach for it* immediately above the footer. *Not* anywhere else — the meaning is the position.

---

## Layout Index (structure → every section that takes it)

**Generated from the descriptions above, never hand-maintained** — the index is a projection of the profiles, so it cannot drift from them. Ask it *"what has a three-column grid?"* without knowing what content any of them once held.

| Structure | Arrangement | Sections |
|---|---|---|
| **Grid** | `five-column-equal` | `grid-five-column-equal` |
|  | `four-column-equal` | `integration-grid` · `outcome-stats` · `pricing` · `stat-band` · `grid-four-column-equal-cards` · `subscription-faq` · `team-about` · `team-leadership` · `grid-four-column-equal` |
|  | `four-column-unequal` | `results-proof` |
|  | `three-column-equal` | `feature-trio` · `latest-insights` · `latest-news` · `resources-insights` · `team-grid` · `team-visionaries` · `value-who` |
| **Split Layout** | `asymmetric` | `about-value` · `cta-orbit` · `get-started` · `hero-agent` · `split-layout-asymmetric` |
|  | `balanced` | `cta-footer-reveal` · `hero-actions` · `more-solutions` |
| **Bento** | `feature-dominant` | `feature-bento` · `hero-bento` · `pricing-packages` · `testimonial-bento` |
| **Carousel** | `cards` | `carousel-cards` |
|  | `full-width` | `customer-story` · `reviews-carousel` · `testimonial-slider` |
|  | `panels` | `resources-carousel` |
| **Accordion** | `panel-right` | `faq-split` · `accordion-panel-right` |
| **Tabs** | `panel-below` | `tabs-panel-below` |
|  | `panel-right` | `feature-steps` · `pricing-tabbed` |
| **Sticky Sidebar** | `sidebar-left` | `sticky-sidebar-left-full-bleed` · `sticky-sidebar-left` |
| **Comparison Table** | `column-matrix` | `compare-table` |
| **Wide Card** | `internal-columns` | `wide-card-internal-columns` |
| **Form Split** | `asymmetric` | `book-demo` · `contact` · `contact-form` |
|  | `balanced` | `contact-methods` · `contact-us` |
| **Link Columns** | `five-column` | `footer-cta` |
|  | `four-column` | `footer-dark` · `footer-mega` |
|  | `inline-row` | `footer-orbit` |
| **Centered Stack** | `single-column` | `cta-band` · `cta-banner` · `faq-centered` · `faq-single` · `feature-stack` · `hero-horizon-light` · `hero-lending` · `mission-reveal` |
| **Marquee** | `single-row` | `integrations` · `logo-marquee` · `logo-strip` |
| **Atom** | `—` | `agent-status` · `buttons` · `comparison` · `demo-modal` · `divider` · `divider-dissolve` · `divider-dither` · `divider-halftone` · `divider-horizon` · `faq` · `footer-links` · `industry-chips` · `nav` · `problem-card` · `stat-tiles` |

*79 sections · 14 structures.*

## Interaction Index (behaviour → every section that does it)

A section appears under **every** interaction it carries, so *"find every accordion"* returns the accordions that live under Features and under Pricing alike.

| Interaction | Sections |
|---|---|
| `static` | `agent-status` · `buttons` · `compare-table` · `comparison` · `cta-banner` · `divider-halftone` · `faq` · `footer-cta` · `footer-links` · `hero-actions` · `hero-horizon-light` · `industry-chips` · `latest-news` · `nav` · `problem-card` · `stat-band` · `stat-tiles` |
| `reveal-only` | `about-value` · `grid-five-column-equal` · `contact` · `contact-form` · `cta-band` · `cta-footer-reveal` · `cta-orbit` · `divider` · `divider-dissolve` · `divider-dither` · `divider-horizon` · `feature-bento` · `feature-trio` · `footer-dark` · `footer-mega` · `footer-orbit` · `get-started` · `hero-agent` · `hero-bento` · `hero-lending` · `integration-grid` · `latest-insights` · `mission-reveal` · `more-solutions` · `outcome-stats` · `pricing-packages` · `resources-insights` · `grid-four-column-equal-cards` · `sticky-sidebar-left` · `team-about` · `team-grid` · `team-leadership` · `team-visionaries` · `value-who` |
| `accordion` | `faq-centered` · `faq-single` · `faq-split` · `accordion-panel-right` · `subscription-faq` |
| `tabs` | `feature-steps` · `hero-agent` · `pricing-tabbed` · `tabs-panel-below` |
| `carousel` | `carousel-cards` · `customer-story` · `resources-carousel` · `reviews-carousel` |
| `slider` | `testimonial-slider` |
| `count-up` | `about-value` · `agent-status` · `results-proof` · `stat-band` · `grid-four-column-equal-cards` · `testimonial-bento` · `wide-card-internal-columns` · `grid-four-column-equal` · `split-layout-asymmetric` · `value-who` |
| `toggle` | `hero-actions` · `pricing` · `subscription-faq` |
| `sticky-scroll` | `feature-stack` · `sticky-sidebar-left-full-bleed` · `mission-reveal` · `sticky-sidebar-left` |
| `marquee` | `integrations` · `logo-marquee` · `logo-strip` |
| `form` | `book-demo` · `contact` · `contact-form` · `contact-methods` · `contact-us` · `footer-cta` · `footer-dark` · `footer-orbit` · `hero-agent` |
| `modal` | `demo-modal` |

---

## Section Playbook (intent → all candidates, across labels)

This is the part that breaks the filename silo. For each intent, pick by layout fit.
**Cross-category** entries are the ones a `component-<intent>-*` grep would miss.

### Hero
- two-col text + creative → `hero-actions`, `hero-agent`
- centered + bento/cards → `hero-bento`, `hero-lending`
- **cross-category:** `mission-reveal` (editorial statement hero), `cta-orbit` / `cta-banner` (oversized headline + CTA as a hero), `hero-horizon-light` (centered CTA hero)

### Feature / capability showcase
- 3-up equal cards → `feature-trio`, `team-grid`/`team-visionaries` (as a capability roster)
- asymmetric bento → `feature-bento`, `testimonial-bento`, `split-layout-asymmetric`
- accordion + creative → `accordion-panel-right`, `feature-steps`, `faq-split`
- sticky numbered walkthrough → `sticky-sidebar-left`, `sticky-sidebar-left-full-bleed`
- tabbed per-product → `tabs-panel-below`, `pricing-tabbed`
- pinned card deck → `feature-stack`
- two-up split → `more-solutions`
- **cross-category:** `grid-four-column-equal-cards`/`stat-tiles` (capability-as-metric grid), `wide-card-internal-columns` (3-col grid as a feature row), `compare-table` (factor-by-factor capability matrix), `integration-grid`

### Social proof / logos
- marquee → `logo-strip` (base), `logo-marquee` (contrast), `integrations`
- logo wall grid → `grid-five-column-equal`, `integration-grid`
- **cross-category:** `grid-four-column-equal-cards`, `stat-band`, `grid-four-column-equal`, `outcome-stats` (numbers as proof), `results-proof` (quote + stats + logo strip), `wide-card-internal-columns`/`customer-story` (named brands)

### Stats / metrics / outcomes
- n-up stat grid → `grid-four-column-equal-cards` (contrast), `stat-tiles`, `grid-four-column-equal` (number columns)
- intro + stat band → `stat-band`, `outcome-stats`
- text + stat bento → `split-layout-asymmetric`, `feature-bento`, `about-value`
- **cross-category:** `wide-card-internal-columns`/`testimonial-slider` (stat column), `results-proof`, `value-who`, `agent-status` (gauge/metric mock)

### Comparison
- table matrix → `compare-table`, `comparison`
- **cross-category:** `pricing` / `pricing-tabbed` / `pricing-packages` (plan-vs-plan), `feature-trio` (side-by-side capability cards)

### Process / how-it-works
- sticky aside + steps → `sticky-sidebar-left-full-bleed`, `sticky-sidebar-left`
- numbered steps + creative → `get-started`, `feature-steps`
- **cross-category:** `accordion-panel-right` (steps as accordion), `tabs-panel-below` (stage tabs)

### Pricing
- plan card grid + toggle → `pricing`, `subscription-faq`
- asymmetric package bento → `pricing-packages`
- tabbed plan card → `pricing-tabbed`
- **cross-category:** `compare-table` / `comparison` (plan feature matrix)

### FAQ
- accordion + creative → `faq-split`, `accordion-panel-right`
- single / centered accordion → `faq-single`, `faq-centered`
- bundled with pricing → `subscription-faq`
- **cross-category:** `feature-steps` (Q-style step switcher), `faq` (static chip rows)

### CTA (closing)
- centered contrast panel → `cta-banner`, `cta-band`, `hero-horizon-light`
- text + creative/orbit → `cta-orbit`, `cta-footer-reveal`
- **cross-category:** `footer-cta`/`footer-orbit`/`footer-dark` (CTA fused into footer), `book-demo`/`contact-form` (CTA-as-form), `mission-reveal`, `get-started`

### Contact / lead form
- split form + creative → `contact-form`, `contact-us`, `book-demo`
- form + method cards → `contact-methods`, `contact`
- modal → `demo-modal`
- **cross-category:** `footer-cta`/`footer-orbit`/`footer-dark` (newsletter capture), `cta-orbit`

### Team / about
- portrait card grid → `team-grid`, `team-leadership`, `team-visionaries`, `team-about`
- editorial about → `about-value`, `value-who`, `mission-reveal`
- **cross-category:** any `n-up-card-grid` (resources/feature grids re-skinned as people)

### Resources / insights / news
- article card grid → `latest-insights`, `resources-insights`, `latest-news`
- expanding-panel carousel → `resources-carousel`
- **cross-category:** `carousel-cards`, `team-grid` (card grid), `feature-trio`

### Testimonials / case studies
- 3-col split-row card → `wide-card-internal-columns`
- bento → `testimonial-bento`
- slider / carousel → `testimonial-slider`, `reviews-carousel`, `carousel-cards`, `customer-story`
- **cross-category:** `results-proof` (quote + proof), `latest-insights` (story cards)

### Navigation & footers (structural)
- nav → `nav`, embedded in every `hero-*`
- footer → `footer-dark`, `footer-orbit`, `footer-mega`, `footer-cta`, `footer-links`

---

*To assemble a **new** section by mixing blocks from several of the above components, go
to [`COMPOSE.md`](COMPOSE.md).*
