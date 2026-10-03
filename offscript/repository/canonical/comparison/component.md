---
schema_version: "1.0"
kind: component
identity:
  id: "canonical::comparison"
  title: "comparison"
ownership:
  owner: "offscript-authority"
scope:
  class: canonical
  identity: "offscript"
governance:
  authority: canonical-global
semantics:
  specializes:
    - "concept:role:comparison"
capabilities:
  satisfies:
    - "serves:comparison"
    - "serves:feature"
    - "serves:pricing"
    - "surface:base"
---

# comparison

A single comparison column for composing.

## Purpose

The composable comparison column: a single option's column of factors, authored to be dropped into
another band rather than to stand as a full matrix on its own. It exists for the case where the
comparison is one part of a larger section — where a host band supplies the framing and the other
column, and this contributes just its own even-handed side of the weigh-up.

## Choose when

- A comparison needs to live inside another band, not as a standalone decision-stage table.
- Only this option's column of factors is needed, with the framing owned by the host section.
- The layout is composing a lighter, embedded weigh-up rather than a full side-by-side matrix.
- One honest column will serve the reader better here than a heavier standalone comparison.

## Avoid when

- The reader needs a full us-versus-alternative or plan-versus-plan matrix — reach for the decision-stage table.
- The axis is purely cost and packaging tiers — reach for a pricing role.
- The goal is to explain the product rather than adjudicate between options — reach for a feature role.
- There is no real counterpart column to weigh this against — a lone column adjudicates nothing.

## Character

Candid and self-contained: the family's composable unit, carrying the same fairness as the full matrix
but scoped to a single column. It is even-handed within its own bounds — honest factors, honest limits —
and defers the side-by-side framing to whatever band hosts it, contributing its column rather than
asserting the whole verdict.

## Composition

It is one option's column of distinguishing factors, one factor per row, each with its proof, built to
sit inside a host band that supplies the comparison's structure and its counterpart. It must stay fair
in isolation — no inflated claims, no hidden losses — and must not pretend to be a complete matrix; its
honesty is what lets the host band's weigh-up be trusted.

## Contract

Assumes a host band that frames the comparison and a real counterpart to weigh against. It expects to be
one fair column among others, not a solo act dressed as an adjudication; a column that overstates its
option, or is placed where nothing genuinely opposes it, borrows the comparison format's credibility
without doing its honest work.

## Judgement

Used well, it slots cleanly into a larger section and gives the reader one even-handed side of a
weigh-up, letting the host band complete the picture. The tempting misuse is treating it as a full
comparison on its own, or loading its single column until it stops being fair. Its value is composability
with integrity: a trustworthy column that a host band can build an honest comparison around.
