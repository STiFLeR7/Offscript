# creative-artifact-contract

Standalone schema/contract package for a **Creative Artifact** — the durable record of what
was *actually produced* from an approved Creative Intent. Sits beside the offscript
engine with its own `package.json`. Like the intent exporter and creative generation packages,
it stays outside `offscript/src/` imports.

## Why this exists, and why it's separate from Creative Intent

**Creative Intent** (`creative-intent-exporter/`) answers *"what should be created?"* — belief,
feature, camera, ratio, must-include. It is intent-only by design and stays that way.

**Creative Artifact** answers a different question: *"what was actually created, where is it,
what intent did it instantiate, what does it digest to, and is it approved for downstream
consumption by its origin system?"* These are deliberately two contracts, never merged — see
`schema/creative-artifact.schema.json`'s description field for the full boundary statement.

This package does **not** implement Creative Generation, an asset store, or website
consumption of an artifact. It provides schema and validation infrastructure. Artifact production is implemented in the
sibling `creative-generation/` package.

## Contract shape

```ts
interface CreativeArtifact {
  contractVersion: 1;
  id: string;                 // stable identity for this record — distinct from artifactDigest
  intentDigest: string;       // reference to the CreativeIntent this instantiates
  artifactType: 'html' | 'animated-html' | 'asset';
  location: string;           // portable reference — never an absolute machine path
  artifactDigest: string;     // content digest of what was actually produced
  createdAt: string;          // ISO-8601, immutable once set
  generation: { sourceSystem: string; runId?: string; generatorVersion?: string; methodologyVersion?: string };
  approval: { status: 'approved' | 'pending' | 'rejected'; source: string; evidence?: string };
  validation?: { status: 'passed' | 'failed' | 'unknown'; validator?: string; validatedAt?: string; reportDigest?: string };
  provenance?: Record<string, string | number | boolean>;
}
```

## Key design decisions

- **`intentDigest` != `artifactDigest`.** One intent can have multiple artifacts (desktop +
  mobile, static + animated); a regenerated artifact gets a new `id`/`artifactDigest` under the
  same `intentDigest`. See `test/scenarios.test.ts` for the proof cases.
- **Artifacts are immutable.** A regeneration is a wholly new record, not a mutation. No
  "supersedes" link is modeled — a future consumer filters by shared `intentDigest` instead.
- **`location` is portable by construction.** Either a project-relative path or a
  `content://sha256:<hex>` URI — never a drive letter, UNC path, absolute POSIX path, or `..`
  traversal segment. Enforced in `src/artifact/location.ts`, not by a single schema pattern
  (the rejected-shape set is richer than one regex can legibly express — same judgment-in-code
  choice this repo already makes for Creative Intent's trust precondition).
- **`approval` is scoped to its origin system, never Offscript.** `approval.source` names the
  system whose approval this reflects (e.g. `"creative-generation"`). Nothing in this package
  reads, imports, or maps into `src/project/readiness.ts`'s `ReadinessState` — a future explicit
  bridge could do that translation; this contract deliberately does not.

## Usage

```bash
npm install
npm test         # vitest — 51 tests across types/digest/location/validate/serialize/scenarios
npm run typecheck # tsc --noEmit
```

## Schema

`schema/creative-artifact.schema.json` is the single source of truth for field types and
closed enums — `CreativeArtifactValidator` (`src/artifact/validate.ts`) loads it at runtime via
ajv; nothing in `src/` duplicates its enum lists.
