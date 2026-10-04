# Session authoring proof

The proof runner exercises existing context, planning, authoring and validation against an owned synthetic project. It is a development engine probe. It reports native readiness and never creates approvals or an admitted production project.

From the repository root:

```powershell
node offscript/node_modules/tsx/dist/cli.mjs offscript/scripts/authoring-proof.ts --project offscript-proof --track website --run proof-001 --inputs examples/authoring-proof/northline.json
```

The first run exits 3 and writes every section request under the ignored project's proofs directory. Read its `proof.json` for exact request/response paths. Read each request and its referenced versioned author contract, then author matching response HTML in a Codex or Claude Code session. No inference API is called by this command.

After all responses exist, repeat with a declared session label:

```powershell
node offscript/node_modules/tsx/dist/cli.mjs offscript/scripts/authoring-proof.ts --project offscript-proof --track website --run proof-001 --inputs examples/authoring-proof/northline.json --session "your actual assistant/session label"
```

Exit 0 means the probe assembled and validated a complete output. Validation findings, skipped render coverage and creative acceptance remain separate. A session label is a declaration, not authentication or proof of creative quality. Scripted/test-generated fragments must be recorded as doubles, not real-session evidence.

Requests bind section instructions, identity inputs, governance and supplied content. Responses from another digest do not count. Empty responses fail with exit 1. The runner refuses foreign projects, manually changed managed inputs and linked paths. It has a per-project exclusive lock; after a crash, inspect the recorded process/run and confirm it is no longer active before removing only that generated lock.

Outputs are addressed by request and response digests under the run's artifacts directory. A pending/failed replay clears the current completion pointer while preserving older artifacts. Use the current proof record, not a guessed index.html path.

For a scoped proof revision, save an ignored JSON file such as `{"hero":"Shorten the headline; preserve all other content."}` and pass `--instructions` with its path. Only that section's request changes. This probes request reuse; it does not implement the later product editing workspace.

Use a separate owned project for the Pixel Garden example. Inspect actual fonts/assets/content and 390/768/1440-pixel renderings. The fictional examples cannot establish user demand or production readiness. All project inputs, prompts, responses, scores and rendered evidence stay ignored by Git.
