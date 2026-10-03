# Collateral-Core Rulebook — ⚠️ FLAGGED STUB (Needs-Review authoring)

> **Status: NOT YET AUTHORED.** This slot needs the brand-agnostic *layout, composition, and
> Swiss-structure governance* that currently lives — fused with brand values — inside the source
> file `README-COLLATERAL.md`. It was **intentionally not auto-written** during migration: extracting
> it cleanly requires **rewriting** (stripping pixels/tokens, re-expressing rules brand-invariantly),
> which is authoring, not copy. Per the approved migration decision ("lift-and-place clean parts;
> flag the rewrites"), the rewrite is deferred to a reviewed authoring pass.

## What belongs here (the HOW — brand-invariant)

The governing rules for collateral structure, expressed by **role and rule, never by pixel or token**:

- **Swiss structure principles** — grid as foundation, modular spacing, strong alignment, hierarchy
  through scale/weight/space, active whitespace, one-idea-per-region, restraint, consistent frame.
- **Composition & layout governance** — one major component per row; components stay within and
  align to the margins; ≤3 equal columns; stacked top-to-bottom reading flow; lone-hero-flush rule.
- **Margin discipline, density balance, and the "vary the layout, never the language" anti-clone rule.**

## Source to extract from (in the archive)

`README-COLLATERAL.md`, sections:
- **DESIGN PRINCIPLES — executive communication** (≈ lines 113–125)
- **VISUAL FOUNDATIONS → Swiss structure — the principles** (≈ lines 149–159)
- **Component placement — one component per row** (≈ lines 161–172)
- **Layout — multi-page A4 collateral** (≈ lines 174–180) — *strip the mm/px/class specifics; those
  are Brand-Pack / execution values, not governance.*
- **Composition & variation** (≈ lines 182+)

## Rewrite rules for whoever authors this
- Remove every hex, px, mm, font name, class name, and brand word. If a statement names an appearance
  value, it is a Brand-Pack value, not a rule here.
- Express each rule so it survives a complete rebrand.
- Concrete numeric specs (margins, column counts, the 4-pt scale) live in the Brand Pack
  (`colors_and_type.css` + a usage note), referenced from here by role.
