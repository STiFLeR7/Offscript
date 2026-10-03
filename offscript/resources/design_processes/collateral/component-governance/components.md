# Component Governance — the collateral component set, by role

## What this document is

The **brand-invariant catalogue of collateral components**, each described by **what it is for, when
to reach for it, and the rules it obeys** — never by pixel, colour, typeface, or class. It is the
governance layer the author consults to choose the *right* component for a job; the concrete house
classes and values that realise each component live in the **brand pack** (the execution stylesheet)
and are surfaced to the author by the engine's component cheat-sheet.

**The rewrite test for every line:** *would it still be true after a complete rebrand?* "The stat
showcase gives a single key number the room to land" ✅ — a specific size, colour, or class ❌ (that is
a brand-pack value). Concrete sizing, tones, and spacing are referenced here only by role.

**Inheritance:** these components serve `PHILOSOPHY.md` (communication over decoration; content
determines form) and `collateral-core.md` (one component per row; vary the layout, never the
language). A component is reached for only when it is the *most communicative* choice for the content.

---

## The page frame — header + footer

- **Job.** The constant furniture that identifies the document and makes a set of pages read as one
  family: an identifying mark at the top, a thin reference line at the bottom.
- **When.** On **every** page, in the same place. It is never omitted and never restyled per page.
- **Rules.** The frame is invariant while the composition between it varies. The identifying mark is
  the real brand lockup, never a typed-out wordmark. The footer is thin and settles on the bottom
  margin — it is the *only* element permitted to pin to the page floor.
- **Footer text (governed, house-invariant).** The footer carries two slots — the brand domain
  (left) and a short house descriptor (right) — identical on every page and every brief. They are
  governed values, not author copy. The engine reads them from the two markers below (absent →
  brand-derived fallback + a warning).

  <!-- footer-domain: example-brand.com -->
  <!-- footer-descriptor: AI strategy & integration -->

## Cover

- **Job.** Establish the piece, its subject, and its register in one decisive opening; set the
  emotional pitch for everything after.
- **When.** The first page, always.
- **Rules.** One idea, large type, room to breathe: an orienting label, a commanding headline, a short
  framing line, and — optionally — a single homogeneous proof strip. The cover is the one page that may
  run edge-to-edge and the place imagery is concentrated; its headline stays short (a title, not a
  paragraph).

## Headline block

- **Job.** Open a region by naming what it is about and why it matters, then hand off to the supporting
  content.
- **When.** At the top of essentially every interior region — the entry point into the page's one idea.
- **Rules.** A display-scale headline paired with a short intro; the headline carries the region's
  single dominant idea. Emphasis is allocated to importance, not spread evenly.

## Editorial / body block

- **Job.** Carry connected prose — the argument, the explanation, the narrative thread between
  components.
- **When.** Wherever meaning is best transferred in sentences rather than a structured component.
- **Rules.** Set at a comfortable reading measure and never below the legibility floor. Subtraction is
  the editing act: it earns its place by what it communicates, not by filling a region.

## Numbered editorial list

- **Job.** Present an ordered or enumerated set of related points as a scannable sequence.
- **When.** Several peer points share a structure and benefit from sequence or count (causes, steps,
  taxes, reasons).
- **Rules.** A homogeneous set of hairline-separated rows reading number → label → description. The
  items are true peers; the count is held to what the page's density budget allows.

## Feature set (a composition, not a standalone component)

- **Job.** Present a small group of capabilities or qualities as equal, glanceable units.
- **When.** Two to a few peer features deserve equal weight (not a ranked sequence).
- **Note.** This is not a primitive of its own — it is a **composition** of the icon-chip primitive +
  a short title + one supporting line, laid out as a homogeneous peer row or grid. It is catalogued here
  because authors reach for it as a unit, but it owns no dedicated class.
- **Rules.** Each unit pairs a small mark, a short title, and one supporting line; the set is a
  homogeneous peer group on one row (never distinct components mixed in). A mark sits inside its chip,
  never bare beside the text.

## Stat showcase — three treatments

- **Job.** Give quantified outcomes the prominence they deserve; let numbers do the persuading.
- **When.** The page's substance is measured results. Choose **one** treatment per page:
  - **Boxed proof** — a small homogeneous grid of tonal cards, one metric each, for a compact set of
    headline numbers.
  - **Metrics wall** — oversized numerals over captions, ruled by hairlines, when a cluster of numbers
    should read as one bold, even grid.
  - **Key-numbers ledger** — number beside supporting text in stacked ruled rows, when each metric
    wants a fuller caption read across rather than down.
- **Rules.** The numeral is the message and stays primary, legible text — **an accent colour never
  touches a number.** Figures are kept short. Within a treatment every numeral shares one size, so
  hierarchy comes from the numbers and captions, not from varied type scale. One stat treatment per
  page — never two stacked.

## Tonal band / section

- **Job.** Separate or group a passage by setting it on its own surface; create rhythm and focus.
- **When.** A region benefits from being visually set apart (an aside, a grouped set, an emphasis
  passage), or a full-width moment is wanted.
- **Rules.** An application of the system's sanctioned surfaces only; it carries dark, legible text on a
  light tonal fill (or the system's inverse treatment). It is *not* a decorative callout device.

## Data / comparison group

- **Job.** Hold a small set of paired or grouped facts (this-vs-that, a labelled cluster) as one
  coherent unit.
- **When.** A handful of related facts read better grouped on a shared surface than as loose prose.
- **Rules.** One group per row; the contained facts are peers within a single component, honouring
  one-component-per-row at the page level.

## Quote / testimonial

- **Job.** Carry an attributed pull-statement as social proof or a human voice.
- **When.** A credible external statement advances the argument better than the author's own words.
- **Rules.** The statement is the hero, set as a pull-statement on a sanctioned surface — **never** a
  decorative bordered callout. Identity is carried by an initials monogram, **never a photographic
  headshot**, and there is no interior photography. Attribution is specific and verifiable.

## Proof checklist

- **Job.** Present a scannable set of qualifications, guarantees, or proof points the reader can absorb
  at a glance.
- **When.** Several short affirmations (certifications, inclusions, guarantees) reinforce trust.
- **Rules.** A marker plus a short line, repeated; the marker is a list marker that inherits the
  surrounding text colour (so it reads on light or dark) — it is not a feature mark, and the accent
  stays reserved for primary actions. The count is held to the density budget.

## Call-to-action

- **Job.** Convert attention into the single next step the piece exists to produce.
- **When.** At the close, and only where one clear action is offered.
- **Rules.** One dominant action, stated plainly, on a sanctioned emphasis surface; it may pair a lede,
  a short line, and a short proof checklist. It flows after the closing argument — never anchored into a
  void at the page floor.

## Icon chip

- **Job.** Give a small monoline glyph a consistent, contained home beside a label.
- **When.** A feature, capability, or list item is clarified by a simple mark.
- **Rules.** The glyph is monoline and seated inside its chip — never a bare icon floating beside copy.
  It clarifies; it does not decorate.

## Divider / hairline

- **Job.** Separate passages quietly without the weight of a surface change.
- **When.** A light break is wanted between blocks or before a takeaway line.
- **Rules.** A thin rule only; it never becomes a decorative element.

## Button

- **Job.** Make the actionable element unmistakable.
- **When.** Only on a genuine call-to-action.
- **Rules.** The primary action carries the accent; secondary actions are quieter. Buttons are not used
  decoratively or for non-actions. (Collateral is static print-true output — a button is a visual
  affordance, not interactive behaviour.)

---

## The rare specialist visual systems

Three component families are **earned and rare** — reached for only when the information genuinely
demands them, and each governed by its own rulebook in `../rulebooks/`:

- **Charts / data-visualisation** (`README-DATA-VIZ.md`) — *Job:* communicate data and comparison.
  *When:* a number set or comparison is clearer shown than told (a single number is a metric, not a
  chart). *Rules:* never fabricate data; data marks use accent/tonal treatment while numerals and axes
  stay legible; charts are document-scoped, never added to the shared system.
- **Diagrams** (`README-DIAGRAMS.md`) — *Job:* communicate relationships, structure, and flow. *When:* a
  relationship is clearer as a structure than as prose. *Rules:* the diagram simplifies; it never adds
  complexity for visual interest.
- **Spatial / isometric heroes** (`README-SPATIAL.md`, `SPATIAL-BRIEF.md`) — *Job:* communicate a
  system, architecture, or layered model at a glance. *When:* a system genuinely benefits from a spatial
  depiction. *Rules:* it must communicate a real structure, not impress; restraint and truthfulness hold.

> The final test for any component choice: **does this component communicate this content more clearly,
> at less cost to the reader, than any other — and does it obey one-component-per-row and the system's
> rules?** If not, reach for a different one, or for plain prose.
