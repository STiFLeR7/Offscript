---
schema_version: "1.0"
kind: component
identity:
  id: "canonical::agent-status"
  title: "agent-status"
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
    - "serves:stats"
    - "surface:base"
---

# agent-status

A live-metric status mock; a creative filler panel.
