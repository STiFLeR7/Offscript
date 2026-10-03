---
schema_version: "1.0"
kind: component
identity:
  id: "canonical::divider-horizon"
  title: "divider-horizon"
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
    - "serves:footer"
    - "serves:transition"
    - "surface:contrast"
---

# divider-horizon

The final transition into the footer.
