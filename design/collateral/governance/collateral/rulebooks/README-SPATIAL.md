# Spatial Visualization Rulebook *(Isometric Technical Illustration)*

A standalone reference for designing and building **spatial visualizations** — publication-quality
technical illustrations that use a **fixed isometric projection** to represent systems,
architectures, platforms, processes, frameworks, and operating models with implied depth. Consult it
**whenever you create one, or choose whether to use one.** Its job is to keep every spatial visual
**editorial, structured, native** to the collateral language — and **information-rich enough to earn
its place as a hero** — never a decorative 3D graphic bolted on, and never an empty plane with a
single icon on it.

The objective is **not** realistic 3D renders. The objective is **not** decorative illustration. The
objective is a consistent visual language that turns an abstract system into a **structured spatial
visual** using one fixed perspective — one that reads as **engineered, not merely illustrated.** Every
output stays a **static 2D composition** — HTML / SVG / print / PDF / A4 compatible — that merely
*implies* depth, elevation, hierarchy, containment, modularity, relationship, and flow. The system is
never a 3D modelling environment.

This rulebook is self-contained. It states *principles and rules*, not implementations. Bring your
own markup; bring these decisions.

---

## How to use this rulebook

Read it top-to-bottom once. After that, jump to what you need:

1. **Is it in scope — a spatial visual at all, not a chart, a diagram, or a sentence?** → §1
2. **Hold the philosophy + priority order (communication first; style restraint vs. richness).** → §2
3. **Decide WHAT is communicated before any geometry — meaning → representation → render.** → §3, §4, §5
4. **Remember you're designing for A4, not an infinite canvas.** → §6
5. **Lock the projection; know what you're allowed to render with.** → §7, §8
6. **Build the representation's signature; primitives are only construction material.** → §9
7. **Set the fidelity level the content + context demand; hit its density.** → §10, §11
8. **Make every plane a real sub-system; never leave it empty.** → §12
9. **Carry hierarchy through elevation, scale & dominance; pick a surface.** → §13, §14
10. **Ground the scene with drafting infrastructure; wire it with the two connector tiers.** → §15, §16
11. **Choose the family and a composition archetype; match density to real complexity.** → §17, §18, §19
12. **Keep it rich at every zoom; apply colour (multi-colour encoding), annotation, integration.** → §20, §21, §22, §23
13. **Keep it honest, hold the style bans, then run the pre-flight checklist (incl. the recognition test).** → §24, §25, §26
14. **When in doubt, re-read the closing principle.** → §27

---

## 1. Scope — and the boundary with diagrams & charts

This rulebook covers **spatial visualizations** — and only those. Use one when information benefits
from being shown as a **system of objects in a structured spatial environment**, given an editorial,
depth-implied treatment:

- Platform & system architecture · layered concepts · modular systems · processes & workflows ·
  frameworks & capabilities · ecosystems · operating & service models · infrastructure / data / AI
  systems.

**One unified system, two ends of a range — never two systems.** Collateral is long-form and
content-heavy; spatial visuals are an engagement element (a sibling to the charts and diagrams
systems) that *both* communicate a system *and* give the reader a visual hook so the page doesn't read
as a wall of text. Some outputs sit at the **structural** end (a platform stack, an architecture);
some at the **conceptual / editorial** end (a security scene, a colour-coded ingestion hook). **They
are the same visual language built from the same philosophy** (§2, §3) — do **not** split them into
"diagrams" vs "illustrations," and the reader should never need to know which it is. What unites every
output is the communication-first method (§3): meaning before geometry.

**Out of scope** *(belongs to a different system — do not build it here)*

- **Quantitative charts & metric visualizations** — anything whose point is a *quantity's magnitude*
  (a bar's length, a line's trend, a wedge's share, a highlighted number), plus KPIs, statistics,
  tables, timelines, comparisons, and dense data tables. These are a **separate charts system.**
- **Quick clarity figures of a structure** — when the job is simply to *explain how something works
  or is organized* as plainly as possible, that is a **flat diagram**, a separate system again.
- **Decorative or cartoon illustration** that carries no system structure.
- **Infinite-canvas artwork** designed for whiteboard tools rather than a printed page (see §6).

**The boundary with the diagrams system — read this carefully, it is the load-bearing decision.**
A flat diagram and a spatial visual can describe the *same content* (an architecture, a process, a
framework, an ecosystem). **The discriminator is intent, not content:**

- A **flat diagram is the default.** It is **clarity-first** — it reads like a *figure* typeset
  beside the prose, communicates the relationship in the least visual structure possible, and is the
  right tool the overwhelming majority of the time.
- A **spatial visualization is that same structure given a depth-implied, editorial / hero
  treatment.** It reads like an *illustration*. Reach for it **only** when *both* are true: (a) the
  content is a genuine **system or concept** — layered, modular, architectural, an end-to-end flow, or
  an idea with a recognizable representation (§4) that *benefits* from being seen in space; **and** (b)
  the **context wants an illustrative / engagement moment** — a cover, a section opener, a
  capability-deck hero, a flagship page, or a visual hook that earns the reader's attention in
  long-form content — **and** A4 width allows it.

Reach for the flat diagram by default. Reach for spatial **only** when the structure earns it *and*
the page wants the illustration. **Never** use isometric merely to decorate a relationship that a
flat diagram — or a sentence — says more clearly. If the value is *clarity*, it's a diagram; if the
value is an *editorial sense of the system's depth and scale*, it may be spatial.

**Spatial visuals are HERO creatives, never inline figures.** This is the placement rule that follows
from everything above. A flat diagram is the *inline* tool — it typesets beside the prose, at figure
scale, as one element in the reading flow. A spatial visual is the opposite: it is a **hero / feature
moment** — a cover, a section opener, a capability-deck hero, a full-width flagship panel — that
**commands the page (or a dominant share of it) and is the thing the reader looks at**, with the prose
arranged around it. **Do not** drop a spatial visual inline beside body copy, shrink it to a
figure-sized slot in the reading flow, or run several down a page as repeating figures. If the content
only warrants an inline, beside-the-text figure, that is a signal it should be a **flat diagram**, not
a spatial visual. One spatial hero per page is the norm; more than one is almost always wrong. Because
it earns the whole page, it must also *fill* that role with real information density (§10).

---

## 2. Core philosophy & priority order

**Spatial visuals are not 3D graphics. They are not realistic renders. They are not decorative
fillers.** Every spatial visual must communicate a **specific concept or system** — chosen
*meaning-first* (§3), never assembled *geometry-first*. If the same information reads more clearly as
**text, a table, a chart, or a flat diagram**, use that instead. The purpose is **communication** —
which legitimately includes *engaging* the reader and breaking the monotony of long-form content
(§1) — never spectacle for its own sake.

A spatial visual should feel **native** to the collateral system — as if it were composed alongside
the prose, not imported from a 3D tool.

**Two restraints, and only one of them limits richness — do not confuse them.** This is the most
important distinction in the rulebook, because confusing them is what produces empty, simplistic
output:

- **Style restraint — keep it absolute.** No glow, no holographic / iridescent fills, no heavy
  shadows, no thick 3D forms, no product-render or cartoon aesthetics; colour is used to **encode
  identity, never to decorate** (§21). The look stays quiet, flat, Swiss, technical.
- **Information density — this is a *virtue* for a hero, not a vice.** A hero spatial visual should be
  **rich, detailed, and engineered**: populated planes, real internal sub-structure, visible
  relationships, multiple levels of hierarchy, drafting infrastructure. "Minimal" describes the
  *styling*, never the *information*. A clean style carrying a dense, legible system is the target; a
  clean style carrying three boxes and an icon is a failure.

The references this language is built from are **style-restrained but information-dense.** Reproduce
both. Restraint of *ink and effect*, generosity of *structure and detail*.

**Priority order** — when these pull against each other, the earlier one wins:

1. **Structure & fidelity** — the system the reader should grasp, rendered at its *true* complexity
   (its real parts and how they assemble — §10), never simplified into emptiness.
2. **Hierarchy** — which layers/objects sit above which, and which dominate, and why (§13).
3. **Relationships & flow** — how the parts connect and move (§16).
4. **Legibility at every scale** — the richness must resolve into meaning, not noise (§20).
5. **Decoration** — last, and only if it survives §25.

Density serves the first four; it is never decoration. **A quiet visual that lands one richly-realised
system beats both a crowded heavily-rendered one and an empty under-built one.** Depth, elevation,
surface, and detail are **communication tools** — use as many as the system genuinely has, and no
ornament beyond that.

**Specify before you draw.** A hero is *fully decided before a single polygon* — that discipline is what
separates a reference-grade visual from a patched-together one. Name the concept and its representation
(§3–§5); budget the whole canvas (§18); plan the tiers, the peripheral modules, the routes, and the
colour-encoding (§13, §16, §18, §21); set the fidelity level (§11); confirm the integrity (§24). The
highest-definition references are "highly defined" because their *brief* was — write that build brief up
front, then build to it, then run the pre-flight (§26).

---

## 3. Communication-first representation *(the thinking model — read this before §9)*

The single most important rule in this rulebook, and the one that most changes the output:
**decide what is being communicated before you reach for any geometry.** A spatial visual fails — it
looks generic, templated, interchangeable — when it is built *geometry-first*: pick a cube, drop an
icon on it, repeat. Every concept then resolves to the same shape and only the icon changes (security
= cube+lock, data = cube+disk, AI = cube+spark). The references never do this: they begin with
**meaning**, choose a **recognizable representation** of that meaning, and use isometric geometry only
to *render* it. The viewer recognizes *"a workflow board," "a knowledge graph," "a secure gateway"*
before noticing a single polygon.

**The four-step method — follow it in order, every time:**

1. **Understand the concept.** What is this thing, and *what does it do*? How would an expert name it?
2. **Choose the representation.** What object, system, environment, interface, tool, workflow,
   artifact, or metaphor most recognizably stands for it? (Use the translation matrix, §4.)
3. **Build the representation** from spatial primitives — give it the *signature* that makes it read
   as that thing (§4).
4. **Then, and only then, render** it in the fixed isometric language (§7, §8).

Geometry is the *last* decision, not the first. Primitives (planes, cubes, cylinders, cards, nodes)
are the **construction material**, never the vocabulary the reader is meant to see (§9).

**The Primitive-Invisibility Principle.** The viewer should recognize the *concept*, not the
primitive. A good result reads as *"an orchestration platform / a monitoring system / a knowledge
network"*; a failed one reads as *"a cube / a cylinder / a stack of cards."* The geometry does not
literally vanish — this is a flat isometric line system — but the **composition must dominate the
read**: the signature, not the substrate, is what registers. If your visual's most honest one-word
description is a shape, it has failed; return to step 1.

**The Semantic Recognition Test (the gate).** Before approving any spatial visual, *mentally remove
every label* and ask: **"What would an expert say this represents?"**

- **Fails** if the answer is *cube · cylinder · block · card · node · plane.*
- **Passes** if the answer is *workflow board · orchestration platform · knowledge network · data
  fabric · secure gateway · monitoring console · service ecosystem.*

This test is a pre-flight requirement (§26). It is the simplest, highest-leverage guard against
geometry-first output, and it applies to **every** spatial visual — the more structural ones and the
more conceptual / editorial ones alike (§1, §2).

---

## 4. Meaning translation & the visual vocabulary

This is the working reference for step 2 of §3: how to turn a concept into a recognizable spatial
representation. **The load-bearing column is the *signature*** — the small set of marks that make a
representation read as itself and distinguish it from its neighbours. Renaming a layer "data fabric"
changes nothing; building the *woven-grid-plus-access-points signature* is what makes it read as one.

**The translation matrix.** *Concept → Representation → Signature (the recognizable marks).*

| Concept | Represent as | Signature — the marks that make it read |
|---|---|---|
| **Decision / control** | command centre · orchestration console | a screen surface: header bar + content rows + a small chart; one focal core |
| **Workflow / process** | workflow board · connected stages | articulated cards flowing across columns; directional connectors stage→stage |
| **Knowledge / ontology** | semantic / relationship network | irregular entities (labelled where the layout allows) + typed edges + larger hub nodes — never a regular lattice |
| **Data / storage** | repository · pipeline · data fabric | stacked racks with platters & status LEDs; or a woven grid-mesh + access points |
| **AI / reasoning** | agent workspace · model hub | a hub wired to a reasoning network; a console of models; nodes feeding a core |
| **Integration / connectivity** | service mesh · connectivity network | a central hub + service tiles wired by routed connectors |
| **Platform / capability** | capability surface · service landscape | a populated platform plane carrying varied labelled modules |
| **Monitoring / analytics** | operational dashboard · insight surface | a console with an eye / monitor glyph, status rows, a small chart |
| **Operational / ecosystem** | system ecosystem · distributed environment | a cloud of *varied* labelled entities around a focal core, on a ground grid |
| **Security / trust** | secure gateway · vault · shield | a shield / padlock / key over a gateway device; dashed containment frames |

**The vocabulary is derived from concepts, not geometry — and it is expandable to any domain.** The
matrix above is the reusable core; apply it to the collateral's domain. Worked instances:

- **AI platforms** — agents, orchestration boards, model hubs, reasoning networks, agent workspaces.
- **Developer platforms** — repositories, build / deploy pipelines, service meshes, code environments.
- **Cybersecurity** — monitoring surfaces, detection / signal networks, secure gateways, alert ecosystems.
- **Healthcare** — patient-journey flows, care networks, clinical / treatment workflows, record repositories.
- **Financial systems** — transaction flows, decision / risk engines, ledgers, operational dashboards.

Same method everywhere: name the concept → pick the representation → build its signature. A new domain
adds *nouns*, not new rules.

**Metaphor objects & icons are first-class vocabulary** — this is what "not just cubes" means in
practice. A representation is often a *recognizable object*: a **shield / padlock / key** (security),
a **server-stack / repository** (data), a **gear / sliders** (configuration), an **eye** (monitoring),
a **screen / console** (interface), a **labelled format card** (an entity), a **hub-and-spokes**
(integration), a **tower** (a core service). These are built from primitives but read as the thing.
They are drawn from the system's **own icon language** (§23) — not third-party brand logos — and each
must encode something real (§24).

**Semantic accuracy — the integrity guard for this section.** The representation must match the
layer's *true function*. Do not dress a dull layer as a "command centre" for drama; the
recognition-test answer must be *what it really is*, not an inflated version. Meaning-first never
licenses meaning-fiction (§24).

---

## 5. Layer identity & geometry concealment

**Every major area has its own identity — no two read alike.** A stack of five identical-looking
planes is the geometry-first failure even when each is labelled. In a multi-area visual, **no two
adjacent layers / stages may share the same representation, object vocabulary, or internal rhythm.** A
platform stack reads correctly only when Experience is a *console*, Application a *board*,
Orchestration a *network*, Data a *repository*, Infrastructure a *fabric* — each recognizable with its
**label removed.** Distinct signatures (§4) achieve this; repeating one motif loses it. This is the
single cheapest defence against visual monotony.

**Geometry stays concealed behind communication.** Primitives are for construction; they must not
remain the dominant visual language. As a working rule: if, scanning the finished visual, the first
thing you notice is *the cubes* (or cylinders, or identical cards), the representation is too thin —
articulate it into its signature (§4, §12) until the *system* is what reads. This is the same standard
as the Primitive-Invisibility Principle and the Recognition Test (§3, §26); §4 supplies the vocabulary
that satisfies it.

---

## 6. Collateral-first constraint

This system generates **A4 collateral.** Every spatial visual must be optimised for:

- **A4 portrait layout** · **print export** · **PDF export** · **HTML rendering.**

Every decision must weigh: available **page width** · available **page height** · **content
density** · **reading flow.** Spatial visuals should **use the available width**, avoid unnecessary
vertical growth, **respect the 16mm content margins and the page grid**, and stay visually balanced.

**Compose with generous negative space — the breathing room is structural, not waste.** A premium
spatial hero is mostly *space*: the focal core, the surrounding modules, and the connectors are
deliberately spread across the page with clear gaps between them. **No element should touch another** —
every object, module, and route is intentionally positioned with air around it. Crowding objects
edge-to-edge reads as a busy diagram; spacing them with calm negative space reads as an engineered
system. The empty space *is* part of the composition (it pairs with the canvas budget, §18) — do not
fill it, and do not let the hero swell to consume it.

**Do not design as if for an infinite canvas.** A visual that only works when you can pan, zoom, or
orbit is the wrong visual here. The composition must be complete, legible, and stable on one printed
A4 page — and, because it is a hero (§1), it should command that page at full size, not sit shrunken
within it.

---

## 7. Fixed projection system

All spatial visuals use **one consistent projection**, and the projection angle stays **fixed across
the entire system** regardless of content type. This single locked perspective is what makes the
language feel like one system rather than a pile of unrelated illustrations.

**Never** rotate the perspective · change the viewing angle · introduce camera movement · simulate
orbiting · simulate perspective shifts · mix projection angles within or across visuals. One angle,
everywhere — including every embedded card, screen, volume, and texture inside a plane.

---

## 8. Rendering architecture

Spatial visuals must be **renderable as static markup** that survives export and reflow. Because the
output is a *static 2D composition* (§ intro) that must hold under PDF and print, the rendering rules
are strict.

**Preferred — SVG with baked isometric geometry.** The isometric planes, faces, and edges are drawn
as **2D polygons whose coordinates already encode the fixed projection angle** (§7). Isometric
projection is *geometrically required* — parallelograms, offsets, and overlaps can't be expressed in
plain flow/grid layout — so SVG earns its place here, exactly as the diagrams system reserves SVG for
geometry it genuinely needs. Semantic HTML + CSS Grid/Flexbox still carry the surrounding layout,
labels, and annotations.

**Allowed — CSS 2D transforms** (`skew` / `scale` / `rotate` / `translate`) for simple single-plane
cases, where a flat element is sheared into the iso angle.

**Detail and density render the same way — and still survive print.** All the richness this rulebook
demands (§9–§12) uses nothing new and nothing fragile: a **volume** is flat 2D shapes at the fixed
ratio (a cube is the plane's faces at full height; a cylinder is an ellipse lid + a wall). An
**articulated card / module** is a small surface parallelogram with smaller inner shapes — pure
composition of the same primitives. A **surface texture** (a woven grid-mesh, a node graph, a ground
grid) is built from **repeated short line segments** (optionally clipped to the plane), **never a
tiled fill pattern**, which is the print/PDF-fragile path. A **screen** shears into the iso plane with
a single **2D affine transform**, not real 3D. Hundreds of such elements compose without any new
technique. All of it is verifiably print-safe; if a detail technique can't survive print-to-PDF, it
doesn't belong here.

**Avoid**

- Real 3D in the engine (3D transforms / preserve-style 3D) — the known-fragile path for PDF/print
  export. The system implies depth; it does not compute it.
- Canvas · WebGL · 3D engines/modellers · JavaScript rendering · absolute pixel-based layout for the
  surrounding composition · tiled fill patterns for textures.

The visual must stay **stable** during **PDF export, print export, page resizing, and content
updates.** If it only holds at one exact pixel width, it is not collateral-ready. It should feel like
a **technical drawing**, not a rendered object.

---

## 9. Spatial primitives *(the construction material — not the vocabulary the reader sees)*

**Read §3 and §4 first.** Primitives are reached for at *steps 3–4* of the communication-first method —
**after** the concept and its representation are chosen, never before. They are the **construction
material** every representation is built from; they are *not* the vocabulary the reader is meant to
recognize. A finished visual should read as its representation (a board, a network, a gateway), not as
its primitives (cubes, cylinders, cards) — that is the Primitive-Invisibility Principle (§3, §5). The
catalogue of *representations* (with the signatures that make them read) is §4; this section is the
low-level kit those representations are assembled from.

**Isometric plane.** The fundamental building block — the spatial equivalent of a *content card.* It
carries a surface, a subtle depth, an edge, and a fill, and represents a layer, capability, module,
platform, service, or component.

**Floating layer.** A plane lifted to imply **hierarchy, system layers, or abstraction levels** —
used for platform architecture, layered systems, and infrastructure models. Hierarchy is implied
through **elevation** (§13).

**Spatial container.** A bounding plane, frame, or ground that visually **groups related objects** — a
platform, system, or environment boundary.

**Embedded objects.** Smaller forms that live *inside* a plane — features, components, entities,
services, or data sources.

**Connectors.** Lines or paths that represent a **relationship — nothing else** (§16).

### Detail vocabulary — build the representation's signature from the kit

The bare primitives are the floor, not the deliverable. Each entry below reads **representation →
how the kit builds its signature** (the reverse of "shape → meaning," which is the geometry-first
trap). The full concept→representation→signature matrix is §4; this is how those signatures are
constructed. All are sanctioned, and for a hero **expected**, **whenever each element encodes
something real** (§24) — never to fill space:

**Metaphor objects (§4) come first.** When a concept *has* a recognizable object — a **shield /
padlock** (security), a **server-stack / repository** (data), a **gear** (configuration), an **eye**
(monitoring), a **labelled format card** (an entity) — build *that*, from the kit, at the fixed angle.
The object is the representation; the cube underneath it is just how it's drawn.

**Volume, where a thing has real presence.** A discrete entity / service is given volume with an **iso
cube** (the plane's three faces at full height); a datastore is better drawn as a **repository**
(stacked racks + platters) than a bare **iso cylinder** (ellipse lid + wall) — the rack signature
reads as *storage*, the lone cylinder reads as *a cylinder*. A *cluster* of **varied, labelled**
entities around a focal core reads as an **ecosystem** (§4), never a uniform heap of cubes.

**Boards, networks, consoles, fabrics — the populated-plane signatures.** A **board** of articulated,
varied, labelled cards = a workflow / capability surface; a **node-graph** (irregular nodes + typed
links + hubs) = a knowledge / model network; a **screen / console** (header + rows + a small chart) =
a control or monitoring surface; a **woven grid-mesh** + access points = a data fabric. Each is built
from the same primitives at smaller scale, but it is the *signature* (§4), not the primitive, that the
reader sees.

**Ground / environment & drafting.** The scene sits in a constructed space, not a void (§15).

**Articulation & variation are mandatory — uniformity is the failure mode.** The single worst quality
signal is a plane tiled with **identical, blank, evenly-spaced shapes**: that reads as placeholder
texture, not architecture, and instantly looks unfinished. So: **vary** object size, width, and
content; **articulate** each object with real internal structure (a title bar, a line, a status mark);
**label** what the real system names. Six varied, articulated, labelled modules outrank thirty
identical blank squares every time. Detail is *resolution*, not *repetition*.

Detail does not relax the other rules: **colour stays encoding, not decoration** (§21), depth stays
subtle (§13), every element must be real (§24), and the richness must resolve at every zoom (§20).

---

## 10. Structural fidelity & density *(the rule that prevents empty output)*

**Render the system's real complexity at full fidelity. Do not simplify it away.** This is the core
correction this rulebook makes. A spatial hero's failure mode is not "too busy" — it is "too empty":
big planes carrying one icon, containers with no contents, architecture labels with no architecture.
The fix is a positive obligation:

- **Show what is actually there.** If a platform has six services, draw six articulated services. If a
  model layer is a network of twenty nodes, draw a network, not three dots. If a workflow board has
  many modules, draw a populated board. **Under-rendering a real system is as much an integrity
  failure as inventing one** (§24).
- **A hero earns the page by filling its role with information** (§1). Target a **high fill** of each
  populated plane with *meaningful* sub-structure — roughly **half to three-quarters** of a plane's
  surface carrying real content, not one corner occupied and the rest bare.
- **Density is fidelity, never padding.** This is the hard boundary with the integrity rule (§24):
  you may render every real part at full detail; you may **not** invent parts, layers, or
  relationships to hit a number. The richness comes from *resolving the real system more finely*
  (articulation, §9), not from fabrication.
- **The honest exception.** A genuinely small system (say, four modules) draws four — richly
  articulated, grounded, and connected. It reaches hero quality through **articulation + drafting +
  flow + scale hierarchy**, not through invented tiles. Small ≠ empty; small = small-and-fully-realised.

Calibrate the *amount* of richness with the fidelity ladder (§11); make each plane carry it (§12).

---

## 11. The fidelity ladder — four measurable levels

Pick the level from **the system's true complexity (§10) and the context's ambition (§1).** A hero
targets **Advanced or Editorial-Hero**; an in-deck supporting spatial may sit at Structured. Never
pad a simple system up a level by inventing parts (§24) — move up only when the real system, and the
page, justify it.

| Dimension | **L1 · Basic** | **L2 · Structured** | **L3 · Advanced** | **L4 · Editorial Hero** |
|---|---|---|---|---|
| Primary objects (planes / volumes) | 1–3 | 3–6 | 6–10 | 8–14+ |
| Sub-components per populated plane | 0–2 | 3–6 | 6–12 | 10–20+ |
| Relationships / connections | 0–2 | 2–5 | 5–10 | 10+, incl. narrative flow (§16) |
| Hierarchy depth (levels of nesting) | 1 | 2 | 2–3 | 3–4 — systems within systems |
| Environmental detail (§15) | none | a ground line / single grid | ground grid + droplines | full ground grid + droplines |
| Drafting detail (§15) | none | none | registration marks | registration marks + indexed rails |
| Annotation density (§22) | one label or none | key labels | indexed labels | indexed rail + bullet detail |
| Narrative (§19) | a single object | a clear structure | a legible progression / flow | a full orchestration story |
| Rewards inspection at (§20) | thumbnail | + composition | + module | + detail (4 levels) |

**How to read the ladder.** The counts are *typical ranges for a system of that genuine complexity*,
not quotas. Slide *down* if the real system is simpler (honest exception, §10); never slide *up* by
fabrication. The level sets the **target richness**; §12 makes sure each plane actually carries it.

---

## 12. Internal plane architecture — and the empty-plane rule

A plane is not a backdrop for a lone icon. **Every populated plane must read as a real sub-system in
its own right** — a board, a console, a network, a schema, a control surface, a populated platform.
This is how the references achieve "systems within systems," and it is non-negotiable for a hero.

**The empty-plane rule.** A large isometric surface carrying only a single icon, a couple of shapes,
or nothing is **forbidden** in a hero. If a plane has nothing real inside it, either (a) it has real
contents you failed to render — render them (§10); or (b) it has no real contents — then it should not
be a large plane at all (shrink it, merge it, or drop it). A container implies contents; draw them.

**What "a real sub-system" means in practice** — give each populated plane one of:

- a **board** of articulated, varied, labelled cards (a workflow / capability / module board);
- a **network** (node-graph) of nodes and links, with the denser, larger nodes reading as hubs;
- a **console / screen** with header, panels, and content rows;
- a **cluster of varied volumes** (entities + datastores) wired by relations;
- a **woven fabric / textured surface** standing for throughput or a data plane.

**Articulation, not texture.** Re-stating §9 because it is the most common failure: the contents must
be **varied and articulated**, never a field of identical blank chips. Variation in size and content,
plus a little internal structure per object, is what reads as "engineered."

**Honest exception (per §10).** A genuinely sparse plane is allowed *only* when the real thing is
sparse, and then it must be carried by articulation and grounding — never left as a bare slab to imply
emptiness the system doesn't have.

---

## 13. Elevation, depth & scale hierarchy

**Hierarchy is carried by three levers — elevation, scale, and density — not by elevation alone.** If
everything sits at the same height, the same size, and the same density, the visual reads as flat and
"equally important," which is the weak-hierarchy failure.

**Elevation is a communication tool, not physical distance.** Use it to convey **importance,
hierarchy, layering, dependency, and abstraction.** Higher layers appear above lower layers, and the
elevation system stays **consistent** across every output. Elevation must never imply a hierarchy that
isn't real (§24).

**Scale & dominance.** Vary object and plane size to encode importance: the **focal sub-system is the
largest and the densest**; primary objects are bigger than secondary ones; a key entity outsizes a
minor one. A deliberate range of sizes reads as engineered hierarchy; one uniform size reads as a
template. (Pair this with colour encoding, §21, and the drafting emphasis, §15.)

**Build a focal hero through stacked tiers, not scale alone.** A central hero object gains presence by
resolving into a *vertical stack of distinct tiers* — for example a **foundation platform**, a layer of
**on-platform sub-modules / controls**, the **primary structure**, an **elevated feature**, and a small
**floating focal highlight** hovering just above it. The floating highlight — a compact element lifted
clear of the core and tied to it by a **dashed dropline** (§15) — signals *activity, processing,
transmission, or intelligence* and pulls the eye to the top of the hierarchy. Lift it with **elevation
and the sanctioned same-hue accent gradient (§21) — never a glow or halo** (§25). Each tier should read
as a *different* sub-part (Layer Identity, §5), so the stack reads as one engineered object rather than
repeated slabs.

**Depth must stay subtle.** It exists only to support spatial reading and must **never become the
primary visual element.** Avoid excessively deep objects, thick 3D forms, and product-render
aesthetics — the system should read like a technical drawing, not a rendered solid. Scale variation
carries hierarchy; brute depth does not.

---

## 14. Surface language

Three approved surface styles, governing *fill weight* (colour itself is governed by §21).

- **Wireframe** — minimal outlines; best for technical systems and architecture.
- **Outlined** — the **primary** style; used for most spatial visuals: light surface, hairline edge.
- **Filled / accent** — a surface takes a saturated accent fill. Use it to **encode** (an identity, a
  focal element, a track) per §21 — whether that is a *single* focal area (one-concept visuals) or
  *several* identity-coloured areas (multi-identity visuals). It is colour with a referent, never a
  louder fill for its own sake.

Surface style is independent of density: an outlined plane can be richly populated. Richness comes
from contents and articulation (§9, §12), not from louder fills.

---

## 15. Drafting & construction layer *(what makes it read "engineered")*

A premium reference does not float in a void — it sits in a **constructed space** with the quiet
infrastructure of a technical drawing. Adding this layer is one of the highest-impact moves for
sophistication, and it is **subtle by definition** (hairline, dashed, behind the subject — never
ornament). The vocabulary:

- **Ground / construction grid** — a dashed isometric grid the system sits on, anchoring the scene
  and reinforcing the projection. Essential for modular, ecosystem, and platform-surface compositions.
- **Droplines** — dashed verticals tying a floating layer or object to its position on the ground or
  to the layer below; they ground an exploded stack and assert alignment.
- **Registration / corner marks** — small L-shaped crop/registration marks framing the composition,
  the signature of a drafted plate.
- **Alignment rails & bracket rails** — a vertical rail (optionally bracketed) that the annotation
  labels align to (§22), with **index numbers** sequencing the parts.
- **Leader lines** — thin lines from an object to its label (§22).

Use these to *ground and sequence*, not to decorate. A hero (L3–L4, §11) should carry several; a
simpler visual carries a subset. They stay quiet enough that the system, not the scaffolding, leads.

---

## 16. Relationships & flow — two connector tiers

Objects in a system **relate**; if they merely coexist, the visual is a still-life, not a system.
Show the relationships — and distinguish two tiers, because collapsing them is why output connectors
read as weak:

- **Tier 1 — structural hairline connectors.** Thin, subtle lines for **dependencies, links,
  containment, and adjacency** — the quiet wiring among modules, nodes, and layers. Functional, never
  decorative; keep them light. This is the default and the majority.
- **Tier 2 — narrative flow.** A **prominent, sweeping path** (often curved) with a clear arrowhead,
  carrying the **main story** — orchestration, the dominant data/process flow, "this feeds that."
  These are *meant to be seen*: heavier weight, a deliberate sweep across the composition, a small
  number of them (one to three). This tier is the explicit exception to "connectors stay subtle"
  (§25): the orchestration arc is a primary narrative element, not ornament — but it must encode a
  real, dominant flow, and it stays a clean line/ribbon, never a glowing or rendered tube.

**Routing & the backbone (a styling of either tier).** A connector may be drawn as a **routed path** —
an orthogonal run with **rounded corners** that travels *through the composition's negative space*
rather than cutting straight across it, like the wiring on a technical drawing. Routed structural
hairlines reading as a shared **backbone / bus** — periphery wired back to a core — are a clean way to
connect a distributed ecosystem (§18) without clutter: they weave through the open canvas, stay **quiet
and hairline**, and **colour-pair** to whatever they connect (§21). Routing is only a *styling of a real
connection* — never decorative pipework, and never a glowing tube (§25).

Every connector — both tiers — must represent something real (§24). Relationship **density** matters:
a hero shows the system actually wired together (see §11), not a few isolated objects.

---

## 17. Spatial structures (families)

A family is the **overall arrangement**; it does not decide what each area *is*. Fill every area with a
**recognizable representation from §4**, and keep adjacent areas distinct (Layer Identity, §5) — a
family is a skeleton, not a licence to repeat one shape. Only the following arrangements are approved.
Each entry: *purpose · pattern · density & detail signature (what a high-fidelity version contains).*

**Layer stack.** Hierarchy through stacked layers. *Pattern:* **exploded floating layers**, highest
abstraction to lowest, aligned by droplines. *Signature:* each layer is a *different* populated
sub-system (a console, a board, a network, datastores, a fabric) — never identical slabs.

**Modular system.** Independent, composable components. *Pattern:* **connected spatial objects on a
shared ground.** *Signature:* each module a *distinct* sub-system; a focal core; hairline links; a
ground grid. No two modules identical.

**Process system.** Flow. *Pattern:* a **spatial sequence** — input → process → output across the iso
plane, with arrowed connectors. *Signature:* each step a populated stage; the transforming step focal.

**Framework system.** Conceptual groupings. *Pattern:* a **structured spatial composition** — a
balanced grid of equal-elevation planes (peers), connector-free, on a faint cell grid. *Signature:*
each plane carries *distinct* capability detail so peers don't read as generic pillar cards.

**Ecosystem system.** Relationships among many entities. *Pattern:* a **distributed spatial network
around a core.** *Signature:* a focal hub wired by hub-spoke relations to a cloud of **varied** entities
(sized by importance), on a ground grid, with peer links among the majors.

---

## 18. Composition pattern library

Reusable composition archetypes — the recurring shapes premium references use. Choose one to fit the
content; each defines *purpose · layout logic · required elements · optional elements · density.*

- **Exploded architecture stack** — *show a layered platform top-to-bottom.* Layers floated apart
  along the vertical, aligned by droplines, labelled on a rail. *Required:* distinct populated layers,
  droplines, indexed rail. *Optional:* a floating console above, narrative flow ribbons to lower
  layers. *Density:* L3–L4.
- **Platform surface** — *one platform as the stage.* A single broad plane richly populated with a
  board/console, other objects sitting on or above it. *Required:* a populated surface, scale
  hierarchy. *Optional:* ground grid, satellites. *Density:* L2–L4.
- **System pipeline** — *an end-to-end flow.* Stages along the iso-X axis, arrowed, the transforming
  stage focal. *Required:* populated stages, directional connectors. *Optional:* a shared ground.
  *Density:* L2–L3.
- **Data fabric** — *throughput / a data plane.* A finely woven grid-mesh surface with access points
  on it. *Required:* the woven texture (line segments, not a pattern), a few articulated nodes.
  *Optional:* flow into/out of it. *Density:* L2–L3.
- **System mesh (network)** — *a network or model layer.* An irregular node-graph with hub nodes.
  *Required:* organic (non-lattice) node placement, links, hubs sized up. *Optional:* a carrying
  plane. *Density:* L2–L4.
- **Capability matrix** — *peer capabilities / a framework.* A regular grid of equal-elevation planes,
  connector-free, each with distinct detail. *Required:* a peer grid, distinct per-plane content,
  cell grid. *Optional:* one focal capability. *Density:* L3.
- **Ecosystem cluster** — *many entities around a core.* A focal hub, hub-spoke relations, a cloud of
  varied volumes on a ground grid. *Required:* focal core, varied entities, relations, ground grid.
  *Optional:* peer links, labelled majors. *Density:* L3–L4.
- **Ecosystem frame** — *the whole canvas as one system.* A focal hero (often a tiered core, §13) at the
  centre, **wrapped by a ring of varied peripheral modules** placed near the canvas edges and corners and
  **wired back to the core by routed backbones** (§16), over a faint ground grid. *Required:* a focal
  core, a peripheral module ring (each its own identity / accent family, §21), routed paths, ground grid,
  generous negative space (§6). *Optional:* a floating focal highlight above the core (§13), on-core
  control sub-modules. *Density:* L3–L4. Distinct from *Ecosystem cluster* (entities orbiting a hub on
  one plane): here the periphery sits at the frame's edges and the **routes spanning the open canvas are
  themselves a primary element**, not incidental wiring.

Archetypes compose: a hero often nests several (a stack whose top layer is a console, whose model
layer is a mesh, sitting above a data fabric, feeding an ecosystem cloud).

**The canvas is the system — budget the whole page, not just the hero.** The strongest references are
not a centred object floating in empty space; the *entire canvas behaves as one system*, and the
surrounding ecosystem, the routes, and the grid carry as much of the composition as the focal object. As
a planning guide (not a quota): roughly **~40% focal hero · ~30% connected ecosystem (peripheral
modules) · ~20% interface sub-modules on the hero · ~10% technical ground grid**, with generous negative
space throughout (§6). The common failure is a dominant hero marooned in blank space; the fix is to
**compose the periphery and the routing with the same care as the core** — they are not background.

---

## 19. Complexity, layout & narrative

**Match density to the system's true complexity (§10) — do not minimise by reflex.** Earlier guidance
to "step down to the simplest composition" is wrong for a hero: it produces the empty-plane failure.
The correct instinct is **fidelity**: render what is genuinely there, at the fidelity level the
context wants (§11), using the page **width first, height second.**

| Real complexity | Primary objects | Composition & fidelity |
|---|---|---|
| **Low** (genuinely simple) | 3–4 | compact stack / single platform · L1–L2 · carried by articulation, not padding |
| **Medium** | 4–8 | layered or modular composition · L2–L3 |
| **High** | 8+ | distributed / ecosystem / deep stack · L3–L4 |

Two failure directions, both real: **overcrowding** (illegible noise — richness that doesn't resolve,
§20) and **under-building** (empty planes, the more common failure here). Aim for *dense and legible*.
A genuinely simple system stays simple (honest exception, §10) — but it is realised richly, never left
bare.

**Narrative is a requirement, not a nicety.** A reader should be able to look at the visual and
explain the system's story — *what flows where, what depends on what, what transforms into what, what
sits above what.* Encode it with elevation/scale (§13), the two connector tiers (§16), reading order
(input→output, top→bottom), and a focal emphasis (§21). If the composition answers none of those
questions, it is displaying objects, not communicating a system.

---

## 20. Multi-scale richness

A hero must **reward inspection at four reading distances.** This is the test that catches
under-building: a visual that says everything at thumbnail size and nothing on closer reading is too
thin.

- **Thumbnail** — the **overall system** is legible: the family, the focal point, the broad shape.
- **Composition** — the **major sub-systems** are identifiable: which plane is which, the flow.
- **Module** — the **sub-systems resolve**: a board's modules, a network's nodes, a console's panels.
- **Detail** — **per-object articulation** appears: title bars, content lines, labels, hub nodes,
  varied volumes.

Build downward through these levels (§9 articulation, §12 plane architecture) until each is satisfied.
If a plane goes blank at module or detail scale, it is under-built — return to §10. Match the number of
levels to the fidelity target (§11): L4 satisfies all four.

---

## 21. Colour & emphasis *(this system's own stance — state it loudly)*

Spatial visuals **inherit the system's existing colour language** and add no palette of their own —
the soft-clay tonal surfaces, the brand accent, and the **secondary accent families** the rest of the
collateral already uses for encoding. **Multi-colour is sanctioned, but only as encoding — never as
decoration.** Four rules:

- **Multi-colour ENCODES identity; it is not ornament.** When a visual shows several distinct things —
  data formats, services, entity types, parallel tracks — give each its **own accent family** so colour
  *carries meaning* (API, JSON, CSV are not three blues). This is the existing collateral mechanism
  applied here: the secondary **accent families** (apply one per entity), each contributing a light
  *surface* and a saturated *accent*. A spatial visual is **not** required to be one accent — a
  monotonous single-accent scene is the failure this corrects.
- **Colour-pair the mark with its meaning.** Where colour encodes identity, the object, its label, and
  its connector **share the exact same family** — the blue source has a blue label and a blue flow into
  the engine. This is the established data-viz colour-pairing rule; without it, multi-colour becomes
  noise. (When colour does *not* encode identity — a single-series object — keep its label the
  system's neutral legible ink, §below.)
- **A single tone is the simple subset.** Not every visual has multiple identities. A single-concept
  scene (one security system, one platform) legitimately uses **one accent** with everything else
  neutral — the old "one selective highlight" is now just the *n = 1* case of encoding, not a mandate.
  Either way, *density is not emphasis*: a plane can be richly detailed and still neutral.
- **Navy / dark surfaces are allowed**, and a **quiet, same-hue accent gradient** is sanctioned on a
  focal element (a restrained two-value gradient of *that element's* accent, to lift it off the
  ground). *(Both follow the diagrams-system lineage but are specific to this system — the same-hue
  gradient does not carry across to flat diagrams or the wider collateral, which stay flat.)* Dark is
  *optional, not required for premium.*

**Hard "no": holographic / iridescent / rainbow-as-decoration.** Multi-colour that *encodes* is
required; multi-colour for its own sake — the oil-slick "active layer" sheen, a gradient that shifts
hue, colour sprinkled with no referent — is the **marketing-illustration aesthetic this system bans**
(§2, §25). The test is simple: every colour must answer *"what does this colour mean?"*

**Type stays legible.** Labels, annotations, eyebrows, and captions keep the system's readable ink —
dark on light grounds, light on dark grounds — never absorbed into the illustration.

---

## 22. Annotation system

Spatial visuals **should not stand alone** — annotation is encouraged, and always **secondary to the
visual.** Approved: **labels, descriptions, callouts, capability names, layer names, index numbers**,
attached with **leader lines** or aligned to a **bracket rail** (§15). For a hero, a sequenced,
indexed rail with brief per-item detail (a short bullet list) is the editorial finish that makes the
plate read as a documented system. Keep annotation copy concise — if an object needs a paragraph, the
information probably belongs in prose, not on the illustration.

---

## 23. Offscript integration

Spatial visuals **inherit the surrounding collateral** and must never feel visually disconnected from
the page. Every spatial visual takes the system's existing **typography scale, colour tokens, border,
radius, spacing, grid, and icon** language.

Spatial visuals must **not introduce** a separate visual language, colour system, spacing system, or
type style. A spatial visual is a **specialized extension of the design system — not a standalone
illustration framework.** When a choice isn't covered here, defer to how the rest of the collateral
already does it.

---

## 24. Integrity

**Represent only structures and relationships that actually exist.** A spatial visual asserts
structure forcefully — a reader takes a drawn layer, containment, connector, or elevation as a claim
about how the system really is. So never:

- Invent layers, modules, stages, or entities that aren't real.
- Fabricate dependencies, flows, containments, or boundaries.
- Use **elevation or scale to imply a hierarchy the content doesn't support.**
- Inflate a structure to fill space — a three-layer system is not a five-layer stack.
- **Mis-represent meaning (the semantic-accuracy rule for §3/§4).** The representation must match the
  thing's *true function*: don't dress a routine store as a "command centre," or a single service as a
  sprawling ecosystem, for visual drama. Meaning-first is a discipline, not a licence — the
  recognition-test answer (§3) must be *what it really is*. A metaphor object must encode a real
  feature (a drawn lock = a real security control), never decoration.

**Density and integrity are two sides of one rule.** §10 says *render the real system fully*; §24 says
*render only the real system.* Together: **resolve the true structure to its real depth, and stop
there.** Richness comes from articulating what exists (§9), never from inventing parts to hit a count
(§11). When in doubt, drop the detail rather than invent the structure it implies.

**Labelling stance.** In real collateral, every label comes from real content. In a specimen or
template built before the content exists, plausible labels are allowed but must be **flagged
illustrative** — and even then, the *structure* (the number of parts, their relationships) should be
representative, not padded.

If illustrative or placeholder structure is used while building a specimen, **mark it clearly as
illustrative.** Trustworthiness outranks completeness: a smaller honest visual beats a padded one.

**Iconographic representation is sanctioned (this reverses the old ban).** The concept vocabulary of
§4 — shields, padlocks, keys, server-stacks, gears, eyes, screens, format cards, hubs, towers — is
**explicitly in scope.** These are *recognizable metaphor objects*, built from the kit (§9) at the
fixed angle, drawn in the system's own line / flat-fill icon language (§23). They are the answer to
"not just cubes," and a hero is *expected* to reach for them. Guardrails: each must encode something
real (the semantic-accuracy rule above); use the **system's own icon language, not third-party brand
logos**; and hold every style ban (§25).

**The fidelity ceiling — what is still out.** The system reproduces **structural and iconographic
detail** — populated boards, consoles, networks, fabrics, metaphor objects, volume clusters, ground
grids, drafting marks, flow ribbons — all in static, print-safe SVG; this is **most of what a polished
reference illustration contains.** What it does **not** do is **bespoke *organic* illustration** (a
one-off robot arm, a hand-drawn figure, a literal scene) or **photoreal / refraction / holographic
shading** — that is freehand illustration, not this system (§25). When a reference shows those,
**reproduce its structure and recognizable objects, and drop only the organic / photoreal flourish**:
the gap is the flourish, not the system. (The earlier sense that the system "could only do cuboids"
was under-building plus an over-broad ban — both now corrected, §3, §10.)

---

## 25. Visual style principles

The spatial language should feel **technical · editorial · structured · deliberate · Swiss-inspired ·
publication-quality** — and, for a hero, **information-rich** (§2: "minimal" is about *ink*, not
*information*).

**Hard "no"s**

- **No realistic rendering, product-render, cartoon, or gaming aesthetics.**
- **No marketing-illustration aesthetics** — including holographic / iridescent fills (§21).
- **No heavy shadows. No glows. No thick 3D forms.** Depth stays subtle (§13).

Structure is carried by **the projection, the planes, hairline edges, elevation, scale, the drafting
layer, and the system's type** — not by ornament. A structural connector is a thin functional line; a
narrative flow ribbon (§16) is a deliberate clean sweep; a plane is a clean, *populated* surface. If a
flourish doesn't help the reader understand the system, it doesn't belong — but genuine structural
detail always helps and always belongs.

---

## 26. Pre-flight checklist

Before shipping any spatial visualization:

- [ ] **Passes the Recognition Test** (§3) — labels mentally removed, every area reads as *what it is*
      (workflow board / knowledge network / data fabric / secure gateway / ecosystem), **never** as a
      cube / cylinder / card / generic plane. This is the gate; if it fails, return to §3.
- [ ] **Built meaning-first** (§3, §4) — you chose the concept → representation → signature before
      reaching for geometry; the representation comes from the §4 vocabulary, not a default cube+icon.
- [ ] **Distinct identities** (§5) — no two adjacent areas share a representation or object vocabulary;
      each is recognizable label-off. No single motif repeated as placeholder texture.
- [ ] **In scope** (§1) — it shows a *system or concept* in space; it isn't a chart, and it isn't a
      job a flat diagram or a sentence does more clearly.
- [ ] **Earns the treatment** (§1, §2) — the content is a genuine system **and** the context wants an
      editorial/hero illustration; you didn't reach for isometric to decorate.
- [ ] **Placed as a hero, not inline** (§1) — it commands the page; not shrunk into a figure slot or
      repeated down the page. If it wanted to be inline, it should have been a flat diagram.
- [ ] **Fidelity level set** (§10, §11) — you chose Basic/Structured/Advanced/Editorial-Hero from the
      system's real complexity **and** the page's ambition, and hit its density.
- [ ] **No empty planes** (§12) — every populated plane reads as a real sub-system (board / console /
      network / cluster / fabric); no large surface carries just an icon or a few shapes.
- [ ] **Articulated, not uniform** (§9, §12) — objects are varied and internally articulated; **no
      field of identical blank chips** standing in for architecture.
- [ ] **Density = fidelity, not padding** (§10, §24) — every drawn part is real; nothing invented to
      fill space; a genuinely simple system stayed simple but fully realised.
- [ ] **Hierarchy on three levers** (§13) — elevation **and** scale **and** density carry importance;
      not everything the same size and weight.
- [ ] **Grounded & sequenced** (§15) — a drafting layer (ground grid / droplines / registration /
      indexed rail) anchors the scene; it doesn't float in a void.
- [ ] **Relationships shown, two tiers** (§16) — structural hairlines wire the system; a narrative
      flow carries the main story where there is one.
- [ ] **Right structure & archetype** (§17, §18) — family and composition pattern chosen from the
      content, not from visual preference.
- [ ] **Reads at every scale** (§20) — informative at thumbnail, composition, module, and detail; no
      plane goes blank on closer reading.
- [ ] **Fixed projection** (§7) — one locked angle, including inside every plane; no rotation/orbit.
- [ ] **Render-safe** (§8) — SVG-baked geometry (or CSS 2D transforms); **no real 3D, no canvas, no
      WebGL, no JavaScript, no tiled fill patterns**; stable under print / PDF / resize.
- [ ] **Within A4 margins** (§6) — uses width, respects the 16mm margins and grid, no needless height.
- [ ] **Colour encodes, never decorates** (§21) — multi-colour where there are multiple identities
      (each its own accent family, mark colour-paired with label & connector); a single tone where
      there is one concept; the same-hue focal gradient restrained; **no holographic / iridescent /
      rainbow-as-decoration.**
- [ ] **Native styling** (§23, §25) — inherits the system's type / colour / spacing / grid / icons; no
      new visual language; no realistic-render / cartoon / heavy shadow / glow / thick-3D look.
- [ ] **Honest** (§24) — every layer, module, connector, scale, and elevation is real; placeholders
      flagged; nothing bespoke-organic or photoreal.

---

## 27. Core principle

**A spatial visual is not mandatory.** First decide whether a system genuinely needs to be *drawn in
space* at all — if text, a table, a chart, or a flat diagram communicates it more clearly, prefer
that.

When a spatial visual is warranted, **start with the meaning** (§3): name the concept, choose its
recognizable representation (§4), build that representation's signature, and only then render it in the
**one consistent isometric language** — at the system's **true complexity and full fidelity**,
populated, grounded, engineered, multi-colour where colour encodes identity, fully aligned with the
collateral design system and compatible with HTML, SVG, PDF, and print. Geometry is how it is drawn,
never what it is.

> **The goal is not 3D graphics, and it is not minimalism for its own sake. The goal is a clear,
> elegant, publication-quality spatial representation of a *concept or system* that the reader
> recognizes **before** they notice the geometry used to build it. Restraint of ink and effect;
> generosity of structure and meaning. Meaning before geometry — the concept determines the
> representation, the representation determines the visual, and the content determines all of it,
> never the reverse.**
