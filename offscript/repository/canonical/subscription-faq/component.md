---
schema_version: "1.0"
kind: component
identity:
  id: "canonical::subscription-faq"
  title: "subscription-faq"
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
    - "serves:faq"
    - "serves:pricing"
    - "surface:base"
    - "surface:contrast"
---

# subscription-faq

Pricing and FAQ in one band; short pages.

## Purpose

The pricing-plus-FAQ band: a compact section that folds a short doubt-clearing FAQ into the price table
itself, for short pages where both the cost and the last reassurance must fit in one place. It states
what a plan costs and, in the same breath, answers the plan questions that would otherwise send a
near-ready reader away.

## Choose when

- The page is short and cost plus its immediate questions must share a single band.
- The remaining doubts are specifically about the plans — billing, terms, what's included.
- Folding reassurance into pricing serves the reader better than a separate FAQ elsewhere.
- Cost is part of the decision and the plan questions are few and plan-specific.

## Avoid when

- There is room for a full price table and a separate FAQ — reach for the plain pricing plus a FAQ role.
- The plans are parallel peers needing a clean tier comparison — reach for the equal plan cards.
- The offers differ by scope or audience — reach for the package set or the persona-split set.
- The remaining questions are general, not about plans — reach for a standalone FAQ role.

## Character

Transparent and consolidating: pricing and a short, plan-specific FAQ presented together so a short page
can close the cost question and its doubts at once. It keeps the family's low-anxiety candour on both
halves — clear price, honest answers — and stays compact, folding reassurance in rather than pressuring.

## Composition

It sits late on a short page as the single pricing component, pairing the plan(s) with a brief FAQ that
answers plan questions in the same band. The FAQ must stay short and genuinely about the plans; the
price must remain fully transparent, and the combined band must not become two competing tables or a
place to bury cost beneath questions.

## Contract

Assumes real plans with true prices plus a few honest, plan-specific questions and answers. It expects
both halves to hold the family's standard — total transparency on cost, real questions honestly answered
on doubt; padding the FAQ with marketing, or using the fold to soften an unfavourable price, breaks the
trust of both roles it combines.

## Judgement

Used well, a reader on a short page learns what a plan costs and gets their plan questions answered in
one place, and commits without leaving to hunt for either. The tempting misuse is hiding cost behind
questions, or dressing promotional copy as an FAQ. Its value is honest consolidation — real price and
real answers, together, with no pressure.
