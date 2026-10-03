---
schema_version: "1.0"
kind: component
identity:
  id: "canonical::nav"
  title: "nav"
ownership:
  owner: "offscript-authority"
scope:
  class: canonical
  identity: "offscript"
governance:
  authority: canonical-global
semantics:
  specializes:
    - "concept:role:navigation"
capabilities:
  satisfies:
    - "serves:nav"
    - "surface:contrast"
---

# nav

The page's persistent top orientation bar.

## Purpose

The persistent top orientation instrument: the calm, constant frame that answers a reader's three
continuous questions — where am I, what is this, where can I go — cheaply and at every moment. It exists
so a reader who may have arrived at any point on the page stays oriented and free to move, able to act
without first working out where they are, and able always to find their way back.

## Choose when

- The page has more than one destination and a reader needs to move between them at any moment.
- Orientation must be available continuously, not just at the top or the close.
- The site's structure should be learnable once and reusable on every page.
- A reader who lands deep in the page still needs to self-orient and reach the primary action.

## Avoid when

- The page has a single destination and nothing to navigate between — no orientation instrument is needed.
- The need is only end-of-page wayfinding after the reader has scrolled through — reach for the footer's link set.
- The instinct is to expose every route at once — a full menu of everything stops orienting and starts overwhelming.
- A second primary action would compete with the one the bar already carries — keep it to one.

## Character

A calm, constant frame — present, legible, and unobtrusive. It is scanned in passing and returned to
repeatedly, never read in sequence; it guides by legible choice, not by pressure, and keeps every move
reversible. It adds no argument of its own and stays out of the page's way, enabling movement rather
than asking for commitment.

## Composition

It is minimal and stable: a brand mark, a small consistent set of destination links, and at most one
primary action. The same kinds of destinations live in the same kinds of places site-wide so the map
learned once holds everywhere. It is orientation, not a menu of everything; it must self-orient a reader
who arrived at any point, and never swell into a full directory.

## Contract

Assumes a multi-destination page and a reader who needs, continuously, to know where they are and where
they can go. It expects to stay lean and stable — one primary action, a small fixed link set, reversible
movement — and to guide by choice, never trap; a bar that grows into a sprawling menu, shifts its
structure page to page, or carries a second competing ask breaks the steady orientation it exists to
provide.

## Judgement

Used well, a reader arriving anywhere immediately knows where they are and can move freely and reversibly
from any point, learning the site's structure once and reusing it everywhere. The tempting misuse is
letting it become a menu of everything — every route exposed at once — until it overwhelms instead of
orients, or letting its structure drift so the learned map no longer holds. Its value is steady,
unobtrusive orientation: quiet until needed, dependable every time.
