# Run Offscript locally

Use Node.js 22+ and npm 10+. From the repository root:

```sh
npm run setup
npm run verify
npm run build
npm run demo
npm run offscript -- --help
```

Setup installs five independent packages from checked-in lockfiles and builds derived knowledge.
The scripted demo uses synthetic inputs and generic reference defaults. Output is written to the
ignored `offscript/projects/offscript-demo/` workspace. It is a pipeline check, not production design.

## Project inputs

```sh
npm run offscript -- init my-project --type website
npm run offscript -- brief my-project --answers examples/offscript-demo/answers.json
npm run offscript -- status my-project --track website
npm run offscript -- generate my-project --track website
```

Demo answers are synthetic. Native generation may refuse unresolved readiness or approval conditions.
Supply brand files in `offscript/projects/<project>/references/`: `colors_and_type.css`, optional
`brand-contract.json` and `brand-kit.json`. Refer to the brief contract and brand-kit types for shape.
Project branding takes precedence across tracks. Generic reference data is used only as a fallback.

## Authoring and browser checks

Scripted authoring makes no inference API calls. Subscription sessions can fulfill authoring requests
through the file-based request/response seam; missing responses fail explicitly. Runtime flags and
execution limitations are documented in the runtime reference.

```sh
npm run browser:install
npm run test:render
```

Browser installation downloads Chromium. Static verification does not establish browser geometry.
Deck authoring remains gated; framework export and review execution have the limits documented by
the current runtime. Website design source updates are previewed through:

```sh
npm --prefix offscript/website-governance-sync run sync:dry-run
```
