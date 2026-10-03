# Spatial Build Brief *(fill this in before drawing a spatial hero)*

The **runtime companion** to `README-SPATIAL.md`. The rulebook is the *governance* (the rules) and its
§26 pre-flight is the *verify gate*. This file is the missing middle: the **generative spec you complete
before you build**, so the visual is fully specified going in — not improvised and patched.

**Why a brief at all.** The highest-definition reference illustrations are "highly defined" because their
*input* was fully defined — an exhaustive spec that fixes every dimension and leaves nothing to default.
A spatial hero earns the page (Rulebook §1); a five-minute brief is what makes it land the first time.
**Rule: no spatial hero ships without a filled brief.** Supporting/in-deck spatials can fill the short
form (Concept → Canvas budget → Per-area table → Pre-flight).

**This brief does not restate rules.** Every field points to the Rulebook section that governs it. When a
field and the rulebook ever disagree, the **rulebook wins** (it is the SSOT). Fill the answers here; read
the rules there.

---

## The divergence guard — read before filling

Most "premium isometric" references on the web are **product-render marketing illustrations** (a brand
palette, drop-shadows, glow halos, glossy-plastic material, AI-raster generation). **We are a technical
drawing**, not a product render. Take their *composition intelligence*; drop their *surface treatment*.
**Never carried over** (Rulebook §21, §25):

- ✗ a borrowed **brand palette** → we encode with navy / soft-clay / accent **families** (§21).
- ✗ **contact / drop shadows** → depth comes from **elevation + droplines** (§13, §15).
- ✗ a **glow / halo** on the floating element → use the sanctioned **same-hue accent gradient** (§21).
- ✗ **glossy-plastic / metal material** → flat, hairline, Swiss (§25). Take the *modularity*, not the plastic.
- ✗ **animation / JS / 3D engine** → static, print-safe SVG, baked iso angle (§7, §8).

If a field below would only be satisfiable with one of these, the answer is wrong — re-read the §.

---

## The brief — fill every field

**1 · Concept & recognition target** *(Rulebook §3, §4)*
- What is this, in one expert sentence? →
- Labels-off **Recognition-Test answer** — what must a viewer say it is? (must be a *system/representation*,
  never "a cube/cylinder/stack") →

**2 · Canvas budget** *(the whole canvas is the system — §18; A4 width-first — §6)*
Budget the canvas, not just the hero. The surrounding ecosystem + routes + grid are ~60% of the work.
- Hero / focal core (~40%) →
- Connected ecosystem — peripheral modules (~30%) →
- Interface / sub-modules on the hero (~20%) →
- Technical ground grid (~10%) →
- Negative-space note (generous breathing room; **no element touches another** — §6) →

**3 · Per-area representation → signature** *(§4; Layer Identity — §5, no two areas alike)*

| Area | Represent as | Signature marks (§4) | Accent family (§21) |
|---|---|---|---|
| (hero) | | | |
| (each ecosystem module) | | | |
| (each sub-module) | | | |

**4 · Hero tier plan** *(elevation stack — §13)*
List the vertical tiers, bottom → top: foundation platform · on-core sub-modules · primary structure ·
elevated feature · **floating focal highlight** (activity/intelligence; lifted by dropline + same-hue
gradient, **no glow**). →

**5 · Ecosystem inventory** *(periphery as co-equal frame — §18)*
Each peripheral module: what it is · its glyph/metaphor object (§4, §24) · its placement (corner/edge,
non-contact) · its accent family. →

**6 · Pathway plan** *(two connector tiers + routed backbone — §16)*
- **Routed backbone(s)** core↔periphery (orthogonal, rounded-corner, hairline; encodes a real bus) →
- **Structural hairlines** (dependencies/adjacency) →
- **Narrative flow** (≤3 prominent sweeps, only if there is a dominant flow) →
- **Colour-pairing check** — every route shares its module's family (§21) →

**7 · Colour-encoding map** *(§21 — colour ENCODES identity, never decorates)*
- One family per distinct identity (mark ↔ label ↔ connector paired) →
- Single tone where there is one concept (the n=1 case) →
- Confirm: **no holographic / iridescent / rainbow-as-decoration**; every colour answers "what does it mean?" →

**8 · Fidelity + density** *(§10–§12, ladder §11)*
- Fidelity level (Basic / Structured / Advanced / **Editorial-Hero**) and why →
- Density quota per populated plane (≈½–¾ real content; **no empty planes**, **no identical blank chips**) →
- Integrity: every part real — nothing invented to fill space (§24) →

**9 · Drafting layer** *(§15)*
Ground grid · droplines · registration marks · indexed/annotation rail — which apply →

**10 · Surface & render** *(§8, §14, §23)*
- Surface style (wireframe / outlined / filled-accent) →
- Light **and** navy variant? (§21) →
- Render-safety: SVG baked at the fixed angle, **no JS / pattern / preserve-3d / canvas** (§8) →

**11 · Divergence guard confirm** — none of the five product-render traits above are present. →

**12 · Pre-flight** — run the full **§26 checklist** (Recognition Test is the gate). →

---

## Worked example — `preview/spatial/iso-illustration-ecosystem-frame.html`

The specimen built from this brief (the whole-canvas-as-system hero).

1. **Concept** — an integration platform that orchestrates many external services. **Recognition target:**
   *"an integrated platform ecosystem with connected services"* (not "a tower / cubes").
2. **Canvas budget** — hero core ~40% (centre); 7 peripheral services ~30%; 5 on-core control tiles ~20%;
   ground grid ~10%. Services pushed to edges/corners; nothing touches.
3. **Per-area** — hero = *orchestration core* (tier-stacked louvred tower on a platform), family `indigo`;
   each service = a *metaphor-glyph module* (db / share / code / eye / sync / model / gear), each its **own**
   family (blue/orange/green/purple/cyan/pink/teal); control tiles = core sub-features → inherit `indigo`.
4. **Tier plan** — foundation platform → front-arc control tiles → central tower (focal) → connector plug →
   floating **bolt** highlight (activity), lifted by a dashed dropline to the plug (no glow).
5. **Ecosystem** — 7 services on a screen-ellipse ring, varied size, glyph per service, one per corner/edge.
6. **Pathways** — 7 rounded-corner **routed backbones** core↔service, each **colour-paired** to its service;
   no narrative sweep (no single dominant flow here); quiet/hairline so they weave without overpowering.
7. **Colour** — one family per service (mark + route paired); core single-family; no decorative colour.
8. **Fidelity** — Editorial-Hero; tower louvred + control tiles articulated; every drawn part real; illustrative
   labels flagged.
9. **Drafting** — faint full-canvas ground grid; dashed dropline on the floating element.
10. **Surface** — outlined + filled-accent focal; light **and** navy; SVG baked, no JS/pattern/3D.
11. **Divergence** — navy/soft-clay/accent only; no shadow, glow, plastic, or brand palette. ✓
12. **Pre-flight** — passes §26 on light, navy, and print-to-PDF (transforms/routes/glyphs survive).

---

*See `README-SPATIAL.md` for every rule referenced above, and `preview/spatial/` for the copy-source
specimens (`iso-illustration-kit.html` = the metaphor-object menu; `iso-illustration-ecosystem-frame.html`
= this worked example). Governance lives in the rulebook; this file only operationalises it.*
