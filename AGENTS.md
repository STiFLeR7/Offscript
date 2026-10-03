# Offscript contributor guidance

Human instructions govern this project. Hill Patel owns the architecture; designers contributed to
the design references. Keep attribution accurate and do not invent licensing terms.

## Source layout

- `offscript/src/`, `offscript/test/`: engine and tests.
- `offscript/resources/`: shared design knowledge and generic reference assets.
- `design/`: authored methodology and source assets.
- Independent creative contract, intent export, generation and governance-sync packages live in `offscript/`.
- `scripts/`, `examples/`: root command orchestration and synthetic inputs.
- `docs/`: public setup and current technical contracts.

Project branding must govern every supported track. Never inject reference-company logos, identity,
voice or commercial copy into a customer deliverable. Preserve readiness, approval, integrity and
schema checks. Distinguish scripted pipeline results from real authoring and browser validation.

Run `npm run setup`, `npm run verify`, `npm run build`, `npm run demo` from the root.
Read `docs/REPRODUCING.md`, `docs/OFFSCRIPT-RUNTIME-ARCHITECTURE.md` and relevant package contracts.
Website resources are maintained from `design/website/` through governance sync.

Private development notes, product ideas, roadmap and research belong in ignored `.local/` only.
Do not commit credentials, local machine settings, project inputs or generated deliverables.
Do not introduce paid inference APIs as an implicit dependency. Release decisions belong to the user.
