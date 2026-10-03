---
schema_version: "1.0"
kind: component
identity:
  id: "canonical::problem-card"
  title: "problem-card"
ownership:
  owner: "offscript-authority"
scope:
  class: canonical
  identity: "offscript"
governance:
  authority: canonical-global
semantics:
  specializes:
    - "concept:role:atoms-transitions"
capabilities:
  satisfies:
    - "serves:feature"
    - "serves:outcomes"
    - "serves:value-prop"
    - "surface:contrast"
---

# problem-card

A single problem-statement card; composes into grids.
