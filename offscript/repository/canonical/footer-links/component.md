---
schema_version: "1.0"
kind: component
identity:
  id: "canonical::footer-links"
  title: "footer-links"
ownership:
  owner: "offscript-authority"
scope:
  class: canonical
  identity: "offscript"
governance:
  authority: canonical-global
semantics:
  specializes:
    - "concept:role:footer"
capabilities:
  satisfies:
    - "serves:footer"
    - "serves:nav"
    - "serves:resources"
    - "surface:base"
---

# footer-links

Bare link columns for composing.

## Purpose

The composing primitive: the family's plainest footer — unadorned columns of destination links with
nothing else asserted. It exists to be assembled with, giving the page's close a complete, honest map
onward without imposing a brand statement, a capture, or a final action. When another band already
carries the ending's expression, this supplies the bare wayfinding beneath it and stays out of the way.

## Choose when

- The wayfinding is all that is needed — a clean set of destination columns, nothing more.
- A preceding band already carries the close's expression, so the footer should stay quiet.
- The layout is being composed and wants an unopinionated link set to build from.
- Consistency and legibility matter more than character at the very bottom of the page.

## Avoid when

- The close should carry the brand's voice and breadth — reach for the editorial mega-footer.
- A short page wants its final action folded into the footer — reach for the CTA-fused footer.
- The ending's real job is to capture an email — reach for the footer with a built-in form.
- Orientation is needed at the top of the page, not the bottom — that is the navigation role.

## Character

Plain and unopinionated: the family at its most restrained, all structure and no flourish. It is a
building block, scanned purely for a destination and asserting nothing of its own — no voice, no ask,
no decoration. Its restraint is the point: it completes the page's map without ever competing for
attention or drifting from the site's other footers.

## Composition

It is bare columns of destination links — the site's wayfinding organized into groups, with at most a
brand mark and a legal or utility row. It carries no capture and no primary action; anything expressive
belongs to a band above it. Its column structure must match the footer on every other page so the
reader's learned map holds from page to page.

## Contract

Assumes its only job is wayfinding and that expression, if any, lives elsewhere. It expects its links to
be real and its structure to stay identical site-wide; the moment it grows a competing action or lets
its columns drift page to page, it stops being the clean, composable map it exists to be and erodes the
orientation frame.

## Judgement

Used well, it gives the bottom of the page a complete, quiet way onward that a reader can navigate from
with no prior context, letting a band above own the ending's voice. The tempting misuse is loading it up
— a stray ask, decoration, inconsistent columns — until it is neither plain nor dependable. Its value is
exactly its restraint: the honest link set that composes with anything.
