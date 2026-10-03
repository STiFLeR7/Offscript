---
schema_version: "1.0"
kind: component
identity:
  id: "canonical::faq"
  title: "faq"
ownership:
  owner: "offscript-authority"
scope:
  class: canonical
  identity: "offscript"
governance:
  authority: canonical-global
semantics:
  specializes:
    - "concept:role:faq"
capabilities:
  satisfies:
    - "serves:faq"
    - "surface:base"
---

# faq

A chip teaser linking to a fuller FAQ.

## Purpose

The FAQ chip teaser: a compact pointer that surfaces a few representative questions and links to a
fuller FAQ elsewhere. It is not the full disclosure list — it is the lightest touch of the family,
acknowledging that questions exist and showing the reader where the complete answers live, so the main
flow stays uninterrupted.

## Choose when

- The real, complete FAQ lives elsewhere and this spot only needs to point to it.
- A few representative questions are enough to signal "your questions are answered — here."
- The main page should not be interrupted by a full expandable list.
- A light, compact teaser fits the beat better than the doubt-clearing list itself.

## Avoid when

- The doubts should be answered right here — reach for a split, centered, or single-column FAQ.
- The list is long and belongs in full on this page — reach for the split column.
- The questions are about plans and belong beside pricing — reach for the pricing-plus-FAQ band.
- The answers are really features carrying a creative panel — reach for an expandable feature /
  value-prop role.

## Character

Light and gestural: a small teaser of a few questions that hands the reader onward to the full FAQ
rather than answering in place. It is the family's most compact member — a signpost, not the
destination — and stays honest by pointing to real answers elsewhere, never implying resolution it does
not itself provide.

## Composition

It sits inline where a full list would be too heavy, as a compact set of representative question chips
linking to the complete FAQ. The teaser must lead somewhere real; it should stay small rather than
creeping toward a full list, and the questions it shows should honestly represent what the fuller FAQ
answers.

## Contract

Assumes a genuine, fuller FAQ exists to link to, and that the chips honestly preview it. It expects the
pointer to resolve — a teaser that links nowhere, or that previews questions the real FAQ does not
answer, breaks the trust of a shape whose whole job is to direct the reader truthfully.

## Judgement

Used well, a reader sees their questions are handled and follows the link when they need the answers,
without the flow being interrupted. The tempting misuse is teasing questions with no real FAQ behind
them, or using a pointer where the doubts genuinely needed answering on the spot. Its value is honest
direction — it must lead to real answers.
