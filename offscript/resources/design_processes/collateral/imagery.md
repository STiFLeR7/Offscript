# imagery.md — collateral imagery manifest (SELECT layer)

> Runtime-read by the Offscript engine (`src/generate/imagery-manifest.ts`). The `role:cover` row is the
> ONLY collateral imagery: the engine paints it (photo + navy scrim) on the bleed/dark cover page.
> Interiors stay photo-free — do not add interior rows. `file` is relative to
> `resources/design_principles/assets/imagery/`. Pick a light asset until the recompress
> follow-up lands (base64 ships in the HTML).

| role  | mode         | file            | scrim | notes                                   |
| ----- | ------------ | --------------- | ----- | --------------------------------------- |
| cover | engine-cover | dark-tech-2.jpg | navy  | Calm dark-tech frame, paired navy scrim |
