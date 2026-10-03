# Purpose

**This design system is the single source of truth an AI consults to build pages. It turns intent into on-brand design — and it grows with every page it builds.**

An AI working inside this system never designs from imagination. Every visual decision — color, type, spacing, layout, component choice — is **answered by the system, not invented**. The AI brings the intent; the system supplies the how.

Given what a section or page must communicate, the system guides the AI to the right component: **selecting** from a meta-indexed catalog when a fit exists, **curating** a new composition when none does — so every output obeys the brand guidelines and nothing looks generic or improvised.

The brand guidelines are the system's **law**. The component catalog is its **memory**. Curation is how it **grows**. New compositions, template outputs, and flagged rule conflicts are all stored back — the system gets smarter with every page it builds, while the brand layer stays swappable.

## How it works — the operating loop

1. **Read the brand guidelines first.** Nothing is built before this. Every CSS property of every component must strictly align to them.
2. **Understand the intent.** What must this section or page communicate? The system thinks at both levels: the section is the unit of work; the page is the narrative — section order, rhythm, flow.
3. **Match by meta, never by name.** Components are known through centralized, indexed meta information describing their layout and composition. They are never chosen by filename or label.
   The catalog's physical structure mirrors this meta: components are sorted into a well-structured hierarchy by category, and the index lives **outside** the components — mapping each one to its place and its purpose, so navigation always goes through the index, never through browsing.
4. **Pick or curate.** If a cataloged component serves the intent within brand, use it. If none fits, compose a new one — thinking across categories — and present **3 variations for human approval**. The chosen one joins the catalog.
5. **Remember templates.** Pages that share a template (same structure, different skin) store their output, so the next page with that structure starts from the last one, not from zero.
6. **Store everything back.** Curated components, template outputs — the catalog gets richer with use.

## Principles

- **Brand wins every conflict.** When a guideline blocks a clearly better design, follow the guideline — and flag the conflict, so the guideline itself can improve.
- **The brand layer is the only swappable part.** Replace the guidelines and the entire system re-themes. Nothing else changes.
- **Assets and the UI-kit are used as-is** — never decorated, never padded with filler.
- **No AI slop.** Every output must read as deliberately designed.

## What this system is not

- **Not a one-brand asset** — it's an engine; the brand is a plug-in.
- **Not a static component library** — it selects by intent and curates when needed. It thinks.
- **Not a shippable product** — it's an internal capability for producing design.
- **Not a fixed aesthetic** — the look can change completely; the process is what's permanent.
