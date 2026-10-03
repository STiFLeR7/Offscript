---
schema_version: "1.0"
kind: component
identity:
  id: "canonical::feature-accordion"
  title: "feature-accordion"
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
    - "surface:base"
---

# feature-accordion

Four-to-six progressive details a reader opts into; not on the first screen.

## Purpose

Offers several related details as a compact set the reader opens one at a time, so depth is
available without forcing it on everyone. It solves the over-long-feature-section problem: when
there are more sub-points than a reader will absorb up front, collapsing them lets the motivated
reader go deeper while the casual reader keeps moving.

## Choose when

- There are roughly four to six genuine sub-topics, each worth a closed row a reader can open.
- The reader has grasped the gist and is now deciding how much detail they want.
- Depth should be offered, not imposed — the surface must stand on its own when nothing is open.
- The page is mid-to-late, past the point where the headline argument has landed.

## Avoid when

- It would sit on the opening screen, where the gist must arrive first — reach for a plain
  overview band there instead.
- Every point genuinely must be seen at once — reach for an even grid or trio so nothing hides.
- There are only one or two details; a collapsing list is overhead with no payoff.

## Character

A restrained, low-surface band whose density is held in reserve: little shows until the reader
chooses to expand it. The interaction intent is opt-in disclosure, and the energy is patient and
quiet rather than insistent.

## Composition

It belongs mid-page, after an overview has established what the section is about, and hands off to
proof or a closing ask. It should not open a page, and it sits poorly straight after another
opt-in band, which doubles the reader's "should I expand this?" tax.

## Contract

Assumes several distinct sub-topics that each merit their own closed row, and a reader motivated
enough to open the ones that matter to them. It expects a self-sufficient surface line per row, so
a closed accordion still communicates.

## Judgement

Used well, a curious reader expands the two or three points that bear on their decision and skips
the rest. The tempting misuse is hiding the primary message inside a closed row, or placing the
band on the first screen. When the key value lives only behind a fold no one opens, the section
silently fails to make its case.
