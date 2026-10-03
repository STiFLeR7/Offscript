# creative-generation

Standalone Offscript package producing a digest-verified CreativeArtifact from CreativeIntent.
It reads shared methodology through `resources/design_processes/creative/` and imports no engine
implementation code. Its public entrypoint is `src/cli.ts`.

## Run

From this package directory after root setup:

```sh
npm run generate -- --creative-intent <file.creative-intent.json> --client <project>
npm run generate -- --creative-intent <file.creative-intent.json> --client <project> --dispatch-dir <directory>
npm test
npm run typecheck
```

The CLI writes `offscript/projects/<project>/creative-assets/<id>/` with `intent.json`,
`artifact.json` and `visual.html`. The artifact is approval-pending; production consumption must
observe its approval and digest contracts. Exit codes: 0 produced, 1 pipeline failure,
2 invalid input, 3 pending dispatch response.

## Pipeline

Feature mapping, camera selection and composition bias create the initial request. Environment
selection and role assignment supply candidate state. Visual-proof judgment and bounded revision
run before rendering and artifact serialization. These stages retain their own typed contracts
and injectable executors; `runRethinkLoop` composes them.

Without `--dispatch-dir`, judgment uses scripted doubles and rendering uses the deterministic
placeholder renderer. This verifies orchestration and integrity, not real creative judgment.
With `--dispatch-dir`, judgment, revision and HTML authoring use resumable prompt/response files.
A missing response reports pending; rerun the same command after supplying the real response.
Environment and role selection remain scripted in the CLI.

## Project branding

Real CLI authoring reads supplied CSS and voice from `projects/<project>/references/`.
An optional brand-kit `voiceReference` selects a project voice file; otherwise `voice.md` is used
when present. Supplied project guidance governs typography, palette and surface treatments.
Missing brand guidance does not impose the bundled example typeface or colors.

Library callers can supply `CreativeAuthoringRequest.brand` with CSS and voice. The bundled
reference typography is available only through explicit `brand: { reference: 'example' }`.
Shared environment assets are reference inputs; they do not establish a customer's identity.

## Validation limits

Structural validation checks components, environment slots, composition roles and declared canvas
geometry. Deterministic checks do not certify taste, complete visual judgment or browser geometry.
Unavailable authoring reports its reason rather than silently presenting a placeholder as authored.
Refer to source contracts and tests for exact validation and dispatch formats.
