# Offscript

A project-driven design generation and validation engine with shared design knowledge, explicit
creative contracts and review tooling. Project branding takes precedence over generic reference data.

## Run locally

Use Node.js 22+ and npm 10+:

```sh
npm run setup
npm run demo
npm run verify
npm run build
```

The demo is scripted and uses synthetic inputs. Native projects retain readiness and approval gates.
Browser checks are an explicit additional step. See [setup and operation](docs/REPRODUCING.md).

## Repository

| Path | Purpose |
| --- | --- |
| `offscript/` | Engine, tests and five independent packages |
| `offscript/resources/` | Shared design knowledge and generic reference assets |
| `design/` | Authored methodology and source assets |
| `scripts/`, `examples/` | Root commands and synthetic demonstration |
| `docs/` | Public technical documentation |

Integrity checks, review records and deterministic tests verify engine mechanics. They do not by
themselves certify creative quality. Deck authoring remains gated, framework output is experimental,
and review execution does not automatically apply design revisions.

Developed by Hill Patel, with design references contributed by designers.
