# creative-intent-exporter

Standalone, read-only exporter that turns an **approved** creative from the Creatives
Generation system (Repo B, `Output/_LOG.md`) into a validated **Creative Intent** artifact —
the contract frozen in Program CG (CG6 semantics, CG7 schema).

This package is the **first producer** of Creative Intent (CG8). It is not an adapter: it
never converts to a Offscript Brief or a Rendering IR, and it never modifies its source. It is
a standalone package with its own `package.json`, never imported into `offscript/src/`.

## Usage

```bash
npm install
npm run export -- build --log-path <path-to-Output/_LOG.md> --out <output-dir>
```

Only creatives that are both `approved=yes` **and** carry the full v5+ field set
(`camera`/`ratio`/`must-include`/`content-provenance`) are exported — the contract is never
retrofitted onto a pre-existing (pre-2026-08-06) creative. Everything else is reported as a
`skipped` diagnostic, never silently dropped and never treated as an error.

## Architecture

```
Output/_LOG.md (Repo B, read-only)
      │  readLogLines            src/log/reader.ts
      ▼
raw dated lines
      │  parseLogLine            src/log/parser.ts
      ▼
ParsedLogLine
      │  buildCreativeIntentPayload   src/intent/build.ts   (reuses existing decided values verbatim)
      ▼
CreativeIntentPayload  ──(ineligible)──▶  diagnostic: skipped
      │  computeDigest           src/intent/digest.ts   (CG7 §2 canonicalization, exact)
      ▼
CreativeIntent (envelope + payload + digest)
      │  toWire                  src/intent/types.ts
      ▼
CreativeIntentWire
      │  CreativeIntentValidator.validate   src/intent/validate.ts
      │    (schema/ajv → digest recheck → trust precondition)
      ▼
   valid? ──no──▶ diagnostic: failed (never written)
      │ yes
      ▼
serializeCreativeIntent          src/intent/serialize.ts
      │
      ▼
<outDir>/<slug>.creative-intent.json
```

`src/export/exporter.ts` (`CreativeIntentExporter`) composes all of the above; it contains no
business logic of its own beyond orchestration and diagnostics collection.

## Testing

```bash
npm test         # vitest — 35 tests across parser/digest/build/validate/export
npm run typecheck # tsc --noEmit
```

## Schema

`schema/creative-intent.schema.json` is the single source of truth for field types and closed
enums — the validator loads it at runtime; nothing in `src/` duplicates its enum lists.
