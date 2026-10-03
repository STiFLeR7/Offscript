---
schema_version: "1.0"
kind: component
identity:
  id: "canonical::pricing"
  title: "pricing"
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
    - "serves:pricing"
    - "surface:rest"
validation:
  expects:
    - "maxPerPage:1"
---

# pricing

Equal, parallel plans with a billing toggle.

## Purpose

The canonical price table: a set of equal, parallel plan cards — peers of comparable shape — with an
optional billing toggle, stating plainly what each costs and what it includes. It exists to make the
cost of saying yes clear and low-anxiety, so price never becomes the silent reason a ready reader leaves.

## Choose when

- Cost is part of the decision and the plans are genuine parallel peers of comparable kind.
- A reader near the decision needs to find the tier that matches them and compare closely.
- A billing toggle honestly reflects real alternatives, not a pressure device.
- One plan can be the single honest focal point, chosen for the reader's benefit.

## Avoid when

- The offers differ in scope rather than tier — reach for an unequal package set.
- Plans divide by audience or persona — reach for the persona-split tabbed set.
- The page is short and price must share a band with reassurance — reach for the pricing-plus-FAQ band.
- The question is feature parity, not price — reach for a comparison role.

## Character

Transparent and low-anxiety: a structured, comparable set of peer plans read by scanning for fit then
comparing closely. It reassures rather than pressures — one plan may be an honest focal point, never a
trap — and it stays calm and legible, treating equal plans as the peers they are.

## Composition

It sits late, near the decision and the ask, as the page's single price table — at most one per page —
with plans as comparable peers and an optional billing toggle. No second price table may compete with
it; cost must be stated openly, and any emphasis must be the one honest recommendation, not a
manufactured default.

## Contract

Assumes real, parallel plans with true prices and honest inclusions. It expects total transparency —
never hiding, burying, or disguising cost, and no false scarcity, dark patterns, or pressure; a second
competing price table splits intent, and a "recommended" plan chosen to extract rather than to help
betrays the low-anxiety the family exists for.

## Judgement

Used well, a near-ready reader sees what it costs and what they get, finds their tier, and feels safe to
commit. The tempting misuse is pressure dressed as pricing — false scarcity, buried fees, a second
table — or emphasising the plan that serves the seller over the reader. Its whole job is to lower the
cost of "yes"; any pressure raises it, and the trust is gone.
