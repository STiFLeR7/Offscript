---
schema_version: "1.0"
kind: component
identity:
  id: "canonical::pricing-tabbed"
  title: "pricing-tabbed"
ownership:
  owner: "offscript-authority"
scope:
  class: canonical
  identity: "offscript"
governance:
  authority: canonical-global
semantics:
  specializes:
    - "concept:role:pricing"
capabilities:
  satisfies:
    - "serves:comparison"
    - "serves:feature"
    - "serves:pricing"
    - "serves:value-prop"
    - "surface:base"
---

# pricing-tabbed

Plans split by persona/audience.

## Purpose

The persona-split price set: plans divided by audience, arranged so a reader first identifies the group
they belong to and then sees the pricing meant for them. It exists for offerings whose plans genuinely
differ by who the buyer is — making the relevant cost legible without forcing every audience to wade
through plans that were never for them.

## Choose when

- Plans genuinely divide by persona or audience — different groups have different relevant plans.
- A reader benefits from selecting their segment first, then seeing only the pricing for it.
- The audiences are distinct enough that one combined table would confuse more than clarify.
- Cost is part of the decision and each audience's plans and prices must be clear.

## Avoid when

- All readers choose from the same parallel plans — reach for the equal plan cards.
- The offers differ in scope rather than by audience — reach for the unequal package set.
- The page is short and price must fold in reassurance — reach for the pricing-plus-FAQ band.
- The question is feature parity, not price — reach for a comparison role.

## Character

Transparent and audience-guided: a switchable set that lets each reader see the plans meant for them,
keeping the family's low-anxiety candour while sorting by who the buyer is. The division must be an
honest aid to relevance — never a way to hide a group's real cost behind another's — and each view shows
its plans as clear peers.

## Composition

It sits late, near the decision, as the page's single pricing component, with plans grouped by genuine
audience and one view shown at a time. The split must reflect real audience differences, not conceal
pricing; it remains the only price table on the page, and within each audience the same
peer-and-honest-focal-point discipline holds.

## Contract

Assumes plans that truly differ by audience, each with real prices and honest inclusions. It expects the
division to serve relevance, not concealment — hiding one segment's cost, defaulting readers into the
wrong group, or using the tabs to bury price all break transparency; and it must be the only pricing
component on the page.

## Judgement

Used well, a reader identifies their segment and sees exactly the pricing that applies to them,
uncluttered by the rest. The tempting misuse is using the split to obscure a less flattering price, or
dividing audiences that do not really differ. Its value is honest relevance — sort by real audience, and
show each their true cost plainly.
