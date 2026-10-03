# Diagrams & Structured-Visualization Rulebook

A standalone reference for designing and building **diagrams** and **structured visualizations** in the
collateral design system. Consult it **whenever you create one, or choose which one to use.** Its job is
to keep every diagram **editorial, clear, and native** to the collateral language — a content component
that explains a relationship, never a decorative graphic bolted on.

This rulebook governs two communication systems that often get conflated:

- **Relationship-focused diagrams** answer **"How does this work?"** — they explain relationships,
  processes, systems, transformations, hierarchies, dependencies, and flows.
- **Structured visualizations** answer **"How is this information structured?"** — they organize plans,
  timelines, schedules, prioritization, categorization, and assessments.

This rulebook is self-contained. It states *principles and rules*, not implementations. Bring your own
markup; bring these decisions.

---

## How to use this rulebook

Read it top-to-bottom once. After that, jump to what you need:

1. **Is it in scope — a diagram at all, not a chart or a sentence?** → §1, §2
2. **Hold the philosophy + priority order.** → §2
3. **Remember you're designing for A4, not an infinite canvas.** → §3
4. **Know what you're allowed to render with.** → §4
5. **Does the content justify a diagram, and which family?** → §7 → §5 → §8 / §9 *(this is the core decision — do it before you draw anything)*
6. **Choose orientation from the content, not the type.** → §6
7. **Apply node, connector, integration, and style rules.** → §10, §11, §12
8. **Keep it honest, then run the pre-flight checklist.** → §13, §14
9. **When in doubt, re-read the closing principle.** → §15

---

## 1. Scope — two systems & the boundary with charts

This rulebook covers **diagrams and structured visualizations** — and only those.

**System A — Relationship-focused diagrams.** Used to *explain.* They answer **"How does this work?"**
and communicate:

- Relationships · Processes · Systems · Transformations · Hierarchies · Dependencies · Flows

**System B — Structured visualizations.** Used to *organize.* They answer **"How is this information
structured?"** and communicate:

- Plans · Timelines · Schedules · Prioritization · Categorization · Assessments

**Out of scope** *(belongs to a different system — do not build it here)*

- **Quantitative charts and metric visualizations.** Anything whose point is a *quantity's magnitude* —
  a bar's length, a line's trend, a wedge's share, a single highlighted number — is a **separate charts
  system.** Do not draw a bar / line / donut chart under this rulebook, and do not stretch a diagram into
  one.
- **Decorative or illustrative graphics** that carry no informational relationship.
- **Infinite-canvas artwork** designed for whiteboard tools rather than a printed page (see §3).

If a request is really about *how big* a value is, it's a chart, not a diagram — stop and treat it as the
other system.

---

## 2. Core philosophy & priority order

**Diagrams are not illustrations. Diagrams are not decorative graphics. Diagrams are not visual
fillers.** Every diagram must communicate a **specific informational relationship.** If the same
information reads more clearly as **text, a table, a chart, or a single metric**, use that instead — the
purpose of a diagram is **clarity, not decoration.**

A diagram should feel **native** to the collateral system — as if it were typeset alongside the prose,
not pasted in from a slide tool.

**The visual language must be:** editorial · structured · deliberate · minimal · Swiss-inspired ·
print-friendly · publication-quality.

**The system must avoid:** SmartArt aesthetics · PowerPoint aesthetics · dashboard aesthetics ·
decorative illustration · heavy shadows · gradients · glows · 3D effects. *(The detailed style rules are
in §12.)*

**Priority order** — when these pull against each other, the earlier one wins:

1. **Clarity** — the relationship the reader should grasp.
2. **Structural fit** — the diagram family genuinely matches the *structure* of the information (§7).
3. **Visual harmony** — it sits naturally in the page, in the system's language.
4. **Density** — how much is shown at once.

Density is last on purpose. A diagram that lands **one** relationship cleanly beats a crowded one that
buries five.

---

## 3. Collateral-first constraint

This system generates **A4 collateral.** Every diagram must be optimised for:

- **A4 portrait layout** · **print export** · **PDF export** · **HTML rendering.**

Every diagram decision must weigh:

- Available **page width** · available **page height** · **content density** · **reading flow.**

**Do not design as if for an infinite canvas.** Whiteboard and slide tools — Miro, FigJam, Whimsical,
Lucidchart, PowerPoint — assume unlimited space and free placement; a printed A4 page does not. A diagram
that only works when you can pan and zoom is the wrong diagram here.

---

## 4. Rendering architecture

Diagrams must be **renderable as static markup** that survives export and reflow.

**Preferred**

- Semantic HTML · **CSS Grid** · **Flexbox.**

**Allowed — lightweight SVG, only when the geometry genuinely requires it**

- Venn diagrams · flywheels · hub & spoke. *(Circles, arcs, and true overlaps can't be expressed in
  flow / grid layout — SVG earns its place there.)*

**Avoid**

- Absolute positioning · pixel-based placement · `<canvas>` · JavaScript rendering.

The diagram must stay **stable** during **PDF export, print export, page resizing, and content updates.**
If a layout only holds at one exact pixel width, it is not collateral-ready. The structure should *be* the
markup — a box is an element, an order is document order — so a static page renders it in any browser with
no scripts.

---

## 5. Complexity levels

Three levels, by how much relational structure the content actually carries. **Always prefer the lowest
level that communicates the relationship** — reach upward only when the content genuinely demands it.

| Level | Kind | Examples |
|------|------|----------|
| **1 — Simple relationship** | one clear relationship | Process · Timeline · Framework · Comparison |
| **2 — Structured system** | additional internal structure | Operating Model · Architecture · Maturity Model · Gantt |
| **3 — Complex relationship** | many interdependencies | Ecosystem · Flywheel · Venn · Hub & Spoke |

A Level-3 form used for Level-1 content reads as visual complexity for its own sake. Step **down** the
levels before you step up.

---

## 6. Layout intelligence & width utilization

**Orientation is never chosen from the diagram type alone.** Before fixing an orientation, evaluate:

- **Node count** · **content length** · **relationship count** · **available width** · **available
  height.**

Then choose:

- **Horizontal — the default.** Attempt it first. Use when **node count ≤ 4**, content is short, and it
  comfortably fits the available width.
- **Grid — the crowding fallback.** Use when **node count is ~4–8** and content stays short but a single
  horizontal row becomes crowded. Prefer a grid over an unnecessarily long vertical diagram.
- **Vertical — the last resort.** Use only when **hierarchy** or **chronology** is essential, content is
  **lengthy**, or **density needs the extra height.**

**Width utilization.** Use the page **width first, height second.** A4 width is a valuable resource — fill
it whenever clarity allows. Avoid a narrow diagram stranded in a slot of the page, and avoid a long
vertical flow that could have run horizontally.

---

## 7. Selection logic — structure determines the family

**Select the family from the *structure* of the information, never from visual preference.** The content
determines the diagram; the diagram never determines the content.

| The information is… | Use |
|---------------------|-----|
| Sequential steps | **Process** |
| Milestones over time | **Timeline** |
| A transformation / before→through→after experience | **Journey** |
| Conceptual pillars | **Framework** |
| Inputs → capabilities → outputs | **Operating Model** |
| A layered system | **Architecture** |
| Entities around a core | **Ecosystem** |
| Two states contrasted | **Comparison** |
| Progression through stages | **Maturity Model** |
| A centre with dependents | **Hub & Spoke** |
| A self-reinforcing cycle | **Flywheel** |
| Overlap / intersection of sets | **Venn** |
| A schedule with durations | **Gantt** *(structured viz, §9)* |
| Planned progression | **Roadmap** *(structured viz, §9)* |
| Classification on two axes | **Matrix** *(structured viz, §9)* |
| Positioning on two axes | **Quadrant** *(structured viz, §9)* |

When more than one family fits, prefer the **lower complexity level** (§5) and the **simpler** form.

---

## 8. Relationship-diagram families

Only the following families are approved. Each entry: *purpose · structure · layout · limits.*

### Process — *Level 1*
- **Purpose:** show sequential progression (workflows, processes, service flows, automation flows).
- **Structure:** `Step → Step → Step`.
- **Layout:** horizontal preferred; grid as fallback; vertical as last resort.
- **Recommended:** **3–8 steps.**

### Timeline — *Level 1*
- **Purpose:** show chronological progression (roadmaps, milestones, plans).
- **Layout:** horizontal **up to 6 milestones**; switch to a **vertical timeline at 7+.**

### Journey — *Level 1*
- **Purpose:** show transformation (customer journey, learning journey, transformation journey).
- **Layout:** horizontal preferred; grid as fallback.

### Framework — *Level 1*
- **Purpose:** show conceptual pillars (strategic pillars, core principles, capability models).
- **Layout:** horizontal pillars for **3–5**; grid for **6+.**

### Operating Model — *Level 2*
- **Purpose:** show how a system operates.
- **Structure:** `Inputs → Capabilities → Outputs`.
- **Layout:** vertical; **maximum 3 major layers.**

### Architecture — *Level 2*
- **Purpose:** show layered systems (technology stack, platform architecture).
- **Layout:** a **layered vertical stack.** **Never** free-form node placement.

### Ecosystem — *Level 3*
- **Purpose:** show relationships between entities.
- **Layout:** centred — a **core entity surrounded by related entities.**

### Comparison — *Level 1*
- **Purpose:** show differences (before vs after, manual vs automated, traditional vs modern).
- **Layout:** horizontal, with **symmetrical columns. Never use a vertical comparison.**

### Maturity Model — *Level 2*
- **Purpose:** show progression stages (capability maturity, digital maturity).
- **Layout:** **linear progression; maximum 5 levels.**

### Hub & Spoke — *Level 3*
- **Purpose:** show central relationships.
- **Layout:** a **central hub** with **evenly distributed outer nodes.** *SVG permitted.*

### Flywheel — *Level 3*
- **Purpose:** show reinforcing cycles.
- **Layout:** **circular; maximum 6 stages.** *SVG permitted.*

### Venn — *Level 3*
- **Purpose:** show overlap and intersection.
- **Rules:** **maximum 3 circles**; keep **labels outside the overlap regions** whenever possible.
  *SVG required.*

---

## 9. Structured-visualization families

**These are not diagrams** — they organize information rather than explain a relationship — and are
treated separately. Each names a required implementation approach.

### Gantt
- **Purpose:** show schedules and durations.
- **Build with:** an **HTML table + CSS bars.** **Never** SVG, **never** canvas, **never** absolute
  positioning.

### Roadmap
- **Purpose:** show planned progression.
- **Build with:** a **timeline / milestone-based** structure.

### Matrix
- **Purpose:** show classification (prioritization matrix, capability matrix).
- **Build with:** **CSS Grid**, fixed rows and columns.

### Quadrant
- **Purpose:** show positioning (impact vs effort, risk vs value).
- **Build with:** a **grid-based quadrant** layout. **Labels must always stay visible.**

---

## 10. Nodes, icons & connectors

Every diagram is built from **nodes** and **connectors** — and nothing else needs inventing.

**Node structure.** A node may carry a **label**, optional **supporting text**, and an optional **icon.**
Keep nodes **concise** — avoid long paragraphs, excessive copy, and dense content blocks. If a node needs
a paragraph, the information probably belongs in prose, not a node.

**Icons.** Icons are allowed and must come from the **existing offscript icon library** and follow its
visual language. They stay **secondary to the content** — they **support comprehension, never decorate.**
*(Render them as static markup; nothing in a diagram should depend on a script — §4.)*

**Connectors.** A connector represents a **relationship — nothing else.** Allowed kinds: **directional,
bidirectional, hierarchical.** Avoid **decorative arrows, complex connector styling, and visual
embellishment.** Connectors stay **subtle and functional.**

---

## 11. Offscript integration

Diagrams **inherit the surrounding collateral** and must never feel visually disconnected from the page
around them. Every diagram takes the system's existing **typography, spacing, grid, colour, border,
radius, and icon** language.

Diagrams must **not introduce** a new design language, a new colour system, a new spacing system, or a new
typography style. A diagram is a **content component within the collateral system — not a standalone
visual system.** When a choice isn't covered here, defer to how the rest of the collateral already does
it.

---

## 12. Visual style principles

The diagram language should feel **editorial · structured · deliberate · minimal · Swiss-inspired ·
print-friendly · publication-quality.**

**Hard "no"s**

- **No SmartArt, PowerPoint, or dashboard aesthetics.**
- **No decorative illustration** — nothing on the page that doesn't encode a relationship.
- **No heavy shadows. No gradients. No glows. No 3D effects.**

Structure is carried by **the layout, hairline rules, and the system's type** — not by ornament. A
connector is a thin functional line; a node is a clean block. If a visual flourish doesn't help the reader
understand the relationship, it doesn't belong.

---

## 13. Integrity

**Represent only relationships that actually exist.** A diagram asserts structure forcefully — a reader
takes a drawn arrow, stage, or overlap as a claim about how things really relate. So never:

- Invent steps, stages, or phases that aren't real.
- Fabricate dependencies, flows, or hierarchies.
- Imply a sequence, a maturity progression, or an overlap the content doesn't support.
- Inflate a structure to fill space — a three-pillar idea is not a five-pillar framework.

If illustrative or placeholder structure is used while building a specimen, **mark it clearly as
illustrative.** Trustworthiness outranks completeness: a smaller honest diagram beats a padded one.

---

## 14. Pre-flight checklist

Before shipping any diagram or structured visualization:

- [ ] **In scope** (§1) — it explains a relationship or organizes a structure; it isn't a quantitative
      chart, and it isn't something a sentence or table says better.
- [ ] **Justified** (§2) — the diagram earns its place; the information genuinely reads more clearly drawn
      than written.
- [ ] **Right family for the structure** (§7) — chosen from the content, not from visual preference.
- [ ] **Lowest workable complexity level** (§5) — you stepped down before stepping up.
- [ ] **Orientation chosen from the content** (§6) — node count / length / width evaluated; horizontal
      attempted first; width used before height.
- [ ] **Within the family's limits** (§8, §9) — step / milestone / pillar / level / circle counts
      respected.
- [ ] **Render-safe** (§4) — semantic HTML + Grid / Flex; SVG only where geometry requires it; no absolute
      positioning, canvas, or JavaScript; stable under print / PDF / resize.
- [ ] **Native styling** (§11, §12) — inherits the system's type / spacing / grid / colour / icons; no new
      language; no SmartArt / dashboard look, heavy shadows, gradients, glows, or 3D.
- [ ] **Nodes concise, connectors subtle** (§10) — no paragraphs in nodes; connectors functional, not
      decorative.
- [ ] **Honest** (§13) — every step, stage, dependency, and overlap is real; placeholders flagged.

---

## 15. Core principle

**A diagram is not mandatory.** First decide whether a relationship genuinely needs to be *drawn* at all —
if text, a table, or a chart communicates it more clearly, prefer that.

When a diagram is warranted, choose the **simplest** form that communicates the relationship clearly, in
the **minimum** visual structure necessary, fully aligned with the collateral design system.

> **Clarity over complexity. Structure over decoration. The content determines the diagram — the diagram
> never determines the content.**
