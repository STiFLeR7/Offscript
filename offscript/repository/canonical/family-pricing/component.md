---
schema_version: "1.0"
kind: component
identity:
  id: "canonical::family-pricing"
  title: "Pricing"
ownership:
  owner: "offscript-authority"
scope:
  class: canonical
  identity: "offscript"
governance:
  authority: canonical-global
semantics:
  produces:
    - "concept:role:pricing"
---

# Pricing

Abstract section family (role). Realized by one or more layout variants that
specialize this role; owns the role, never a specific surface or pixel.
