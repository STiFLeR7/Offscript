# Creatives — the placeholder doctrine (Rulebook · HOW)

> **Brand-agnostic.** Governs *how the system treats a creative asset it does not own*. Asset files,
> palette and the reference library are **Brand-Pack** values referenced here by role.
>
> **This rulebook was inverted.** It previously instructed the system to *generate* a section visual —
> a purpose-built interface inside a curated atmospheric environment. That is no longer the doctrine
> and must not be reintroduced. Creative production has been withdrawn from the design system.

---

## Creative-First Composition — the doctrine this rulebook rests on

> **Creative assets are first-class compositional elements. Their proportion, measure and placement
> are determined before surrounding layout decisions.**
>
> **Layout adapts to the creative. Creative never adapts to available space.**

This was implied in several places and stated as law in none, which is why ratios, placeholders,
heroes, closing calls to action and editorial layouts each drifted on their own. It is one rule, and
it governs all of them.

**It names exactly three properties, and each has a closed vocabulary below.** Governing only one of
them governs nothing: the same approved ratio at 90% of a composition and at 35% are different design
decisions, and the same ratio at the same size can still be assembled media-first, text-first or
interleaved at random.

| Property | Vocabulary | Decides |
|---|---|---|
| **Proportion** | the four approved ratios | the shape the creative will occupy |
| **Presence** | the presence classes | how much compositional authority it holds |
| **Placement** | the anchors | where it sits, and how content relates to it |

**The order matters.** These three are settled *before* the surrounding layout, not fitted to it
afterwards. A creative sized to whatever room was left over is the failure this doctrine names — it is
how a layout ends up dictating a proportion, which is the relationship exactly backwards.

## The boundary

**This design system governs the structural and visual language of the website. It does not define or
generate creative.**

It does **not** produce, and must never produce:

- photography · illustrations · artwork
- product screenshots · screenshot styling · screenshot integration
- image treatments · marketing graphics · decorative graphics · motion graphics
- creative direction for any of the above

These assets are **created independently, by people**. The system's job is to know exactly where each
one goes and to hold that space correctly until it arrives.

## When the creative has arrived — the approved library

The boundary above is about **production, not use**. "Until it arrives" was always half of a
sentence, and this is the other half: some creative *has* arrived. Approved environmental imagery
now lives in the Brand Pack, made by people and delivered to the system, and it is the **single
source of truth for environmental photography** across the website.

So a reserved position has two possible answers, and they are not in competition:

| the creative for this position… | the system's job |
|---|---|
| **exists** in the approved library | **select it.** Composition, treatment and legibility follow. |
| **does not exist yet** | **reserve it.** A structural placeholder, exactly as below. |

**Selection is not production.** Choosing which approved asset occupies a position is the same class
of decision as choosing its ratio, its presence or its anchor — a layout decision the system
legitimately makes. Authoring the asset is not, and that has not changed by one word. The rule that
follows is the whole of it:

> **Select from the approved library. Never generate, never substitute, never modify.**

- **Never generate** an environmental image, and never write a description of one — a prose brief for
  a photograph *is* creative direction, which is the thing this rulebook withdraws.
- **Never substitute.** Not a stock library, not a generated stand-in, not a file from elsewhere in
  the repository because nothing in the library quite fit. If the library genuinely cannot serve the
  section, that is a finding to report — it is not a licence to source around it.
- **Never modify the asset.** No treatment is ever baked into a file. Gradients, overlays,
  atmospheric colour, noise, film grain, surface texture and blend modes are applied **by the design
  system, above an untouched image**. That is what lets one asset read two different ways in two
  different sections, and what stops a per-page effect from being mistaken for the material.

**This does not reopen "never an atmospheric background".** That rule forbids the system from
*inventing* atmosphere — authoring a scene, a gradient landscape, a decorative field — to fill a
position it was supposed to reserve. Placing an approved photograph that people made is the
opposite act: nothing was invented, and the asset is accountable to whoever made it.

**Do not reserve a position the library can already fill.** A placeholder standing in front of an
available approved asset is a reservation for nothing — it declares an absence that is not real. The
test is what the position is *for*: an environmental atmosphere the library can supply is delivered
creative and should simply be selected, while a product screenshot or a photograph of this client's
own work is not in the library and is genuinely absent until someone makes it.

### Selecting — the question every choice has to answer

> **Why is this the correct environmental atmosphere for *this* section?**

*"It looks good"* is not an answer. The answer comes from what the section is doing — its Section
Composition Archetype and its communication intent — and it is reached in that order, never by
browsing the library for something attractive and composing around it afterwards.

The library's own catalog records what each asset is and what it is for; these are the standing
criteria by role.

- **Hero — atmosphere before content.** The image should read as editorial rather than decorative:
  natural negative space, depth, environmental storytelling, organic texture, room for typography.
  **Typography occupies the negative space; it never covers the subject.** Avoid an obviously centred
  focal point — a symmetrical image gives typography nowhere to be.
- **Closing banner — never.** The closing call-to-action band is a **solid brand surface**: no
  environment, no photograph, no gradient. Its material is the grain and the printed-imperfection
  layer over a flat colour, and that is the whole of it. The last argument on a page is carried by
  typography on an unambiguous surface, and atmosphere behind it competes for the one moment that
  has to be unambiguous.

  **This is enforced by the pack, not left to discipline.** An environment selection landing on a
  closing band resolves to nothing — no image, no tonal layer, no veil. A rule stated in prose with
  the handle left open is a rule that gets broken by someone who never read it.
- **Editorial section — reinforce the narrative, don't illustrate the copy.** Contribute mood, scale,
  depth and rhythm. **Avoid literal visual metaphor** — a section about growth does not need a photo
  of a plant. Editorial communication is typography first, imagery second.
- **As the subject rather than the surface** — a delivered creative shown as itself, not as an
  environment behind content. The detailed, high-contrast assets belong here; they are exactly the
  ones that compete with copy when used as a background.

### Legibility is part of the selection, and it is measured

An environment used **as a surface** sits under text whose contrast was only ever measured against
flat colour. Putting a photograph there **destroys that measurement** — unmitigated, the approved
library measures as low as **1.02:1**, which is text that cannot be read at all, and no rule in this
system would have caught it.

So the surface carries a veil, the veil is **set by the darkest asset in the library rather than
chosen**, and the resulting rule is short: **a surface keeps the contrast measurement it replaces.**
An asset that cannot clear that bar does not join the library. The value, the measurement and the
method live with the assets, in the Brand Pack.

A creative shown as the **subject** is never veiled — there is no text to protect, and dimming it
would dim the thing being shown. **Same asset, two jobs, and the surface decides which.**

## What the system does instead — when the creative does not exist

**Wherever a creative asset is required and none has been delivered, generate a structural
placeholder indicating its position within the layout.** Nothing more.

The named types:

- **Photography Placeholder**
- **Product Screenshot Placeholder**
- **Editorial Visual Placeholder**
- **Dashboard Placeholder**

They differ only in **what they declare**, never in how they are drawn. A placeholder states which
kind of asset belongs in that position, and that is the whole of its content.

## What a placeholder owns

Only the structural properties — every one of which is a layout decision the system legitimately
makes:

- **Placement** — where in the section it sits, and on which side of a split.
- **Proportion** — an aspect ratio from the approved vocabulary, chosen for the placement, so the
  reserved space is the space the real asset will occupy.
- **Presence** — how much of the composition it commands, from the approved presence classes.
- **Placement** — where it sits, from the approved anchors (this subsumes the "which side of a split"
  question above and answers it deterministically).
- **Spacing** — its relationship to the heading group above it and to whatever follows, drawn from
  the named spacing rhythm.
- **Alignment** — the content edge it aligns to, which is the page's one canonical edge like every
  other block.
- **Responsive behaviour** — how the reserved space reflows across breakpoints.

## What a placeholder must never do

- **Never generate or describe the creative itself.** Not as an image, not as a generated interface,
  not as an illustrative vector composition, not as an atmospheric background, and not in prose. A
  placeholder that describes the photograph it is standing in for has produced creative direction.
  *(Selecting an existing approved asset is a different act entirely — see the approved library
  above. This forbids **inventing** creative, never **using** creative that people made.)*
- **Never substitute an invented artifact.** Authoring a mock dashboard, a fabricated screenshot, or
  a decorative diagram *because a real one is unavailable* is the failure this doctrine exists to
  prevent — not a clever workaround for it.
- **Never decorate.** A placeholder is a reserved position rendered in the system's own structural
  vocabulary — the standard stroke, the standard radius, the standard surface. It is not a designed
  object.

  **A reserved position now carries an approved environment as its base**, and that is not
  decoration — it is the position shown at the weight it will actually carry. An empty outlined box
  reads as a wireframe: a page full of them cannot be judged as a design, because the thing being
  judged is mostly absent. What must not change is what the position *claims*: the label names what
  belongs there, it stays legible, and the base is visibly held back from the strength a delivered
  creative renders at. **A reserved position must never be dressed up as the real asset** — that is
  the fabricated-substance rule below, and it is the one line this must not cross.

## Placeholder vs. filler — the distinction that reconciles this with the rest of governance

Elsewhere the system forbids placeholders, in strong terms: a product artifact must be *genuine,
never faked, placeholder, or invented*; resource items must be *real, never placeholder titles*;
assets are used *as-is, never padded with filler*.

**Those rules stand, and they are about something else.** They forbid **fabricated substance** —
inventing evidence, faking a product, padding a page with content that does not exist to make it look
fuller. Every one of them protects the reader from being shown something untrue.

**A structural placeholder is the opposite act.** It **declares an absence** instead of concealing
one. It says, in the layout itself, *a real photograph belongs here and has not been made yet* — and
it is legible as exactly that to everyone who sees it. It adds no claim, no evidence, and no
substance.

The test: **does it assert something the reader might believe?** Fabricated proof does; a labelled
reserved position does not. If a placeholder is ever styled so that a reader could mistake it for the
real asset, it has crossed into the thing those rules forbid.

## Composition & storytelling

The section around the placeholder is still designed, and the ordinary rules bind it:

- **One thing per section.** The placeholder holds the position of the section's single primary
  visual — not a gallery of competing ones.
- **Strong hierarchy, one clear focal point, generous whitespace, editorial layout, clean alignment.**
- **Avoid** clutter, competing focal points, and reserving more visual positions than the section's
  argument needs. Two placeholders in one section usually means the section is really two sections.

## Proportion — the aspect-ratio vocabulary

**Four ratios, and only these four.** *(The values are Brand-Pack values; the vocabulary is closed
here.)*

| Ratio | Used for |
|---|---|
| **1:1** | product fragments · supporting editorial visuals · icons presented as imagery · small creative moments |
| **3:4** | portrait photography · editorial photography · human subjects · storytelling imagery |
| **4:3** | editorial illustrations · product compositions · medium-emphasis creatives · general visual storytelling |
| **16:9** | product interfaces · dashboards · platform screenshots · wide editorial imagery · hero demonstrations |

- **Choose the ratio that best supports the communication objective** — not the one that happens to
  fit the space left over.
- **Never generate an arbitrary ratio.** Not 5:7, 7:9, 13:8, 11:6, or any proportion whose only
  purpose is filling available width. A ratio that is a near-miss on an approved one (4:5 against 3:4)
  is the easiest to introduce and the hardest to notice; it is still a violation.
- **If a layout cannot accommodate an approved ratio, adjust the layout** — never stretch the creative
  and never invent a proportion. That is Creative-First Composition applied.
- The **ratio** is chosen for the placement; the **rendered size** follows from the section and the
  breakpoint. Choosing a ratio is a layout decision and is in scope. Choosing what fills it is not.
- **Repetition is the point.** Reusing the same small vocabulary across a site creates visual rhythm —
  readers recognise the creative language through repeated proportion rather than through decorative
  styling. Aspect ratio is part of the visual identity and stays consistent across the experience.

### A delivered creative rarely arrives at an approved ratio — so it is cropped, never stretched

The four ratios govern the **position**. A real asset has whatever proportion the person who made it
chose, and it is usually not one of the four: the approved environmental library is 3:2 at source,
so **every placement of it crops**. Two rules, and they do not conflict once stated plainly:

- **Never distort.** No stretching, squashing or non-uniform scaling to make an image meet a ratio.
  *"Preserve the aspect ratio"* means **preserve the creative** — it is never a licence to ship an
  off-vocabulary proportion because that is the shape the file happened to be.
- **Crop to an approved ratio, at a chosen focus, preserving the subject.** If no crop of an asset
  survives the ratio the composition needs, **choose a different asset** — or change the layout.
  What is not available is inventing a proportion for the one you wanted.
- **What "preserving the subject" means, stated rather than assumed.** **Never crop a face. Preserve
  the horizon line in a landscape. Preserve the product's edges in a screenshot.** These were
  previously left to the focus point, which was the wrong instrument for the job: a focus says where
  to *look*, and none of these is about looking — they are about what must still be *in the frame*
  when the looking is done. A focus centred perfectly on a face still crops the chin if the ratio
  demands it.
- **Crop to strengthen the composition, never to fit a container — and never to equalise ratios.**
  A crop is a compositional act with a reason. Trimming two images so they match each other is the
  commonest crop with no reason at all: it improves a grid nobody was asked to admire, at the cost of
  the two compositions that were.

**The focus is half the selection, not a refinement of it.** A centre crop is simply the crop nobody
chose, and it is the reliable way to lose a subject: on a 3:2 master, a 3:4 composition keeps only
half the width. A focus is therefore chosen against the crop it actually produces **at every ratio
the asset is used at**, and it **travels with the asset** — it is not a per-section adjustment, and
it is not a number typed at a call site. An arbitrary crop position is the same free handle an
arbitrary width is, and it is closed the same way: by selection.

## Presence — how much of the composition the creative commands

Ratio alone does not protect hierarchy. A 4:3 creative occupying most of a composition and the same
4:3 occupying a third of it are different decisions, and one of them can flatten the section.

**Presence is a closed set of classes expressed as a share of the composition, never as an arbitrary
width.** A share stays meaningful across breakpoints and comparable between sections; a hand-picked
width does neither.

The name is deliberate: **presence, not scale.** What is being governed is the creative's
**compositional authority** — whether it is the section's focal point, its support, or incidental.
A creative occupying most of a composition is not merely *larger*; it is *dominant*. Presence is
therefore read against the focal-weight model that already exists — it is how a creative declares its
weight, not a second, competing notion of importance.

*(It is also deliberately not called "dominance": that word is already load-bearing upstream, with its
own named failure modes, and a creative is frequently not the dominant element of its section.)*

## Placement — the anchoring vocabulary

Without governed placement, a correct ratio at a correct presence can still be assembled
text-then-media, media-then-text, or interleaved, at random — the same rules satisfied, a different
experience delivered every time.

**A reserved position takes one of the approved anchors:** left-anchored · right-anchored · inline ·
bleed · framed · editorial inset. *(The anchors are realized in the Brand Pack; the bracketed media
container the pack already ships is the **framed** anchor, not a one-off treatment.)*

The anchor is chosen for what the section is doing, and it is what makes creative placement
deterministic rather than a per-section improvisation.

**`floating` was retired on 2026-07-29 and the vocabulary is six.** The direction refuses floated
creative outright — *never float screenshots, never centre screenshots by default* — and `floating`
was the one anchor that did not name a relationship to anything. Every other anchor says where the
creative sits *with respect to the composition*; `floating` said it sat in the middle because there
was room. That is the absence of a placement decision wearing the name of one, which is exactly what
this vocabulary exists to close. `media-first` was the only archetype that permitted it and now takes
`bleed` alone.

### Placement is looked up, not chosen

Two sections holding the same kind of asset should place it the same way, and the deterministic route
to that is a lookup rather than a judgment repeated from scratch each time:

| The creative is | It is placed |
|---|---|
| a landscape image | full width |
| a portrait image | editorial split |
| a UI screenshot | embedded |
| an environment / nature | immersive |
| people | narrative |
| architecture | evidence |
| a detail | supporting |

**This does not demote the anchor vocabulary to a synonym list.** The lookup answers *what kind of
placement this kind of asset gets*; the anchor answers *where in this composition it lands*. A
landscape image placed full width may still be `bleed` in one section and `framed` in another. What
the lookup removes is the case where the same asset kind arrives somewhere different on every page
for no reason anyone could state — which is how a site stops looking authored.

## Placeholders inherit all three

**A placeholder preserves the proportion, presence and anchor of the creative that will occupy it.**

- Never resize a placeholder independently per section.
- Every placeholder communicates the final creative shape that will later occupy that position.
- **The placeholder represents the future creative. It never represents the available space.**

That last line is the whole rule. A reservation sized to the room that was left over has stopped
reserving a creative's position and started decorating a gap.
