---
name: offscript
description: "Operate Offscript project generation, validation and review using the current command surface."
disable-model-invocation: true
arguments: [subcommand, ...args]
argument-hint: "[init|brief|generate|status|list|derive-brand|harden|dry-run|harden-review|bundle|fullstack]"
---

# Offscript operations

Read root `AGENTS.md` and `docs/REPRODUCING.md` before operating the engine.
Run commands from the repository root. Use `npm run offscript -- --help` for the current command surface;
use the corresponding script's help and typed contracts for detailed arguments.

## Setup and verification

```sh
npm run setup
npm run demo
npm run verify
npm run build
```

The demo and default authoring are scripted doubles. Do not present their output as real model judgment.
Real authoring uses the documented session dispatch boundary. Preserve readiness, approval and integrity checks.
Browser validation is optional and must be reported separately from static validation.

## Project workflow

1. Initialize a local project with `npm run offscript -- init <project> --type <type>`.
2. Capture the user's intent and supply normalized interview answers with
   `npm run offscript -- brief <project> --answers <file.json>`, or prepare the canonical brief contract.
3. Put the project's supplied token CSS, voice and assets under
   `offscript/projects/<project>/references/`. Consult the generated guide and typed brand-kit contract.
4. Generate using `npm run offscript -- generate <project> --track website|collateral` after resolving
   any readiness blockers. Report output paths, validation findings and pending review.

Each project's supplied identity and creative direction govern its deliverables. Shared resources provide
methodology and explicitly generic examples; never substitute example logos, domains or voice for the user's
brand. When required project inputs are missing, report the actual blocker rather than inventing identity.
External sourcing and brief adapters are not bundled. The default brief source is manual input.

## Other operations

- `status` and `list`: inspect local project state and scores.
- `derive-brand`: derive a token mapping from supplied CSS for human review.
- `harden`, `dry-run`, `harden-review`: validate and review existing artifacts with the supported track rails.
- `bundle`: inspect or package a supported bundle through the engine CLI.
- `fullstack`: experimental framework transformation; report its actual behavior and limitations.

Deck generation remains blocked by missing methodology. Never imply an implemented capability from an
experimental API or a planned idea. Local project inputs, private development notes and generated artifacts
are ignored by Git. Public documentation describes current technical behavior only.
