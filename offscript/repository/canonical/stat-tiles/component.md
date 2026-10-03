---
schema_version: "1.0"
kind: component
identity:
  id: "canonical::stat-tiles"
  title: "stat-tiles"
ownership:
  owner: "offscript-authority"
scope:
  class: canonical
  identity: "offscript"
governance:
  authority: canonical-global
semantics:
  specializes:
    - "concept:role:stats-outcomes"
capabilities:
  satisfies:
    - "serves:feature"
    - "serves:outcomes"
    - "serves:social-proof"
    - "serves:stats"
    - "surface:figure"
    - "surface:rest"
---

# stat-tiles

Drop-in metric tiles for composing into other bands.

## Purpose

Supplies metrics as small, self-contained tiles meant to be dropped into another section, so proof
can travel wherever the argument needs it. It solves the composition problem: when a number belongs
inside a feature, hero, or value band rather than in a proof section of its own, this provides the
reusable building block that carries a figure without demanding a whole band.

## Choose when

- A metric should reinforce another section from within, not stand alone as a proof band.
- The page wants a few figures embedded where the argument is being made, close to the claim.
- Proof is needed in small, portable units that compose into a larger band.
- A self-contained number tile serves better than a dedicated stats section.

## Avoid when

- The numbers are the page's central argument and deserve their own beat — reach for a full proof
  band (a contrasting punch or a narrated outcome) instead.
- They would accumulate into a dense block of tiles that becomes an unplanned stats section by
  accident — that overload defeats the point.
- There is no host section for them to support — a building block with nothing to build into is
  stranded.

## Character

A modular, compact, low-ceremony set of figure tiles: quiet by design, since their role is to
support a host section rather than to perform. Density is light per tile, the energy is neutral,
and each tile is a portable unit of proof rather than a standalone statement.

## Composition

By design it lives inside or beside other bands — feature, value, or outcome sections — lending
them a figure or two, rather than occupying a band of its own. It is the family's compositional
atom; gathered into a full section, it stops being a building block and competes with the real
proof beats.

## Contract

Assumes a host section for the tiles to support and a few real, current, verifiable numbers worth
embedding, each stated specifically. It expects the figures to reinforce the surrounding claim, not
to be assembled into a proof argument they were not shaped to carry.

## Judgement

Used well, a feature or value section gains a credible figure exactly where the claim is made. The
tempting misuse is massing the tiles into a de facto stats band, or scattering numbers with no host
argument to anchor them. When the tiles are made to stand alone, they read as a thin substitute for
a real proof beat and the evidence loses its force.
