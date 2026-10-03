# Design Charter — the governing communication standard (Rulebook · HOW)

> **Brand-agnostic.** This rulebook describes *behavior and rules*, never appearance. It names no
> colour, type, pixel, or asset — every value it implies lives in the **Brand Pack** and is referred
> to here by **role**. It must still be true after a complete rebrand.
>
> **Authority.** Sits beneath `PHILOSOPHY.md` (the behavioral law) and above the visual-language and
> creatives rulebooks. **Source:** extracted from the brand charter (`_ARCHIVE` → `README.md` →
> *Design charter*); brand-specific token/icon-set references were generalised to roles.

---

## The governing standard
Every page, section and component is judged against one standard: **it must communicate first and
impress second.** When a trade-off arises, **prioritise understanding over visual complexity.** A
design succeeds when it reads first and impresses second — in this priority order: clarity,
scannability, readability, information hierarchy, professional credibility, fast comprehension.

## Structure
- **One communication objective per section.** If two messages compete equally inside a band, split
  them or subordinate one.
- **One primary focal point per viewport.** Test: *can a reader name the single most important thing
  on screen within ~3 seconds?* If not, simplify and strengthen the hierarchy through scale,
  position, spacing and contrast.
- **Grids serve clarity, not density.** Use them for strong alignment, predictable flow and
  consistent rhythm — design as a system, not as isolated sections. Never use a grid to maximise the
  number of elements on screen.

## Restraint
- **Progressive disclosure.** Content is revealed as needed, not dumped at once. A band feels
  complete without being crowded or sparse.
- **Every component justifies its presence** by advancing the narrative. Never add a card or widget
  to fill space; avoid the "dashboard effect" where many elements carry equal weight.
- **Visual interest comes from fundamentals** — scale, composition, typography, spacing, contrast and
  hierarchy — never from decorative effects, illustration, or embellishment.

## Hard constraints
- **Depth is not a hierarchy device.** Build hierarchy from **whitespace, typography, scale,
  alignment, proportion and composition**. There is no elevation and no glass treatment — no shadow,
  no backdrop blur, no glow, no depth simulation anywhere. If something needs to feel more important,
  give it more room, more scale, or a clearer position. *(The Brand Pack retains deprecated elevation
  tokens so nothing downstream breaks; they are inert, and referencing them violates this rule rather
  than satisfying it.)*
- **Hover only signals a real interaction** — buttons, links, nav, controls. Static, informational
  content never reacts to hover.
- **No negative margins and no layout hacks.** Resolve composition through spacing, grid, alignment
  and component structure.
- **Icons come from one defined set only.** No mixing icon sets, no custom one-off glyphs, no emoji,
  no illustrations standing in for icons. (The specific set is a Brand-Pack value.)
- **The system never produces the creative.** Photography, illustration, artwork, screenshots and
  marketing graphics are made independently. Where a page needs one, the system reserves its
  **position** — placement, dimensions, spacing, alignment, responsive behaviour — and nothing else.
  See `creatives.md`.

> Read these as laws on *behavior*. The exact icon set, the exact spacing step, the exact stroke are
> Brand-Pack values — this charter only governs **when and why** they may be used.
