---
schema_version: "1.0"
kind: component
identity:
  id: "canonical::buttons"
  title: "buttons"
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
    - "serves:any-cta-row-source"
    - "surface:base"
    - "surface:contrast"
---

# buttons

The canonical action styling; source for every call-to-action.
