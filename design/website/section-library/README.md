# The Section Library

> **The Website Design System owns all design knowledge, design decisions, and production design
> assets. The engine owns orchestration, retrieval, composition, content population, validation, and
> rendering.**

This directory is the **single canonical Section Library**. There is no other. Two earlier copies
existed — one under `brand-pack/exemplars/sections/` (the frozen v2 archive, kept as an archive) and
one vendored inside the engine (deleted). If you are reading a section from anywhere else, you are
reading the wrong shelf.

---

## What this is

> **The Section Library is the production design language of the Website Design System.** Every
> webpage is assembled from its sections. **A section is the smallest independently retrievable
> production-ready layout unit that fully expresses a communication pattern.**

**A webpage is a composition of Sections.** Not a canvas that sections decorate. Composition is the
act; invention is the exception, permitted only where the library does not yet serve a capability.

**Every generated webpage must be reproducible from the same library version, inputs, and retrieval
contract.** That sentence defines deterministic generation, and the rules below exist to make it true
rather than aspirational.

"Production-ready" is literal. These sections are **not** inspiration, **not** references, **not**
examples. **They ship.** A generator that studies them and authors something similar has failed; a
generator that retrieves one and edits its content has succeeded.

---

## Component and Section are different things

| | **Component** | **Section** |
|---|---|---|
| Is | a reusable UI primitive | a complete communication unit |
| Examples | button · card · badge · input · timeline item | hero · features · comparison · CTA |
| Retrievable as a page band | **no** | **yes** |

The catalog encodes this: every row is typed `section` or `atom` — **64 sections, 15 atoms**. Atoms
are the vocabulary sections are built from. Pages retrieve sections, never atoms.

---

## Capability — what a section can *do*

> **A section's capability is the communication work it performs — not the shape it takes.**

Capability answers *"what does this accomplish for the reader"* — compare options, explain a process,
establish trust, introduce the team, display metrics, convert, collect leads, reassure. Layout answers
*"what shape is it"* — centred stack, n-up card grid, split panel, sticky aside.

Two sections may share a capability and differ entirely in layout. That pair is what selection needs,
which is why the catalog holds them in separate columns and why they must never be merged.

> **The capability vocabulary is owned by the Website Design System and evolves only through
> governance changes.**

Without that rule, `problem-statement` · `problem` · `pain` · `pain-point` · `challenge` all arrive as
separate capabilities and selection can no longer tell duplicates apart. Adding a capability is a
governance decision, not an authoring convenience.

---

## Variants belong to a Section, not beside it

```
Section  (identity + capability)
   └── Variant  (a presentation of the same capability)
```

A variant **inherits** its section's identity, capability, governance, validation and composition
rules. **Only presentation changes.**

Anything needing a different capability, different composition rules, or different validation is not a
variant — it is a new section, and must pass the admission test below. Without that rule the library
fills with near-siblings selection cannot tell apart.

---

## Identity

**A section's identity is its canonical name.** The catalog row is the index; the `File` cell is
merely where the file currently sits. Renaming a section is a change to one catalog cell — the
resolver looks files up *through* the catalog and never rebuilds a filename from a slug.

The design team's own doctrine, from the migration record: **"the file may move, its identity may
not."**

Ten sections were renamed when they were modernized. Their former names are recorded in the catalog so
that historical pages, usage records and cross-references still resolve. A rename is a coordinated
edit across the catalog, this directory, and the engine's knowledge tree — enforced by bijection
gates, so a half-done rename fails the build rather than degrading a page silently.

---

## Versioning, and what a page records

This library is generation **3** (see `VERSION`). The frozen v2 controls sit in `_v2/`, paired by
identical stem so a render diff can prove "the layout did not change" rather than assert it.

Every generated page carries a build record — enough to reproduce it exactly:

| Recorded per page | Recorded per band |
|---|---|
| library version · retrieval contract version · rendering contract version | section name · section version · capability · former names |

**Compatibility rule:** a page is reproducible against **the library version it records**, not against
the current one. A page built on v3 is regenerated by resolving v3. Opening it under a later library is
a *comparison*, never a silent upgrade.

---

## Ownership of the HTML

> **The HTML inside a section is owned by the Design System. The engine may consume it. It may never
> rewrite the canonical copy.**

The engine holds a working copy for the duration of a build — it scopes CSS, stamps anchors, and edits
content within the editable boundary — and all of that lands in the *deliverable*, never here. A
correction to a section is an edit made in this directory, passing the lifecycle below. There is no
path by which generation writes back.

---

## The editable boundary

An author receives a section and edits it in place. What may change is closed, in both directions.

**Editable** — copy · media · icons · numbers · logos · CTA links.

**Never editable** — grid · layout · spacing · rhythm · hierarchy · component order · responsive
behaviour.

Stated structurally, so it is checked rather than trusted: an edit may change **text nodes** and a
**closed set of attribute values** (`src`, `alt`, `href`, `aria-label`, icon name). It may not add,
remove or reorder elements; change class names; or alter any CSS declaration.

---

## Fidelity — what counts as reuse

| Dimension | Requirement |
|---|---|
| DOM | element count, tag sequence, nesting depth **unchanged** |
| class names | **unchanged** |
| CSS | every declaration **unchanged** after scoping |
| structural attributes | `data-*`, `id`, ARIA roles **unchanged** |
| text nodes | **expected to change** |
| `src` · `alt` · `href` · `aria-label` · icon names | **expected to change** |

All six hold → the section was **reused**. Any violated → it was **re-created**, and the run says so.

---

## Lifecycle — how, and when, section 80 arrives

**How:**

```
author  →  validate against governance  →  extract capability profile
   →  add the catalog row (identity, former names, capability, File)
   →  verification passes  →  published  →  available to every caller
```

A section that has not passed verification is not in the catalog; a section not in the catalog is not
retrievable. **Publication and reachability are the same event**, so the library cannot drift from its
index again.

**When** — a new section is admitted **only if all three hold**:

1. no existing section satisfies the capability;
2. adapting an existing section would reduce clarity;
3. it introduces a genuinely new communication pattern.

Otherwise the right answer is a **variant**, or an edit to an existing section.

---

## Layout

```
README.md               this document
VERSION                 the library generation
sections/*.html         79 specimens, named by bare slug — the canonical corpus
_v2/*.html              frozen v2 render controls, paired by stem
MIGRATION.md            the v2 → v3 migration record, incl. the authoritative rename table
_migration-report.json  per-file migration audit
_stage-a.json           pre-migration measurements
```

Renders are generated output and live under `output/section-library/_renders/`, not here.

**The catalog** — the component table, the capability profiles and the generated indexes — lives at
`../governance/website/component-governance/COMPOSITION.md`, beside the composition rules
(`COMPOSE.md`) and the family/variant model (`components.md`). It is governance of record, which is
why it sits in the governance tree rather than here.
