# Collateral track — GOVERNANCE GAP (no source material)

The Collateral track is declared **active** in the operating model, but **no source governance for it
exists** in the migrated workspace. The audit found **zero** collateral philosophy, rulebooks,
component governance, or exemplars — the entire authored system in the archive is **website-only**
(its own README states it "covers website / marketing only").

**This folder is intentionally empty of governance.** Nothing here was fabricated, per the migration
rule *"do not invent governance."*

## What the downstream engine should expect
- The shared **Brand Pack** (`../../brand-pack/`) applies to collateral too — colours, type, voice
  and assets are brand DNA shared across tracks.
- What is **missing** and must be authored before the engine can run the collateral track:
  - `PURPOSE.md` — why the collateral track exists.
  - `PHILOSOPHY.md` — the governing behavior of a **fixed, print-true page** (a composed,
    self-contained canvas — every page complete on its own), distinct from the website's fluid scroll.
  - `rulebooks/` — the rules beneath that philosophy.
  - `component-governance/` — collateral components by role (cover, headline block, editorial/body,
    stat callout, feature grid, quote, imagery panel, diagram/process, contact band).
  - `exemplars/` — a few on-brand collateral pieces to study.

Until these are authored, the engine should treat the collateral track the way it treats the deck
track: **refuse cleanly rather than guess.**
