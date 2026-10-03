# COMPONENT SYSTEM-WEBSITE — The Mechanism Constitution of the Website Track

> **What this is.** The governing layer that sits between Section Layout and Visual Language. It governs the single thing none of those layers govern: **the structural means through which spatially organized progression becomes consumable.** It receives a **Spatial Model** — the allocation, relationships, containment, density, reading flow, spatial hierarchy, and composition a progression has been given — and determines what structural means must exist so that progression can actually be taken in: what must explain, what must give evidence, what must let a reader weigh a choice. Its output is not a page and not a component library; it is a **Mechanism Model.**
>
> **What this is not.** Not a UI component library, not a design system, not a pattern library, not a catalogue of interface elements. It names no UI element, no foundation mechanism, no grid, spacing scale, breakpoint, container width, token, colour, type, or technique. Those are the layers and mechanisms beneath it. It also does not create or alter meaning, information, progression, or space — those are settled above it.
>
> **The one boundary above all others.** *The Component System governs the structural means through which spatially organized progression becomes consumable. It never decides what the information **is** (Information Architecture owns information), what **progresses** (Page Structure owns progression), how progression **occupies space** (Section Layout owns space), how a mechanism **looks** (Visual Language owns expression), or how a mechanism is **built** (Foundation Systems provide execution). It governs mechanism intent, and nothing else.* Everything in this document descends from that sentence.
>
> **The test every line passes.** *Would this still be true after a complete redesign — new components, a new visual language, a new technology, a new interaction paradigm, a new foundation, a new brand, a new industry, a new era?* If a statement depends on any of those, it does not belong here and has been removed. A second, sharper test governs relevance: *if removing a principle does not change the required mechanisms, it does not belong to the Component System.*
>
> **How to read it.** Each principle states a behavior and the reason for it. The behavior is the law; the reason is why the law exists, so that it can be applied sensibly in situations this document never anticipated. When two principles tension, the **Non-Negotiables (§25)** resolve the conflict.
>
> **Where this sits.** Below `PURPOSE.md`, `PHILOSOPHY.md`, `COMMUNICATION_AND_PERCEPTION_SYSTEM.md`, `INFORMATION_ARCHITECTURE.md`, `PAGE_STRUCTURE.md`, and `SECTION_LAYOUT.md`; above Visual Language. **On any conflict, the layers above win over this document, and this document wins over everything below it.** In the Purpose layer's descent — *Purpose → Communication → Information Architecture → Layout → Component → Visual* — this is the **Component** node: below the Layout region (Page Structure decides how progression unfolds; Section Layout decides how it occupies space), above Visual (which expresses what this layer decides). The downstream layers **realize** the Mechanism Model; they do not co-author it.

---

## §0 — First principles

Begin from nothing and reason up.

Section Layout does not hand down empty space. It hands down **spatially organized progression** — progression that has already been allocated room, contained, made dense or open, related, hierarchized, and composed. The space is full of decisions. What it is not yet is **consumable.**

A reader cannot take in organized progression directly. Room, relationship, and composition arrange the field, but a reader does not consume a field; they consume what inhabits it — something that explains, something that proves, something that lets them act. Between spatially organized progression and a reader who can experience it lies exactly one thing that has not been decided: **the structural means through which that progression becomes consumable.**

These means are not decoration laid over the space once it is arranged. They are the medium in which progression becomes consumable at all. The same progression, organized in the same space, given the right structural means is something a reader can absorb, weigh, and act on; given the wrong means, or none, it is something that occupies the page and cannot be taken in. What must exist for a progression to be consumed — and what must not — is the whole of what this layer decides.

Every layer above this one decides *what must be true* — what must happen in the mind, what information must exist, how it must unfold, how it must occupy space. Every layer below decides *how each mechanism is concretely realized* — in visual form, in foundation systems, in rendered output. Neither governs the structural means themselves. Those means have a logic of their own, independent of any component that will later realize them or any style that will later express them. Constructing that logic is the only work this layer governs.

## §1 — Mission

The Component System exists to govern **the structural means through which spatially organized progression becomes consumable** — to transform a settled **Spatial Model** into a **Mechanism Model** so that progression, already given space, can actually be taken in.

It is the bridge between two worlds. Above it, Section Layout has established *how progression occupies space* — the allocation, relationships, containment, density, reading flow, hierarchy, and composition — and handed down a model that is spatial through and through. Below it, Visual Language and the foundation mechanisms give that mechanism intent concrete form. Between the organized space and its concrete realization lies a question neither side answers: **what structural means must inhabit this space so the progression can be consumed?** This layer answers it.

Its mission is therefore not to create visuals, not to define foundation systems, not to implement anything. It is to **define the Mechanism Model** — the authoritative record of the structural means a progression requires. The Mechanism Model is the authoritative record of the required mechanisms, their purposes, responsibilities, relationships, orchestration, and dependencies. It is this layer's identity and its only output:

> *The Component System does not output a page or a component library. It outputs a Mechanism Model.*

This mirrors the layers around it: Communication & Perception produces a Communication Model of how meaning must be perceived; Information Architecture produces an Information Model of what information must exist; Page Structure produces a Progression Model of how information unfolds; Section Layout produces a Spatial Model of how progression occupies space; the Component System produces a Mechanism Model of the means through which progression is consumed. Each layer hands the next a complete, governed artifact — never raw material, never a finished page.

The backbone of this layer is a single chain — its constitutional formula:

> **Space → Mechanism → Consumption → Experience**

Space (settled above) is given **Mechanism** — the structural means; the mechanism makes the progression available for **Consumption** by the reader; consumed progression becomes **Experience.** Mechanism is the transformation; everything this layer does is a facet of giving progression the means to be consumed.

**The Mechanism Model carries authority.** It is the authoritative representation of mechanism intent. Visual Language, Brand Expression, and the foundation mechanisms may **realize** the Mechanism Model — give it visual form, expression, and execution — but they may **never redefine which mechanisms must exist.** What this layer decides about the structural means is settled here; downstream layers express it, they do not overrule it.

And one boundary on execution, which this layer states more than once because it is the layer most tempted to forget it: **Governance determines intent. Foundation provides execution. Foundation may never redefine governance decisions.** This layer decides which mechanisms must exist, as intent that survives any component, any grid, any token. The concrete realization that renders that intent is a foundation mechanism, not this layer's concern.

One final principle of the mission, stated in brief here and in full at §6: the Mechanism Model is **set by need, not by the available kit.** What mechanisms must exist is determined by the upstream models, never bounded by what the design system already provides. The implementation is built to the Model; the Model is never trimmed to the implementation.

## §2 — What this layer receives

This layer receives the outputs of every layer above it, as authoritative inputs it never alters. It does not re-open them; it gives them the means of consumption.

- **From Purpose** — *why the page exists*: the reason that makes one mechanism right and another wrong.
- **From the Creative Director** — *intent, desired reader state, and desired outcome*: the experience the mechanisms must make reachable.
- **From Communication & Perception** — *what must be understood, believed, and acted upon*: the outcomes settled above this layer.
- **From Information Architecture** — the **Information Model**: what information exists, how it relates, what it depends upon, what is complete.
- **From Page Structure** — the **Progression Model**: the progression units, encounter sequence, transition logic, and progression objectives.
- **From Section Layout** — the **Spatial Model**: the allocation, relationships, containment, density, reading flow, spatial hierarchy, and composition.

Two seams are exact and must be held.

**The Section Layout seam.** The Spatial Model is consumed as **settled fact.** This layer **may not reopen allocation, containment, density, composition, hierarchy, or spatial relationships** — those are owned above. It never asks *what occupies dominant space?* — that is a layout question, already decided. It accepts *where things live* as given, and decides only *what structural means inhabit those locations.* Space is settled; mechanism begins here.

**The Communication seam.** What must be understood, believed, trusted, preferred, or acted upon is **already settled** by Communication & Perception, and is consumed here as fact. This layer never re-decides any of it. When a question sounds like *what must the reader come to trust?* or *what must they understand?*, that question was answered above; the only question that belongs here is *what structural means make that already-defined progression consumable?*

It consumes all of these; it never modifies them.

## §3 — The core question and the role of this layer

The Component System answers one question:

> **What structural means must exist for spatially organized progression to be consumed?**

Every principle in this document exists to support answering it. If a principle does not concern **mechanism discovery, selection, purpose, hierarchy, relationships, orchestration, composition, responsibilities, or dependencies**, it does not belong here and has been removed.

The role that follows is narrow and total. Section Layout determines *how progression occupies space*; this layer determines *what structural means inhabit that space so progression can be consumed*. It does not give those means concrete form. It constructs the mechanism intent that form will later realize — and it is responsible for that intent actually making the progression consumable, before a single component, style, or implementation is chosen.

One self-check guards this role against everything that does not belong to it — the layer's constitutional litmus test:

> **If removing a principle does not change the required mechanisms, it does not belong to the Component System.**

A statement about meaning, information, progression, space, appearance, brand, or content can be removed without changing which mechanisms a progression requires — and so none of them belong here. Only statements that change the required mechanisms are this layer's. This is the standing guard that keeps visual, layout, brand, and content rules from drifting in.

## §4 — The Component System transformation model

This layer transforms a Spatial Model into a Mechanism Model. Two chains describe it, and they must never be conflated.

**The constitutional formula** — the layer's *why*, its conceptual backbone (named in §1, parallel to Communication's *Meaning → Expression → Belief*, Information Architecture's *Requirements → Information → Relationships → Dependencies → Understanding*, Page Structure's *Purpose → Progression → Understanding → Belief → Action*, and Section Layout's *Progression → Space → Orientation → Experience → Comprehension*):

> **Space → Mechanism → Consumption → Experience**

**The transformation model** — *where the layer sits in the pipeline*, the artifact it takes in and the artifact it hands on:

> **Communication Model → Information Model → Progression Model → Spatial Model → Mechanism Model → Visual Model**

The Component System is the bridge between *spatial intent* (settled above) and *visual realization* (decided below). It decides what structural means must inhabit space **before** any decision about appearance, styling, or implementation. The first chain says what mechanism is *for*; the second says what mechanism sits *between*. The output of both is the same single artifact — the **Mechanism Model** — and nothing else.

**The Mechanism Model is defined by what it records:** the required mechanisms, the purpose each serves, the responsibility each carries, how they relate, how they are orchestrated, what they depend upon, and which are primary, supporting, or optional. It is the authoritative record of mechanism intent.

The constitutional truth this layer owns is **mechanism intent.** The sections that follow govern that intent through eight responsibilities — Selection, Purpose, Hierarchy, Relationships, Orchestration, Composition, Responsibilities, Dependencies (§8–§15). These eight are the **current governance decomposition** of mechanism intent — the responsibilities through which it is governed — not the eternal identity of mechanisms. Exactly as *information* is the constitutional truth of Information Architecture while *domains, relationships, and dependencies* are merely how it governs that truth, *mechanism intent* is the truth here and the eight are its governance structure. The record the Mechanism Model keeps and the domains this layer governs are the same content seen two ways, never two competing lists.

All downstream systems consume the Mechanism Model; **none of them redefine it.** They may realize it — give it components, visual form, and execution — but its mechanism intent is settled here.

## §5 — What a mechanism is

A mechanism is **not** a component. A mechanism is **not** a UI pattern. A mechanism is **not** a visual treatment. A mechanism is **not** a framework artifact.

**A mechanism is a structural means through which a unit of progression becomes consumable.** It is defined by **the role it performs** in making progression consumable — never by the form it eventually takes. A progression unit may need something that explains, something that gives evidence, something that lets a reader weigh a choice; *that need, and the means that answers it,* is the mechanism. The concrete form that later realizes it is not.

This is why the constitution governs the **properties, responsibilities, and relationships** of mechanisms — and not a fixed catalog of mechanism classes. Specific classes of mechanism may emerge from different contexts, industries, and eras, but they are **not constitutional truths unless proven universal**, and this document names none as canonical. A frozen catalog would make this a component library and forfeit the one thing the layer must keep: the ability to require whatever means a progression genuinely needs, in any context, now or in a future this document cannot foresee.

The name of this layer is itself a hazard. It says *component*; its responsibility is *mechanism*. The doc holds that line without exception: a mechanism is a structural means, never a UI element, and the moment "component" is read as an interface artifact rather than a structural means, the layer has begun to drift out of its own territory.

## §6 — Mechanism Discovery and Inventory Independence

This is the layer's intelligence, and it is the reason the layer exists. It has three governing parts.

**Discovered, not retrieved.** Mechanisms are not selected from a predefined catalog; they are **discovered.** They emerge from the needs of Communication, Information, Progression, and Space working **together** — the Component System discovers the mechanisms a given progression requires; it does not retrieve them from a library. A mechanism exists because an upstream need demonstrably requires it; if no upstream need calls for it, it does not exist. The lazy path — *need → the closest existing component → basic output* — is precisely what produces mediocre work; this layer mandates the intelligent path instead: *need → reasoning → required mechanism → implementation.*

**Reasoning before inventory.** A permanent rule makes that path enforceable: **the Component System must derive the required mechanism before considering whether a realization already exists.** Derivation comes first. The inventory is consulted only afterward, and only to *find or create* the realization — never to bound what may be required. An author who searches the library first and reasons second has already surrendered the layer's intelligence.

**Inventory independence.** What mechanisms *must exist* is determined by the progression's needs as handed down by the upstream models — **never bounded by what the design system happens to already provide.** The governing statement is exact: **the sophistication of the Mechanism Model is determined by the demands of the upstream models, never by the sophistication of the existing component inventory.** When the upstream models demand a level of consumption that no existing component realizes, this layer **still mandates the mechanism, at the full ambition the models require**, reasoning up to non-trivial, sophisticated means that *can be implemented* in the final page. **Missing components are implementation deficiencies, not justification for weaker mechanism intent.** The mechanism stays authoritative; the implementation catches up — never the reverse. The Mechanism Model sets the bar the output must reach; the inventory adapts to the Model, not the Model to the inventory.

**The failure when ignored.** The layer capitulates to the available kit: mechanism intent collapses to what is easy to assemble, ambition is set by the shelf rather than by need, and the output regresses to the basic, however demanding the upstream models were. This is the failure the whole layer exists to prevent.

## §7 — What this layer owns

The Component System governs the structural means through which spatially organized progression becomes consumable. Within that, it owns: which mechanisms must exist (discovery, selection), why each exists (purpose), which carry the progression and which assist (hierarchy), how they relate and depend on one another (relationships, dependencies), how they work together across the page and within a section (orchestration, composition), and what each is accountable to deliver (responsibilities).

It answers one question — *what structural mechanism must exist?* — and it never answers the two that belong below it: *how should it look?* (Visual Language) and *how should it be implemented?* (Foundation Systems).

These owned domains are the governance decomposition of mechanism intent established in §4 — the responsibilities through which the layer governs, not the truth itself. The truth is mechanism intent; the domains are how it is held. The sections that follow govern each domain, and the disciplines (§16, §17) keep the whole sound. This definition is the guard at both edges of the layer: it keeps mechanism from reaching up into progression, space, and meaning, and from reaching down into components, visual form, and implementation.

## §8 — Mechanism Selection

**The governing truth.** Of all the means a progression could be given, only some are required. **A mechanism is selected because a unit of progression demonstrably requires that means to become consumable** — selection is the act of determining which discovered mechanisms a given progression actually needs.

**Why it exists.** Without deliberate selection, mechanisms accrete by habit — whatever is conventional, whatever was used last time, whatever the kit offers first — and the progression is fitted to the means rather than the means to the progression. Selection is what makes the mechanism set serve the progression. It is the first owned act after discovery: discovery establishes *where mechanisms come from* (derived from need); selection determines *which the progression gets,* and the justification each must earn.

**The behaviors that emerge.** This layer determines, for each progression unit, which mechanisms it requires to become consumable, selecting each from communication and progression requirements — never from visual preference, convention, or a catalog. A mechanism that no progression unit requires is not selected; a progression unit whose consumption is unmet selects the mechanism that meets it.

**The failure when ignored.** When selection is left to habit, mechanisms appear that no progression needed and mechanisms are missing that it did; the page carries means it cannot justify and lacks means it required, and consumption is shaped by precedent instead of by the progression.

## §9 — Mechanism Purpose

**The governing truth.** Every mechanism exists to serve a specific progression or communication need. **No mechanism without purpose** — each earns its place by what it makes consumable.

**Why it exists.** A mechanism with no purpose is weight without work: it occupies the progression, competes for attention, and returns nothing. Purpose is the test that every mechanism must pass to remain. It is distinct from responsibility: purpose is *why a mechanism exists*; responsibility (§14) is *what it is accountable to deliver*.

**The behaviors that emerge.** This layer requires, of every selected mechanism, an articulable purpose tied to a specific progression need — what this mechanism makes consumable that would otherwise not be. A mechanism whose purpose cannot be stated is removed; a purpose with no mechanism is an unmet need to be filled.

**The failure when ignored.** When purpose is not governed, mechanisms persist out of inertia, the Mechanism Model fills with means that serve nothing, and the cost of every purposeless mechanism — attention, effort, complexity — is paid by the progression it does not advance.

## §10 — Mechanism Hierarchy

**The governing truth.** Mechanisms are not equal. Some **carry** the progression; some **assist** its consumption; some are **available** without bearing weight. **Mechanism Hierarchy is the standing of mechanisms relative to the progression** — primary, supporting, optional.

**Why it exists.** If every mechanism is treated as equally central, the progression's own emphasis is lost in the means that serve it: what should carry the progression is crowded by what should merely assist. Hierarchy makes the mechanism set follow the progression's emphasis rather than flatten it. Its standing follows the progression's own weighting — what the progression made foundational, supporting, peripheral — never visual prominence (that is downstream).

**The behaviors that emerge.** This layer assigns each mechanism a standing:

- **Primary** — the mechanism that carries the progression, because the progression turns on what it makes consumable.
- **Supporting** — the mechanism that strengthens or accompanies the primary, present but not bearing the progression's weight.
- **Optional** — the mechanism that is available to a reader who wants it, without the progression depending on it.

**The failure when ignored.** When hierarchy is not governed, a supporting mechanism competes with the primary it was meant to serve, the progression's center is contested by its own means, and the reader cannot tell from the mechanisms which one carries the advance.

## §11 — Mechanism Relationships

**The governing truth.** Mechanisms do not stand alone; they relate to one another **functionally.** One sets up another; one complements another; one completes another. **Mechanism Relationships are the functional relations among the means of consumption.**

**Why it exists.** A progression is consumed through more than one mechanism, and how those mechanisms relate determines whether their work compounds or collides. Relationships are how the mechanism set behaves as a connected whole rather than a pile of independent parts. The boundary is exact and easily blurred: these are not **informational** relationships (Information Architecture owns what is informationally related) and not **spatial** relationships (Section Layout owns what is spatially together or apart). They are **functional** — relations of one means to another in the work of making progression consumable.

**The behaviors that emerge.** This layer determines, among the mechanisms a progression requires, which set up which, which complement which, and which complete which — the lateral functional relations that let the means work as one. This is distinct from dependency (§15): a relationship is lateral; a dependency is a strict prerequisite.

**The failure when ignored.** When relationships are not governed, mechanisms that should reinforce one another work at cross-purposes, the means that should have set up another arrives after it, and the progression is consumed in fragments that never connect.

## §12 — Mechanism Orchestration

**The governing truth.** Beyond any single relationship, the mechanisms of a page must work together **across the whole.** **Mechanism Orchestration is how the mechanisms across a page combine into one continuous act of consumption.**

**Why it exists.** A progression is consumed across its full length, and mechanisms that each work in isolation can still fail to add up to a coherent whole — the reader experiences a sequence of disconnected means rather than one continuous consumption. Orchestration governs the mechanisms *as a system across the page*, so their combined behavior serves the progression as a whole. It is the scale at which the difference between a basic page and a sophisticated one is decided: richer orchestration, not richer styling.

**The behaviors that emerge.** This layer determines how the mechanisms across the whole page are arranged to build on one another — which establish, which deepen, which resolve — so that the progression is consumed as one continuous experience rather than a series of separate encounters. Orchestration is *across the whole*; composition (§13) is *within one section*.

**The failure when ignored.** When orchestration is not governed, every mechanism works and the page still fails: the means do not build on one another, the progression is consumed in disconnected pieces, and the experience never accumulates into the whole the upstream models intended.

## §13 — Mechanism Composition

**The governing truth.** Within a single section, a progression unit may require **more than one mechanism, composed into a single consumable whole.** **Mechanism Composition is how the mechanisms within one section combine to make one progression unit consumable.**

**Why it exists.** One progression unit is often not served by a single mechanism — it needs, say, something that explains and something that gives evidence, working as one. Composition governs how those means combine *within the section* so the unit is consumed as a whole and not as competing parts. It is composition of **means**, not of visuals (downstream) and not of space (Section Layout, above). Composition is *within one section*; orchestration (§12) is *across the whole page*.

**The behaviors that emerge.** This layer determines, for a progression unit that requires more than one mechanism, how those mechanisms combine into a single consumable whole — which leads, which supports, how they resolve into one act of consumption for that unit.

**The failure when ignored.** When composition is not governed, a section's mechanisms each address the progression unit separately, the reader consumes the unit in pieces that do not cohere, and a unit that needed a composed whole is delivered as a scatter of unrelated means.

## §14 — Mechanism Responsibilities

**The governing truth.** Each mechanism is accountable for delivering something specific. **One mechanism, one clear responsibility** — what this mechanism, and no other, is accountable to make consumable.

**Why it exists.** When a single mechanism is made responsible for two unrelated things, neither is delivered cleanly, and the Mechanism Model loses the ability to say what is accountable for what. Responsibility is what makes each mechanism answerable for a defined deliverable. It is distinct from purpose: purpose (§9) is *why a mechanism exists*; responsibility is *what it must deliver.*

**The behaviors that emerge.** This layer assigns each mechanism one clear responsibility. A mechanism that carries two unrelated responsibilities is two mechanisms and is split; a responsibility that no mechanism carries is an unmet progression need and is assigned one.

**The failure when ignored.** When responsibilities are not governed, mechanisms blur into one another, no single means is accountable for any specific deliverable, and a gap in consumption cannot be traced to the mechanism that was supposed to fill it.

## §15 — Mechanism Dependencies

**The governing truth.** Some mechanisms cannot do their work alone. **A dependency is a strict functional prerequisite: a mechanism cannot deliver its purpose unless another mechanism has already done its work.**

**Why it exists.** When a mechanism depends on another and that prerequisite is absent or out of order, the dependent mechanism cannot function — it is present but unable to deliver. Dependencies make those prerequisites explicit, so the Mechanism Model can be checked for the means each mechanism requires. The boundary is exact: a dependency is a **functional** prerequisite among means, never an **order of appearance** (Page Structure owns sequence) and never a **spatial arrangement** (Section Layout owns space). Only this domain carries "cannot function without."

**The behaviors that emerge.** This layer determines, for each mechanism, which other mechanisms it requires to deliver its purpose — the strict prerequisites without which it cannot function — distinct from the lateral relationships of §11.

**The failure when ignored.** When dependencies are not governed, a mechanism is included whose prerequisite is missing, it cannot deliver what it was selected for, and the progression stalls at exactly the point a means was present but unable to function.

## §16 — Mechanism Integrity

**The governing truth.** A Mechanism Model must remain **coherent** — its selection, purposes, hierarchy, relationships, orchestration, composition, responsibilities, and dependencies must hold together as one set of means a reader can be carried through. Integrity is the property of the whole mechanism intent being purposeful and sound, not merely correct in its parts.

**Why it exists.** A Mechanism Model assembled from individually reasonable decisions can still fail as a whole — a mechanism orphaned from any progression need, two mechanisms in conflict, the same responsibility served twice, a broken functional relation. Integrity is the discipline of checking the mechanism intent *as a system*, before any component or visual is built on it.

**The behaviors that emerge.** This layer guards the mechanism intent against the ways it loses coherence:

- **Missing mechanism** — a progression need with no means to make it consumable.
- **Purposeless mechanism** — a mechanism serving no progression need.
- **Conflicting mechanisms** — two mechanisms competing for the same responsibility.
- **Redundant mechanisms** — the same responsibility served more than once with no purpose.
- **Orphaned mechanism** — a mechanism with no tie to the progression it was meant to serve.
- **Broken relationships** — functional relations or dependencies that cannot be satisfied as composed.

The Mechanism Model must remain coherent, purposeful, and consumable end to end.

**The failure when ignored.** When integrity goes unchecked, a Mechanism Model whose parts each seem sound ships with a conflict, a gap, or an orphan inside it, and the progression it was meant to make consumable fails at exactly the point the mechanism intent stopped holding together.

## §17 — Mechanism Sufficiency

**The governing truth.** A Mechanism Model must provide **enough** means for the progression to actually be consumed. **Mechanism Sufficiency asks: does the Mechanism Model provide enough mechanisms for the intended progression to be consumed?** It is the analog of Information Architecture's Informational Sufficiency, Page Structure's Progressional Sufficiency, and Section Layout's Spatial Sufficiency.

**Why it exists.** A progression can be complete, well-sequenced, and well-spaced — and the means given it can still be **insufficient**: there is room for the progression but no means to consume it. Completeness of information, of progression, of space, and sufficiency of mechanism are different things; a sound, well-spaced progression with insufficient means cannot be consumed, however sound it is. Sufficiency is the discipline of confirming the means are enough before the page is built, and it is the cleanest statement of this layer's distinct identity: whether a progression can actually be consumed is a question only this layer can answer.

**The behaviors that emerge.** This layer determines whether the Mechanism Model is sufficient by asking, of the progression as a whole:

- Whether every progression unit that requires a means to be consumed has one.
- Whether the mechanisms are orchestrated and composed enough to carry the progression as a whole.
- Whether every required functional relationship and dependency is satisfied.
- Whether anything required for the progression to be consumed is absent.

The test is sufficiency, not abundance: enough means that the progression *can* be consumed — no gap, and no surplus mechanism for its own sake.

**The failure when ignored.** When sufficiency goes unchecked, a Mechanism Model that looks complete ships under-provisioned, and the progression — sound and well-spaced in itself — cannot be consumed, because the means it was given were never enough to carry it.

## §18 — The Removal Test

This section proves the layer must exist. Its core is one statement:

> **Without the Component System, progression can occupy space and be visually expressed, but no layer determines the structural means through which it becomes consumable.**

Trace it across the stack. Communication can determine *what must happen*; Information Architecture, *what information must exist*; Page Structure, *how it unfolds*; Section Layout, *where it lives*; Visual Language, *how it looks.* **No layer determines the structural means that make the progression consumable.** Space exists and style exists, but the bridge between spatial intent and visual realization is gone, and the progression has room and appearance with no means to be taken in.

Neither neighbour can absorb the gap. **Section Layout cannot:** it would have to invent mechanisms while deciding space — conflating two transforms, since *what fills* space is not *how space is organized*, and the moment it reasoned about means it would no longer be governing space. **Visual Language cannot:** it would have to invent mechanisms while styling them — making *appearance* the author of *structure*, so that what a progression requires would be decided by how it is to look. The layer earns its existence by being the only thing that answers what structural means make the progression consumable.

## §19 — The Premium Stress Test

This layer must explain both a simple website and a highly sophisticated, premium one — **without referencing style.** Its governing truth:

> **Premium quality emerges from richer reasoning and richer mechanism intent before it emerges from richer visual expression.**

The difference between a basic site and a premium one is not richer styling; it is richer **mechanism orchestration** derived from richer reasoning about what the progression needs to be consumed well. A simple progression requires few mechanisms, simply orchestrated. A sophisticated one requires more mechanisms, more carefully related, composed, and orchestrated into one continuous act of consumption — and that richness is decided **here, before any visual decision occurs.** The objective is not a prettier website; it is a more *intelligent* one. The visual layer only expresses that intelligence; it does not create it.

This is why a premium site styled over poor mechanism intent is still poor — appearance cannot supply means the Mechanism Model never required — and why a site with rich mechanism reasoning is premium before it is styled. It also reinforces inventory independence (§6): premium ambition is reasoned up from the upstream models, not assembled from whatever components already exist. A richer site mandates richer mechanisms whether or not the kit yet provides them.

## §20 — Governance versus Foundation

This separation is non-negotiable, and this layer states it more than once because it is the layer most tempted to forget it.

> **Governance determines intent. Foundation provides execution. Foundation may never redefine governance decisions.**

The Component System decides *which mechanisms must exist* — that is governance, that is intent. The foundation mechanisms — grids, tokens, type scales, breakpoints, container widths, spacing systems — provide the execution that renders mechanism intent into a built page. Foundation is downstream and subordinate: it realizes what this layer decided and may never overrule it. A foundation limitation is a reason to extend the foundation, never a reason to redefine which mechanisms a progression requires. The mechanisms this layer owns survive any grid, any token, any scale, because they are intent, and intent is settled here.

## §21 — The implementation-leakage warning

**The Component System is the layer most vulnerable to implementation leakage.** This is its signature hazard, and it must be named in the constitution itself.

The reason is structural. A mechanism is usually *realized* through a recognizable interface pattern — and so the pull to govern the realization instead of the mechanism is strongest exactly here, stronger than in any layer above. Information has no tempting interface vocabulary; space has none; but every mechanism has a "usual" form, and the moment that form is named, the layer has begun to govern the implementation rather than the intent. A future author will reach for the familiar artifact — a card, an accordion, a tab — and mistake naming it for governing the mechanism.

The standing test that holds the line:

> **Whenever a principle can be expressed using a UI element, a framework artifact, or a design pattern, it belongs downstream — not here.**

If a statement names a card, an accordion, a tab, a table, a form, or any interface element, it has left mechanism intent and entered realization. The correct form of the statement is the mechanism — the structural means and the role it performs — and the interface element is downstream, where Visual Language and the foundation realize it. This warning is the standing guard that the boundary of §5 is under more pressure in this layer than anywhere above it.

## §22 — What the Component System must never do

This section is the layer's discipline, and it is absolute. The Component System explicitly rejects ownership of everything around it. For each, the decision belongs to a named layer, and this layer claims none of it.

**Not communication.** It never determines what must happen — never what must be understood, believed, trusted, preferred, or acted upon. Those are communication outcomes, already settled; **mechanism is not capability.** They belong to **Communication & Perception** (`COMMUNICATION_AND_PERCEPTION_SYSTEM.md`).

**Not information.** It does not create, remove, or redefine information, relationships, dependencies, or completeness. Those belong to **Information Architecture** (`INFORMATION_ARCHITECTURE.md`).

**Not progression.** It does not decide encounter order, transition logic, or progression objectives. Those belong to **Page Structure** (`PAGE_STRUCTURE.md`).

**Not space.** It does not reopen allocation, containment, density, composition, hierarchy, or spatial relationships. Those belong to **Section Layout** (`SECTION_LAYOUT.md`).

**Not visual expression.** It does not decide typography, colour, contrast, motion, illustration, visual assets, or surface treatment. Those belong to **Visual Language** (`VISUAL_LANGUAGE.md`, executed by `rulebooks/visual-language.md`), a downstream consumer that *expresses* the Mechanism Model — never a co-author of it.

**Not brand expression.** It does not decide personality, tone, character, or brand expression. Those belong to **Brand Expression** (`BRAND_EXPRESSION.md`, executed by `rulebooks/design-charter.md` and `creatives.md`) and, above all, to the Creative Director.

**Not UI elements.** It never defines cards, accordions, tabs, tables, forms, buttons, carousels, modals, timelines, steppers, or dashboards. Those are **implementations** of mechanisms, realized downstream — never mechanism intent.

**Not foundation systems.** It never defines grids, tokens, type scales, breakpoints, container widths, or spacing systems. **Governance determines intent; Foundation provides execution.**

The rule beneath every line of this section is the one boundary from the header: this layer governs mechanism intent; it never creates the meaning, information, progression, or space above it, nor decides the form, implementation, or brand below it.

## §23 — The output of the Component System

The output of this layer is a single artifact: the **Mechanism Model** — the authoritative record of the required mechanisms, their purposes, responsibilities, relationships, orchestration, and dependencies. It records what mechanisms must exist, why each exists, what each is accountable to deliver, how they relate and depend on one another, how they are composed and orchestrated, and which are primary, supporting, or optional.

It never outputs a component library, a UI catalog, a foundation system, or a visual system. The output remains *mechanism intent* from end to end. **The Mechanism Model is the authoritative representation of mechanism intent**: Visual Language, Brand Expression, and the foundation mechanisms **realize** it — give it components, visual form, and execution — but they may **never redefine which mechanisms must exist.** When this layer hands down a coherent, sufficient Mechanism Model, everything below it has a mechanism intent it can realize and did not have to invent.

## §24 — Failure modes

Each failure below is a violation of a principle established above; the cure is the principle.

- **Missing Mechanism** — a progression need has no means to make it consumable (violates §8, §17).
- **Purposeless Mechanism** — a mechanism serves no progression need and is carried out of habit (violates §9).
- **Catalog Retrieval** — a mechanism is chosen from the library or from convention rather than discovered from need (violates §6).
- **Inventory Capitulation** — mechanism intent is downgraded to fit the components that already exist, so the output regresses to the basic (violates §6).
- **Mechanism Conflict** — two mechanisms compete for the same responsibility (violates §10, §16).
- **Mechanism Redundancy** — the same responsibility is served more than once with no purpose (violates §14, §16).
- **Broken Mechanism Dependencies** — a mechanism cannot function because its prerequisite is absent or out of order (violates §15).
- **Orchestration Failure** — the mechanisms each work but do not combine into one continuous act of consumption (violates §12, §13).
- **Implementation Leakage** — a UI element, framework artifact, or foundation choice is named as if it were mechanism intent (violates §5, §21).
- **Mechanism Insufficiency** — room and style exist but the progression still cannot be consumed (violates §17).

## §25 — Non-Negotiables

These are immutable. They are permanent, universal, technology-agnostic, paradigm-agnostic, trend-agnostic, and medium-agnostic. They define what the Component System fundamentally is and is not, and no downstream need or upstream pressure may override them.

1. **The Component System governs the structural means through which spatially organized progression becomes consumable.** It owns mechanism intent — never meaning, information, progression, space, visual expression, or implementation.
2. **The Component System never determines what must happen.** What must be understood, believed, trusted, preferred, or acted upon is settled by Communication & Perception. **Mechanism is not capability.**
3. **The Spatial Model is accepted as settled fact.** This layer never reopens allocation, containment, density, composition, hierarchy, or spatial relationships, and never asks what occupies dominant space.
4. **A mechanism is not a component.** It is a structural means defined by the role it performs, never by the form it takes.
5. **Mechanisms are discovered, not retrieved.** They emerge from upstream need; they are never selected from a predefined catalog.
6. **Reasoning before inventory.** The Component System must derive the required mechanism before considering whether a realization already exists.
7. **The Mechanism Model is need-derived and inventory-independent.** Its sophistication is set by the upstream models, never by the existing inventory; missing components are implementation deficiencies, not grounds for weaker mechanism intent.
8. **The constitution governs mechanism properties, responsibilities, and relationships — not a fixed set of mechanism classes.** The constitutional truth is mechanism intent; the owned domains are its governance decomposition, not its eternal identity.
9. **The Mechanism Model is the authoritative record of mechanism intent.** Downstream systems realize it but may never redefine which mechanisms must exist.
10. **Governance determines intent; Foundation provides execution.** Foundation may never redefine governance decisions.
11. **Premium quality emerges from richer reasoning and richer mechanism intent before richer visual expression.** The objective is more intelligent websites, not prettier ones.
12. **Whenever a principle can be stated as a UI element, a framework artifact, or a design pattern, it belongs downstream.**
13. **If removing a principle does not change the required mechanisms, it does not belong to the Component System.**
14. **The Mechanism Model must be mechanically sufficient.** A complete, well-spaced progression can still be mechanically insufficient; enough means that the progression can be consumed — no gap, and no surplus.

## §26 — The final governing principle

Communication determines what must happen in the mind. Information Architecture determines what information must exist. Page Structure determines how information unfolds. Section Layout determines how progression occupies space. The Component System governs the structural means through which spatially organized progression becomes consumable.

It creates neither meaning, nor information, nor progression, nor space. It creates **the means of consumption** — it transforms a Spatial Model into a Mechanism Model that allows progression to be experienced.

If any section of this document begins to discuss UI elements, components, foundation systems, grids, spacing, visual styling, or implementation techniques, it has left its territory and must return to mechanism discovery, selection, purpose, hierarchy, relationships, orchestration, composition, responsibilities, dependencies, integrity, and sufficiency. That return is always available, because those are the whole of what this layer governs, and the whole of what it must.
