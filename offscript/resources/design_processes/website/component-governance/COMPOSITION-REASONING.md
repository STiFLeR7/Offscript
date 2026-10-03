# Composition Reasoning — the intelligence beneath the catalogs (Reasoning · WHY/HOW)

> **What this is.** The author-readable reasoning layer that sits *above* the operational
> composition catalogs. It governs the four decisions a page makes *before* a single component is
> chosen: **what information must exist**, **in what order it is met**, **how space carries it
> within a section**, and **which mechanism makes a unit consumable**. It is the "why/how to
> compose," distilled to survive any brand and any brief.
>
> **What this is not.** Not a catalog, not a parser input, not a replacement for anything. It names
> no component, surface, layout primitive, count, or measurement — those live, canonically, in the
> files it defers to:
> - **`COMPOSITION.md`** — the by-`serves` index of all realized sections (the SELECT layer). *The
>   runtime parses this; it is the source of truth for which sections exist.*
> - **`COMPOSE.md`** — the §B section skeletons, composition grammar, and focal-weight model (the
>   ASSEMBLE layer). *The runtime parses this.*
> - **`components.md`** — the role-family catalog and the universal component rules.
> - **`rulebooks/numerics.md`** — the only numeric thresholds a rail reads.
>
> Where this reasoning implies a *quantity*, a *named structure*, or a *measurement*, the catalogs
> and `numerics.md` are authoritative and this file is silent. This file supplies judgment; those
> files supply vocabulary. **Cite them; never restate them.**
>
> **The test every line passes.** *Would this still be true after a complete rebrand and a complete
> catalog re-skin?* If a statement assumes a component, a number, or a visual choice, it has left
> this layer and belongs downstream.

---

## 0. The fixed-library boundary (non-negotiable)

The reasoning below is deliberately inventory-neutral: it reasons about *need*, not about what is on
the shelf. That neutrality has one hard limit. **Offscript composes from a fixed component library.**
The 79 realized sections and the role families in the catalogs are the closed, canonical universe of
form; curation may *compose within* the existing blocks (per `COMPOSE.md`), but the system never
invents a new component class to satisfy a need.

When a genuine need cannot be expressed by any existing section or composed from existing blocks, that
is **an escalation to a human decision** (a frozen, bespoke, out-of-band choice) — never a licence to
grow the library. "The inventory is insufficient" is a finding to surface, not a permission to
accumulate. A reasoning model that concludes "therefore invent the mechanism" has crossed the
boundary and is wrong: derive the need first, then map it to the *best-fitting existing* form.

---

## 1. Information — what must exist before any form

*Reason backward from the understanding the reader must reach; model the information first, give it
form second. These are facts about information, a strict input to selection — never a substitute for
it.*

- **The information a page needs exists before, and independently of, any page that presents it.**
  Model what must be true for the reader to understand, believe, and act — then realize it. Designing
  the form first and back-filling content inverts the dependency and produces decoration.
- **Required information is discovered, not enumerated.** Work backward from the reader's destination
  understanding to the body of facts without which it cannot form — never forward from what happens to
  be on hand.
- **Separate the required from the merely strengthening.** Some information is load-bearing — the
  understanding collapses without it; some only reinforces an understanding already possible. Know
  which is which before allocating any attention to it.
- **A claim and its validation are different things.** What is asserted and what lets the assertion be
  believed are distinct; conflating them leaves a claim standing on nothing. (The catalogs enforce
  *proof beside claim*; this is the upstream reason it matters.)
- **Meaning is set by connection.** An isolated fact carries almost no load; the same fact tied to the
  claim it proves becomes structural. Reason about the relationships — *causes, validates,
  depends-on, supports, contrasts-with, contains, transforms-into* — as real, before reasoning about
  layout.
- **A dependency is a fact; a sequence is a decision.** "B cannot be grasped until A is held" is a
  property of the information; "show A then B" is a downstream choice that *honors* the dependency.
  Never let the ordering choice masquerade as the fact, or the fact silently dictate the ordering.
- **Cluster by genuine affinity, not by output convenience.** Information groups by its own structure;
  "these belong together" must not quietly become "therefore present them together" — that is a later,
  separate decision.
- **Rank by necessity, never by desire.** Priority emerges from what the understanding *depends on* —
  not from what the author wishes to emphasize. The moment ranking follows what you want stressed
  rather than what understanding requires, the model has drifted into persuasion and lost its spine.
- **Sufficiency, not abundance, is completeness.** Enough that the required understanding *can* form —
  no gap, and no heap of surplus. Prove completeness; do not assume it. *False completeness* — a model
  that looks finished and so is never re-examined — hides the one missing link (a claim without proof,
  a process missing a step). Hunt the hidden hole.
- **Flag the loadless.** Information that connects to nothing (an orphan), or repeats content already
  modeled with no added role (redundancy), or a dependency chain missing a link (a break that fails
  understanding at exactly that point) — each is a defect to surface before any form is chosen.

---

## 2. Progression — the order in which understanding is met

*A page is encountered as an advancing sequence, not a pile of bands. The order assembles or destroys
understanding even when every part is individually correct. Settle the progression before selecting
sections; hand a settled progression down to the catalog.*

- **The unit of progression is a single advance** — one step in understanding, belief, or
  decision-confidence — not a content grouping. Two bodies that make one advance are one stage; one
  body that makes two advances is two.
- **A stage earns its place only by advancing the reader.** A stage that moves understanding nowhere
  is unjustified, however well it fits the brief. (This is `PHILOSOPHY §4`'s "progression, not depth"
  applied at the page scale.)
- **Sequence is derived every time, never defaulted.** Order follows from purpose, dependencies, and
  the arc's objectives — not from a familiar page shape reached for because it is familiar.
  Dependency *constrains* order (a foundation precedes what derives from it) but does not *choose* it;
  choosing within the constraints is its own deliberate act.
- **Adjacency is not progression.** Between every pair of stages there must be connective logic that
  makes the next *follow from* the last — a reason of the kind *continuation, escalation, validation,
  expansion, resolution, reinforcement*. A seam with no logic is a place the reader falls out.
- **The arc must arrive.** It opens in the reader's world, builds, turns toward the decision, and
  closes with the reader prepared to act — Purpose → Progression → Understanding → Belief → Action. A
  page resolves; it does not merely stop.
- **Check the progression as a whole, not part by part.** Sound stages joined by sound seams can still
  fail collectively. *Progressional sufficiency* is its own property: complete information can still
  yield a weak progression.
- **Stagnation is the signature page-level failure** — new, non-repeating information keeps arriving
  yet no advance is made: presence without movement. Guard equally against the missing advance, the
  stalled seam, the circular doubling-back, the premature advance (asking before the reader is ready),
  the redundant repeat, and the gap the reader cannot cross.

---

## 3. Spatial composition — how a section carries one advance

*A section is the spatial realization of one progression unit. Space is the medium that unit becomes
experienceable in — not decoration laid over finished content. This layer owns what should feel
together, apart, dominant, or quiet in space; it never re-decides what is informationally related
(§1) or in what order it is met (§2). For all weights, ratios, and measurements, `COMPOSE.md` and
`numerics.md` are authoritative.*

- **Spatial hierarchy precedes visual styling.** Room, placement, and presence assert importance
  before any colour or weight is applied; downstream emphasis only *reinforces* an order space has
  already made correct. (The enforced focal-weight model lives in `COMPOSE.md`; this is why it
  matters.)
- **Allocation is a deliberate act.** Dominant, supporting, and peripheral room must be *assigned*
  from each part's progression role. Unassigned allocation defaults to accident — the first-placed or
  easiest-filled element wins — and flattens emphasis.
- **Containment and density are levers, not leftovers.** Contained space concentrates; expansive space
  opens. Density is felt before it is read — it sets the pace and pressure of the experience. Choose
  both from what the advance needs, never from visual taste.
- **Composition is read whole before it is read in parts.** A section registers as a single-focus,
  dual-focus, or distributed field at a glance; the parts can each be sound while the whole reads as
  something the progression never intended. Spatial relationships are inferred *before* the words —
  contradicting them misleads the reader before they have read anything.
- **Even spread emphasizes nothing.** Balance for its own sake is a failure mode, not a default; a
  field that weights everything equally directs the eye nowhere.
- **Spatial sufficiency is bounded both ways.** Enough organization that the advance can be
  experienced — and no surplus of room for its own sake. Under- and over-provisioning are both
  defects. Validate the *whole* arrangement for missing space, contradicting relationships, two
  competing organizations in one field, ambiguity, and redundant roles.

---

## 4. Mechanism — the means that makes a unit consumable

*A component is the structural means by which a progression unit becomes consumable — defined by the
role it performs, never by the form it takes. This reasoning chooses among the **fixed** catalog
(see §0); it does not expand it. The catalog (`components.md`, `COMPOSITION.md`) owns every component
name, family, and variant.*

- **Fit the means to the need, not the need to the means.** A component is selected because a unit
  *demonstrably requires that means*. Reaching for the closest existing component because it is easy
  is the lazy path that produces mediocre work — derive the need, then map it to the best-fitting
  existing form.
- **No mechanism without a stateable purpose.** Every component must have a purpose tied to a specific
  need; one whose purpose cannot be stated is removed. Purpose (*why it exists*) and responsibility
  (*what it must deliver*) are distinct tests — and a component carrying two unrelated
  responsibilities is two components.
- **Components have standing relative to the progression** — primary (carries the advance), supporting
  (assists it), optional (available without bearing weight) — following the progression's weighting,
  not visual prominence.
- **Mechanisms relate functionally.** One sets up, complements, or completes another; a functional
  *dependency* (one cannot deliver its purpose until another has done its work) is distinct from
  informational relationship (§1), from spatial relationship (§3), and from order of appearance.
  Functional relations must compound, not collide.
- **Orchestration and composition are different scales.** Composition combines means *within* one
  section; orchestration combines them *across* the page. Richness lives in both — and **premium
  quality comes from richer mechanism reasoning before richer styling.** A premium skin over poor
  mechanism intent is still poor.
- **Validate the set as a system.** Beyond choosing each component well, confirm the set is
  *sufficient* (no gap, no surplus) and has *integrity* — no purposeless, conflicting, redundant, or
  orphaned mechanism, no broken functional relation. Individually-sound choices can fail as a whole.
- **Governance owns intent; the build owns execution.** A foundation or build limitation is a reason
  to extend execution, never to weaken which mechanism a need requires — and never (see §0) a reason
  to invent a new one outside the catalog.

---

> **Where this sits, in one line.** `PHILOSOPHY.md` decides how any website must behave; this file
> decides *how to reason from a settled intent to a composed page* — what information must exist, in
> what order it is met, how space carries it, and which existing mechanism makes it consumable. The
> catalogs (`COMPOSITION.md`, `COMPOSE.md`, `components.md`, `numerics.md`) then supply the concrete
> form and the numbers, and the rails verify. This layer is judgment; those layers are vocabulary and
> measurement. It never authors form, and it never grows the library.
