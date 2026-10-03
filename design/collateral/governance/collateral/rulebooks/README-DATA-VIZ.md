# Data Visualization Rulebook

A standalone reference for designing and building data visualizations in the collateral design
system. Consult it **whenever you create a chart or metric visualization, or choose which one to
use.** Its job is to keep every visualization **editorial, truthful, and native** to the collateral
language — never a generic dashboard widget bolted on.

This rulebook is self-contained. It states *principles and rules*, not implementations. Bring your
own markup; bring these decisions.

---

## How to use this rulebook

Read it top-to-bottom once. After that, jump to what you need:

1. **Is it in scope?** → §1
2. **Hold the philosophy + priority order.** → §2
3. **Does the data even justify a visualization, and which one?** → §6 → §7 → §8 *(this is the core decision — do it before you draw anything)*
4. **Pick a layout mode.** → §3
5. **Apply styling, colour, scale, and integrity rules.** → §4, §5
6. **Use the per-type guidance, then run the pre-flight checklist.** → §9, §10
7. **When in doubt, re-read the closing principle.** → §11

---

## 1. Scope

This system covers **data visualization only** — charts and metric visualizations.

**In scope**

- Stat visualizations
- Bar charts
- Line charts
- Area charts
- Donut charts
- Tables
- Metric visualizations

**Out of scope** *(deliberately excluded — these belong to separate, future systems and must not be
built under this rulebook)*

- Infographics
- Process diagrams
- Workflows
- Architecture diagrams
- Ecosystem maps
- Flow charts
- Illustrative data stories

If a request drifts toward the excluded list, stop and treat it as a different system. Do not stretch
a chart into a diagram.

---

## 2. Core philosophy & priority order

Data visualizations should feel **native** to the collateral system — as if they were typeset, not
generated.

**The visual language must be:** editorial · deliberate · minimal · quiet · structured · insight-first ·
Swiss-inspired · print-friendly · publication-quality.

**The system must avoid:** generic SaaS dashboard aesthetics · analytics-dashboard patterns · decorative
chart styling · overly dense data displays · visual clutter.

**Priority order** — when these pull against each other, the earlier one wins:

1. **Insight** — the point the reader should leave with.
2. **Readability** — they can read it at a glance, in print.
3. **Visual harmony** — it sits naturally in the page.
4. **Data density** — how much is shown at once.

Density is last on purpose. A quieter chart that lands one insight beats a busy one that buries five.

---

## 3. Chart layout modes

Choose by how much room the insight deserves — **inline, full width, and hero** by room; **split** by
the figure's internal arrangement.

- **Inline** — the chart sits naturally within the content flow, at body scale.
- **Split** — *inside a single figure*, the chart's marks sit beside the figure's own labels,
  legend, or pulled-out metric (either order). Both sides are one component, read as one unit.
- **Full width** — the chart dominates a section.
- **Hero** — the chart becomes the focal element of the section.

**Rules**

- **Split is internal to one figure — never a way to pair two components.** The two sides of a
  split are the chart and its **own** labels, legend, or metric. Do **not** use it to set a chart
  beside a separate passage of body copy, or beside a second data element (a stat list, another
  chart) — those are distinct components; each takes its own space, stacked above or below.
- Use **hero** only when a **sufficiently rich dataset** exists to reward the space. A thin dataset
  blown up to hero size reads as padding.
- A **single metric** uses a **hero metric visualization**, never a hero chart. One number is not a
  chart's worth of data.
- **A hero or showcase chart is a single focal point — keep supporting prose out of its column.**
  When a chart is the page's focal element (hero, or any chart shown as the main visual), give it its
  own space: explanatory sentences and paragraphs belong in a **separate row** — the lede above, or a
  note below — **never in a column beside the chart**. The figure keeps its **own** intrinsic labels
  (the value inside a ring, axis or category labels, a legend, a one-line caption directly under it);
  those are part of the figure, not supporting text. A focal chart paired with a block of prose beside
  it splits attention and stops being focal.
- **A hero chart commands the page — centre it or run it full-width, never tuck it to one side.**
  Present a hero or showcase chart **centred on the page** (compact or radial figures — rings, donuts,
  gauges) **or full-width within the margins** (wide figures — bar rows, trends, tables); choose by the
  figure's shape **and how much data it carries**. Go full-width **only when the data fills the width** —
  a sparse comparison (a couple of bars) **centres instead**, even though it's a bar chart, because
  stretched across the full measure it reads thin and sparse (the same "a thin dataset reads as padding"
  caution as hero). Don't leave it flush to one edge with dead space beside it. *(This governs the chart —
  the visualization. A single value is a hero metric visualization, not a hero chart, per the rule above.)*

---

## 4. Styling & colour principles

Charts must **inherit the surrounding collateral** — its typography, spacing, grid, and colour system —
and must **never feel visually disconnected** from the page around them.

**Hard "no"s**

- No dashboard widgets. No floating dashboard cards.
- No callout bubbles, annotation cards, badges, or floating "insight" containers **inside** charts.
- No decorative styling that doesn't encode something.

**Where insight lives.** Communicate the takeaway through **titles · subtitles · supporting editorial
copy · direct data labels** — not through bubbles pinned onto the plot. Minimize legends: whenever a
series can be **labelled directly**, do that instead of a legend.

**Colour — encode with tonal, accent & gradients; data marks are never dark.** A chart's **data marks**
— the **bars, lines, areas, wedges, and rings that encode values** — must **not** use brand navy,
near-black, or any dark fill. Encode them with the **soft-clay tonal palette**, the **accent colour**,
and **gradients**.

- **The active / subject series takes the accent colour** (optionally as a quiet same-hue gradient), so
  the value that matters reads at a glance on white. **Tonal** colours carry the **inert** parts — a
  reference / baseline / "before" track, a secondary series, or a large fill. **Neither is ever dark.**
  This keeps the eye on what changed.
- **Several categorical series — an opt-in set of accent colour families.** When one accent plus a tonal
  cannot keep distinct categories apart, a set of opt-in accent colour families may be used to separate
  them — applied **sparingly (no rainbow)**, still **never dark** (the marks rule above holds), and with
  **each mark sharing the exact colour of its label / legend**. Prefer direct labels over a legend; reach
  for this only when the series genuinely cannot be told apart otherwise.
- **Readability still wins (priority #2) — and it governs the *marks*, not the *type*.** Titles,
  numerals, direct labels, and **hairline baselines/axes stay the system's normal dark, legible ink** —
  "avoid dark" is about the coloured marks, never the words or the grid. Equally, **never render a
  primary series in a tonal so pale it disappears** on white; reach for the accent (or an accent
  gradient) when a mark must carry contrast.
- **Gradients are a sanctioned data-visualization exception.** The wider collateral system avoids
  gradients — **data-viz may use them.** A quiet, **same-hue tonal→accent** gradient adds depth and helps
  a series read. Keep it quiet: **no rainbow**, and a gradient must **never blur the edge of a value**
  (where a bar ends, where a segment stops). Legibility of the magnitude comes first.
- **On a dark surface** (a chart placed on a navy band) **lighten the marks** so they read against the
  dark ground — the marks are tonal/accent/gradient, so they lift cleanly; never dark-on-dark.
- Use colour only to **distinguish series, encode magnitude, or mark the subject** — **never to
  decorate.**

**Quiet structure.** Baselines and axes are **hairline rules**, not heavy frames. Titles, numerals and
labels follow the system's display/number typography — **dark and legible.** Data marks may be **flat or
gently gradiented** (the sanctioned data-viz ornament), but nothing louder.

---

## 5. Axis & scale governance

Charts must not simply plot numbers mathematically — they must **communicate clearly**. Before you fix a
scale, decide what the chart is *for*. **These are author judgements, not a formula to run.**

### Identify intent first

- **Comparison intent** — *"How different are these values?"* Use a **tight domain** so differences read.
  - e.g. for `1% · 2% · 3% · 5%`, prefer **0–6%** (or 0–10%). **Not** 0–100% — at 0–100 they all flatten
    into the same sliver.
- **Magnitude intent** — *"How large is this value?"* Use a **broader domain** appropriate to the scale.

### Nice-number scaling

Axis domains use **human-friendly intervals**. Round the top of the scale to a clean number.

- Prefer: **0–6 · 0–10 · 0–25 · 0–50 · 0–100**
- Avoid: `0–5.73` and other raw, computed maxima.

### Minimum visual size

Tiny values must stay **visible**. Enforce a **minimum drawn dimension** for bars and marks so a small
value never collapses.

- `1%` must never render as a 1-pixel bar. Give it a floor.
- **Invisible chart elements are not permitted.**

### Baseline rules

- **Bar charts — must start at zero.** Bar length encodes magnitude, and magnitude requires a zero
  baseline. No exceptions.
- **Line charts — may use an intelligent domain.** For `93 · 96 · 97 · 99`, prefer **90–100**, not
  0–100, so the movement is visible.
- **Area charts — default baseline 0.** Exception: a **percentage-movement** visualization where another
  baseline communicates the change more honestly.

### Small-range expansion

When values cluster in a narrow band, **expand the range a little** so the trend is legible.

- For `95 · 96 · 97 · 99`, use roughly **94–100** rather than a cramped 95–99.

### Percentage handling

Pick the percentage domain by **range and communication intent**:

- `1% · 3% · 5% · 9%` → **0–10%** (not 0–100%).
- `20% · 40% · 60% · 90%` → **0–100%**.

The objective is always **truthful communication + visual clarity** — never a domain chosen just to
make a change look bigger or smaller than it is.

---

## 6. Data integrity

**The system must never fabricate data.** This is non-negotiable; trustworthiness outranks every visual
goal.

Never:

- Invent values
- Estimate values
- Interpolate missing values
- Extrapolate future values
- Generate historical values
- Create synthetic observations
- Fabricate trends
- Create artificial datasets

**Visualize only data that was explicitly provided.** If sample/placeholder values are used while
building a specimen, mark them **clearly illustrative** (e.g. round them, flag them as representative,
"for planning only / measured against your own baseline") — because a chart asserts "measured data"
far more strongly than prose does. Never draw fabricated precision or invented breakdowns as a chart.

---

## 7. Data sufficiency evaluation

Before choosing a visualization, determine the **structure** of the data you actually have. This level
drives the choice in §8 — not visual preference.

| Level | Structure | Example | Observations |
|------|-----------|---------|--------------|
| **1 — Single metric** | one value | `92% cost reduction`; `9 hrs saved daily` | 1 |
| **2 — Comparative metric** | two states | `Before: $100 · After: $8` | 2 |
| **3 — Categorical dataset** | values across categories | `Sales 40 · Marketing 25 · Support 20 · Ops 15` | 3+ categories |
| **4 — Time-series dataset** | a chronological sequence | `Jan 10 · Feb 15 · Mar 20 · Apr 25` | min **3**, prefer **5+** |
| **5 — Composition dataset** | parts of a meaningful whole | `Enterprise 60% · Mid-Market 25% · SMB 15%` | parts summing to a whole |

If you can't place the data cleanly into a level, you probably don't have enough to chart — see §11.

---

## 8. Visualization selection

Select by **data structure, not visual preference.**

| Data | Use | Do **not** |
|------|-----|-----------|
| **Single metric** (L1) | a **metric visualization** | generate a chart |
| **Comparative metric** (L2) | **before/after**, **delta**, or **benchmark** comparison | generate a trend chart |
| **Categorical** (L3) | **bar**, **ranked bar**, or **horizontal bar** | — |
| **Time-series** (L4) | **line** or **area** — only with **real chronological observations** | imply a trend you don't have |
| **Composition** (L5) | **donut** — only when values are genuine **parts of a meaningful whole** | use a donut for unrelated values |

**Chart selection hierarchy.** When more than one option is valid, prefer in this order and pick the
**simplest** that communicates the insight clearly:

1. Bar chart
2. Line chart
3. Area chart
4. Donut chart
5. Table

---

## 9. Per-type guidance

Each entry: *when to use · the rules that govern it · how to approach it.*

### Metric visualizations *(the typographic family — these are visual representations of metrics, not charts)*

Use when **structured datasets don't exist** (Levels 1–2). Especially important for case studies,
executive collateral, outcome reports, and business-impact documents.

- **Highlight metric** — a single dominant value (`92%` · *Lower cost per task*).
- **Outcome metric** — a metric paired with a short supporting explanation.
- **Delta comparison** — before → after (`$100 → $8`).
- **Directional metric** — direction + value (`↑ 40%` · *Capacity increase*).
- **Metric stack** — several outcome metrics shown together (`92% · 40% · 9hrs · 4wk`).
- **Benchmark comparison** — a value measured against industry, a previous state, or a baseline.
- **Percentage visualization** — a percentage shown via a bar, ring, or similar device. It represents
  **magnitude only**. It must **not** imply historical progression, timeline progression, completion
  state, or any fabricated trend.

### Bar / ranked / horizontal bar — Level 3 (categorical)

- **Zero baseline, always.**
- **Nice-number domain** (§5); **minimum visual size** so small bars stay visible.
- **Direct labels** over legends. Rank the bars when ordering carries meaning.

### Line — Level 4 (time-series, ≥3 / prefer 5+ real observations)

- Use an **intelligent domain** (not forced 0–100); apply **small-range expansion** for tight clusters.
- Only with **actual chronological observations** — never to fake a trend.
- The line is an **accent (or quiet accent-gradient) stroke — never a dark/navy line** (§4); axes and any
  gridlines stay hairline.

### Area — Level 4 (time-series)

- **Baseline 0** by default. Exception: a **percentage-movement** view where another baseline communicates
  the change more truthfully.

### Donut — Level 5 (composition)

- Only for **meaningful parts of a whole.** Keep it to **~5 segments or fewer.**
- A **restrained tonal/accent sequence** (no dark/navy wedges, §4) — **no rainbow**; let the subject
  segment carry the **accent**, the rest tonal.
- **Centre label**; a legend with **bold percentages** read directly.
- **No decorative arrows or ornament.** The ring encodes the composition; nothing else should compete.

### Table — last resort in the hierarchy

- Reach for a table when a chart would add encoding without adding clarity.
- Align it to the **grid, type scale, and hairline rules** so it reads as part of the document, not a
  pasted-in spreadsheet.

---

## 10. Pre-flight checklist

Before shipping any visualization:

- [ ] **In scope** (§1) — it's a chart/metric viz, not a diagram.
- [ ] **Justified** — the data actually warrants a visualization (§7, §11); a metric viz isn't clearer.
- [ ] **Right type for the data level** (§8), and the **simplest** valid one (hierarchy).
- [ ] **Intent set** — comparison vs magnitude — and the **domain** follows it (§5).
- [ ] **Nice-number scale**; **bars start at zero**; line/area domains are honest.
- [ ] **No invisible elements** — every value, even ~1%, clears the minimum size.
- [ ] **Only provided data** — nothing invented, interpolated, or extrapolated (§6); placeholders flagged.
- [ ] **Native styling** — inherits type/spacing/grid/colour; no dashboard chrome, bubbles, or badges.
- [ ] **No dark data marks** — bars/lines/areas/wedges/rings use **tonal/accent/gradient, never navy or
      near-black**; type & hairline axes stay dark/legible. Gradients welcome (the data-viz exception),
      kept quiet with crisp value edges; colour earns its place (distinguishes/encodes/marks the subject).
- [ ] **Insight is in the words** — title/subtitle/labels carry the point; legends minimized.

---

## 11. Core principle

**Charts are not mandatory.** First decide whether **enough information exists to justify a chart at
all.**

If the data communicates more clearly as a **metric visualization**, a **benchmark comparison**, a
**delta visualization**, or a **table**, prefer those over drawing a chart.

> **Clarity over density. Trustworthiness over visual complexity. A meaningful metric visualization is
> always preferred over a misleading chart.**
