# ASSETS.md — the variable-layer catalog (SELECT layer for images / textures / vectors / gradients)

**What this is.** The authoritative index for *choosing* the **variable layer** — the images,
textures, logos, gradients and decorative elements a section is skinned with — **by intent**, the
same way `COMPOSITION.md` selects sections by intent. Section *structure* was already curated; this
closes the gap (PROBLEM 4) so the *variable parts* are chosen deliberately, not by vibe.

Like the component catalog, the **index lives outside the assets** and navigation goes through it:
`tools/build-assets.js` reads this file + the real component usage and generates
`assets/manifest.json` (machine-readable; never hand-edited). Add an asset → add a row here → run
`node tools/build-assets.js`.

> **Grounded in real usage.** The generator scans every `fragments/*.html` for `src`/`href` **and**
> CSS `url()` references, inverts them, and stamps each asset with the `serves` / `surface` of the
> components that actually use it. The tables below add the **subjective** layer (kind, mood,
> vertical, aspect, direction) on top of that objective usage.

---

## Controlled vocabulary

- **kind:** `background` · `texture` · `photo` · `environment` · `avatar` · `logo` · `gradient` · `element`

  `environment` is the one kind that is not a *subject*. It is approved environmental
  photography used to establish the atmosphere a section is read in — see **Environmental
  imagery** below. A `photo` shows you something; an `environment` is where you are standing.
- **surface** (where it sits): `light` · `ink` · `gradient` · `warm` · `any`
- **mood** (cool palette only — v2 has no warm note): `portrait` · `editorial` · `atmospheric` ·
  `calm` · `dense` · `technical` · `bright`
- **serves** (intent keywords — same vocabulary as `COMPOSITION.md`): `hero` · `creative-bg` ·
  `feature` · `stats` · `team` · `testimonials` · `customer-story` · `resources` · `insights` ·
  `integrations` · `value-prop` · `cta` · `brand-mark` · `element` · `surface-treatment`
  *(`surface-treatment` is the one keyword that selects nothing: the three assets carrying it are
  canonical and always used together, in a fixed order — see the section near the end of this file.)*
- **vertical:** `bfsi` · `healthcare` · `staffing` · `supply-chain` · `any`
- **aspect:** `1:1` · `3:4` · `4:3` · `16:9` — **the closed creative ratio vocabulary**, plus `free`.

  For a delivered creative the `aspect` column records the approved ratios the asset can be
  **composed at**, which is not the ratio of the file: the environmental library is 3:2 at
  source and is *always* cropped. See **Environmental imagery** below.

  The four ratios are the *whole* vocabulary for a creative occupying a reserved position: `1:1`
  product fragments and small creative moments · `3:4` portrait and human storytelling · `4:3`
  editorial illustration and product composition · `16:9` interfaces, dashboards and wide hero
  demonstrations. **Never invent a ratio to fit available space** — not `5:7`, `7:9`, `13:8`, and
  not the easy near-miss `4:5` against `3:4`. If a layout cannot take an approved ratio, the layout
  changes (`rulebooks/creatives.md` — Creative-First Composition).

  **`free` is not an escape hatch from that rule, and must never be used as one.** It marks an asset
  that does not occupy a reserved creative position at all — a wordmark, a canonical surface texture,
  an atmospheric background used as material. Those have no reserved proportion to preserve. **A
  photograph, screenshot, illustration or any other creative filling a reserved position takes one of
  the four.**

---

## Folder conventions  (default meta by location — the generator applies these to every file)

| folder | kind | surface | serves | mood |
| --- | --- | --- | --- | --- |
| `environments/` | environment | any | hero, creative-bg, value-prop | atmospheric |
| `avatars/` | avatar | light | team, testimonials | portrait |
| `customer-story/` | photo | light | customer-story, testimonials, outcomes | editorial |
| `insights/` | photo | warm | resources, insights | editorial |
| `textures/` | texture | any | surface-treatment | — |
| `creative-background/` | background | ink, gradient | — | atmospheric |
| `creative-background/web/` | background | ink, gradient | — | atmospheric |
| `(root)` | photo | any | — | editorial |

> **Note — `creative-bg` is granted per-asset, not by folder.** The folder default is deliberately
> `—` (no `serves`): the per-blur visual pass (below) found most of the pool is **off-brand** for v2,
> so a blur only earns `serves: creative-bg` through a per-asset override. This stops the SELECT layer
> from ever auto-surfacing a banned-hue background.

> **Per-blur visual pass — DONE (2026-06-14), and it surfaced a brand-law problem.** An eyes-on review
> of every `blur-*` (PNG pool + `/web` set) found the pool is **overwhelmingly off-brand for v2**:
> violet / pink / lavender / magenta (`blur-1,2,2.1,3,4,5,8,9,10` + their `/web` mirrors) and one green
> (`blur-6`). **Only `blur-7.png` and `web/blur-7.jpg` are brand-legal** (clean cool blue). The
> BRIDGE-3 hue-sweep scanned CSS *values* and could not see colour baked into **raster** images, so
> these off-brand blurs had been wired into ~8 components as visible backgrounds. They are now all
> **re-pointed to `blur-7`** (see `tools/_repoint-blurs.js`; ALIGNMENT.md GAP-8/BRIDGE-10) and the
> off-brand files are **quarantined** here (`serves: —`). The only remaining gap a schema can't close:
> **regenerate a *cool* atmospheric set** (image-gen) to restore per-blur variety — until then `blur-7`
> + the `brand-gradient` recipe are the two on-brand creative backgrounds.

---

## Per-asset overrides  (specific tags that beat the folder default)

| file | kind | surface | serves | vertical | aspect | direction |
| --- | --- | --- | --- | --- | --- | --- |
| `logo-color.svg` | logo | light, warm, gradient | brand-mark | any | free | Colour wordmark — light & gradient surfaces (nav-surface rule) |
| `logo-white.svg` | logo | ink | brand-mark | any | free | White wordmark — ink/dark surfaces only |
| `textures/noise-texture.webp` | texture | any | **surface-treatment** | any | free | **CANONICAL — not selectable.** Layer 1 of the surface treatment. See the section below; do not substitute. |
| `textures/film-texture.webp` | texture | any | **surface-treatment** | any | free | **CANONICAL — not selectable.** Layer 2 of the surface treatment. See the section below; do not substitute. |
| `textures/grunge-retro-texture.webp` | texture | any | **surface-treatment** | any | free | **CANONICAL — not selectable.** Layer 3 of the surface treatment. See the section below; do not substitute. |
| `texture-gradient.png` | texture | ink, gradient | creative-bg, element | any | free | v2 — radial blue/black blob behind dark cards & stat tiles. Retained, not referenced by the current language. |
| `texture-grain.png` | texture | any | element | any | free | v2 — fine noise overlay over flat colour blocks. Superseded by `noise-texture`; retained, not referenced by the current language. |
| `environments/env-cliffside-muted.jpg` | environment | any | creative-bg, value-prop, feature | any | 16:9 · 4:3 · 1:1 · 3:4 | **CANONICAL library — see the section below.** The most restrained member; recedes furthest behind copy. Focus `50% 42%`. |
| `environments/env-dawn-haze.jpg` | environment | any | hero, creative-bg | any | 16:9 · 4:3 · 1:1 | **CANONICAL library.** The most cinematic; large natural negative space on the light side. Focus `55% 50%`. Not for 3:4 — the crop loses the flare that is the whole image. |
| `environments/env-lake-mirror.jpg` | environment | any | value-prop, creative-bg | any | 16:9 · 4:3 · 1:1 · 3:4 | **CANONICAL library.** Bright, calm, deliberately centred — a quiet closing surface, never a hero (an obviously centred subject is what hero composition avoids). Focus `50% 50%`. |
| `environments/env-massif-banded.jpg` | environment | any | hero, creative-bg, feature | any | 16:9 · 4:3 · 1:1 · 3:4 | **CANONICAL library.** Strong horizontal depth layers; holds its subject at every approved ratio. Focus `40% 45%`. |
| `environments/env-massif-clear.jpg` | environment | any | creative-bg, feature | any | 4:3 · 16:9 · 1:1 | **CANONICAL library.** The most detailed member — busy enough to compete with copy, so prefer it as a subject rather than behind text. Nearly 4:3 at source. Focus `50% 42%`. |
| `environments/env-ridges-distant.jpg` | environment | any | hero, creative-bg, value-prop | any | 16:9 · 4:3 · 1:1 · 3:4 | **CANONICAL library.** The largest quiet sky and the most versatile across ratios. Focus `50% 50%`. |
| `environments/env-valley-deep.jpg` | environment | any | hero, creative-bg, feature | any | 16:9 · 4:3 · 1:1 · 3:4 | **CANONICAL library.** The deepest recession; saturated and dense at the edges. Focus `64% 45%`. |
| `value-bg.jpg` | photo | warm | value-prop, cta | any | 16:9 | Atmospheric value-band backdrop |
| `resource-docs.jpg` | photo | light | resources | any | 4:3 | Document/resource card imagery |
| `resource-office.jpg` | photo | light | resources | any | 4:3 | Office/team-context resource imagery |
| `avatars/hero-work.jpg` | photo | light | hero | any | 3:4 | Hero work-context portrait (not a team headshot) |
| `avatars/case-lead.jpg` | avatar | light | customer-story, social-proof | any | 1:1 | Named customer lead in case studies |
| `avatars/testimonial-1.jpg` | avatar | warm | testimonials | any | 1:1 | Testimonial portrait |
| `avatars/testimonial-2.jpg` | avatar | warm | testimonials | any | 1:1 | Testimonial portrait |
| `creative-background/blur-7.png` | background | gradient, ink | creative-bg, hero, cta, feature | any | free | **ON-BRAND** cool-blue atmospheric — the brand-legal creative background (calmest → hero; also CTA / feature panels) |
| `creative-background/web/blur-7.jpg` | background | gradient, ink | creative-bg, hero, cta, feature | any | free | **ON-BRAND** web-optimised cool blue (same image as `blur-7.png`) |
| `creative-background/blur-1.png` | background | ink, gradient | — | any | free | OFF-BRAND v2 (violet + amber) — quarantined; use `blur-7` / `brand-gradient` |
| `creative-background/blur-2.png` | background | ink, gradient | — | any | free | OFF-BRAND v2 (pink + amber) — quarantined |
| `creative-background/blur-2.1.png` | background | ink, gradient | — | any | free | OFF-BRAND v2 (pink/magenta) — quarantined |
| `creative-background/blur-3.png` | background | ink, gradient | — | any | free | OFF-BRAND v2 (lavender + periwinkle) — quarantined |
| `creative-background/blur-4.png` | background | ink, gradient | — | any | free | OFF-BRAND v2 (lavender/violet) — quarantined |
| `creative-background/blur-5.png` | background | ink, gradient | — | any | free | OFF-BRAND v2 (violet/pink) — quarantined |
| `creative-background/blur-6.png` | background | ink, gradient | — | any | free | OFF-PALETTE v2 (green/lime — off the cool blue/teal axis) — quarantined |
| `creative-background/blur-8.png` | background | ink, gradient | — | any | free | OFF-BRAND v2 (blue + violet) — quarantined |
| `creative-background/blur-9.jpg` | background | ink, gradient | — | any | free | OFF-BRAND v2 (periwinkle + peach sunset) — quarantined |
| `creative-background/blur-10.jpg` | background | ink, gradient | — | any | free | OFF-BRAND v2 (lavender/violet) — quarantined |
| `creative-background/web/blur-2.jpg` | background | ink, gradient | — | any | free | OFF-BRAND v2 (pink) — quarantined |
| `creative-background/web/blur-3.jpg` | background | ink, gradient | — | any | free | OFF-BRAND v2 (lavender/violet + blue) — quarantined |
| `creative-background/web/blur-4.jpg` | background | ink, gradient | — | any | free | OFF-BRAND v2 (lavender/violet) — quarantined |
| `creative-background/web/blur-6.jpg` | background | ink, gradient | — | any | free | OFF-PALETTE v2 (green) — quarantined |
| `creative-background/web/blur-9.jpg` | background | ink, gradient | — | any | free | OFF-BRAND v2 (periwinkle + peach) — quarantined |

---

## Curatable elements  (CSS recipes, not files — the vectors & gradients)

These are the **generated** variable parts. They have no file, but they are chosen by intent and
carry brand law, so they belong in the catalog (kind `element` / `gradient`).

| element | kind | surface | serves | direction |
| --- | --- | --- | --- | --- |
| `brand-gradient` | gradient | gradient, ink | creative-bg, cta, hero | The 3-stop cool recipe: deep ink → `--cr-ink-violet` (`#14233A`) → `--cr-teal-900` + grain overlay. **Never indigo/purple** (brand law). The alternate to an atmospheric blur. |
| `orbit-ring` | element | ink, gradient | element, hero, cta | 1px white circle ~40% opacity, ~1500px, ghosting from a corner — the recurring "orbit" motif on coloured imagery. Sparingly. |
| `dot-constellation` | element | ink | element | Hairline dot grid / radial-dot field on dark cards — suggests "a system in motion". One per dark band, low contrast. |

---

## Section Playbook for assets  (intent → which variable parts to reach for)

Mirrors `COMPOSITION.md`'s Section Playbook: pick by the **intent** you're skinning, across kinds.

- **Environmental imagery (hero · editorial background · transition)** →
  **`environments/env-*`, and nothing else.** Pick by what the section is doing, not by which
  photograph is nicest:
  - **Hero** → atmosphere before content. `env-dawn-haze` (cinematic, negative space on the
    light side) · `env-ridges-distant` (quiet sky) · `env-valley-deep` (deep recession) ·
    `env-massif-banded`. Avoid an obviously centred subject — that is why `env-lake-mirror`
    is not on this list. Typography occupies the negative space; it never covers the subject.
  - **Closing banner** → **never.** The closing call-to-action band is a SOLID brand surface: no
    environment, no photograph, no gradient. Its material is the grain and the printed-imperfection
    layer over a flat colour, and that is all of it. Enforced in the pack, not left to discipline —
    an environment selection on a closing band resolves to nothing.
  - **Editorial section background** → reinforce the narrative, don't illustrate the copy.
    `env-cliffside-muted` (recedes furthest) · `env-ridges-distant`. Editorial communication
    is typography first, imagery second; avoid literal visual metaphor.
  - **As the subject** (a creative surface rather than a background) → any of them, and
    `env-massif-clear` especially, which is too detailed to sit behind text.

  Every selection has to answer one question: **why is this the correct environmental
  atmosphere for this section?** "It looks good" is not an answer — the answer comes from the
  Section Composition Archetype and the communication intent.
- **Hero background (non-photographic)** → `creative-background/blur-7` (the brand-legal cool-blue atmospheric), or
  `brand-gradient` (gradient hero) · hero portrait: `avatars/hero-work.jpg` · wordmark:
  `logo-color`/`logo-white` per surface. *(The rest of the `blur-*` pool is off-brand and quarantined —
  see the per-blur note above; do not reach for it until a cool set is regenerated.)*
- **Creative background (the README "one mode per section")** → **default:** the atmospheric
  `creative-background/blur-7`; **alternate:** `brand-gradient` + `texture-grain`. Never mix modes in
  one section. **Only `blur-7` is brand-legal today** — the other blurs violate "no purple/violet in v2".
- **Team / leadership** → `avatars/team-*`, `avatars/leader-*` (portraits).
- **Testimonials / reviews** → `avatars/testimonial-*`, `avatars/avatar-*`, and named-customer
  `customer-story/cs-*`.
- **Customer story / case study** → `customer-story/cs-*` + `avatars/case-lead.jpg`.
- **Resources / insights / news** → `insights/insight-*`, `resource-docs.jpg`, `resource-office.jpg`.
- **Value-prop band** → `value-bg.jpg`.
- **Stats / dark proof bands** → `texture-gradient.png` (behind stat tiles) + `dot-constellation`.
- **Brand mark (nav/footer)** → `logo-color.svg` (light/gradient nav), `logo-white.svg` (ink nav).
- **Decoration / depth on coloured imagery** → *(v2 — the current language has no depth and does not
  decorate. Branded surfaces instead carry the fixed **surface treatment**; there is nothing to
  select. See the section below.)*

*(Verticals: tag a `bfsi`/`healthcare`/`staffing`/`supply-chain` asset in the overrides table and it
surfaces here for that vertical. Today most imagery is `any`; the per-blur visual pass is where
vertical tone gets assigned.)*

---

## Environmental imagery — the canonical library

> **These assets form part of the Example Brand Brand Pack.** They are approved environmental
> creative, made by people and delivered to the system — **the single source of truth for
> environmental photography across the website.** When a section, hero, transition or editorial
> composition needs environmental imagery, it is **selected from here**. (The closing
> call-to-action band is the one place it is refused outright — see below.) Not generated, not sourced from a stock library, not invented because nothing here
> quite fit. Governed by `governance/website/rulebooks/creatives.md`.

**Selection is the only affordance, and that is enforced, not requested.** Each asset is
reachable through a named selection in the pack that carries the image *and* its focus
together; **there is no handle that accepts a URL.** A path typed at a call site can point at a
stock library, a generated image, or a file that is not in the pack at all — and every one of
those reads as a perfectly legitimate CSS value. Naming the library makes *"use an approved
asset"* a property of the mechanism rather than a rule someone has to remember.

### Every one of these is cropped. That is the point of the focus.

**The library is 3:2 at source, and 3:2 is not an approved ratio.** Six of the seven measure
1.500 and the seventh 1.328; the closed vocabulary is 1:1 · 3:4 · 4:3 · 16:9. So **every
placement crops**, and the two rules that govern it are not in tension once stated plainly:

- **Never distort.** No stretching, squashing, or non-uniform scaling to make an image meet a
  ratio. This is structural, not a convention — the creative surface resolves through
  `aspect-ratio` + `cover`, which can only ever crop.
- **Crop to an approved ratio, at a chosen focus.** "Preserve the aspect ratio" means *preserve
  the creative* — never the licence to ship an off-vocabulary proportion. If a layout cannot
  take an approved ratio, **the layout changes** (Creative-First Composition).

**The focus is half the selection, not a refinement of it.** A centre crop is simply the crop
nobody chose, and on a 3:2 master a 3:4 composition keeps only **half the width** — enough to
lose the subject entirely. Each focus below was checked against the crop it produces **at all
four ratios**, not judged from the full frame.

### The pool is entirely landscape — say so rather than claim coverage

There is **no portrait environmental creative here**, and `3:4` is defined for *portrait
photography, human subjects and storytelling imagery*. This library serves **16:9, 4:3 and 1:1
naturally**, and 3:4 only where an asset's focus was verified to survive the half-width crop
(marked in the table above). An environment forced into 3:4 to fill a portrait slot is the
layout dictating the creative — exactly backwards.

### Green subject matter is not an off-brand hue

The `blur-*` pool was quarantined for violet, pink and green, and that rule holds — but it is
about **synthetic colour fields**, where the hue *is* the asset and reads as a brand colour.
**A forest is subject matter.** These are on the cool blue/teal axis in tone, they carry no
generated brand colour, and the surface treatment sits over them. Do not quarantine this
library by analogy with the blurs.

### Legibility is measured, not assumed

An environment used **as a surface** carries a veil of the page cream — the scrim — because a
text-bearing surface's contrast was only ever measured against flat colour. **Unveiled, the
worst case here measures 1.02:1**: text that is, in practice, invisible, and nothing in
governance would have caught it. The veil is set by the library's darkest member rather than
chosen; measured on the real render it clears **7.37:1** at worst, above the **6.11:1** the
solid surface already had. **The surface keeps the measurement it replaces.**

**An asset that cannot clear that bar does not join the library.** Re-measure when adding one.

A creative shown as the **subject** is never scrimmed — there is no text to protect, and
veiling it would dim the thing being shown. Same asset, two jobs.

### The library

| file | mood | best at | focus | what it is, and what it is for |
| --- | --- | --- | --- | --- |
| `env-ridges-distant.jpg` | calm, atmospheric | 16:9 · 4:3 · 1:1 · 3:4 | `50% 50%` | Receding hazy ridges under a deep cloud bank. The largest quiet sky in the library and the most versatile across ratios — the safest reach when a section needs atmosphere without a strong subject, and a strong hero. |
| `env-dawn-haze.jpg` | atmospheric, cinematic | 16:9 · 4:3 · 1:1 | `55% 50%` | Backlit morning haze, flare left, silhouetted treeline right, still water. The most cinematic member; its natural negative space on the light side is where typography belongs. **Hero.** |
| `env-massif-banded.jpg` | atmospheric, dense | 16:9 · 4:3 · 1:1 · 3:4 | `40% 45%` | Grey massif, dark conifer band, turquoise lake. Strong horizontal depth layers; the only member that holds its subject convincingly at every approved ratio. |
| `env-valley-deep.jpg` | dense, atmospheric | 16:9 · 4:3 · 1:1 · 3:4 | `64% 45%` | Enclosed green valley flanked by forest, glacier peak beyond. The deepest recession in the library; saturated and dense at the edges, so it wants room. |
| `env-cliffside-muted.jpg` | calm, editorial | 16:9 · 4:3 · 1:1 · 3:4 | `50% 42%` | Muted, near-monochrome cliff and forest under a white sky. The most restrained member — it recedes furthest behind copy, so reach for it when the typography must lead. |
| `env-lake-mirror.jpg` | bright, calm | 16:9 · 4:3 · 1:1 · 3:4 | `50% 50%` | Symmetrical mirror lake under cumulus. Bright and quiet, but **deliberately centred** — a closing surface, not a hero, because an obviously centred subject is what hero composition avoids. |
| `env-massif-clear.jpg` | dense, technical | 4:3 · 16:9 · 1:1 | `50% 42%` | Jagged limestone massif over transparent shallows. The most detailed member — busy enough to compete with copy, so prefer it as a **subject** rather than behind text. Nearly 4:3 at source. |

---

## Composed creatives — the second delivered library (2026-07-29)

> **These assets form part of the Example Brand Brand Pack.** Delivered by the design team as
> **finished compositions**, and selected by name exactly like an environment — there is no handle
> that takes a URL. Governed by `governance/website/rulebooks/creatives.md`.

### What makes this a second library rather than seven more environments

An **environment** is raw material: a place, which the system then dresses — its own crop, its own
scrim, its own grain. That is why one environment can read two ways in two sections.

A **composed creative arrives finished.** The crop, the colour, the edge rule and the corner chip
were decided by the people who made it. Everything the system would normally do to a creative surface
would therefore be done *on top of decisions already taken* — which is the one thing
`rulebooks/creatives.md` forbids outright: **never modify the asset.**

So all of the system's usual moves are withdrawn for this library, and the withdrawal is enforced
rather than trusted (`verify.py` check 16 fails if any of them come back):

| | environments | composed creatives |
|---|---|---|
| directory | `assets/imagery/environments/` | `assets/imagery/creatives/` |
| vendored as | JPEG, Lanczos-downscaled, q82 | **the delivered PNG, byte-for-byte** |
| proportion | cropped to one of the four approved ratios | **the asset's own**, bound to it in the pack |
| fit | `cover` (crops) | **`contain` (crops nothing)** |
| focus | chosen per asset, half of the crop decision | **none** — there is no crop to focus |
| material | grain · analog-tonal · printed-imperfection | **none** — it would be a filter |
| container | card radius, clipped | **no radius, no clip, no background plate** |
| selection | `.cr-env-*` | `.cr-cre-*` |
| accents | applied by the system | **in the pixels** |

**The four-ratio vocabulary defers here, and that is not a loophole.** Those four exist to stop the
*system* inventing a proportion for a position it is reserving. A finished composition is not a
reserved position — its proportion is part of what was delivered. The ratio is still not free and
still is not typed at a call site: it travels with the asset, exactly as a focus does for an
environment.

**What is still done to them:** they are scaled down uniformly to fit the column they sit in, which
is unavoidable for a 1396px file in a 455px column and changes no proportion and no pixel
relationship. Nothing else.

**Their accents are in the pixels.** Every accent rule in this system reads computed style, so a
baked chip or edge rule is invisible to the ≤20% budget, the three-moment count and the
one-accent-per-band check. Two of the five carry two accents each. Nothing measures this today — see
the `apa-finance` FINDINGS.

### The library

| file | native | serves | what it is, and what it is for |
| --- | --- | --- | --- |
| `creatives/cre-horizon-marked.png` | 561×690 | creative-bg, value-prop | A banded massif above still water; orange corner chip, purple right edge. The only member with **no product surface in it** — reach for it where a band needs atmosphere rather than evidence. Portrait, so it takes a lot of area: at supporting presence it will not clear the focal margin beside an argument. **An incidental-presence asset.** |
| `creatives/cre-workplace.png` | 680×653 | hero, value-prop, team | A person working at a laptop; purple chip, orange left and bottom rules. The only member with a **human subject**, and the squarest — the one composed asset that holds a `s`-presence position beside copy. |
| `creatives/cre-agent-insight.png` | 678×734 | feature, value-prop | An agent panel surfacing the reasoning behind a record, set into a forest. Shows an agent **explaining itself**, which is a different claim from showing a dashboard. |
| `creatives/cre-operating-view.png` | 1396×838 | feature, outcomes | A device-and-status list over a massif — the closest thing in either library to an **operating view**. ⚠ third-party product name, see below. |
| `creatives/cre-prompt-surface.png` | 1396×838 | feature | An agent input surface over a lake. ⚠ it is a prompt bar, see below. |

**Proportion drives placement.** These are not interchangeable across positions: a portrait frame at
`s` presence occupies more area than the argument beside it and fails the decisive-margin floor,
while the near-square and landscape members clear it comfortably. Check the position's archetype
before selecting — it is the same discipline as matching an environment to a section's intent, with
geometry doing the constraining.

### Two caveats that belong with the assets, not with a page

Both are properties of the files and will follow them onto every page that selects them:

- **`cre-operating-view` names a third-party product in its interface.** On a marketing surface that
  reads as an integration or a partnership claim, which is the *fabricated substance* class of
  problem — the reader may believe something untrue. **Recommend a re-export with Example Brand's own
  interface** before this is used prominently. Placed incidentally until then.
- **`cre-prompt-surface` is a prompt bar.** Any page whose argument is that assistants and copilots
  stop short of owning a process is arguing against the thing this image shows, and several briefs
  explicitly refuse "chatbot interfaces". It is not off-brand; it is **off-argument** for that class
  of page. Check the page's own claim before selecting it.

Neither is a reason to source around the library. Both are findings to report, which is what this
section is.

### Provenance & derivation

Masters are the design team's Figma exports (`New-visual-creative-direction/creatives/`,
`Frame 2147226604 / -1 / 2147226614 / 2147226616 / 2147226617.png`). **These are vendored
byte-for-byte** — verified by SHA-256 against the source — because they are already curated. There is
no derivation step to record and none to reproduce: no downscale, no re-encode, no crop, no flatten,
no treatment. 4.4 MB, carried as delivered.

If a size budget ever forces a re-encode, that is a **creative decision to take with the design team**,
not a build step to add here — a lossy pass over a finished composition is a modification of it.

---

### Provenance & derivation

Masters live in `New-visual-creative-direction/Nature-Images/` and are **not committed** —
26.7 MB against 3.2 MB vendored. Sourced from Unsplash; the master filenames carry the
photographer credit and the Unsplash asset id, and are the record of it.

Every vendored file is derived identically, and the derivation is complete — any of them can be
regenerated exactly:

> **Lanczos downscale to 2000 px on the long edge; JPEG quality 82, progressive, optimized.
> The native aspect ratio is preserved — no crop is baked in.**

The crop is a **composition** decision the pack makes at render time, from the ratio and the
focus. Baking it into the file would multiply every asset by four and freeze a decision the
vocabulary exists to make.

| vendored | master | source | vendored |
| --- | --- | --- | --- |
| `env-cliffside-muted.jpg` | `tobias-marks-js4tYfsGnog-unsplash.jpg` | 4896×3264 (3:2) | 2000×1333, 585 KB |
| `env-dawn-haze.jpg` | `lea-kobal-sfI0_B5W5Z0-unsplash.jpg` | 6000×4000 (3:2) | 2000×1333, 434 KB |
| `env-lake-mirror.jpg` | `erin-o-brien-lk1HlIoWfzo-unsplash.jpg` | 5611×3605 (1.556) | 2000×1285, 368 KB |
| `env-massif-banded.jpg` | `lukasz-konieczka-hQ1pdasJ93o-unsplash.jpg` | 6000×4000 (3:2) | 2000×1333, 439 KB |
| `env-massif-clear.jpg` | `arnau-castellano-vEcV5-17IUs-unsplash.jpg` | 4080×3072 (1.328) | 2000×1506, 651 KB |
| `env-ridges-distant.jpg` | `andrei-berescu-Tka9Egjdg4c-unsplash.jpg` | 3984×2656 (3:2) | 2000×1333, 240 KB |
| `env-valley-deep.jpg` | `alexandra-smielova-eNf7NQqzKR4-unsplash.jpg` | 4825×3217 (3:2) | 2000×1333, 565 KB |

**Never bake a treatment into a master.** Gradients, overlays, atmospheric colour, noise, film
grain, surface texture and blend modes are all applied by the design system, above an untouched
image. That is what keeps one asset reusable in two different environments — and it is why the
three canonical textures below are shared rather than composited in.

---

## Surface treatment — the three canonical texture assets

> **These assets form part of the Example Brand Brand Pack. Do not replace, regenerate or substitute
> them without updating the Brand Pack itself.** Every textured surface across the entire website
> references these same shared assets — that shared reference is what makes the treatment read as
> **one material** rather than as a per-page effect. They are not page resources, not decoration and
> not a pool to pick from: unlike everything else in this catalog, there is **nothing to select
> between**. Governed by `governance/website/rulebooks/visual-language.md` §1.1.

**What they are for.** They soften the digital precision of a large branded surface and give it a
tactile, editorial character — the quality of printed matter rather than of a screen. A reader should
perceive the background as materially considered and should never notice an individual texture.

**Composition order** — fixed, and part of the visual language. The **film layer belongs to the
base, not to the surface**: it varies tone that is already there, and a solid brand colour has none.
Over a flat colour field it stops reading as material and starts reading as dirt on the block, so a
solid-colour surface takes the grain and the printed-imperfection layers only. The order does not
change; the tonal layer is simply absent when there is nothing for it to vary.

```
   SOLID COLOUR BASE                     PHOTOGRAPHIC BASE

   noise-texture   Overlay      100%     noise-texture   Overlay        100%
        ↓                                     ↓
                                         film-texture    Plus Lighter    50%
                                              ↓
   grunge-retro    Overlay        5%     grunge-retro    Overlay          5%
        ↓                                     ↓
   Brand Colour                          Photograph · Screenshot ·
                                         Illustration · Creative
```

**Applied to** the closing call-to-action banner and creative surfaces, **automatically, by what the
surface is** — there is no opt-in class. **Never** to the page surface, cards, buttons, navigation,
inputs, small UI, icons, typography, or placeholders.

| file | identifier | role | vendored | derived from |
| --- | --- | --- | --- | --- |
| `assets/imagery/textures/noise-texture.webp` | `noise-texture` | the final tactile grain that unifies every branded background | 384×384, lossless WebP, 117 KB | `noise-texture.png` (1898×1281) — **centre crop at native scale, never resampled**: grain is resolution-relative, so rescaling would change its frequency. Tiled (`repeat`, native size). The source is a uniform neutral field (mean L 125.80 on every row and column, i.e. the identity for `overlay`); the crop preserves that mean exactly, so only its deviation shows. |
| `assets/imagery/textures/film-texture.webp` | `film-texture` | analog tonal variation, inspired by scanned film. **Photographic bases only** — never over a solid brand colour | 1200×813, WebP q78, 67 KB | `film-texture.png` (1920×1301) — Lanczos downscale, greyscale. One composition mapped to the surface (`cover`). Lossy is safe here: the source is near-black (mean L 4.9) and rides `plus-lighter` at 50%. |
| `assets/imagery/textures/grunge-retro-texture.webp` | `grunge-retro-texture` | printed imperfection that stops a large colour field reading as digitally flat; almost imperceptible by design | 640×427, WebP q72 + alpha, 105 KB | `grunge-retro-texture.png` (1920×1281) — Lanczos downscale, greyscale, **alpha pre-multiplied to 13/255 (the governed 5%)**. It is the bottom layer and rides `background-blend-mode`, which has no per-layer opacity; alpha compositing performs exactly the arithmetic `opacity` would. Mapped to the surface (`cover`). |

Masters live in `New-visual-creative-direction/texture/` and are **not committed** — 8.1 MB against
289 KB vendored. The derivations above are complete: any of the three can be regenerated exactly.
*(The source is spelled `grunge`; the creative-direction document writes `grudge`. The identifier
follows the file.)*

`texture-grain.png` and `texture-gradient.png` (below, in the overrides table) are **v2 assets** and
are not part of this treatment. They are retained, not referenced by the current language.

---

## Maintenance contract

When you add an asset to `assets/`:
1. If it doesn't fit a folder convention, add a **per-asset override** row above (kind / surface /
   serves / vertical / aspect / direction).
2. Run **`node tools/build-assets.js`** — regenerates `assets/manifest.json` (folder conventions +
   overrides + real component usage). Never hand-edit the manifest.
3. The generator **warns** about: assets on disk with no catalog coverage, override rows whose file is
   missing, and assets with **zero component usage** (the "unused pool" — fair game to pick from, but
   flagged so nothing is silently orphaned).

`ASSETS.md` (not the manifest) is the single source of truth for asset *metadata*;
`assets/manifest.json` is generated from it + usage, exactly as `COMPOSITION.md` → `fragments/manifest.json`.
