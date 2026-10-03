---
schema_version: "1.0"
kind: component
identity:
  id: "canonical::hero-actions"
  title: "hero-actions"
ownership:
  owner: "offscript-authority"
scope:
  class: canonical
  identity: "offscript"
governance:
  authority: canonical-global
semantics:
  specializes:
    - "concept:role:hero"
capabilities:
  satisfies:
    - "serves:feature"
    - "serves:hero"
    - "serves:logos"
    - "surface:base"
---

# hero-actions

Hero that demonstrates a real product state.

## Purpose

The opening screen for a product whose most persuasive argument is simply seeing it work. It answers
the "is this real?" doubt a cold reader carries into the first screen: instead of describing the
product, it shows a genuine slice of it in a true, working state, so the promise and the proof that it
exists arrive in the same glance.

## Choose when

- A real, showable product exists and one honest view of it says more than any sentence could.
- The audience is skeptical or technical — people who trust what they can see over what they are told.
- Early in the journey, opening a page that will go on to explain how the shown capability works.
- The single promise is best carried by the product itself rather than by figures or trust marks.

## Avoid when

- No genuine product view can be shown yet — a mocked or invented state betrays the reader; reach for
  a calm credibility opening or a plain promise-led hero instead.
- The strongest argument is breadth of proof rather than the product itself — reach for a proof-tile
  opening that shows many outcomes at once.
- The real job of the first screen is to start a conversation or capture intent — reach for a
  conversational opening.

## Character

Confident and concrete, energised by the product rather than by decoration. Denser than a bare
promise yet still singular — one artifact, one promise, one action. The product view is evidence on
display, read and believed, not a control the visitor is asked to operate.

## Composition

It opens the page, so almost nothing precedes it. It hands off naturally to a feature or
how-it-works section that explains the capability the artifact implied, and later into deeper proof.
It should not sit beside another hero, nor be followed immediately by a second heavy product
showcase that repeats the same view.

## Contract

Assumes a real product exists and that one honest, representative state of it can be shown. It
expects a single genuine artifact — a true screen or working view — alongside the one promise and the
one primary action; without a real artifact it has nothing to stand on.

## Judgement

Used well, a working product opens with one true view of itself beside a sharp promise and a single
next step. The tempting misuse is dressing up a mockup, or a state the product cannot actually reach,
to look further along than it is. When the shown state is faked or unrepresentative it reads as a
bluff and forfeits the trust the hero exists to earn; crowded with several views it stops being a
hero and becomes a showcase.
