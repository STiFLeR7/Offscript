---
schema_version: "1.0"
kind: component
identity:
  id: "canonical::feature-bento"
  title: "feature-bento"
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
    - "serves:feature"
    - "serves:integrations"
    - "serves:stats"
    - "serves:value-prop"
    - "surface:base"
validation:
  expects:
    - "avoidAdjacent:stats"
---

# feature-bento

Feature set where one item dominates.

## Purpose

Presents a set of features as a deliberately unequal arrangement where one capability is given
the most room. It solves the flat-feature-list problem: when several features matter but one is
the headline, an even treatment hides the hierarchy — this band makes the lead feature win
visually while the supporting features still register.

## Choose when

- There is a clear hero feature plus a few supporting ones, and that hierarchy is part of the
  message.
- The audience is scanning, early-to-mid journey, to understand "what is this, mainly?"
- The value argument is better served by emphasis than by parity.
- The product has one signature capability and a supporting cast around it.

## Avoid when

- The features are genuine peers with no dominant one — use an even trio or grid so none is
  falsely subordinated.
- The section is really a sequence ("do this, then this") — use a steps or how-it-works
  treatment.
- It would sit directly beside a stats band: the two compete for the same dense-proof attention
  and dilute each other (the reason its frontmatter forbids that adjacency).

## Character

A purposeful, medium-high-density band with a single clear focal point. The emphasis is
asymmetric by intent — one dominant area anchoring smaller supporting ones — and the energy is
directed rather than busy. It is read, not operated.

## Composition

It typically follows the hero, as the first expansion of the promise, and hands off into deeper
feature detail, process, or proof. It should rarely sit beside a stats band (a declared rule) or
beside another dominance-led layout that would fight it for the same focal role.

## Contract

Assumes the features are genuinely unequal in importance and that a lead feature can be named.
It expects one feature substantial enough to carry the dominant area, plus real supporting
features for the smaller ones.

## Judgement

Used well, a product leads with its signature capability supported by a few secondary features
held in smaller positions. The tempting misuse is forcing equal features into the unequal
arrangement, making an arbitrary one look dominant — or placing it next to a metrics band. When
no feature truly dominates, the asymmetry reads as a layout accident; placed beside stats, both
bands lose their impact.
