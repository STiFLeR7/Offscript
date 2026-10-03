# Visual Language — rules by role (Rulebook · HOW)

> **Brand-agnostic by construction.** This is the most value-heavy area of the original brand
> charter, re-authored so it carries **no literals**. Every colour, type family, size, radius,
> spacing step and asset named in the source is replaced here by a **role** that resolves to a
> **Brand-Pack** value (`brand-pack/colors_and_type.css`, `brand-pack/fonts/`,
> `brand-pack/assets/`). It must remain true after a rebrand.
>
> **Source:** `_ARCHIVE` → `README.md` → *Visual foundations* (background, type, headline hierarchy,
> spacing, corners/cards, buttons, navigation, iconography, imagery, borders, effects, animation,
> layout, colour usage). The literals were moved to the Brand Pack; the *rules* stayed here.
>
> **The governing posture — editorial restraint.** Visual hierarchy is created with **typography,
> scale, whitespace, alignment and proportion — not decoration.** Heavy shadows, decorative borders,
> visual noise, excessive colour and dense layouts are all out. The interface should read as clean,
> calm, premium and structured. Where a rule below narrows the system, it states what the website
> **currently standardizes on** — not a permanent closure. A future creative direction may widen it;
> drift may not.

---

## 0. Content density — the rule the rest of this document descends from

- **Each section communicates one primary message.** If two messages compete equally inside a band,
  split them or subordinate one.
- **Avoid:** multiple competing layouts in one section · excessive nested cards · dense information
  blocks · decorative UI clusters · competing focal points.
- **Whitespace is the primary mechanism for creating hierarchy.** Before reaching for a size, a
  weight, a rule, a fill or a border to separate two things, reach for space. Almost every other rule
  in this rulebook is a consequence of this one.
- Generous whitespace is maintained throughout — a section that has been packed to fill its space has
  failed, and so has one padded to look airy without an argument to carry.

## 1. Surfaces & background system

- **There is one page surface** — the default website background — and it carries the overwhelming
  majority of the experience. *(The exact surface is a Brand-Pack value.)*
- A **raised surface** exists for cards and panels that sit on the page. This is the only routine
  surface change in the language.
- A **surface change is a deliberate accent moment, not a rhythm device.** An accent surface may
  carry a single emphasis band — a closing call to action, one promotional beat. It is used because
  that band has earned distinct treatment, never to break up monotony on a cadence.
- **One surface per band.** A band carries exactly one surface — never blended, never gradient-mixed,
  never a second surface, and never a change the reader can locate inside the band. *(This governs the
  surface **changing**. The **material** a surface is made of is a separate matter — see below.)*
- **Dark surfaces are not part of the current Example Brand website language** and are not used unless a
  future creative direction requires them. The dark tier remains defined in the Brand Pack so the
  system can support future pages; it is dormant, not removed.

### 1.1 Surface treatment — the material a branded surface is made of

> **Surface treatments are not decorative effects.** They exist to soften the digital precision of
> large branded surfaces and give them a tactile, editorial character — the quality of printed matter
> rather than of a screen. Their purpose is to make the interface feel **editorial, printed, organic,
> human and crafted**. A reader should perceive the background as rich and materially considered, and
> should never notice an individual texture.

- **Material is a property of a surface, not a second surface.** It is uniform across the whole
  surface, marks nothing, separates nothing and carries no hierarchy. "One surface per band" is
  therefore untouched: a treated band still holds exactly one surface.
- **Material is not depth.** It adds no elevation, no z-axis and no depth simulation. §12 stands in
  full — this is not a relaxation of it.
- **Surface first — a large branded surface reads as an ENVIRONMENT before it reads as a layout.**
  Background treatment establishes **atmosphere**; typography establishes **hierarchy**; components
  occupy the environment. **Never reverse that relationship**, and never let the treatment compete
  with the content it sits behind: surface treatment stays secondary to typography.

  *This does not contradict the two rules above, and the reconciliation is worth stating so neither
  gets "fixed" later.* Atmosphere is not hierarchy: the material still marks nothing, separates
  nothing and ranks nothing. What it establishes is the **character of the space** the content is read
  in — and that character is perceived first, in the same way a room is sensed before its contents are
  read. Perception **order** is not visual **dominance**.
- **The governing test.** The reader should perceive a *tactile surface*, never an identifiable
  *texture*. The moment a texture reads as a thing **on** the surface rather than as what the surface
  is **made of**, it has failed — and the answer is to remove it from that surface, never to add
  more.
- **The treatment is fixed, shared and central.** A single set of textures, in a single composition
  order, at single blend and opacity values, applied identically everywhere. That shared reference is
  what makes the material read as one substance rather than a per-page effect. *(The assets, order,
  blends and opacities are Brand-Pack values; substituting an asset or reordering the layers is a
  change to the visual language, not an authoring choice.)*
- **The analog-tonal layer belongs to a photographic base, never to a solid colour.** The layer that
  carries scanned-film character is a *tonal* treatment: it varies tone that is already there. A
  photograph, screenshot or illustration has tone for it to act on. A solid brand colour does not —
  over a flat field the same layer stops reading as material and starts reading as dirt on the block.
  **A solid-colour surface therefore takes the grain and the printed-imperfection layers only.** The
  composition order is unchanged; the tonal layer is simply absent when there is nothing for it to
  vary. *(Which layer this is, and which bases take it, are Brand-Pack values.)*

  **Which surfaces have a photographic base is not fixed, so the rule is stated about the base.**
  Any surface can carry approved environmental imagery (§10), so "is there a photograph here" is a
  question about the **base**, answered per surface, never a list of surfaces held somewhere else.
  It is the same rule as it always was, stated where it is actually true.
- **THE SURFACE THAT CARRIES TYPE IS NEVER THE PHOTOGRAPH.** A photograph occupies a position the
  composition allocates to it. It is never the ground words are set on — but a panel or a band that
  happens to overlay one is, and that composition is permitted.

  **The test, stated the way it is measured.** Walk from a line of type to its **nearest opaque
  painted ancestor**. If that ancestor is the photographic element, the photograph is being used as a
  surface and is **refused**. If it is a panel or a band that merely overlays one, the photograph is a
  subject and the composition is **permitted**. Equivalently, and this is the property being
  protected: **no text draws its contrast from a photographic ancestor.**

  It is decidable by an author before authoring and by a machine after, which is what lets it replace
  a categorical ban. *(Reversed twice: 2026-07-29 — `DECISION-REGISTER.md` DR-7 retired the veil ramp
  and stated the ban categorically; 2026-07-31 — DR-46 narrowed the ban to the property it was
  protecting; 2026-08-05 — DR-55 brought this sentence and the instrument to DR-46, which they had
  never received.)*

  **What the categorical form cost, recorded because it is the reason for the change.** Stated as
  *"no composed surface carries both a photograph and text"*, the rule refuses a composition it has no
  quarrel with — an opaque band nested inside a photographic element, where every line of type sits on
  flat ink. That is exactly what DR-52 and DR-54 went on to author on four specimens, measured between
  8.54:1 and 14.38:1. A ban that forbids its own direction's work is over-stated, not strict.

  **What this replaced, and why the reasoning is kept.** A measured veil stood here: text contrast in
  this system was measured against flat colour (§15), a photograph underneath invalidated that
  measurement, and unmitigated it fell to near-total illegibility. The veil was set by the darkest
  asset in the approved library rather than chosen, it followed the composition rather than washing
  the band, and the standard it met — **a surface keeps the contrast measurement it replaces** — is
  worth carrying forward to anything that ever replaces a measured surface with another.

  None of that was wrong. The direction removed the case, not the measurement. It is recorded rather
  than deleted because a veil is exactly what a future direction would reach for if text over
  photography returned, and it should return to the measured version rather than to a chosen one.

  **The film and grain layers are untouched where the creative is the subject.** Material on an asset
  a person made is not a veil over text; it is the surface treatment this section governs, doing its
  normal job.

  **A creative shown as the SUBJECT is never veiled.** There is no text to protect, and dimming it
  would dim the thing being shown. The same asset takes the veil as a background and not as a
  subject — the surface's job decides, never the asset. *(The values and the measurement are
  Brand-Pack values.)*
- **A surface is treated because of what it is, never because someone chose to treat it.** There is
  no author-facing switch. The website **currently treats** the **closing call-to-action banner** and
  **creative surfaces** — a surface whose base is a delivered photograph, product screenshot,
  illustration or other creative. The creative direction additionally *declares* the hero, the
  full-width accent section, the editorial background panel and the brand-colour background; those
  are **not yet enabled**, and enabling one is a direction decision recorded in the Brand Pack.
- **Never treated:** the page surface, cards, buttons, navigation, inputs, small UI components,
  icons and typography. **Typography is never inside the composite** — this is structural, not a
  convention to remember.
- **A placeholder is never treated.** It reserves a position; it is not a surface. When the creative
  arrives, the material arrives with it (§10, `creatives.md`).
- **Reaching for material to relieve monotony is the same failure as reaching for an accent band to
  relieve monotony** (§2). Monotony is answered with density, scale and rhythm.

## 2. Section separation & rhythm

- **Sections are separated by generous whitespace and by the Section Marker** (§16), not by
  alternating the surface and not by fencing every band with a rule.
- A **divider** is available where a structural hand-off genuinely needs marking (§11) — punctuation,
  not a default.
- **Avoid:** a fixed repeating surface cadence; an accent band with no reason beyond variety; a
  surface change that competes with the content; decorative surface treatments — patterns, in-band
  gradients, and any texture used *as an element* rather than as the surface's material (§1.1); long
  stretches with no change in density or scale, which read as monotonous even on one surface; **a
  section opening compressed, or a section collapsed vertically, because its content is short** —
  the rhythm is the section's, not the content's (§17).

## 3. Typography (by role)

- **One typeface across the whole experience.** The display, body and editorial roles all resolve to
  the same family. *(The family is a Brand-Pack value.)*
- **Display role** — the type ramp's heading steps: section titles, card titles, metric figures.
- **Editorial role** — the top of the ramp at its largest step, for the occasional commanding moment.
  Emphasis comes from **scale**, not from a heavier or a different face.
- **Body role** — the body step and the body line-height for paragraphs.
- **Supporting role** — the one step below body, carrying eyebrows, captions, labels, metadata and
  supporting UI text. **One step for all of them**, not a family of small sizes. It is editorial, not
  tracked-out uppercase.
- **Every heading level inherits one tracking value and one line-height** from a single declaration.
  Do not override either unless a component explicitly requires an exception.
- **Colour ownership — headings and paragraphs do not choose their own colour.** All heading levels
  inherit the **primary text** role by default; all paragraphs and all supporting text inherit the
  **secondary text** role by default. A component departs from either **only by explicit override** —
  in practice, only when it sits on an accent surface and takes that surface's paired foreground
  (§15). Nothing else re-decides text colour. This is what keeps a page consistent across components
  built at different times.
- **A component that must stay the primary ink regardless of its surface reads the *fixed* primary
  role, not the inherited one.** The two text roles are re-pointed by the pairing wrapper — that is
  how inheritance works — so anything that must not flip with the surface (the label on an action
  inverted onto an accent band) must read the fixed role instead. Reaching for the inherited role
  there produces white-on-white on a deep accent. *(Both roles are Brand-Pack values.)*
- **No italics, no serifs, no second family.** *(Family, weights and sizes are Brand-Pack values.)*

## 4. Headline & title hierarchy (a toolkit, not a mandate)

Reach for these **only when they sharpen the message**, and never stack more than one — one focal
point per headline. Build emphasis **only** from the existing ramp, weights and palette (add no new
size, weight, font, or colour):

- **Two-tone colour split** — focal line/word in the primary text role, supporting line/word in the
  secondary role.
- **Single accent word** — colour exactly one key word or phrase with the section's accent; never the
  wordmark-only colour, and only with an accent that is legible as text on the page surface (§15).
- **Scale pairing** — stack existing ramp steps (supporting label → title; large metric → caption) so
  parent and child read at a glance. Don't invent intermediate sizes.
- **Positioning, line-breaks, staggered alignment** — deliberate breaks and per-line alignment create
  a focal path; offset lines with alignment only, **never negative margins**.
- **Big number as focal point** — let a key metric lead at the ramp's top step, its unit and label
  smaller and in the supporting role.
- **Never** create emphasis with shadow, blur, or a heavier face. Leave body and supporting text on
  the base ramp.

## 5. Spacing & layout

- A **canonical content well / page frame** owns horizontal layout: every section aligns to that one
  edge by inheriting the single page-composition primitive (`.cr-well`) — sections do **not** declare
  their own content width or side padding (the page gutter is owned by the primitive, not the
  section). A **narrower well** (`.cr-well--narrow`) is the one documented exception, for editorial /
  FAQ reading widths; a deliberately-marked **full-bleed** is the other.
- **Three named spacing steps carry the language** — a tight step between closely related elements, a
  default step between related content groups, and a generous step between major visual groups. They
  are drawn from the underlying grid, not a second scale. A component-specific layout may override
  them where it genuinely must. *(The steps are Brand-Pack values.)*
- **A section opening uses three named rhythm ROLES, not steps chosen at the point of use** — an
  *opening* gap, a *cluster* gap and a *content* gap (§17). The generic steps say how far apart two
  things are; the roles say what the gap is **for**, and that is the difference between a rhythm that
  reproduces and one that gets re-improvised into an even spread every time a page is built. Never
  distribute spacing evenly simply because the steps exist.
- **Sections carry a consistent default padding**, generous on the block axis. Section heights are
  **substantial**, not cramped. Card stacks are **differentiated**, not equal N-up rows — large, small, accent
  and neutral rather than one shape repeated. The equal grid survives only where the section's
  archetype is `feature-comparison`, because parallel structure is that section's message. Everywhere
  else it is the shape a page reaches for when nothing decided which card mattered most.
  *(Reversed 2026-07-29 — `DECISION-REGISTER.md` DR-9. It had been half-reversed by accident for some
  time: `COMPOSE.md` §C.14's decisive-margin floor already failed a three-equal-card grid unless the
  section declared itself `distributed`, so the rulebook and the grammar contradicted each other and
  the grammar was quietly winning.)* *(All measurements are
  Brand-Pack values.)*
- **Content width is governed independently of layout width, and the system currently distinguishes
  FOUR widths.** *(All four are Brand-Pack values.)*

  | Width | Applies to | Job |
  |---|---|---|
  | **Container** | the page frame | defines the composition; never affects readability |
  | **Layout** | comparison tables · dashboards · card grids · feature matrices · **a creative that leads its section** | the *licence* to occupy the full container, granted only where the component genuinely requires it |
  | **Title measure** | headings at the three editorial steps · large editorial statements · hero messaging · CTA headlines | holds a headline to a tight, editorial column |
  | **Body measure** | paragraphs · supporting copy · descriptions · explanatory text · CTA copy | a comfortable line length |

  **There are exactly TWO text measures, and no third — DR-14.** They were previously named
  *Editorial* and *Reading*, and the second was a **band** a composition could select within, which is
  how a third value survived: a band with two ends is two values, and a title measure above it made
  three. Both are single values now, named for the role they govern.

  **Title and Body share the same default width, and the wide value is a RELEASE VALVE — DR-15.**
  A title takes the body width. It is released to the wider value **because the type wrapped to a
  third line, and for no other reason** — a wrap problem, not a hierarchy one. This is the closing
  band's rule generalized; that band already carried a narrow/wide pair with exactly these semantics
  and is **no longer an exception**, because its pair is now the general pair.

  > **The title→body narrowing is retired as a hierarchy mechanism.** This rulebook previously made
  > the transition between two measures load-bearing: *"supporting copy should not inherit the width
  > of the headline; the transition establishes the section's visual hierarchy."* With both roles at
  > the same default, that transition does not happen, and a rule that describes something the system
  > no longer does is worse than no rule.
  >
  > **Hierarchy comes from scale, weight and space** — the display step against the body step, and
  > the rhythm roles between them. That is what §0 and the governing posture have said all along:
  > *visual hierarchy is created with typography, scale, whitespace, alignment and proportion.*
  > Measure was one mechanism among those, it was the weakest, and it is the one that produced a
  > third text width twice in two days. Removing it costs nothing the others were not already
  > carrying.

  **CSS cannot count rendered lines, so the release is an authored opt-in** — a class, exactly as the
  closing band's already is. That is not an honour system: the **render can be measured even though
  the trigger cannot be expressed**, so a title held at the wide value while rendering in fewer than
  three lines is a failure, not a preference. *(Both values, and the class, are Brand-Pack items.)*

  **A dominant creative was missing from that list and is added — 2026-07-29.** Photography that
  carries a section takes the full content width; a landscape image constrained into a column is the
  layout deciding the creative's authority, which `creatives.md`'s Creative-First Composition forbids
  in the one place it is easiest to do accidentally. The omission was already contradicted by the
  archetype contracts, which have mandated a bleeding creative for `immersive-landscape` and
  `media-first` for some time — so this closes a seam between two documents rather than widening a
  licence. **Narrative content is not covered by it**: copy never spans the full container, whatever
  the creative beside it is doing.

  **Editorial content never inherits layout width**, and never expands merely because horizontal space
  exists. Below the editorial heading steps, a heading takes the measure of the context it sits in —
  a card title is bounded by its card, not by a page measure.

  > **RETIRED — DR-15. Kept visible because it was load-bearing and its removal is the point.**
  > ~~Headlines and supporting copy intentionally occupy different measures.~~
  >
  > ~~Supporting copy should not inherit the width of the headline. The transition from Title
  > Measure to Reading Measure establishes the visual hierarchy of the section and should remain
  > consistent throughout the website.~~
  >
  > **Replaced by:** hierarchy is established by scale, weight and space. Title and body share a
  > width; what separates them is that one is set at the display step and the other is not.

  **The two measures are now equal by default, and that is a decision rather than a tidy-up.** This
  passage previously read *"the narrowing is the design — equalising the two measures to tidy it
  removes the hierarchy it was carrying."* The warning was sound against an accidental equalisation;
  it does not survive a deliberate one. Hierarchy moved to scale, weight and space, and the width is
  no longer asked to carry it.

  It is the **title** measure, not a "display" measure: *display* names a font classification, and
  what is governed here is the editorial composition.

- **The body measure is a CAP, not a band — reversed 2026-07-29, DR-14.** It previously had a lower
  and an upper bound that a composition selected within, and that freedom is what produced a third
  text width: a band with two ends is two values, and the title measure above it made three. The
  measure is now one value, and a section does not select a width for its copy any more than it
  selects a type size for it.

  **What the band was protecting is protected better by the release valve.** Its argument was that
  one fixed maximum across every section reads as mechanical — true, and the answer is a valve pulled
  for a **stated reason** (the type wrapped to a third line) rather than a width that drifts section
  by section for none. A paragraph still never runs the full content well; it simply now fails to for
  a reason that can be checked.

## 6. Corners & cards

- The website **currently standardizes on two radii**: one for controls (buttons, inputs, chips) and
  one for large surfaces (cards, panels). A third value is not introduced by drift; a genuinely new
  component may argue for one explicitly. *(Exact radii are Brand-Pack values.)*
- **Standard content card:** the large-surface radius, the raised surface, a **hairline border** for
  separation, and **generous internal spacing**. **No elevation** — see §12.
- Defined variants keep their own rules: the **metric tile**, the **FAQ row**, the **Q&A answer
  panel** — each a role with its own surface/radius/padding.

## 7. Buttons & states

- **Minimal styling at the control radius. No shadow.** The label and the fill are the whole button.
- **Primary** — a flat fill in the **primary text role** with the page surface as its label colour.
  It reads as the action because it is the densest thing on a light page, not because it is coloured.
  The "→" arrow, where used, sits **inside the label span** (not as a separate icon).
- **Secondary** — no fill, a hairline border, the primary text role as the label.
  **Tertiary** — bare, no fill and no border, label only.
- **On an accent surface** the primary action inverts to the raised surface with the primary text
  role as its label, so it remains the one thing to press.
- **States are derived, not arbitrary:** hover shifts the fill by one step (no hue change); press
  snaps to a slight scale-down; disabled drops to a reduced opacity. *(Values are Brand-Pack values.)*

## 8. Navigation

- **One canonical composition:** logo left · the canonical link set · one primary action right.
  It **never changes composition** and never copies a reference's nav links.
- The nav sits on the page surface, with the link set in the primary text role and the action as the
  standard primary button. There is no light/dark nav pairing to resolve — the page has one surface.
- Nav type sits on the **supporting step** of the ramp, and its action on the control radius; the nav
  is not a place where off-scale sizes are introduced.
- Links may hide on narrow viewports; logo + action remain.

## 9. Iconography

- **One icon set only** — outline style, minimal geometry, a single consistent stroke weight,
  editorial in character. No fills except defined chip tiles.
- **Stroke scales with icon size** by defined ratios so optical density stays consistent; never set
  stroke independently of size.
- **No emoji, no unicode-as-icon.** The only permitted unicode glyph is the CTA "→" arrow, written as
  the actual character inside a label.

## 10. Imagery — the system reserves position and selects, never creates

- **This design system does not produce photography, illustration, artwork, product screenshots,
  screenshot styling, image treatments, marketing graphics, decorative graphics or motion graphics.**
  Those assets are created independently, by people.
- **Where the creative exists, it is SELECTED from the approved library; where it does not, a
  structural placeholder is generated instead**, naming what belongs there. Both are layout
  decisions. The system defines **which approved asset, its placement, proportion, presence,
  spacing, alignment and responsive behaviour** — never the asset itself. See `creatives.md` for the
  full doctrine and `brand-pack/ASSETS.md` for the library.
- **Environmental imagery has one source.** Approved environmental photography comes from the
  canonical Brand Pack library and nowhere else — never stock, never generated, never another file
  in the repository because nothing in the library quite fit. **Never modify the asset**: atmosphere
  is built above an untouched image, by the system.
- **Crop, never stretch.** A delivered asset rarely arrives at an approved ratio, so it is cropped to
  one at a governed focus that travels with the asset. *"Preserve the aspect ratio"* means preserve
  the creative — it is not a licence to ship an off-vocabulary proportion.
- **A photographic surface keeps the contrast measurement it replaces.** Text contrast in this system
  was measured against flat colour (§15); a photograph behind copy invalidates that measurement, so
  the surface carries a measured veil. Legibility is a property of the surface, not a styling choice.
- **The closing call-to-action band is a solid surface — never an environment, a photograph or a
  gradient.** Its material is the grain and the printed-imperfection layer over a flat brand colour.
  The last argument on a page has to be unambiguous, and atmosphere behind it competes for exactly
  that moment. *(Enforced in the Brand Pack: an environment selection on a closing band resolves to
  nothing.)*
- **Do not reserve a position the library can already fill** — a placeholder in front of an available
  approved asset declares an absence that is not real.
- **Never generate or describe the creative itself** — not as an image, not as generated interface,
  not as an illustrative vector composition, and not in prose.
- A placeholder is the opposite of filler: it makes an absence **explicit and legible** rather than
  faking presence with an invented artifact.
- **A delivered creative is a treated surface; the placeholder standing in for it is not** (§1.1).
  The system does not make the creative, but it does own the material the creative is presented in —
  that material is what keeps a supplied asset reading as part of the page rather than pasted onto
  it.

## 11. Borders & dividers

- **A single hairline weight and a single stroke colour** for all structural separation — cards,
  inputs, dividers. **Avoid heavy borders**; there is no emphasis-weight tier.
- With the page held on one surface, **hairlines now carry the structural separation** that surface
  switching used to. They are still punctuation and still used sparingly — reach for a divider when a
  genuine structural hand-off earns it, not to fence every group.
- **Decorative borders are out.** A border either separates two things structurally or does not
  belong.

## 12. Effects — depth

- **No shadows anywhere.** Not on cards, not on buttons, not on floating panels, not on hover.
- **No glass, no backdrop blur, no glow, no depth simulation of any kind.**
- **Hierarchy is achieved using spacing, typography, alignment and composition.** If something needs
  to feel more important, give it more room, more scale, or a clearer position — not more depth.
- The Brand Pack retains its elevation tokens marked deprecated so nothing downstream breaks. They
  are inert. **Referencing them is a violation of this section**, not a permitted fallback.
- **Surface material (§1.1) is not an exception to this section.** A texture that is being used to
  make something feel raised, recessed, or separated from what is around it is depth, and this
  section forbids it.

## 13. Motion & micro-interactions

- Nothing parallax; primary content blocks don't move.
- **Hover only signals a real interaction** — buttons, links, nav, controls. Static, informational
  content never reacts to hover. Section reveals are short, calm fades; avoid spring and bounce — the
  brand reads as institutional unless the brand says otherwise. Press is a quick scale-snap.

## 14. Layout rules

- **No negative margins, no layout hacks.** Resolve composition through spacing, grid, alignment and
  structure.
- The **action element never matches its surrounding band** — a primary action always reads clearly
  against its surface.
- Long pages are sectioned by **whitespace and the Section Marker, not by alternating surfaces**;
  each band carries its own block padding.

## 15. Colour usage (by role)

**The principle this whole section serves:**

> **Colour communicates emphasis. Components communicate function. Layout communicates hierarchy.
> Typography communicates importance.**
>
> **Colour reinforces hierarchy. It never creates it.**

- **Colour never establishes a component's identity.** A component is defined by its semantic role,
  its hierarchy and its interaction — never by its fill. "This component is that colour" makes the
  colour load-bearing, and a load-bearing colour can no longer be spent, withheld or varied for a
  communicative reason. No page relies on an accent to establish hierarchy.
- **Typography stays predominantly neutral.** Two text roles — primary and secondary — carry
  effectively all type. **Hierarchy comes from typography and spacing rather than colour.**
- **Accents are used sparingly**, and each has one job: an **emphasis accent** for Section Markers and
  moments given deliberate additional attention, a **positive accent** for success, validation and
  completion, an **information accent** for information, orientation and environmental grounding at
  scale, and an **intelligence accent** for intelligence and premium capability.
  *(Which hue fills which role is a Brand-Pack value.)*
- **The emphasis accent is never used as a large coloured surface.** It is a spark, not a wash — never
  a band, a page background, a card fill or a wide field. *(A single small filled control is not a
  large surface; see `component-governance/COMPOSE.md` §C.5 for the one bounded case where an
  emphasis-filled action is permitted.)*

### The Colour Intent Matrix

Each colour's **purpose** and how often it should be met. This is the bridge between what the palette
*is* and how a page *uses* it — without it, "use the closest token" has no way to be wrong.

| Colour | Purpose | Frequency |
|---|---|---|
| Neutral | architectural canvas | 90–95% |
| White | elevation | frequent |
| Orange | editorial emphasis | rare |
| Blue | information · environmental surfaces | moderate |
| Purple | intelligence | rare |
| Green | success | rare |

Three readings that keep this table from being misused. **Frequency is an occasion, not a quota** — an
accent that appears because its occasion arose is correct however rarely it appears, and an accent
distributed to hit a target has stopped meaning anything. **The 90–95% is a page aggregate**, not a
per-section rule; a single declared accent-surface band may be almost entirely chromatic and the page
still reads correctly (`COMPOSE.md` §C.5 holds the per-section ceiling and that band's exemption).
And **the hues are named here** — unusually for this rulebook — because §16's marker order already
depends on them by name; the binding itself remains a Brand-Pack value.

### Surfaces and the page ground

- **The page ground is the canvas, and the canvas is warm.** The system's default page surface is the
  warm neutral field, not white. **White is an elevation** — a raised surface for content lifted off
  the canvas. This inverts the usual white-page hierarchy, and it is most of why the experience reads
  as editorial rather than as an application. *(The value is a Brand-Pack value; the default is
  canonical, not mandatory.)*
- **Section Background Ownership — every section declares its own background.** A section never
  inherits a background by accident. Background selection is an intentional design decision, drawn
  from the approved surface tokens, and the page ground exists only beneath sections that have not
  declared otherwise. A default without this rule becomes the only background anything ever has; this
  rule without a default lets every generation drift somewhere different.
- **The surface scale is consumed semantically.** Reach for the semantic surface token that names what
  the surface *is*; reach for a numbered tonal step only when building a new semantic token or
  defining a new component. A numbered step chosen directly at a call site is a decision nobody can
  later find.

### Governed editorial dark surfaces

The system is **light-first and editorial. Dark surfaces are intentional compositional devices, not a
theme.** A dark surface is never used to produce a dark-mode experience, and there is no dark theme to
switch to — dark is one more section background, selected for a communicative reason.

- **Permitted:** hero · closing CTA band · footer · immersive storytelling · full-bleed media
  environments · product reveals · transitional narrative moments.
- **Forbidden:** general content sections · forms · documentation · long-form reading · dashboards ·
  arbitrary section alternation · whole-page dark.
- **A page carries no more than two dark environmental sections.** Dark surfaces are narrative
  moments, not layout defaults — **their rarity is what gives them weight**, so the ceiling is part of
  the device rather than a limitation on it.

### The rules that hold regardless

- **Accent-on-surface pairing is a rule, not a judgement call.** An accent used as a surface has a
  **paired foreground** recorded in the Brand Pack, measured for contrast. Use the pair. Do not put
  the primary text role on an accent that requires the inverse, or vice versa.
- **Only accents that meet contrast as text may be used as text.** Some accents in the palette are
  surface-only. The Brand Pack records which is which; when in doubt, use a text role.
- **A focus indicator is never the thing that fails.** The default focus indicator is high-contrast
  against the page ground; on an accent or dark surface it takes the variant recorded for that
  surface. An accent that reads as a natural "focus colour" but does not clear the non-text contrast
  floor is not a focus indicator. *(Both values are Brand-Pack values.)*
- **Accent-on-surface pairing is a rule, not a judgement call.** An accent used as a surface has a
  **paired foreground** recorded in the Brand Pack, measured for contrast. Use the pair. Do not put
  the primary text role on an accent that requires the inverse, or vice versa.
- **Only accents that meet contrast as text may be used as text.** Some accents in the palette are
  surface-only. The Brand Pack records which is which; when in doubt, use a text role.
- **Wordmark-only colour** — appears *solely* inside the logo. Never paints UI surfaces, accents,
  headlines, or icons.
- **Semantic status & data-viz** roles exist for charts and metrics (info / success / warning / error
  + chart series). Saturated hues survive there and nowhere else as surface colour.
- **No banned-hue rule.** The palette is what the Brand Pack defines; anything outside it is
  off-palette and that is the only test.

## 16. The Section Marker

The Section Marker is part of the Example Brand visual identity. It introduces a major section and
establishes consistent horizontal alignment across the page.

- **Structure** — two small, hard-cornered squares. *(Size and radius are Brand-Pack values; the
  radius is zero — it is the one element in the system with square corners.)*
- **Placement** — one square at each edge of the section's content width, so the pair spans the full
  available width:

  ```
  ■────────────────────────────────────────────────────────────■
  ```

- **It aligns to the content well's inner edge — never the section's outer edge.** Its job is
  establishing the page's horizontal alignment, so it must sit on the same edge every other section
  aligns to. A deliberately-marked **full-bleed** band still places its marker on that edge, even
  though its content runs edge to edge.
- **The marker BRACKETS its section — one at the opening, one at the close.** It is a pair, not a
  single mark. The top marker says a major section begins here; the bottom one says it ends here; and
  the two together are what make the section read as a **bounded movement** rather than as content
  that simply stopped. **Never mid-section.**
- **A section either takes the bracket or takes no marker at all.** Half a bracket is the defect: it
  opens something it never closes. This is the one thing to get right when adding a marker to an
  existing section.
- **The opening gap is larger than the closing gap**, and that asymmetry is deliberate. A bracket with
  identical space at both ends reads as a box drawn around the content; an opening that breathes
  wider than the close reads as authored. *(The two steps are §17's opening and content roles;
  the values are Brand-Pack values.)*
- **It belongs to the section, not to the heading.** A large separation sits between the opening
  marker and the heading (§17's opening step), and the heading must never appear visually attached to
  it. The marker introduces the section; the heading begins the narrative. Two moments, not one pair.
- **Colour** — the accent assigned to that section, in a stated order of preference: **orange first,
  then blue, then the remaining accents.** Orange is the identity's own marker colour and the
  default; reach past it only when the section has a reason, and past blue only when both are already
  spoken for on the page. **Never a text colour.** On an accent surface it takes that surface's
  paired foreground, so it stays visible without introducing a second accent.
- **Both halves of a bracket are the same colour.** They are one mark in two places, not two
  decisions — a bracket that opens orange and closes blue reads as two different sections colliding.

  That rule is doing more work than it looks. **A section's closing marker sits nearer to the next
  section's opening marker than to its own opening one** — measured on a reference page, a bracket
  spans 540–1341px while the gap across a section boundary is ~248px. Colour is what stops the
  reader pairing the wrong two: an orange close beside a blue open reads as one section ending and
  another beginning. **Consecutive marked sections should therefore not share a colour**, and the
  rotation through the priority order (orange, then blue, then the rest) is what naturally provides
  it. Two same-coloured brackets in a row is the one arrangement where the bracket becomes
  ambiguous.
- **The marker stays scarce.** A section that does not open a major movement of the page does not
  need one, and a page in which every section carries one has made the marker meaningless — which
  is truer of a bracket than of a single mark, since each one now costs two.
- It is **optional**. A section that does not open a major movement of the page does not need one,
  and a page in which every section carries one has made the marker meaningless.

## 17. Section structure

**Preferred hierarchy**, with a deterministic rhythm — the rhythm is what makes generation
reproducible rather than merely plausible:

```
Section Marker (optional)
    ↓   OPENING step   — the largest gap in the section
Heading
    ↓   CLUSTER step   — the smallest; one thought
Supporting Body
    ↓   CONTENT step   — the hand-off
Primary Content
```

**The marker introduces the section; the heading begins the narrative. Those are two different
moments.** The marker is not attached to the heading and must never appear to be — it sits within the
section's composition as its opening gesture, separated from the heading by the section's **largest**
gap. Binding the two together with the tight step is what makes a section opening read as compressed,
and it is what this rhythm previously specified.

**The heading and its supporting copy are one editorial cluster** — a single thought, read together.
They bind with the smallest step, and no intermediate spacing is inserted between them.

**The rule is the ORDER, not the numbers: opening > content > cluster, at every viewport.** Three gaps
of equal size satisfy every named step and still fail this rhythm — spacing distributed evenly because
steps exist is precisely the failure. Whitespace is part of the communication hierarchy, not the room
left over; large transitions should feel calm and breathable.

**Preserve the rhythm regardless of content length.** A section with little to say produces a calm,
open composition — never a collapsed one. Do not reduce whitespace merely because the content is short.

*(The three steps are the named rhythm roles from §5; their measures are Brand-Pack values, and they
scale by viewport while preserving the ordering. Component-specific layouts may override where they
genuinely must.)*

**Primary Content** may be a photography placeholder, a product-screenshot placeholder, an editorial
visual placeholder, a dashboard placeholder, cards, metrics, a timeline, tabs, an accordion, or a
call to action. The system defines **only its placement and spacing** — never the creative (§10).

**Preferred layout patterns** — editorial, split layout, full width. Reach for the one the section's
argument calls for.

**Every section communicates one primary message, with no competing focal points** (§0).

## 18. Component styling

Each entry adds only what is *specific* to that component; §0–§17 already bind it.

- **Buttons** — the control radius, minimal styling, no shadow. (§7)
- **Cards** — the large-surface radius, one hairline stroke, no shadow, generous internal spacing.
- **Tabs** — minimal appearance, typography-first, a simple active state, no heavy backgrounds.
- **Accordions** — editorial spacing, hairline dividers between rows, one item expanded by default.
- **Metrics** — large numerical hierarchy at the top of the ramp, minimal decoration, emphasis
  carried by typography alone. On an accent surface the figure takes the paired foreground (§15).
- **Lists** — generous vertical spacing, clean typography, minimal decoration.
- **Dividers** — one hairline weight and colour, structural separation only. (§11)
- **Icons** — outline, minimal geometry, consistent stroke weight, editorial. (§9)
- **Media containers** — the container that holds a section's primary content block, including every
  placeholder. Its **corner treatment** is component styling and lives with the component. Its
  **proportion, presence and placement are not** — those are decided *before* the surrounding layout,
  from the three closed vocabularies in `creatives.md` (Creative-First Composition). The system-level
  rules that bind it are §10 (never the creative) and §17 (position and rhythm).
- **Closing call-to-action banners and heroes** — composed sections, not containers holding centred
  text. See `component-governance/COMPOSE.md` §C rule 12: the section sets its own rhythm and the
  content inhabits it; content occupies an editorial portion, not the full width; vertical
  composition is intentional rather than mathematically centred; the marker brackets the section, opening and closing it.
