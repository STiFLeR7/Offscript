# Example Brand Brand Pack — the house collateral brand (the swappable WHAT)

This directory is the **brand pack**: the single source of brand *truth* the engine binds to. It is
the **WHAT** (the values), distinct from the brand-invariant **HOW** that lives in
`design_processes/<track>/` (purpose, philosophy, rulebooks, component governance). Governance is
written by role; every concrete value — colour, type, spacing, radius — lives **here**.

A real external client supplies their *own* pack under `projects/<client>/references/`, which wins by
precedence; this Example Brand pack is the house default the collateral engine falls back to.

## Contents

| File / dir | What it is | Authority |
|---|---|---|
| `colors_and_type.css` | **The single source of brand truth.** Brand + neutral + soft-clay tokens, the type families & scale, radii, the spacing scale, and the A4 collateral layout classes. Every token carries its **usage rationale inline (Value + Why)** — the value *and* the rule for when it applies. | Primary |
| `accent-palette.css` | The **secondary expression palette** (16 Material families). Extends — never overrides — `colors_and_type.css`; loaded per-document *after* it, for data-viz / charts / diagram marks / categorisation / supporting UI. Primary brand chrome stays on the core sheet. | Secondary |
| `fonts/` | The self-hosted font files the `@font-face` rules in `colors_and_type.css` reference. | — |
| `assets/logo/` | The real brand lockups (colour + white). The engine embeds these as the page-header mark; the brand mark is never a typed wordmark. | — |
| `assets/imagery/` | Approved photography (concentrated where the system places imagery, per `collateral-core.md` §7). | — |
| `voice.md` | The brand voice: register, person, do/don'ts — the *how it speaks*. | — |
| `exemplars/` | Finished, brand-compliant gold-standard pieces — study for quality and rhythm, never clone. | — |

## The single-source rule

There is **one** home for any brand value: this pack. Usage rules for colour, type, and spacing live
as **inline rationale in `colors_and_type.css`** (and `accent-palette.css`), not duplicated into prose
elsewhere. If governance needs a value, it references it *by role* and resolves here — it never
restates the number. When the brand changes, only this pack changes; the governance above is untouched.

## How the engine binds it

`generate` derives `brand-contract.json` from `colors_and_type.css` (the slot→token map), so the rails'
abstract slot vocabulary (`--accent`, `--surface-0`, `--font-display`, …) resolves to these real
tokens. The map is auto-derived (`confidence:auto`) and may be reviewed and pinned to `confidence:human`.
