# Brand-Pack Exemplars — brand-compliant sample pieces

> ## ⚠️ FROZEN — these files express the PREVIOUS visual language (v2 "eternum")
>
> Every page and section here was authored against **v2**: Urbanist + Inter, a cool-white page,
> blue-and-teal accents, pill buttons, a 20px card radius, and sanctioned shadow / glass depth. The
> design system has since moved to **v3 editorial restraint** — one typeface, a warm cream page, a
> Major Third scale, four sparing accents, two radii, **no shadows at all**, the Section Marker, and
> structural placeholders in place of generated creative.
>
> **They were deliberately not retrofitted, and they are now pinned so they cannot half-migrate.**
> All 81 files link **`_frozen-v2-tokens.css`** — a snapshot of the v2 brand pack taken 2026-07-28 —
> rather than the live pack. This matters: the v3 re-theme kept every token *name* stable (that is
> the contract that lets a rebrand propagate), so while these files linked the live pack they were
> silently picking up the new page surface, accents, stroke and radii *underneath* their ~185
> hardcoded old font-family strings and ~180 raw old hexes. The result was a hybrid that was neither
> language. Pinning them makes the claim on this page true again.
>
> **Do not author against `_frozen-v2-tokens.css`, and do not sync it forward.** It is a historical
> reference, not a layer. The live pack is `brand-pack/colors_and_type.css`.
>
> ### This directory is the FROZEN v2 ARCHIVE. It is not the Section Library.
>
> The canonical Section Library — production-ready, current Creative Direction, the corpus every
> webpage is **composed from** — lives at **`../../section-library/`**. Its sections **ship**: they
> are retrieved and edited in place, never studied and re-authored.
>
> Everything in *this* directory is the **pre-modernization v2 corpus**, kept as a historical
> record. The rule below applies to these files and to nothing else. It was once the rule for the
> whole library, and when the library was modernized into a new location this text stayed accurate
> about the archive while quietly becoming the reason generators kept authoring from scratch —
> which is why the scope is now stated first.
>
> ### Treat every file here as a STRUCTURAL REFERENCE, never a visual exemplar.
>
> **What they are still good for — and this is the whole list:**
> **structural composition · information hierarchy · semantic intent.**
> What a section is made of, how its information relates, and what it is *for*.
>
> **What they must not be read for:** typography · colour · radius · depth · **spacing and rhythm ·
> marker placement · CTA layout · component styling · visual balance · imagery treatment · creative
> placement** · how a visual asset is handled.
>
> The earlier wording here offered "structure, composition, hierarchy, section order, page rhythm and
> voice", and that was too generous: **page rhythm and visual balance are exactly what the current
> direction replaced.** A donor read for its rhythm carries a v2 section opening into a v3 page, and
> that is how the compressed openings and the centred closing band arrived in generated output. Those
> decisions now come from governance, never from a file in this folder.
>
> **Your responsibility is not to recreate a specimen.** It is to author the section as though it had
> been designed today, under the current Creative Direction, Brand Pack, Visual Language, Component
> Governance and Section Structure. Where a specimen conflicts with any of those, **the governance
> documents always win.** The final result should feel designed today — not migrated.
>
> For the current visual language, read the live pack and the **section-level v3 specimens at
> `design/website/output/v3-specimens/sections/`**. *(The three page-level specimens one directory up
> are older and have fallen behind the verifier — they are no longer a reference for the current
> language.)*
>
> **Section-level v3 specimens live at `output/v3-specimens/sections/`** — approved structures from
> this directory, re-authored under the current direction with their structure, scripts and every
> behavioural hook byte-compatible with the originals here. Each sits beside a render control of the
> v2 file it came from, so the two can be compared directly. They are Stage 2 of the migration
> recorded in `governance/DECISION-REGISTER.md` **DR-22**: a migration authors a new specimen, it
> never re-themes a frozen one, which is why nothing in this directory moved. Status, measurements
> and open findings are in that folder's `FINDINGS.md` — **all ten are complete**, and each carries a
> declared `geometry-budget` naming every dimension it moves. They are verified by seven predicates,
> and are being joined by the remaining 69 in phases of ten.
>
> *(Three of these files apply `box-shadow`. That is correct for v2 and is exactly why they are
> pinned — the v3 no-depth rule governs the current language, and these files are explicitly outside
> it.)*

On-brand realized pieces, kept as references for *what good looks like* in this brand.
**Study them; do not clone them.**

- `pages/` — two complete, on-brand built pages (the latest `*-v2` outputs): a strategy/landing page
  and a case-study page. They show full-page rhythm, section order, voice and surface usage end to end.
- `sections/` — the **full realized section catalog: all 79 components** (`component-*.html`). This is
  the complete set of brand-realized sections to study at the section level — heroes, features,
  proof/stats, testimonials, pricing, FAQ, CTAs, footers, contact, team, resources, integrations,
  dividers and atoms. The **by-role index** for these 79 (what each is *for*, when to reach for it, the
  rules it obeys) lives in `../../governance/website/component-governance/COMPOSITION.md`.

> **Path caveat (study references, not drop-in renders).** These files were authored inside the
> original workspace and reference tokens and imagery by relative paths into that structure
> (`../colors_and_type.css`, `../assets/…`); the ~9 atom previews also link `card.css`, a
> preview-harness file that is **intentionally not migrated** (it is execution, not brand value). They
> are preserved here to be read for **structural composition, information hierarchy and semantic
> intent** — and are **not
> guaranteed to render standalone** without repointing those paths to `brand-pack/colors_and_type.css`
> and `brand-pack/assets/`. The build machinery that turns them into liftable, paste-ready pages
> (`fragments/`, the manifest, `tools/`) stays in the archive by design — the STACK carries the
> catalog as *study reference + by-role governance*, not as the execution engine.
