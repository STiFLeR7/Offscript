# Offscript runtime reference

## Architecture

The engine reads a project brief, resolves project branding, authors a deliverable, and produces
validation and review artifacts. Native projects retain readiness and approval gates.
`offscript/resources/` holds shared design knowledge and generic reference assets.
Project inputs live under `offscript/projects/<project>/references/`.

Project CSS, brand contracts and brand kits are authoritative for every supported track. Bundled
reference defaults are sample data. They do not define a customer's identity.

## Runtime libraries

Generation coordinates authoring, validation and review. Review and execution modules are library
interfaces, not complete browser editing workflows. Framework transformation remains experimental.
Standalone creative contracts and generation packages have their own manifests and tests.

## 6. Environment flags

Flags read by the current engine and scripts are documented below. Explicit opt-in settings generally
use `1`. Governed defaults follow per-project governance state when an environment value is absent;
explicit values retain precedence. Consult the listed code for the exact behavior.

| Flag | Default | Behavior | Source |
| --- | --- | --- | --- |
| `OFFSCRIPT_PLAYWRIGHT` | plain, off | enable render-measured rails (overflow/overlap/geometry) for `generate`/`harden`/`measure-responsive`; without it the render rails skip cleanly | `src/render-runtime.ts`, `src/generate/validate.ts`, `src/operators/responsive-need-rendered.ts`, `scripts/harden{,-collateral,-deck}.ts`, `scripts/measure-responsive.ts` |
| `OFFSCRIPT_ACTUATOR` | plain, off | M3 governed-actuator driver: run the dispatched per-pass edit loop vs. skip with a one-line message | `scripts/actuate.ts` |
| `OFFSCRIPT_DESIGNER_AUTHOR` | plain, off | Designer Author script: run (read-only summary, or a `--step=...` action) vs. skip with a one-line message | `scripts/designer-author.ts` |
| `OFFSCRIPT_AUTHOR` | plain, off → scripted | `=subagent` opts the in-session production author in; else the deterministic scripted double. On **website** this is necessary but not sufficient — `selectRealizationAuthor` also requires a governance pack (§4.4); on **collateral** it is the sole gate. | `scripts/generate.ts` |
| `OFFSCRIPT_SEMANTIC_SELECTION` | **governed-default** | W19 — semantic body as selection tie-break (rank key 5) | `scripts/generate.ts` → `plan.ts` |
| `OFFSCRIPT_SEMANTIC_AUTHOR` | **governed-default** | W20 — attach component knowledge to the author request (transport only) | `scripts/generate.ts` |
| `OFFSCRIPT_SEMANTIC_AUTHOR_CONSUME` | **governed-default** | W21 — author *consumption* directive (layered on W20; only the subagent author reads it) | `scripts/generate.ts` |
| `OFFSCRIPT_FAMILY_SELECTION` | **governed-default** | W24 — family knowledge as selection tie-break (rank key 6) | `scripts/generate.ts` → `plan.ts` |
| `OFFSCRIPT_MISSION_SELECTION` | **governed-default** | W30 — mission/audience as selection tie-break (rank key 7) | `scripts/generate.ts` → `plan.ts` |
| `OFFSCRIPT_RHYTHM_CADENCE` | **governed-default** | W50 — surface-only visual-rhythm cadence (adjacent same-archetype/same-surface repeats); no archetype/order/count effect | `scripts/generate.ts` → `plan.ts` |
| `OFFSCRIPT_PRESENTATION_INTENT` | **governed-default** | W52–58 — Presentation Intent, **collateral only** (e.g. the W57 StatsPage structural rule) | `scripts/generate.ts` → `plan.ts` |
| `OFFSCRIPT_W16_BAND_DELTA` | plain, `0` | W33 — W16 soft-band tolerance δ (non-negative int, deliberately **not** governed-default — W34 found no δ>0 worth tying to governance presence); `0` = byte-identical exact-max. Applies to both selector sites (composition router + fragment picker). | `scripts/generate.ts` → `PlanOptions.w16BandDelta` |
| `OFFSCRIPT_WEBSITE_VISUAL_DISCOVERY` | plain, off | W70 — website-only Foundation-stage field attach; **no consumer yet** (inert even when on) | `scripts/generate.ts` → `plan.ts` |
| `OFFSCRIPT_CONTENT_CAPACITY` | plain, off | P24 — website-only Foundation-stage field attach; **no consumer yet** (inert even when on; corpus authoring deferred) | `scripts/generate.ts` → `plan.ts` |
| `OFFSCRIPT_CREATIVE_ARTIFACT_CONSUMPTION` | plain, off | Sprint 1–8 — discover/select/attach a `CreativeArtifact` to matching plan items, embedded by the author | `scripts/generate.ts`, `src/generate/author.ts` |

## 8. Convention: scripted double before real executor

Scripted doubles verify deterministic contracts and pipeline mechanics. They do not establish
creative judgment or visual quality. Real authoring uses the injectable request/response boundary;
missing executor responses fail explicitly. Preserve schema, digest and approval checks.

Render-dependent checks require an available browser runtime. Static success does not certify
geometry, and recorded review execution does not by itself regenerate the deliverable.
