---
schema_version: "1.0"
kind: component
identity:
  id: "canonical::latest-news"
  title: "latest-news"
ownership:
  owner: "offscript-authority"
scope:
  class: canonical
  identity: "offscript"
governance:
  authority: canonical-global
semantics:
  specializes:
    - "concept:role:resources-insights-news"
capabilities:
  satisfies:
    - "serves:feature"
    - "serves:resources"
    - "serves:social-proof"
    - "surface:rest"
---

# latest-news

Press/news row; source- and date-driven.

## Purpose

The press row: a source- and date-driven row of third-party coverage, surfacing what others have written
about the offering rather than what it says about itself. It shows the offering is alive and noticed —
external validation carried by the credibility of named outlets and recent dates — and lets an
interested reader follow the coverage to its source.

## Choose when

- Real third-party press or coverage exists and lends outside credibility to the case.
- Named sources and recent dates will do more here than the offering's own voice.
- A reader is helped by seeing who has covered the offering and how recently.
- A compact, source-and-date row fits better than an editorial grid of owned articles.

## Avoid when

- The material is the offering's own writing, not third-party coverage — reach for the editorial teaser.
- There is no genuine press to show — invented coverage is worse than none and far more damaging.
- The coverage is stale and freshness is the point — an out-of-date press row signals the opposite.
- The section must carry the primary ask — it supports credibility, it does not convert on its own.

## Character

Substantive and externally validated: quieter than the owned-editorial variants because its authority
comes from the sources, not the copy. It leans on named outlets and visible dates, reads as evidence
that others are paying attention, and — like the whole family — offers the path to the coverage without
forcing anyone to take it.

## Composition

It is a row of press or news items, each driven by its source and date, each linking to the real
coverage. The outlets must be genuine and the links must resolve to the actual pieces; dates are load
bearing here, so the items must be current enough to support the freshness they imply, and the row must
still read on its own for a reader who clicks nothing.

## Contract

Assumes real, attributable third-party coverage with resolving links and honest dates. It expects the
sources to be genuine and current — because a press row trades entirely on external credibility, an
invented outlet or a dead link does more damage here than anywhere else in the family, turning borrowed
trust into an exposed claim.

## Judgement

Used well, a reader sees that credible outlets have covered the offering recently and can follow the
coverage to confirm it, deepening confidence through outside validation. The tempting misuse is
manufacturing coverage or leaning on stale, unresolving links to seem noticed — a claim that collapses
the instant it is checked. Its value is real, attributable, current third-party proof.
