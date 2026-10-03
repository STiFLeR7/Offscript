---
schema_version: "1.0"
kind: component
identity:
  id: "canonical::feature-steps"
  title: "feature-steps"
ownership:
  owner: "offscript-authority"
scope:
  class: canonical
  identity: "offscript"
governance:
  authority: canonical-global
semantics:
  specializes:
    - "concept:role:feature-value-prop"
capabilities:
  satisfies:
    - "serves:faq"
    - "serves:feature"
    - "serves:process"
    - "serves:value-prop"
    - "surface:rest"
---

# feature-steps

Features that are really a sequence; a switcher.

## Purpose

Presents capabilities that are actually an ordered progression, letting the reader move through
them one state at a time. It solves the mis-shaped-feature problem: when features are not peers but
stages of a single flow, an even layout hides the order, while a stepped switch makes the sequence
itself the point.

## Choose when

- The features form a genuine order — one naturally comes before the next.
- The reader benefits from following the progression rather than comparing items side by side.
- The section is explaining "how this unfolds" as much as "what it includes".
- A guided, one-state-at-a-time walk reads more clearly than a static grid.

## Avoid when

- The items are independent peers with no order — reach for an even trio or grid so none implies a
  false sequence.
- There is no real progression to follow — imposing steps invents an order that misleads.
- The flow is a literal onboarding or setup procedure — reach for a dedicated how-it-works
  treatment.

## Character

A structured, sequential band with a guided switch between states: medium density, lightly
operated, and oriented around order. The energy is methodical and reassuring, walking the reader
forward rather than asking them to compare.

## Composition

It sits mid-page where workability is being established, near process or how-it-works bands, and
hands off into proof or the next stage of the argument. It should not stand in for an unordered
feature overview.

## Contract

Assumes the features are genuinely an ordered sequence the reader can follow start to finish, with
each step distinct and meaningful. It expects enough steps to justify a switcher, but not so many
that the walk becomes a chore.

## Judgement

Used well, a multi-stage capability is shown as the progression it really is, each step legible in
turn. The tempting misuse is forcing unrelated peers into numbered steps, manufacturing an order
that does not exist. When the sequence is fake, the numbering implies a logic the product does not
have and the reader is quietly misled.
