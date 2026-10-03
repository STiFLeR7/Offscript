# Offscript design sources

These are authored design inputs and source assets used to develop Offscript.

| Directory | Purpose |
| --- | --- |
| `website/` | Website governance, brand assets, fonts and section templates |
| `collateral/` | Collateral methodology and reference assets |
| `creative/` | Creative production methodology |
| `shared/` | Creative direction and shared identity principles |

Creative generation reads runtime resources, including website fonts and environment imagery. The
[governance sync tool](../offscript/website-governance-sync/README.md) maintains the website runtime
mirror under `offscript/resources/design_processes/website/`. Changes to source paths must update
these consumers together.

HTML section templates and reference exemplars are design inputs. Keep them distinct from generated
project output, which belongs in ignored `offscript/projects/` workspaces. Edit authored methodology
here; preserve runtime governance integrity and validate changes before using them in production.
