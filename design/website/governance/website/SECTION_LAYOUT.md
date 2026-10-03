# SECTION LAYOUT-WEBSITE — The Spatial Constitution of the Website Track

> **What this is.** The governing layer that sits between Page Structure and the Component System. It governs the single thing none of those layers govern: **how a settled Progression Model is given space.** It receives a **Progression Model** — the progression units, encounter sequence, transition logic, and progression objectives a page must carry — and determines how that progression occupies space: what is allocated room, what is contained or expansive, what is dense or spacious, what relates to what spatially, what dominates, and how the whole is composed. Its output is not a page and not a layout system; it is a **Spatial Model.**
>
> **What this is not.** Not a layout system, not a grid system, not a spacing system, not a responsive-design guide, not a visual-design guide, not a wireframing guide, not a UI guide, not a component guide, not a section library, not a collection of layout patterns. It names no grid, spacing value, breakpoint, container width, token, component, colour, type, or technique. Those are the layers and mechanisms beneath it. It also does not create or alter information, meaning, or progression — those are settled above it.
>
> **The one boundary above all others.** *Section Layout decides the spatial organization of progression — how progression occupies space. It asks what should feel together, what should feel separate, what should share space, and what should occupy distinct space. It never decides what the information is or how it relates informationally (Information Architecture owns informational relationships), never decides what progresses (Page Structure owns progression), and never decides how the space is styled or mechanized (settled downstream). It governs spatial intent, and nothing else.* Everything in this document descends from that boundary.
>
> **The test every line passes.** *Would this still be true after a complete redesign — a new grid, a new spacing scale, new breakpoints, new components, a new brand, a new technology, a new industry, a new era?* If a statement depends on any of those, it does not belong here and has been removed. What remains is true of how progression must occupy space to be experienced, not of any one website.
>
> **How to read it.** Each principle states a behavior and the reason for it. The behavior is the law; the reason is why the law exists, so that it can be applied sensibly in situations this document never anticipated. When two principles tension, the **Non-Negotiables (§19)** resolve the conflict.
>
> **Where this sits.** Below `PURPOSE.md`, `PHILOSOPHY.md`, `COMMUNICATION_AND_PERCEPTION_SYSTEM.md`, `INFORMATION_ARCHITECTURE.md`, and `PAGE_STRUCTURE.md`; above the Component System and Visual Language. **On any conflict, the layers above win over this document, and this document wins over everything below it.** In the Purpose layer's descent — *Purpose → Communication → Information Architecture → Layout → Component → Visual* — this layer is the **lower half of the region that descent abbreviates as "Layout"**: Page Structure decides how progression unfolds; Section Layout decides how that progression occupies space, before any component, visual, or mechanism gives it concrete form. The downstream layers **realize** the Spatial Model; they do not co-author it.

---

## §0 — First principles

Begin from nothing and reason up.

Progression is conceptual. A Progression Model — the stages a reader must advance through, in their settled order, connected by their settled logic — has no extent, no room, no near and no far. It is weightless. Yet a reader does not experience a concept; a reader experiences something that occupies space, and moves their attention through that space. Between a settled progression and a reader who can move through it lies one thing that has not yet been decided: **the space the progression occupies.**

Space is not decoration laid over a progression once it is built. It is the medium in which progression becomes experienceable at all. The same progression — the same advances, the same order, the same logic — given space one way is something a reader moves through effortlessly, and given space another way is something they cannot navigate, cannot weigh, cannot hold. What commands room and what recedes; what feels together and what feels apart; what is contained and what runs to the edges; what is dense and what is open — these are not details. They are the difference between a progression that can be experienced and one that, though perfectly sound, cannot.

Every layer above this one decides *what must be true* — what must happen in the mind, what information must exist, how it must unfold. Every layer below decides *how each spatial decision is concretely realized* — in components, in visual form, in grids and spacing and tokens. Neither governs the spatial organization itself — the allocation of room, the spatial relationships, the containment, the density, the composition. That organization has a structure of its own, independent of any grid that will later execute it or any component that will later fill it. Constructing that structure is the only work this layer governs.

## §1 — Mission

The Section Layout layer exists to transform a settled **Progression Model** into a **Spatial Model** — to determine how progression occupies space so that it can be experienced clearly, coherently, and purposefully.

It is the bridge between two worlds. Above it, Page Structure has established *how information unfolds* — the progression units, their encounter sequence, their transition logic, their objectives — and handed down a model that is progressional through and through. Below it, the Component System, Visual Language, and the foundation mechanisms give that spatial intent concrete form. Between the conceptual progression and its concrete realization lies a question neither side answers: **how should this progression occupy space?** This layer answers it.

Its mission is therefore not to create visuals, not to choose components, not to define grids or spacing scales. It is to **define the Spatial Model** — the authoritative account of how progression occupies space. The Spatial Model is this layer's identity and its only output:

> *Section Layout does not output a page. It outputs a Spatial Model.*

This mirrors the layers around it: Communication & Perception produces a Communication Model of how meaning must be perceived; Information Architecture produces an Information Model of what information must exist; Page Structure produces a Progression Model of how information unfolds; Section Layout produces a Spatial Model of how progression occupies space. Each layer hands the next a complete, governed artifact — never raw material, never a finished page.

The backbone of this layer is a single chain — its constitutional formula:

> **Progression → Space → Orientation → Experience → Comprehension**

Progression (settled above) is given **Space**; space gives the reader **Orientation** — a sense of where they are, what is near, what is primary; orientation makes the progression an **Experience** the reader can move through; and the experience yields **Comprehension.** Space is the transformation; everything this layer does is a facet of giving progression space.

**The Spatial Model carries authority.** It is the authoritative representation of spatial intent. The Component System, Visual Language, Brand Expression, and the foundation mechanisms may **realize** the Spatial Model — give it concrete components, visual form, and measured execution — but they may **never redefine its spatial logic.** What this layer decides about allocation, relationship, containment, density, hierarchy, and composition is settled here; downstream layers express it, they do not overrule it.

And one boundary on execution, stated once and not returned to: **Section Layout determines spatial intent; Foundation Systems provide spatial execution.** This layer decides what should occupy more room, what should feel contained, what should sit apart — as intent that survives any grid, any spacing scale, any breakpoint. The concrete grid, the spacing steps, the container widths, the responsive rules that carry that intent into a rendered page are foundation mechanisms, not this layer's concern.

## §2 — What this layer receives

This layer receives the outputs of every layer above it, as authoritative inputs it never alters. It does not re-open them; it gives them spatial form.

- **From Purpose** — *why the page exists*: the reason that makes one spatial organization right and another wrong.
- **From the Creative Director** — *intent, desired reader state, communication arc, and desired outcome*: the experience the space must serve.
- **From Communication & Perception** — *what must be understood, believed, and acted upon*: the outcomes the space must make reachable.
- **From Information Architecture** — the **Information Model**: what information exists, how it relates informationally, what it depends upon, what is foundational.
- **From Page Structure** — the **Progression Model**: the progression units, encounter sequence, transition logic, and progression objectives.

The Progression Model is the central input, and the seam with it is exact. Page Structure has already decided how information unfolds — what advances are made, in what order, by what connective logic, toward what objectives. **This layer does not re-do any of that.** It does not re-order the progression, redefine a transition, or invent an advance. It receives the progression as settled fact and asks a single question of it: **given that progression unfolds this way, how should it occupy space so it can be experienced?** Progression is settled above; spatial organization begins here. The Progression Model is consumed, not re-authored.

## §3 — The core question and the role of this layer

Section Layout answers one question:

> **How should progression be organized within space?**

Every principle in this document exists to support answering it. If a principle does not concern **spatial organization, allocation, distribution, containment, hierarchy, relationships, composition, or flow**, it does not belong here and has been removed.

The role that follows is narrow and total. Page Structure determines *how information unfolds*; this layer determines *how that unfolding occupies space*. It does not give the space concrete form. It constructs the spatial organization that form will later realize — and it is responsible for that organization actually making the progression experienceable, before a single component or visual is chosen.

One distinction guards this role above all others, and it is stated here at the center of the document: **Information Architecture owns informational relationships; Section Layout owns spatial relationships.** It is tempting to reason that "related information should sit together" — but *related* is an informational judgment, already made above. This layer never asks what is informationally related. It asks only what should **feel** together, what should **feel** separate, what should **share** space, and what should **occupy distinct** space. That is the cleanest line between the two layers, and the whole of this layer lives on the spatial side of it.

## §4 — The Section Layout transformation model

This layer transforms a Progression Model into a Spatial Model. Two chains describe it, and they must never be conflated.

**The constitutional formula** — the layer's *why*, its conceptual backbone (named in §1, parallel to Communication's *Meaning → Expression → Belief*, Information Architecture's *Requirements → Information → Relationships → Dependencies → Understanding*, and Page Structure's *Purpose → Progression → Understanding → Belief → Action*):

> **Progression → Space → Orientation → Experience → Comprehension**

**The transformation model** — *where the layer sits in the pipeline*, the artifact it takes in and the artifact it hands on:

> **Purpose → Intent → Information Model → Progression Model → Spatial Model → Component System**

Section Layout is the bridge between *progression* (settled above) and *realization* (decided below). It determines how progression occupies space **before** any decision about components, visuals, styling, grids, or implementation. The first chain says what space is *for*; the second says what space sits *between*. The output of both is the same single artifact — the **Spatial Model** — and nothing else.

The Spatial Model is the authoritative representation of how progression occupies space, and it comprises seven parts:

- **Spatial Allocation** — how much space each part of the progression is given.
- **Spatial Relationships** — what relates to what in space: together, apart, shared, distinct.
- **Containment** — how contained or expansive the progression is.
- **Density** — how concentrated or open the progression is within its space.
- **Reading Flow** — how space supports the reader's movement through the progression.
- **Spatial Hierarchy** — how space expresses importance.
- **Composition** — how the progression occupies space as a whole.

All downstream systems consume the Spatial Model; **none of them redefine it.** They may realize it — give it components, visual form, and measured execution — but its spatial logic is settled here. The sections that follow govern the construction of each of its parts, and the disciplines (§14, §15) that keep the whole sound.

## §5 — What a section is

A section is **not** a content category. A section is **not** a collection of components. A section is **not** a visual block. A section is **not** a grouping mechanism.

**A section is the spatial realization of a Progression Unit.** Progression exists conceptually — a progression unit is a stage of advancement with no extent of its own. A section is the spatial environment through which that one progression unit is experienced: the room it occupies, the way it is contained, the way its parts relate in space. A section exists because a progression unit requires a spatial environment in which it can be encountered; it is the physical manifestation of progression within space.

This matters because it fixes what a section is *for*. A section is not where related content is gathered (that is an informational judgment, made above) and not where components are placed (that is realization, decided below). A section is where one advance of the progression is given the space to be experienced — no more, and no less.

## §6 — What layout is

Layout is the **organization of space.** It determines how progression is spatially experienced, and it concerns exactly these things: allocation, distribution, containment, density, relationships, hierarchy, flow, and composition.

Layout does **not** determine meaning, information, progression, components, visual styling, or brand expression. Those are settled above it or realized below it. Layout reaches only as far as the spatial organization of progression — how room is given, how things relate in space, how the whole is composed — and stops exactly there. The moment a principle of "layout" begins to decide what something means, what information it carries, what component it becomes, or how it is styled, it has left layout and entered a layer that is not this one.

This definition is the guard at both edges of the layer: it keeps layout from reaching up into progression and meaning, and from reaching down into components and visual form. Layout is the organization of space, and only that.

## §7 — Spatial Allocation

**The governing truth.** Space is finite, and how it is distributed is a decision. Some parts of a progression must command room; others need only enough to be present. **The amount of space a thing is given reflects its role within the progression** — allocation is the spatial expression of what the progression itself has made primary, supporting, or peripheral.

**Why it exists.** Without deliberate allocation, space is distributed by accident — by whatever happens to be placed first, or by what fills out most easily — and the progression's own emphasis is lost. Allocation is what makes space serve the progression rather than the other way round. It is the first and most consequential act of spatial organization.

**The behaviors that emerge.** This layer determines, for each part of a progression:

- **Dominant allocation** — the space given to what must command the field, because the progression turns on it.
- **Supporting allocation** — the space given to what strengthens or accompanies the dominant, present but not commanding.
- **Peripheral allocation** — the space given to what must be available without drawing the progression's weight.

Allocation emerges from progression requirements — what the progression has made foundational, what it has made supporting — never from visual preference or what merely looks balanced.

Allocation may be **dramatic**. Giving one part far more room than its neighbours, and another deliberately little, is how space creates contrast and emphasis — not only how it ranks; and where a part is dominant, its allocation expresses that primacy by a **decisive** margin, not a marginal one. A uniform allocation band — every part given comparable room — forfeits that instrument and flattens the progression's emphasis into an even spread.

**The failure when ignored.** When allocation is left to accident, the part of the progression that should command the field is given the same room as the incidental, the reader cannot tell from the space what matters, and the progression's emphasis is flattened into an even spread that emphasizes nothing.

## §8 — Spatial Relationships

**The governing truth.** Things occupy space *in relation to one another*, and those relations carry meaning of their own. What sits close reads as belonging together; what sits apart reads as distinct; what shares a space reads as one; what occupies its own space reads as separate. These are **spatial relationships**, and they are the core of what this layer owns.

**Why it exists.** A reader infers structure from space before reading a word of it — what goes with what, what stands alone — and if the spatial relationships contradict the progression, the reader is misled before they begin. Spatial relationships are how the progression's structure is made felt in space. They are also the single sharpest boundary this layer holds. **Information Architecture owns informational relationships; Section Layout owns spatial relationships.** The two must never be confused: that two things are *informationally related* is settled above and is not this layer's to decide or re-decide. This layer decides only what should be *felt* as related in space.

**The behaviors that emerge.** This layer determines, among the recurring spatial relations:

- **Proximity** — what should feel together by sharing nearness in space.
- **Separation** — what should feel apart by holding distance.
- **Association** — what should read as belonging to a common whole.
- **Distinction** — what should read as its own thing, occupying space that is unmistakably its own.

The questions this layer asks are always spatial: *what should feel together? what should feel separate? what should share space? what should occupy distinct space?* — never *what is related?*, which was answered above.

**The failure when ignored.** When spatial relationships are not governed, things that belong to one advance are scattered and things that belong to different advances are crowded together; the reader's spatial inference fights the progression instead of carrying it, and the structure the progression settled is contradicted by the space it was given.

## §9 — Containment

**The governing truth.** Progression occupies space within some boundary — held tightly within a defined region, or released to run to the edges. **How contained or expansive a progression is, is a spatial decision** that shapes how it is experienced: containment concentrates and focuses; expansiveness opens and releases. Containment is not only how focused-or-open a unit is; it is a **communicative** decision. Some meaning wants to be held tight and concentrated — close, intimate reading examined at short range — and some wants to be released and enveloping, a moment the reader is meant to feel surrounded by rather than read across. Width is one of the ways space tells the reader how to hold the content.

**Why it exists.** The same content held within a narrow boundary and the same content allowed to span the whole field are experienced differently — one as deliberate and focused, the other as broad and enveloping. Containment is the control of that experience. Left undecided, a progression is contained or released by accident, and the experience it produces is unintended.

**The behaviors that emerge.** This layer determines, for each part of a progression, the degree of containment:

- **Contained** — held within a defined boundary, concentrated and bounded.
- **Partially contained** — mostly held, with deliberate release at chosen edges.
- **Expansive** — allowed to occupy generous space beyond a tight boundary.
- **Full width** — released to span the entire available field.

Containment emerges from progression requirements — what the progression needs to feel focused, what it needs to feel open — never from visual preference. And containment is decided across the progression as a whole, not unit by unit in isolation: the alternation of held and released is itself a compositional act, and a single degree of containment applied uniformly flattens the page to one spatial volume, however correct that degree is for any one unit.

**The failure when ignored.** When containment is not governed, a progression that needed focus is allowed to sprawl and lose its center, or a progression that needed openness is squeezed into a boundary that suffocates it; either way the spatial experience contradicts what the progression required. And when one degree of containment is held across the whole progression — **uniform containment** — the page never changes spatial volume, and the reader never feels the shift that should mark a change of intent.

## §10 — Density

**The governing truth.** Within whatever space a progression occupies, it can be concentrated or open. **Density — how much occupies a given space — is a spatial decision,** and it governs the pace and pressure with which a progression is experienced.

**Why it exists.** Density is felt before it is read: a concentrated space presses and quickens; an open space breathes and slows. The same progression made dense and made spacious are different experiences. Density is a spatial decision and not a content decision (the content is settled above) and not a visual decision (styling is settled below) — it is purely how much that content is allowed to concentrate within its space.

**The behaviors that emerge.** This layer determines, for each part of a progression:

- **Dense** — concentrated, with much occupying a given space, pressing the experience closer.
- **Balanced** — measured concentration, neither pressed nor sparse.
- **Spacious** — open, with room around what is present, giving the experience air.

Density emerges from what the progression requires of the reader's pace and attention — never from a wish to fill or empty a space for its own sake. And density is decided **relative to neighbouring units**, giving spatial realization to the rhythm the layers above mandate (`PHILOSOPHY.md` §9; `COMMUNICATION_AND_PERCEPTION_SYSTEM.md` §11): a peak of density must be given surrounding rest so it can be absorbed, and a run of comparable density must be broken. Density is a narrative tempo, not a per-section setting — compression earns the expansion that follows it.

**The failure when ignored.** When density is not governed, a progression that needed room to be absorbed is crushed into a dense field the reader cannot settle into, or a progression that needed momentum is scattered so thin it loses its thread; the spatial pace works against the progression instead of carrying it. And when density never rests, or climbs without relief — **flat or monotonic density** — the alternation of compression and expansion is real in the layers above and lost here.

### §10.1 — Capacity

**The governing truth.** Density says how concentrated a space is. It does not say **how many parts that space was composed to hold** — and those are different facts. A field composed for three peers and a field composed for an unbroken body of prose can be equally concentrated and cannot hold each other's content. **Capacity is the quantity of parts a spatial field is composed to carry.**

**Why it exists.** Without it, quantity is settled by whatever content arrives — a field built to hold three is handed nine, and it either crushes them or is rebuilt into something it was not. Capacity makes the quantity a field can carry a property of the field, decided before the content meets it, so that a mismatch is a fact rather than a surprise discovered during composition. It also gives density something to be *about*: concentration is meaningless without knowing how many things are being concentrated.

**The behaviors that emerge.** A field declares the quantity it is composed for:

- **Singular** — one thing, undivided; the field has a subject rather than members.
- **Paired** — two, set against or beside each other.
- **Triad** — three, the smallest quantity that reads as a set rather than a comparison.
- **Small set** — four to six; still countable at a glance.
- **Large set** — seven or more; read as a body, not counted.
- **Continuous** — no item count at all; an unbroken field whose parts are not discrete.

**Capacity is what the field was composed for; it is never a permission to exceed a limit.** Where a governing rule caps what may occupy a space — as the composition grammar caps competing information groups — that cap holds regardless of capacity. **Capacity is the want; a limit is the law**, and a field composed for a large set still obeys the ceiling.

**The failure when ignored.** When capacity is not governed, quantity is decided by supply: fields receive whatever count the content happens to have, sets that needed to be countable become uncountable, and a field composed around a single subject is asked to hold a list — at which point the composition that made it work is gone, and only the space it occupied remains.

## §11 — Reading Flow

**The governing truth.** A reader moves through space, and space either supports that movement or obstructs it. **Reading Flow is how space supports the reader's movement through the progression** — it gives the already-settled progression a navigable spatial field. It does not create the movement; the progression decided that. It creates the spatial conditions in which that movement can happen.

**Why it exists.** A progression has an order, but order alone does not make a space navigable — a reader can be left unsure where to go next even when the sequence is sound. Reading Flow is what makes the progression's movement physically followable in space. It is the spatial condition of navigation, and without it a coherent progression can still feel like a space a reader is lost in. The boundary is exact: **Page Structure owns sequencing — what comes after what; Section Layout owns only the spatial field that lets the reader move through that sequence.**

**The behaviors that emerge.** This layer determines the kind of spatial movement the field supports:

- **Linear flow** — a single, continuous spatial path through the progression.
- **Split flow** — the field divides the reader's movement into parallel spatial tracks.
- **Guided flow** — the space deliberately leads the reader's movement from one part to the next.
- **Exploratory flow** — the field supports the reader moving through the space in more than one viable order.

These describe how space *supports* movement; they never re-decide the progression's sequence, which is settled above.

**Movement begins somewhere, and where it begins is a spatial decision.** A field does not only support movement through it; it offers the reader a place to enter. That entry is given by space — by what is allowed to be encountered first, by what holds enough room to be arrived at, and by what the surrounding emptiness leads toward. Left ungoverned, entry defaults to whatever sits at the field's first corner, and every unit on the page is entered at the same point regardless of what it needed to say. A unit that composes its entry deliberately can be entered at its centre, at its dominant part, or at the one place the field leaves open — and the reader arrives where the progression needed them to. This is the spatial condition of arrival, not the sequence of what is read, which Page Structure settled.

**The failure when ignored.** When reading flow is not governed, a sound progression is given a space with no navigable path through it; the reader knows what should come next in principle but cannot find it in the space, and the progression stalls not for lack of order but for lack of a field that carries the reader along it.

### §11.1 — Pace

**The governing truth.** Flow gives movement its **shape**; it does not give it a **speed**. A field can be linear and cross in an instant or linear and take a while, and the difference is not a matter of how much it contains — a single vast statement and a single dense diagram are both one thing, entered once, and are not passed through at the same rate. **Pace is how quickly the field is traversed once it is entered.**

**Why it exists.** A progression is not only a path, it is a *tempo*, and tempo cannot be read off the path's shape. Without pace, every field of the same flow is assumed to move the reader at the same rate, and the alternation the layers above require — the compression and expansion that let comprehension continue — has no spatial quantity to alternate. Pace is what makes a field's contribution to that alternation a property of the field rather than an impression formed after the page exists.

**The behaviors that emerge.** A field declares the rate of movement it produces:

- **Fast** — crossed in a single motion; the field is taken in and left behind.
- **Moderate** — traversed in a few movements; the reader settles briefly and moves on.
- **Slow** — dwelt in; the field holds the reader while it is understood.

**Pace is not density, and the distinction is the point.** A spacious field of many parts can be slow; a dense field of one part can be fast. Density is how much occupies the space; pace is how long the space takes. Where the two coincide it is a fact about that field, not a rule — **if pace ever becomes predictable from density across every field, it is density under another name and has no standing as a separate decision.**

**The failure when ignored.** When pace is not governed, a page of correctly-shaped flows moves at one undifferentiated speed: nothing is allowed to be lingered over and nothing is allowed to be passed, the reader is given no variation in tempo to recover within, and a progression that was paced in the layers above arrives flat in the space that was supposed to carry it.

## §12 — Spatial Hierarchy

**The governing truth.** Space itself expresses importance. Before anything is styled, the reader already senses what matters from how much room it holds, where it sits, and how present it is. **Spatial Hierarchy is the expression of importance through space** — through allocation, placement, dominance, and presence.

**Why it exists.** Importance must be felt, and space is the first thing that conveys it. If the spatial hierarchy is flat or inverted, the reader's sense of what matters is wrong before a single visual cue is applied. Spatial hierarchy establishes importance in the medium of space, so that everything realized later expresses an importance that is already correct. The boundary is exact: **Spatial Hierarchy is not Visual Hierarchy.** Visual weight, contrast, and type-driven emphasis are downstream, in Visual Language; this layer expresses importance purely through space.

**The behaviors that emerge.** This layer expresses importance spatially through:

- **Allocation** — what is given more room reads as more important.
- **Placement** — where a thing sits in the field signals its standing.
- **Dominance** — what commands the space reads as primary.
- **Presence** — how much a thing asserts itself spatially, independent of any styling.

Spatial hierarchy follows the progression's own importance — what it has made primary, secondary, supporting — and expresses that importance in space, never in visual treatment. Dominance is expressed by a **decisive** spatial margin, not a marginal one; supporting and peripheral parts must actively yield room so the dominant commands the field. A near-even allocation realizes the letter of hierarchy while dropping the decisive difference the attention law above (`PHILOSOPHY.md` §6) requires.

**The failure when ignored.** When spatial hierarchy is not governed, every part of a progression occupies space as though equally important; the reader gets no spatial signal of what to weigh, and the burden of expressing importance falls entirely on downstream styling that should have been reinforcing a hierarchy the space already established.

## §13 — Composition

**The governing truth.** Beyond any single allocation or relationship, a progression occupies space *as a whole*, and that whole is perceived first. **Composition determines how the whole is perceived before its parts are examined** — it is the overall spatial impression of a progression unit, not a summary of the decisions beneath it. And that impression is not neutral: **every viewport should intentionally evoke a specific perceptual response before communicating detailed information.** A composition decides first **what the moment should feel like** — calm, tense, expansive, still, urgent — and only then what it should explain. That felt response is the unit's **character**, and it may be composed around emptiness, around a single dominant figure, around its words, around structure itself, or around slowing the reader down. The character is chosen deliberately for the response the moment must evoke; a unit that expresses no character defaults to a neutral even field that communicates information without composing a moment.

**Why it exists.** A reader takes in a space as a whole before resolving its parts; that first whole-impression frames everything read afterward. Composition governs that impression deliberately, so the progression's overall character — focused, balanced, distributed — is felt correctly at a glance. Without it, the parts may each be sound while the whole reads as something the progression never intended.

**The behaviors that emerge.** This layer determines the overall spatial impression:

- **Single-focus composition** — the whole is organized around one dominant center.
- **Dual-focus composition** — the whole is organized around two balanced centers.
- **Distributed composition** — the whole is organized as a field of comparable parts with no single center.

Composition emerges from progression requirements — what the progression needs to be perceived as, as a whole — never from visual style. It is the spatial gestalt of the section, decided before its parts are resolved. Across the progression these characters vary, so the experience reads as a sequence of authored moments rather than a run of interchangeable sections.

Omission is part of composition. What a unit deliberately leaves out — and the space it deliberately leaves empty — composes the moment as much as what it includes; an almost-empty unit is a legitimate and often the strongest composition. Removing a part to sharpen the one that remains is a compositional decision equal in weight to adding one, never merely the absence of a decision.

**Balance is a decision, and asymmetry is its default answer.** A unit is composed **asymmetrically** — unequal parts held in balance by their placement rather than their size — unless there is a stated reason for it not to be. Asymmetry is a spatial instrument, not an irregularity to be corrected: it is what lets a composition point somewhere, and it is available to any unit, not only to those that open a page. The **tension** between unequal parts is the instrument itself — a large part answered by a small one across a deliberate distance holds the field more actively than two equal parts ever do, and the eye is given somewhere to travel. **Mechanically symmetrical composition — a mirrored layout, or parts given mathematically equal visual weight — is the exception and carries the burden of justification**, because a unit composed symmetrically by default has not chosen symmetry; it has declined to compose, and the evenness that results is the neutral field this section already names as its failure. *(Narrowed 2026-07-29 — `DECISION-REGISTER.md` DR-10. This sentence previously offered the two as equally available, which made the failure it names unreachable: a page could be symmetrical throughout, one legitimately-symmetrical unit at a time. The reason that survives is unchanged — what is condemned is symmetry nobody decided on. **One exception is named rather than left implicit:** a closing band converges and is centred, which `COMPOSE.md` §C.20 now carries as the CTA placement rule.)*

**The failure when ignored.** When composition is not governed, a progression whose parts are individually well-organized still reads, as a whole, as something other than itself — a single-center progression perceived as scattered, or a field of equals perceived as having a center it does not have — and the first impression contradicts the progression before its parts are even examined. And when a unit asks only what it should explain and never what it should feel like — **neutral composition** — it is arranged rather than authored, and the moment is forgettable even when every part is placed correctly.

## §14 — Spatial Integrity

**The governing truth.** A Spatial Model must remain **coherent** — its allocations, relationships, containment, density, hierarchy, and composition must hold together as one organization that a reader can make sense of. Integrity is the property of the whole spatial organization being purposeful and understandable, not merely sound in its parts.

**Why it exists.** A Spatial Model assembled from individually reasonable decisions can still fail as a whole — relationships that contradict, space that is missing where it is needed, two organizations competing in one field, an arrangement that reads ambiguously. Integrity is the discipline of checking the spatial organization *as a system*, before any component or visual is built on it.

**The behaviors that emerge.** This layer guards the spatial organization against the ways it loses coherence:

- **Missing space** — a part of the progression given no room to be experienced.
- **Broken relationships** — spatial relations that contradict what they should convey.
- **Spatial conflict** — two spatial organizations competing within one field.
- **Spatial ambiguity** — an arrangement that reads in more than one way, so the reader cannot tell what is intended.
- **Spatial redundancy** — the same spatial role assigned more than once with no purpose.
- **Spatial fragmentation** — an organization broken into pieces that no longer read as one.
- **Compositional discontinuity** — successive sections composed with no shared spatial logic, so the whole reads as a set of independently-solved parts rather than one field, even when every part is sound.

Integrity holds not only within a section but across the whole progression. Successive sections must carry a spatial **through-line** the eye can track, so the reader is carried from one to the next rather than re-orienting at every boundary. This is the spatial realization of the felt continuity `PHILOSOPHY.md` §9 requires and the progression `PAGE_STRUCTURE.md` settles.

**Variation is bounded on both sides, and this is one rule rather than two.** Too little and successive units repeat a single spatial arrangement, so the page reads as one cadence mechanically restated and the reader stops distinguishing one moment from the next; too much and each unit is spatially reinvented, so the through-line breaks and the page reads as independently-solved parts. Both failures are already named in this layer — uniform containment (§9), flat density (§10), and Compositional Discontinuity below — and they are the same requirement approached from opposite ends: **successive units must differ enough to be felt as distinct moments, and share enough to be felt as one field.** Neither bound may be satisfied by abandoning the other, and a progression that never varies has not achieved continuity; it has achieved sameness, which is the cheaper thing that looks like it.

The Spatial Model must remain coherent, purposeful, and understandable end to end.

**The failure when ignored.** When integrity goes unchecked, a Spatial Model whose parts each seem fine ships with a contradiction, a gap, or an ambiguity inside it, and the progression it was meant to make experienceable fails at exactly the point the spatial organization stopped holding together.

## §15 — Spatial Sufficiency

**The governing truth.** A Spatial Model must provide **enough** spatial organization to support the progression it serves. **Spatial Sufficiency asks: does the Spatial Model provide sufficient spatial organization to support the intended progression?** It is the spatial analog of Information Architecture's Informational Sufficiency and Page Structure's Progressional Sufficiency.

**Why it exists.** A progression can be complete — every advance present, every order sound — and the space given it can still be **insufficient**: the room, relationships, and composition provided are not enough for the progression to actually be experienced. Informational completeness, progressional completeness, and spatial sufficiency are different things; a sound progression in an insufficient space cannot be experienced, however sound it is. Spatial Sufficiency is the discipline of confirming the space is enough before the page is built, and it is the cleanest statement of this layer's distinct identity: the question of whether progression can be effectively experienced within the space it is given is one only this layer can answer.

**The behaviors that emerge.** This layer determines whether the Spatial Model is sufficient by asking, of the progression as a whole:

- Whether each advance has been given enough room to be experienced, not merely placed.
- Whether the spatial relationships are defined enough to convey the progression's structure.
- Whether the containment, density, and composition are enough to make the progression navigable and coherent.
- Whether anything required for the progression to be spatially experienced is absent.

The test is sufficiency, not abundance: enough spatial organization that the progression *can* be experienced — no less, and no surplus of space for its own sake.

**The failure when ignored.** When sufficiency goes unchecked, a Spatial Model that looks organized ships under-provisioned, and the progression — complete and sound in itself — cannot be effectively experienced, because the space it was given was never enough to carry it.

## §16 — What Section Layout must never do

This section is the layer's discipline, and it is absolute. Section Layout explicitly rejects ownership of everything around it. For each, the decision belongs to a named layer, and this layer claims none of it. Each is stated once.

**Not information discovery.** It does not create, remove, or redefine information. Those belong to **Information Architecture** (`INFORMATION_ARCHITECTURE.md`).

**Not information relationships.** It does not redefine informational relationships or dependencies — only spatial ones. Those belong to **Information Architecture**.

**Not progression design.** It does not decide encounter sequence, transition logic, progression objectives, or progression structure. Those belong to **Page Structure** (`PAGE_STRUCTURE.md`).

**Not communication strategy.** It does not decide meaning, communication modes, communication mediums, belief strategy, or experience strategy. Those belong to **Communication & Perception** (`COMMUNICATION_AND_PERCEPTION_SYSTEM.md`).

**Not components.** It does not decide cards, tables, tabs, accordions, carousels, timelines, or dashboards. Those belong to the **Component System** (`COMPONENT_SYSTEM.md`, executed by `component-governance/components.md`, `COMPOSITION.md`, `COMPOSE.md`), which realizes the Spatial Model — it does not co-author it.

**Not visual language.** It does not decide typography, colour, contrast, motion, shape, or visual weight. Those belong to **Visual Language** (`VISUAL_LANGUAGE.md`, executed by `rulebooks/visual-language.md`), a downstream consumer that *expresses* the Spatial Model — never a co-author of it.

**Not brand expression.** It does not decide personality, tone, character, or brand expression. Those belong to **Brand Expression** (`BRAND_EXPRESSION.md`, executed by `rulebooks/design-charter.md` and `creatives.md`) and, above all, to the Creative Director.

**Not foundation systems.** It does not decide grids, spacing scales, breakpoints, container widths, design tokens, or responsive rules. **Section Layout determines intent; Foundation Systems provide execution.**

The rule beneath every line of this section is the one boundary from the header: this layer governs spatial intent; it never creates the progression above it nor decides the form and mechanism below it.

## §17 — The output of Section Layout

The output of this layer is a single artifact: the **Spatial Model.** It comprises:

- **Spatial Allocation** — how space is distributed across the progression.
- **Spatial Relationships** — what relates to what in space.
- **Containment** — how contained or expansive the progression is.
- **Density** — how concentrated or open the progression is.
- **Reading Flow** — how space supports movement through the progression.
- **Spatial Hierarchy** — how space expresses importance.
- **Composition** — how the progression occupies space as a whole.

It never outputs grids, spacing scales, components, or visual systems. The output remains *spatial intent* from end to end. **The Spatial Model is the authoritative representation of spatial intent**: the Component System, Visual Language, Brand Expression, and the foundation mechanisms **realize** it — give it components, visual form, and measured execution — but they may **never redefine its spatial logic.** When this layer hands down a coherent, sufficient Spatial Model, everything below it has a spatial organization it can realize and did not have to invent.

## §18 — Failure modes

Each failure below is a violation of a principle established above; the cure is the principle.

- **Spatial Conflict** — two spatial organizations compete within one field, and the reader cannot resolve which governs (violates §13, §14).
- **Spatial Ambiguity** — an arrangement reads in more than one way, so the reader cannot tell what is intended (violates §8, §14).
- **Broken Spatial Relationships** — what should feel together is scattered, or what should feel distinct is crowded; the space contradicts the progression's structure (violates §8).
- **Missing Allocation** — a part of the progression is given no deliberate room, and the progression's emphasis is lost (violates §7).
- **Spatial Fragmentation** — a single progression is broken into pieces that no longer read as one (violates §13, §14).
- **Compositional Discontinuity** — each section is spatially reinvented, breaking the through-line so the whole reads as assembled parts rather than one composed field (violates §13, §14).
- **Spatial Redundancy** — the same spatial role is assigned repeatedly with no purpose, inflating the organization without strengthening it (violates §7, §14).
- **Insufficient Containment** — a progression that needed focus is allowed to sprawl, or one that needed openness is suffocated (violates §9).
- **Spatial Over-Concentration** — space is packed past what the progression can be experienced within; density crushes the experience (violates §10, §15).
- **Spatial Under-Definition** — the space is too loosely organized to support the progression; the Spatial Model is spatially insufficient (violates §10, §15).

## §19 — Non-Negotiables

These are immutable. They are permanent, universal, technology-agnostic, industry-agnostic, trend-agnostic, and medium-agnostic. They define what Section Layout fundamentally is and is not, and no downstream need or upstream pressure may override them.

1. **Section Layout owns spatial relationships; Information Architecture owns informational relationships.** This layer asks what should feel together or apart in space — never what is informationally related.
2. **The Spatial Model is the authoritative representation of spatial intent.** Downstream systems realize it but may never alter its spatial logic.
3. **Section Layout determines how progression occupies space — never what progresses, and never how space is styled or mechanized.** Spatial organization is its whole territory.
4. **Its output is a Spatial Model — never a grid, spacing scale, component, or visual.** The output is spatial intent from end to end.
5. **A section is the spatial realization of a Progression Unit — never a content category, component group, or visual block.**
6. **Allocation, containment, density, and composition emerge from progression requirements — never from visual preference.** Space serves the progression, not the eye.
7. **Spatial hierarchy is not visual hierarchy, and reading flow is not sequencing.** This layer expresses importance and supports movement through space; it never styles and never re-orders.
8. **Section Layout determines spatial intent; Foundation Systems provide spatial execution.** Grids, spacing scales, breakpoints, and tokens are mechanisms, not this layer's concern.
9. **The Spatial Model must be spatially sufficient.** A complete progression can still be spatially insufficient; enough spatial organization that the progression can be experienced — no gap, and no surplus.

## §20 — The final governing principle

Communication determines what must happen in the mind. Information Architecture determines what information must exist. Page Structure determines how information unfolds. Section Layout determines how progression occupies space.

It creates neither meaning, nor information, nor progression. It creates **spatial organization** — it transforms a Progression Model into a Spatial Model that allows progression to be experienced clearly, coherently, and purposefully.

If any section of this document begins to discuss grids, spacing systems, visual styling, components, interaction patterns, responsiveness, breakpoints, or implementation techniques, it has left its territory and must return to allocation, containment, relationships, density, hierarchy, composition, flow, spatial integrity, and spatial sufficiency. That return is always available, because those are the whole of what this layer governs, and the whole of what it must.
