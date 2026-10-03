# Offscript Brief Contract — the design system's external input interface

> **Status:** contractVersion 1 (brief `schemaVersion: 1`). Authoritative source: this file +
> `src/generate/brief.ts` (the parser is the executable form of this contract). A machine-readable
> schema ships alongside at [`brief.schema.json`](brief.schema.json).

This is the **one stable, versioned seam** the design system exposes for consuming intent produced
elsewhere. Anything that wants Offscript to generate a deliverable — a human, or an **ingress adapter**
(one standalone translator per upstream system) — writes a `brief.md` conforming to this contract at:

```
projects/<client>/references/brief.md
```

The bundled acquisition path accepts manual interview answers or a canonical brief.
External converters may produce this contract, but no sourcing or outreach adapters are bundled.

Offscript loads it at a single call site (`src/generate/context.ts` → `loadBriefIfPresent`), derives its
internal Intent Brief from it, and generates. **Nothing else is a supported input.**

---

## 1. What the brief is — and is not

- **The brief carries INTENT ONLY** — *what* you're making, *who* it's for, *how* it should feel.
  Offscript supplies the *how of execution* from shared methodology (`resources/`) and project-specific brand inputs; the rails own
  correctness.
- **The brief is NOT a governance artifact.** Claims, approval states, review gates, and publishing
  safety are **not** the design system's concern and have **no load-bearing field here.** If a governed
  content-engine feeds this pipeline, an **adapter** (outside both repos) enforces approval upstream —
  it must refuse to emit a brief for un-approved content — and may record what it approved *opaquely*
  via [`provenance`](#5-provenance-opaque-audit-only) for audit. The design system never interprets it.

This boundary is deliberate and load-bearing. Do not add claim/gate/approval semantics to the brief.

---

## 2. Schema (brief `schemaVersion: 1`)

Frontmatter is a YAML block fenced by `---`, followed by a free-form markdown body.

| Field | Required | Type | Meaning |
|---|---|---|---|
| `schemaVersion` | ✅ | integer | Contract major version. Must be in the supported set (see §4). Currently `1`. |
| `track` | ✅ | enum | `website` · `collateral` · `deck`. (`deck` generation is currently blocked at runtime.) |
| `one-liner` | ✅ | string | The single reader-outcome the deliverable must land. The most load-bearing line. |
| `brand` | — | string | Display name. Defaults to the titleized client id. |
| `audience` | — | string | Who arrives, and what they already believe or doubt. |
| `goals` | — | string[] | Ordered, most important first. Steers narrative, not layout. |
| `must-include` | — | string[] | Named sections the deliverable must carry — name the *job*, not a component. |
| `tone` | — | string | Voice / register. Taste only — never colours, sizes, or components. |
| `success-criteria` | — | string[] | What a successful encounter ends in. |
| `parent_url` | — | string | Parent brand to inherit palette/type/conventions from (Rule 0, sub-pages). |
| `source-doc` | — | path | Path (relative to `references/`) to long-form grounding copy. See §6. |
| `provenance` | — | map<string,string> | Opaque upstream audit stamp. See §5. |

Only `schemaVersion`, `track`, and `one-liner` are required. **Everything else is optional but improves
the result** — completeness is the single biggest lever on output quality.

**Validation behavior (VERIFIED against `parseBrief`):**
- Missing required fields → one error listing all of them.
- Malformed YAML → throws (never silently demoted to a stub).
- Unknown `track` → throws, naming the value.
- Unsupported `schemaVersion` → throws, naming the supported set (§4).
- **Unknown frontmatter keys → a non-fatal `console.warn`** (drift diagnostic — catches adapter typos
  like `must_include` vs `must-include`), then ignored. Unknown keys are never fatal, keeping the
  contract forward-compatible.
- Absent `brief.md` → the generate pipeline substitutes a stub (a legitimate skeleton run);
  present-but-malformed always errors.

---

## 3. Track selection

Choose `website`, `collateral`, or `deck` explicitly. External producers are responsible for
mapping their own deliverable types into this vocabulary; unsupported types must not be guessed.
Deck generation remains blocked by missing methodology.

---

## 4. Versioning strategy

Brief schema and design governance use independent version namespaces:

| Version | Owned by | Where |
|---|---|---|
| **brief `schemaVersion` / contractVersion** | **design system (this contract)** | `brief.md` + `SUPPORTED_BRIEF_VERSIONS` |
| `governanceVersion` | design governance | `resources` CSS marker → `manifest.json` |

**Policy for the brief `schemaVersion` (major integer):**
- The engine accepts any version in `SUPPORTED_BRIEF_VERSIONS` (`src/generate/brief.ts`). Today: `{1}`.
- **Additive, backward-compatible changes** (a new *optional* field) do **NOT** bump the major — older
  and newer briefs both parse. This is why unknown keys warn rather than fail.
- **Breaking changes** (removing/retyping a field, changing the required set) bump the major. When that
  happens, keep the previous major in `SUPPORTED_BRIEF_VERSIONS` for a deprecation window so an adapter
  can migrate without a hard cutover.
- A future content-engine can therefore evolve freely: it only breaks this pipeline if it emits a brief
  `schemaVersion` the design system has dropped — and then it fails **loudly**, with a message naming
  the supported set, not silently.

---

## 5. `provenance` (opaque, audit-only)

An optional mapping the design system carries **verbatim** into the per-run `manifest.json`
(beside `score.json`) and **never interprets**. It exists so an adapter can prove, after the fact, which
governed input a generated deliverable was built from — without leaking governance logic into the design
system. All values are coerced to strings; a non-mapping value is ignored; absent → nothing recorded (the
manifest stays byte-identical to a no-provenance run).

Suggested keys an adapter may stamp (none are required or validated):

```yaml
provenance:
  sourceSystem: content-core
  packetId: uk-accounting-landing-page
  packetStatus: approved_external      # recorded for audit; NOT enforced here
  packetVersion: "1"                   # upstream content-engine schema/version
  sourceHash: <hash of the packet consumed>
  # Future context (e.g. domain / region) may also ride here opaquely — the engine
  # will record but never act on it. Add a real brief field only when a concrete
  # generation need exists (YAGNI), never speculatively.
```

Because provenance is opaque, the content-engine can add or rename provenance keys at will without any
offscript change.

---

## 6. `source-doc` — the sanctioned grounding channel

`source-doc` names a long-form markdown file (relative to `references/`) whose body Offscript uses for
deterministic per-page content grounding (`context.ts` → `plan.ts`). **This is the blessed channel for an
adapter to pass a governed packet's body as verbatim copy:** write the packet's approved prose to a file
under `references/`, point `source-doc` at it, and Offscript grounds sections in it rather than authoring from
intent alone. The design system treats it as unstructured copy — it parses no packet frontmatter, claims,
or gates from it. A declared-but-missing `source-doc` warns and is non-fatal.

---

## 7. Extension strategy (how to grow this contract without coupling)

1. **Prefer `provenance` for anything the engine doesn't need to act on.** It is the pressure-relief
   valve: opaque, unversioned from the engine's view, infinitely extensible by the adapter.
2. **Add a real brief field only when generation must act on it**, and only as an *optional* field
   (no major bump). Update this doc, `brief.schema.json`, `KNOWN_BRIEF_KEYS`, and a test together.
3. **Never** add governance/claims/approval semantics — enforce those upstream in the adapter.
4. Bump the major only for a breaking change, and keep the old major supported for a deprecation window.

---

## 8. Minimal and complete examples

A minimal valid brief:

```markdown
---
schemaVersion: 1
track: website
one-liner: Show finance teams they can close the books in days, not weeks.
---
```

A fuller brief (including an adapter-stamped provenance block) is in
[`brief.example.md`](brief.example.md).
