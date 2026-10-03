# imagery.md — website imagery manifest (SELECT layer)

> Runtime-read by the Offscript engine. `mode:author` rows are the whitelist of governance images the
> website author MAY request on a figure / contrast band (emit a normal relative ref; the engine
> inlines it to a data-URI). `file` is relative to
> `resources/design_processes/website/assets/imagery/`. Off-list refs do not resolve and are
> dropped. See ASSETS.md for the full intent vocabulary.

| role             | mode   | file                          | scrim | notes                                         |
| ---------------- | ------ | ----------------------------- | ----- | --------------------------------------------- |
| hero-night       | author | backgrounds/hero-bg-night.jpg |       | AI-strategy night hero (dark band)            |
| creative-bg      | author | backgrounds/blur-7-web.jpg    |       | Brand-legal cool-blue atmospheric             |
| texture-gradient | author | textures/texture-gradient.png |       | Radial blob behind dark cards / stat tiles    |
| texture-grain    | author | textures/texture-grain.png    |       | Fine noise overlay, low opacity               |
| value-bg         | author | value-bg.jpg                  |       | Atmospheric value-band backdrop               |
