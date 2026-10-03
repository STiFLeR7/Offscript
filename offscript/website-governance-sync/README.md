# Website governance sync

Maintains the website runtime mirror from Offscript's authored design sources:

`design/website/` → `offscript/resources/design_processes/website/`

Defaults resolve from this package's location, independently of the current working directory.
Use `--source <dir>` and `--target <dir>` for explicit alternatives.

## Commands

From the repository root:

```sh
npm --prefix offscript/website-governance-sync run sync:dry-run
npm --prefix offscript/website-governance-sync run sync -- --report
npm --prefix offscript/website-governance-sync run sync:validate
```

Preview the plan before applying source changes. `--dry-run` writes nothing; `--report` lists the
planned operations. `--validate` runs the engine's governance parser tests against the on-disk target.
Combining `--dry-run --validate` validates the current mirror without applying the proposed changes.
Generation does not invoke sync automatically.

## Boundaries

- Explicit flatten rules map brand-pack and governance files into the runtime layout.
- Section templates map to engine-resolvable `component-*.html` names through the rename map.
- Composition and component metadata receive the required filename transforms.
- Runtime-only files and unaccounted target files are preserved and reported.
- Source files without an applicable rule fail explicitly.
- The sync library does not import engine code. Validation runs engine tests as a subprocess.

Run `npm --prefix offscript/website-governance-sync test` for sync tests. After applying changes,
run root `npm run verify` and inspect the generated deliverable and review reports.
