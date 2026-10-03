# Website numerics — quantitative companion (machine-read)

The few website-medium quality numbers the escalating render rails read at runtime
(externalized from code per the Offscript stateless-generation doctrine). Edit a value here and the
rail picks it up with no code change. Keys are fixed; values are plain numbers.

| key               | value |
|-------------------|-------|
| minFillPct        | 55    |
| minFocalRatio     | 1.4   |
| minBandsForRhythm | 4     |

- **minFillPct** — a `<section>` band whose content fills under this % of the band height is a
  sparse, under-built section (B4 `website-fill-focal`, escalating).
- **minFocalRatio** — the largest content block's area ÷ the median block area must reach this
  ratio, so every band has one clearly dominant FOCAL block (COMPOSE rule 2; B4, escalating).
- **minBandsForRhythm** — a page with at least this many stamped `<section>` bands MUST carry ≥1
  `contrast`/`figure` band; a flatter page than this is exempt (`website-surface-rhythm`, escalating).

> COMPOSE rule 5's per-section accent ceiling (~20%) is design governance with no runtime rail
> consumer yet — deliberately not listed here (this file carries only numbers a rail reads).
