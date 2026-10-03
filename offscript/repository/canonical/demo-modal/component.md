---
schema_version: "1.0"
kind: component
identity:
  id: "canonical::demo-modal"
  title: "demo-modal"
ownership:
  owner: "offscript-authority"
scope:
  class: canonical
  identity: "offscript"
governance:
  authority: canonical-global
semantics:
  specializes:
    - "concept:role:contact-lead-form"
capabilities:
  satisfies:
    - "serves:contact"
    - "serves:cta"
    - "surface:base"
---

# demo-modal

Overlay attached to any action; not a standalone band.

## Purpose

The overlay capture: a contact or booking form presented as an overlay attached to an action elsewhere
on the page, rather than as a standalone band. It lets a reader act on an invitation in place — opening a
focused capture over the current context — so the moment of readiness is met immediately, without
sending them away to a separate section or page.

## Choose when

- A capture should appear in response to an action elsewhere, keeping the reader in context.
- The moment of readiness is triggered by a button or link that should not navigate away.
- A focused, temporary form serves better than a permanent band on the page.
- The reader benefits from acting immediately rather than scrolling to a contact section.

## Avoid when

- The capture should be a permanent part of the page — reach for a standalone form or band.
- A dedicated contact page is the right home — reach for the full standalone body.
- The support case wants visible contact methods — reach for the methods-plus-form layout.
- The next step is a single freely-chosen action, not information — reach for a call-to-action role.

## Character

Low-friction and in-context: a focused overlay that meets readiness where it is triggered, then steps
aside. It is the family's non-standalone shape — summoned by an action, not a fixed band — and keeps the
same restraint and reassurance, appearing only when invited and asking only for what the moment needs.

## Composition

It is attached to an action elsewhere on the page and surfaces over the current context, not as a section
in the page's flow. It must be genuinely dismissable and summoned by a real trigger, ask only for what is
needed, carry its reassurance with it, and never trap the reader or appear uninvited to interrupt rather
than serve.

## Contract

Assumes a real triggering action and a reader who chose to open it. It expects the overlay to be invited,
minimal, and escapable — never an unbidden interruption, never harder to close than to complete; an
overlay that ambushes the reader or holds them hostage inverts the family's door-opening purpose into a
barrier.

## Judgement

Used well, a reader acts on an invitation the instant they feel it, in a focused overlay that respects
their context and lets them leave. The tempting misuse is the uninvited pop-up that interrupts rather
than serves, or a modal that is hard to dismiss. Its value is timely, in-context capture by invitation —
summoned, minimal, and always escapable.
