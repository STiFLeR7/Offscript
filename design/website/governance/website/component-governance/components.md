# components.md — the abstract website component catalogue (by role, by rule)

**What this is.** The authoritative, **brand-invariant** description of every component in the
website design system — written by **role and rule, never by appearance**. It is the
governance a downstream generation engine reads to decide *which component a job calls for*. It sits
**above** its two neighbours in this folder:

- **`COMPOSITION.md`** — the SELECT index of the **79 realized layout variants** (which file fits a brief).
- **`COMPOSE.md`** — the ASSEMBLE grammar (how to mix blocks into a new section).
- **`components.md`** *(this file)* — the **abstract role catalogue**: what each component *is* and *does*,
  durable across any rebrand. COMPOSITION/COMPOSE answer *how to build*; this answers *what to reach for and why*.

**Where appearance lives.** Not here. Every concrete value — colour, type family, spacing, radius, shadow,
icon set, the surfaces (light / off-white / dark / gradient), specific class names — lives in the **brand
pack** and is referenced from this catalogue **only by role** ("a contrasting rest beat", "the primary
action", "genuine product artifact"). If a line below named a colour, size, font, or class, it would belong
in the brand pack, not in governance.

**The one hard line — the rebrand test.** Every line in this file must still be true after a complete
rebrand: different colours, fonts, spacing, and visual style. *"The hero states the single most important
promise and gives the page its one clear next step"* survives a rebrand; *"the hero headline is large type
on a dark panel"* does not — that is a value, not governance.

---

## How to read an entry

Authored to the design team's own model: components are thought of **by where they sit on the page** and
**by what they are made of**, first. So the catalogue is **ordered top-of-page to bottom**, every entry
is tagged with its page-position **Type**, and every entry opens with what it is built from. Then the
governance:

- **Type** — the page-position zone it belongs to (and where in the page it sits).
- **Made of** — its building blocks, named by role (the abstract molecules defined in `COMPOSE.md`).
- **Job** — the one thing it communicates / the role it plays in the page's argument.
- **When to reach for it** — the use case that selects it, and what to reach for instead when it doesn't fit.
- **Rules** — the constraints it must obey, each written to survive a rebrand.
- **Example** — an abstract use-scenario ("reach for this when a visitor needs to…"), plus an optional
  pointer to a realized piece in `brand-pack/exemplars/sections/` that shows the role at its best (a
  reference, never a code/colour/pixel snippet).

**Altitude.** One entry per **component family** (the role), with its realized variants named as
*reach-for* guidance inside the entry. Every one of the 79 variants is mapped to its family and its
distinguishing angle in the **[Variant appendix](#variant-appendix--all-79-mapped-to-family)** at the end.

---

## Universal rules — every component obeys these

These hold for **every** component, across any brand, palette, type system, or component set (from
`PHILOSOPHY.md` §13). Per-component **Rules** below add only what is *specific* to that component;
they never repeat these.

1. **One focal point.** Each component has exactly one thing that matters most. Two co-equal focuses
   means it has no point. *(§6)*
2. **No claim without proof beside it.** A component never overstates; evidence sits with the assertion,
   not pages away. The cost of one inflated claim is the believability of every honest one. *(§8)*
3. **It earns its place.** A component must advance the page's argument — set up, support, complicate,
   resolve, or invite action. One that advances it in none of these ways does not belong on the page. *(§4)*
4. **It is self-orienting.** Each component must make sense to a reader who arrived there first, with no
   prior context. Nothing may depend on something earlier having been read. *(§7)*

---

# Opening

> The reader's first contact: orientation, and the single promise that earns the scroll.

## Navigation
- **Type** — Opening · structural frame (persists at the top; the page's orientation instrument).
- **Made of** — a brand mark, a small set of section links, and one primary action.
- **Job** — answers the reader's three continuous questions — *Where am I? What is this? Where can I go?* —
  cheaply, at every moment.
- **When to reach for it** — always present on a page that has more than one destination. Reach for the
  bare link grid (a Footer atom) instead when you only need wayfinding at the page's close, not orientation
  at its top.
- **Rules**
  - Orientation is the goal, not the menu — the reader is oriented when they can act without first working
    out where they are.
  - The same kinds of destinations live in the same kinds of places across the whole site; a reader who
    learns the structure once must never relearn it.
  - Movement must feel reversible — a reader who cannot tell how to get back stops going forward.
  - Guide by legible choice, never by force: no trapping the reader, no removing the exit.
  - Carries at most one primary action; everything else is a quieter wayfinding link.
- **Example** — Reach for this when a visitor needs to know, at a glance and from anywhere on the page,
  what this is and where they can go next. *Shown at its best:* `brand-pack/exemplars/sections/component-nav.html`.

## Hero
- **Type** — Opening · the first screen, above all body content.
- **Made of** — the navigation, a headline cluster (the one promise), one primary action, and — optionally —
  a single proof or product artifact (a creative panel, a tile cluster, or an early row of trust marks).
- **Job** — state the single most important promise and give the page its one clear next step, in the few
  seconds before the reader decides whether to grant the scroll.
- **When to reach for it** — the opening band of nearly every page. Among hero shapes: reach for a
  **tile-cluster hero** when several real proof tiles tell the story; a **calm credibility hero** when
  cards-of-proof beneath the promise carry more weight than a busy grid; a **product-state hero** when a
  genuine product artifact can be shown; a **conversational/demo hero** only when there is a real,
  live-demo story to capture intent against.
- **Rules**
  - One promise, not the whole product — the hero makes a single argument legible, not a feature list.
  - Exactly one primary action; any secondary option is visibly subordinate.
  - Fully self-orienting — it is the orientation, so it assumes no prior context.
  - If it shows a product, the artifact must be **genuine — never faked, fabricated, or an invented
    demo**. This bans *substance the reader might believe and shouldn't*. It does **not** ban a
    **structural placeholder**, which declares an absence rather than concealing one: where no real
    artifact exists yet, the hero reserves its position and says so plainly (see *Creative position*
    below). Inventing a mock product to fill that space is the failure this rule exists to prevent.
  - It promises; the body must then repay the promise — a hero that overstates spends trust the rest of
    the page cannot recover.
- **Composition** — a hero is a **composed section**, and it carries the same obligations as a closing
  band (see *Call-to-action*). It is the most exposed section on the page, so an improvised hero is the
  most visible improvisation there is.
  - The hero **establishes its own spatial rhythm**; content inhabits it rather than filling it, and
    the whitespace holds regardless of how little the headline says.
  - Content occupies an **editorial portion**, not the full width — headline messaging on the
    editorial measure, supporting copy on the reading measure, and the narrowing between them is the
    hierarchy.
  - **Vertical composition is intentional, not mathematically centred**, and the composition is
    asymmetric unless there is a reason for it not to be.
  - Any creative it shows is decided **Creative-First** — proportion, presence and placement settled
    before the surrounding layout, from the approved vocabularies (`rulebooks/creatives.md`). The
    creative is not sized to the space the copy left over.
  - **Surface first:** if the hero sits on a branded surface, that surface is an environment the
    content is read in — atmosphere first, hierarchy from typography, never the reverse.
  - **If that environment is a photograph, it is selected from the approved library** and chosen for
    what the hero is doing, never for how it looks: natural negative space, depth, room for
    typography. **The typography occupies the negative space; it never covers the subject.** Avoid an
    obviously centred image — a symmetrical composition leaves typography nowhere to be. The surface
    then carries its measured veil (`rulebooks/visual-language.md` §1.1); the asset itself is never
    modified.
- **Example** — Reach for this when a visitor needs, within seconds, one reason this matters to them and one
  obvious thing to do about it. *Shown at its best:* `brand-pack/exemplars/sections/component-hero-bento.html`;
  in full-page context, `brand-pack/exemplars/pages/ai-strategy-v2.html`.

---

# Body · persuasion

> The explanation: what it is, how it works, whether it fits, what it costs. The page's argument advancing.

## Feature / value-prop
- **Type** — Body · persuasion (the explanatory core of the page).
- **Made of** — a headline cluster plus one proof shape: equal cards, a mixed-size tile set, an expandable
  list beside a creative panel, a tabbed panel, a numbered walk, or a stat highlight — and an optional
  closing nudge.
- **Job** — explain *what the offering is and why it matters*, one idea at a time, showing rather than only
  telling.
- **When to reach for it** — whenever the page must make a capability or value understood. Among its shapes:
  **equal cards** when items are true peers; a **mixed-size set** when one item should dominate; an
  **expandable list** for several progressive details a reader opts into; a **tabbed/stepped switcher**
  when the features are really a sequence or a set of parallel use-cases; a **pinned/sticky walk** for
  long-form storytelling on a long page; a **secondary two-up** for "also" features after the main set; a
  **single-statement reveal** for one manifesto-grade idea. Reach for **Stats / outcomes** instead when a
  number, not a description, is the argument.
- **Rules**
  - One idea per component — a feature band carrying two messages is split, or one is subordinated.
  - Peers are shown as peers; a dominant item is given dominant weight — equal weight where ranks differ
    erases the meaning.
  - Detail is offered, never forced: deeper layers are reachable but the surface stands on its own.
  - Heavy-motion or full-page-length shapes are used at most once per page and only when the page is long
    enough to justify them.
  - Progressive/interactive detail does not belong on the opening screen, where the gist must arrive first.
- **Example** — Reach for this when a visitor needs to understand *what this does and why it's worth their
  time* before they will consider acting. *Shown at its best:*
  `brand-pack/exemplars/sections/component-feature-trio.html` (peers) and
  `brand-pack/exemplars/sections/component-feature-bento.html` (one dominant item).

## Process / how-it-works
- **Type** — Body · persuasion (after the what, before the proof or the ask).
- **Made of** — a headline cluster, a numbered step sequence, a supporting creative panel or media frame,
  and an optional next action.
- **Job** — show that the offering is *workable* by laying out how it happens, in order.
- **When to reach for it** — when the content is genuinely a sequence of ordered, causal steps. Reach for the
  **canonical sticky walk** for three-to-four substantial steps that reward dwelling; a **lighter
  closing-half version** when the process is a simple lead-in to the call to action. Reach for **Feature /
  value-prop** instead when the items are parallel, not sequential.
- **Rules**
  - Only when the content truly *is* a sequence — never impose order on parallel items.
  - Each step opens onto the next (an open loop the following step closes); a step that resolves everything
    gives the reader a place to leave.
  - Steps must be self-evident in order even to a reader who lands mid-sequence.
- **Example** — Reach for this when a visitor needs to believe *"I could actually do this"* by seeing the
  path from start to result. *Shown at its best:* `brand-pack/exemplars/sections/component-how-it-works.html`.

## Integrations
- **Type** — Body · persuasion / proof bridge (mid-page; "it fits what you already use").
- **Made of** — a headline cluster and a row or grid of partner/connection marks, optionally with a line of
  copy per connection.
- **Job** — answer *"does this work with what I already have?"* — reducing the perceived cost of adopting.
- **When to reach for it** — when ecosystem fit is part of the decision. Reach for the **grid** when each
  connection needs a line of explanation; the **marquee** when the marks speak for themselves and a lighter
  beat is wanted. Reach for **Social proof / logos** instead when the marks signal *trust* rather than
  *compatibility*.
- **Rules**
  - Only real, supported connections — never imply an integration that does not exist.
  - The marks are evidence of fit, not decoration; if they argue nothing, the component does not belong.
- **Example** — Reach for this when a visitor needs reassurance that adopting this won't mean abandoning
  their existing tools. *Shown at its best:* `brand-pack/exemplars/sections/component-integration-grid.html`.

## Comparison
- **Type** — Body · persuasion (decision stage, once the reader is weighing options).
- **Made of** — a headline cluster and a factor-by-column matrix (us-versus-alternative, or plan-versus-plan).
- **Job** — help a deciding reader weigh options *factor by factor*, honestly.
- **When to reach for it** — at the decision stage, when a reader is actively choosing between this and an
  alternative, or between plans. Reach for **Pricing** instead when the axis being compared is purely cost
  and packaging; reach for **Feature / value-prop** when the goal is to explain, not to adjudicate.
- **Rules**
  - Fair representation only — never a straw-man of the alternative; misrepresenting a competitor destroys
    trust faster than it wins the point.
  - Honesty about limits outperforms claimed perfection — a matrix that admits where this is *not* the
    best fit is believed on where it is.
  - One factor per row; the reader orders importance themselves.
- **Example** — Reach for this when a visitor needs to satisfy themselves that this is the right choice
  among real alternatives. *Shown at its best:* `brand-pack/exemplars/sections/component-compare-table.html`.

## Pricing
- **Type** — Body · persuasion (late, near the decision and the ask).
- **Made of** — a headline cluster, an optional billing toggle, and a set of plan cards (or unequal package
  tiles), with optional trust marks or an FAQ folded in.
- **Job** — make the cost of saying yes *clear and low-anxiety*, so price never becomes the silent reason a
  ready reader leaves.
- **When to reach for it** — when cost is part of the decision and must be stated. Reach for **equal plan
  cards** when plans are parallel peers; an **unequal package set** for services/offers of differing scope;
  a **persona-split tabbed** set when plans divide by audience; a **pricing-plus-FAQ** band on short pages
  where both must fit. Reach for **Comparison** instead when the question is feature parity, not price.
- **Rules**
  - At most one pricing component per page — competing price tables split intent.
  - Total transparency: never hide, bury, or disguise cost; no pressure tactics, false scarcity, or dark
    patterns. Lower the cost of yes; never raise it with pressure.
  - Equal plans are shown as peers; an emphasized plan is the single focal point, honestly chosen.
- **Example** — Reach for this when a visitor needs to know *what it costs and what they get* before they
  will commit. *Shown at its best:* `brand-pack/exemplars/sections/component-pricing.html`.

---

# Body · proof

> The evidence: why to believe it. Proof placed where doubt forms and where decisions are made.

## Social proof / logos
- **Type** — Body · proof (often early, directly beneath the hero; ambient trust).
- **Made of** — a row or wall of client/partner/investor marks, optionally with a quiet headline and, in the
  proof-hybrid shape, a single anchoring quote or metric.
- **Job** — signal, quickly and without argument, that credible others already trust this.
- **When to reach for it** — when borrowed credibility belongs early, before the reader has been given
  reasons. Reach for an **early trust strip** under the hero (marks only); an **investor/credibility wall**
  on about pages; a **proof hybrid** when one customer story should anchor a few numbers. Reach for
  **Testimonials** instead when the proof is a *voice*, not a *mark*; **Stats / outcomes** when it is a *number*.
- **Rules**
  - Marks only, no claims — this component signals, it does not assert.
  - Every name, mark, and figure must be real and permitted; never fabricate or imply a relationship that
    doesn't exist.
  - It is ambient trust, not the page's focal point — it supports the argument, it isn't the argument.
- **Example** — Reach for this when a visitor needs an immediate, low-effort reason to keep reading:
  *"serious people already rely on this."* *Shown at its best:*
  `brand-pack/exemplars/sections/component-logo-strip.html`.

## Stats / outcomes
- **Type** — Body · proof (a contrasting beat where numbers carry the case).
- **Made of** — a headline cluster and a set of large metrics (cards, an inline row, or mixed tiles), with
  optional narrative copy or a progress meter.
- **Job** — prove the claim with *specific, checkable numbers* — the form of proof the skeptical reader
  extends the most belief to.
- **When to reach for it** — when a number, not a sentence, is the strongest argument. Reach for a
  **strong contrasting card beat** for a mid-page proof punch; a **quiet inline row** for low-drama proof
  between calmer bands; an **outcome band with meters** when the numbers need narrative; **drop-in tiles**
  when composing metrics into another band. Reach for **Testimonials** instead when a human voice persuades
  more than a figure.
- **Rules**
  - Every number is real, current, and verifiable — never rounded up to impress; one inflated figure
    discredits the rest.
  - Numbers are stated specifically; a precise figure is more believable than a vague superlative.
  - Avoid numeric overload — don't place two heavy number bands adjacent; proof needs rest around it to land.
- **Example** — Reach for this when a visitor's doubt is best answered by evidence they can check —
  *"how much, how many, how fast."* *Shown at its best:*
  `brand-pack/exemplars/sections/component-stat-cards.html`.

## Testimonials / case studies
- **Type** — Body · proof (human evidence, near the claims it supports).
- **Made of** — one or more quote cards (voice, attribution, portrait), optionally paired with metrics, a
  media frame, or a trust-mark row.
- **Job** — let real customers' words and results vouch for the claim, in a human voice the reader trusts.
- **When to reach for it** — when lived proof persuades more than the brand's own assertion. Reach for a
  **single quote-plus-metrics card** for one named customer; a **multi-voice set** to show breadth; a
  **one-at-a-time slider** for a long single quote; a **review carousel** for the volume-of-love signal;
  an **editorial case study** or **deep single story** when the proof needs narrative depth.
- **Rules**
  - Every quote, attribution, face, and result must be real and permitted — never fabricate, composite, or
    embellish a customer.
  - Place proof where the decision is made — beside the claim or the ask it supports, not stranded far from it.
  - Specificity persuades; a concrete, attributable outcome beats a glowing but vague endorsement.
- **Example** — Reach for this when a visitor needs to hear from someone like them that this delivered.
  *Shown at its best:* `brand-pack/exemplars/sections/component-testimonial-stack.html`; as a full story,
  `brand-pack/exemplars/pages/prism-case-study-v2.html`.

## Team / about
- **Type** — Body · proof (credibility of the people behind the offering; about/company pages).
- **Made of** — a headline cluster and a grid of portraits with names and roles, optionally with story copy.
- **Job** — build trust in *who* stands behind the offering — making an organization legible and human.
- **When to reach for it** — when the people are part of the credibility argument. Reach for a **portrait
  grid** for a broad team; a **formal leadership row** for executives; a **minimal founders row** for a
  small team; a **team-plus-story hybrid** on richer about pages.
- **Rules**
  - Real people only — genuine portraits of actual team members; never invented faces, stock stand-ins, or
    fabricated roles.
  - Credibility comes from specificity — real names and real responsibilities, not decorative head-count.
- **Example** — Reach for this when a visitor needs to know there are real, credible people behind the
  promise. *Shown at its best:* `brand-pack/exemplars/sections/component-team-grid.html`.

## Resources / insights / news
- **Type** — Body · proof / depth (later in the page or on dedicated pages; demonstrates ongoing substance).
- **Made of** — a headline cluster and a grid or carousel of article/press cards (title, media frame, tag,
  optional date or source mark).
- **Job** — show the offering is *alive and substantive* by surfacing real articles, insights, or press —
  and offer a deeper path to readers who want one.
- **When to reach for it** — when demonstrating depth or freshness helps the case. Reach for an **editorial
  article grid** as a blog teaser; a **denser resources grid** when more must fit; a **press/news row** for
  third-party coverage; a **carousel** when more items than fit a static band must be shown.
- **Rules**
  - Real, current items only — **never invented titles or fabricated coverage**; every link must
    resolve. This bans *fabricated substance*. A card's **image position** may still be held by a
    structural placeholder (see *Creative position* below) — reserving where a thumbnail goes is a
    layout decision; inventing the article it points to is not.
  - It offers depth, never forces it — the surface page never pays for the existence of this deeper layer.
- **Example** — Reach for this when a visitor wants to gauge ongoing substance or go deeper before deciding.
  *Shown at its best:* `brand-pack/exemplars/sections/component-latest-insights.html`.

## FAQ
- **Type** — Body · proof (late; the last doubt-clearing beat before the close).
- **Made of** — a headline cluster and an expandable question-and-answer list, optionally beside a creative
  panel.
- **Job** — anticipate the reader's real remaining doubts and answer them at the moment they form, so an
  unresolved question never becomes a silent exit.
- **When to reach for it** — when known objections stand between understanding and action. Reach for a
  **split column** for long lists that must stay scannable; a **centered or single column** for short,
  quiet lists near the page end; a **pricing-plus-FAQ** band when the questions are about plans; a **chip
  teaser** that links to a fuller FAQ elsewhere. Reach for the **expandable feature list** (Feature /
  value-prop) instead when the answers are really features carrying a creative panel.
- **Rules**
  - Answers the reader's actual questions — never marketing copy dressed as a question.
  - Meets each doubt where the reader feels it, not pages later; credibility is built by answering
    objections early, not deflecting them.
  - Honest about limits — an acknowledged constraint makes every other answer more believable.
  - Long lists stay scannable; the reader must be able to find their question without reading all of them.
- **Example** — Reach for this when a visitor's remaining *"but what about…"* would otherwise stop them
  short of acting. *Shown at its best:* `brand-pack/exemplars/sections/component-faq-split.html`.

---

# Closing · conversion

> The ask: placed where readiness peaks, framed as the reader's gain, never demanded before it is earned.

## Call-to-action (closing)
- **Type** — Closing · conversion (where the page's argument arrives and resolves).
- **Made of** — a headline cluster, optional supporting copy, one primary action (or a capture form), and
  an optional creative panel or link set.
- **Job** — convert earned understanding and trust into a single, freely-chosen next step.
- **When to reach for it** — at the moment of peak readiness, usually as the page resolves. Reach for the
  **shortest banner** when a footer follows immediately; a **band with link columns** for a near-footer
  hand-off; a **decorated/flagship close** for a marquee page (once only); a **softer mid-page close** when
  a gentle invitation fits between bands. Reach for **Contact / lead form** instead when the next step *is*
  giving information.
- **Rules**
  - One primary action; competing asks split intent and lower the odds of any single one.
  - Placed where readiness peaks — after the reader has what they need to say yes, never before.
  - Framed as the reader's gain, not the brand's want; a beginning offered to *them*.
  - Never nags — a repeated, unearned ask spends trust and is worse than no ask; no urgency tricks or
    cornering.
  - Decorated/heavy closing shapes are used at most once per page.
- **Composition** — a closing band is a **composed section, not centred text inside a coloured
  rectangle.** It had a fully specified surface and no specified shape, and that vacuum was filled by
  centring; these are the rules that close it.
  - The banner **establishes its own spatial rhythm**, and the content *inhabits* it rather than
    filling it. The section is the composition; the content simply occupies it.
  - The **section marker brackets the banner** — one at its opening, one at its close, both the
    same colour — and belongs to the section, not attached to the heading.
  - Content occupies an **editorial portion** of the banner, not its full width. Editorial copy holds
    its measure here exactly as everywhere else.
  - **The band is CENTRED — content and items alike — and its vertical padding is equal, top and
    bottom.** That is a decision, not the absence of one: the page is over, there is nowhere further
    to point, and everything converges on one ask. Centring is the shape of convergence.
  - **The failure to avoid was never centring — it was the slack rectangle.** A tall band with
    content adrift in the middle of it, nobody owning the space. That is answered by the band's
    **proportion**: the closing band is the one composed section that does *not* take the page's
    section padding, because a closing ask does not want to be entered, it wants to be answered.
    *(The value is a Brand-Pack value; it is tight and equal.)*
  - **Centring the box is not centring the content.** Editorial copy still holds its measures here
    exactly as everywhere else, so a centred band is a narrow column of type inside a wide band —
    never a full-width block of copy that merely happens to be centred.
  - **The surface creates atmosphere; typography creates hierarchy.** Surface treatment stays
    secondary to the type it sits behind.
  - **The surface is SOLID — a flat brand colour, never an image or a gradient.** No environmental
    photography here, whatever the library offers. The band's material is the grain and the
    printed-imperfection layer over that colour; the analog-tonal layer is correctly absent, because
    a solid colour has no tone to vary. The last argument on a page has to be unambiguous, and
    atmosphere behind it competes for exactly that moment. *(Enforced in the pack, not left to
    discipline: an environment selection on a closing band resolves to nothing.)*
- **Example** — Reach for this when a visitor has understood and believes, and now needs the one obvious,
  low-cost thing to do next. *Shown at its best:* `brand-pack/exemplars/sections/component-cta-band.html`.

## Contact / lead form
- **Type** — Closing · conversion (where the next step is to hand over information).
- **Made of** — a headline cluster, a labelled field set with a submit action, and reassurance beside it
  (copy, contact methods, or a creative panel); optionally an overlay variant.
- **Job** — capture intent or open a conversation while keeping the perceived cost of doing so as low as
  possible.
- **When to reach for it** — when the action is to make contact, book, or subscribe. Reach for a **plain
  capture-plus-reassurance split** for general contact; a **contact-plus-newsletter** combo when both are
  wanted; a **methods-plus-form** layout for support-style pages; a **sales-led booking band** for demos;
  an **overlay** attached to any action elsewhere on the page (not a standalone band); a **full standalone
  body** for a dedicated contact page.
- **Rules**
  - Ask only for what is needed — every extra field raises the cost of yes.
  - Reassurance sits with the form — proof and risk-reduction belong at the moment of decision.
  - Honest about what happens next; never demand the action before understanding and trust exist.
- **Example** — Reach for this when a ready visitor needs a low-friction way to start the conversation.
  *Shown at its best:* `brand-pack/exemplars/sections/component-contact-form.html`.

---

# Structural frame

> The page's edges. Wayfinding and close, consistent everywhere, oriented for a reader who arrived anywhere.

## Footer
- **Type** — Structural frame (the page's close; the bottom half of the orientation frame, paired with
  Navigation at the top).
- **Made of** — multi-column link sets, optionally a final action or capture form, a brand mark, and quiet
  legal/utility rows.
- **Job** — close the page and provide complete, low-effort wayfinding for a reader who has reached the end
  or scrolled past everything.
- **When to reach for it** — the closing band of essentially every page. Reach for a **link-rich footer with
  capture built in** when a final newsletter ask fits; a **decorated footer** to round off a quieter
  preceding band; an **editorial/brand-forward mega-footer** for a brand-led site; a **CTA-fused footer**
  on short pages that close in one band; the **bare link set** when composing.
- **Rules**
  - Consistent across the whole site — it is part of the learned map; its structure must not drift page to
    page.
  - Orients a reader who scrolled past everything — complete enough to navigate from, with no prior context.
  - May carry a final action, but never one that competes with the page's single primary ask.
- **Example** — Reach for this when a visitor who reached the bottom needs an easy way onward rather than a
  dead end. *Shown at its best:* `brand-pack/exemplars/sections/component-footer-dark.html`.

---

# Atoms & transitions

> Position-independent pieces and punctuation, used everywhere and sparingly.

## Structural atoms & transitions
- **Type** — Atom (small standalone pieces; not full bands — they compose into the components above, or
  punctuate between them).
- **Made of** — single molecules: the canonical action styling, a tag/category chip rail, a single
  problem-statement card, a live-metric status mock, and a family of transition dividers.
- **Job** — supply the shared, reusable parts other components are built from, and mark deliberate hand-offs
  between bands.
- **When to reach for it** — when assembling or punctuating, not when communicating a whole idea. Reach for
  the **action styling** as the single source for every call-to-action; **chips** as a hero or feature
  garnish; a **problem card** to compose into a grid; a **transition divider** only when a deliberate
  hand-off between bands earns one.
- **Rules**
  - An atom never stands in for a full band's argument — it is a part, not a section.
  - Transitions are punctuation, used sparingly. Sections are separated by generous space and by the
    **section opener** below — a divider is for a genuine structural hand-off, and one with no
    hand-off to mark is visual noise.
  - The action styling is canonical and singular — one defined set of action treatments, used consistently,
    is the source for every other component's primary action.
  - Every atom must mean something where it is placed; ornament that carries no meaning is forbidden.
- **Example** — Reach for these when a component needs a shared building block, or when a deliberate shift
  between two bands needs marking. *Shown at its best:*
  `brand-pack/exemplars/sections/component-buttons.html` (the canonical action source) and the
  `component-divider-*.html` set (transitions).

## Section opener (the identity mark)
- **Type** — Atom (opens a band; belongs to no single component family).
- **Made of** — a matched pair of small identity marks, one at each edge of the section's content
  width, in the accent assigned to that section.
- **Job** — announces that a **major movement of the page** begins here, and — by sitting on the one
  canonical content edge — makes the page's horizontal alignment visible rather than merely true.
  It is the cheapest possible signal of "new chapter", carrying no words and no argument.
- **When to reach for it** — when a section opens a genuine movement of the page's argument, not
  merely the next band. Reach for a **heading alone** when the section continues the movement before
  it; reach for a **divider** when what is needed is a hand-off, not an opening.
- **Rules**
  - **Once per major section, at its beginning.** Never twice, never mid-section.
  - It aligns to the **canonical content edge**, never the section's outer edge — announcing the
    alignment is half its job, so sitting anywhere else contradicts its own purpose. A deliberately
    marked full-bleed band still opens on that edge.
  - It takes the **accent assigned to the section**, never a text colour. On an accent surface it
    takes that surface's paired foreground, so it never introduces a second accent.
  - It is **optional and must stay scarce.** A page where every section carries one has made the mark
    meaningless — it can no longer signal a chapter because everything is a chapter.
  - It carries no content and is never made to. The moment it acquires a label it has become a
    heading, and the heading already exists.
- **Example** — Reach for this when a reader scrolling past should feel the page turn a corner.
  *(No realized exemplar predates this direction — see the new specimen pages under
  `design/website/output/`.)*

## Creative position (the placeholder)
- **Type** — Atom (fills the primary-content slot of any component that shows a visual).
- **Made of** — a reserved region carrying the standard stroke, the standard large-surface radius and
  a plain label naming which kind of asset belongs there.
- **Job** — holds the **exact space a creative asset will occupy** — photography, product screenshot,
  editorial visual, dashboard — so a page can be composed, reviewed and approved before the asset
  exists, and so the asset drops into a position already designed for it.
- **When to reach for it** — whenever a component's visual slot has no supplied asset. Reach for
  **omitting the slot entirely** instead when the section's argument does not actually need a visual;
  an unnecessary reserved position is as much filler as an unnecessary card.
- **Rules**
  - **The system reserves position; it never produces creative.** Placement, proportion, spacing,
    alignment and responsive behaviour are the whole of what it decides. Photography, illustration,
    artwork, screenshots, image treatment and marketing graphics are made independently, by people.
  - **Never describe the creative** — not in the label, not in prose, not as generated interface, and
    not as an illustrative composition standing in for it. A placeholder that describes the
    photograph it awaits has produced creative direction.
  - **Never substitute an invented artifact.** Authoring a mock dashboard or a fabricated screenshot
    because a real one is unavailable is the failure this role exists to prevent, not a workaround.
  - **It must read as a reservation.** If a reader could mistake it for the real asset, it has become
    the fabrication that the genuine-artifact rules forbid.
  - **One per section, ordinarily.** Two reserved positions in one band usually means the band is
    really two sections.
  - **A reservation carries no surface material; the delivered creative does.** Branded surfaces
    carry the shared texture treatment that makes them read as printed rather than digital — but a
    placeholder is a reserved *position*, not a surface, and treating it would dress an absence up as
    a presence. When the real asset arrives it becomes a **creative surface** and picks the material
    up by being one. *(Rule: `rulebooks/visual-language.md` §1.1.)*
- **Example** — Reach for this when the layout is ready and the photography is not. *(Governed in
  full by `rulebooks/creatives.md`.)*

---

## The test every component answers

Before any component ships in a page, it must pass both halves:

> **Does this component communicate its content more clearly than any alternative — and does it obey its
> rules (the four universal rules, plus its own)?**

If a clearer alternative exists for *this* brief, the rule of fit (`PHILOSOPHY.md` §11) says use it.
If the component breaks a rule, the choice is wrong no matter how good it looks (`PHILOSOPHY.md` §13).

---

## Variant appendix — all 79 mapped to family

The 17 families above are the abstract roles. The website system realizes them as **79 layout variants**,
indexed for *selection* in [`COMPOSITION.md`](COMPOSITION.md) and lifted for *assembly* in
[`COMPOSE.md`](COMPOSE.md). This appendix is the bridge: each variant, its family, and the **distinguishing
angle** that makes it the right pick — stated abstractly (no surface, colour, or pixel), so it survives a
rebrand. For full selection guidance (and the cross-category picks), use `COMPOSITION.md`.

### Opening
| Family | Variant | Distinguishing angle |
| --- | --- | --- |
| Navigation | nav | The page's persistent top orientation bar. |
| Hero | hero-bento | Product hero with a cluster of real proof tiles. |
| Hero | hero-lending | Calm credibility hero; cards-of-proof beneath the promise. |
| Hero | hero-actions | Hero that demonstrates a real product state. |
| Hero | hero-agent | Conversational/demo hero with intent capture; needs a live-demo story. |

### Body · persuasion
| Family | Variant | Distinguishing angle |
| --- | --- | --- |
| Feature / value-prop | feature-trio | Three peer items at a glance. |
| Feature / value-prop | feature-bento | Feature set where one item dominates. |
| Feature / value-prop | accordion-panel-right | Four-to-six progressive details a reader opts into; not on the first screen. |
| Feature / value-prop | feature-stack | Cinematic pinned sequence; long pages only, once per page. |
| Feature / value-prop | feature-steps | Features that are really a sequence; a switcher. |
| Feature / value-prop | tabs-panel-below | Three-to-five parallel use-cases, one panel at a time. |
| Feature / value-prop | sticky-sidebar-left | Long-form storytelling walk; long pages only. |
| Feature / value-prop | more-solutions | Secondary "also" features after the main set; mid/low page. |
| Feature / value-prop | split-layout-asymmetric | Proof-forward value prop; numbers carry the argument. |
| Feature / value-prop | value-who | "Who we are" plus numbers; bridges value and team. |
| Feature / value-prop | grid-four-column-equal | Minimal number-progression; a quick proof beat between heavier bands. |
| Feature / value-prop | about-value | About-page value band; pairs media with numbers. |
| Feature / value-prop | mission-reveal | One manifesto-grade statement; used once, max. |
| Process / how-it-works | sticky-sidebar-left-full-bleed | Canonical three-to-four-step process; rewards longer steps. |
| Process / how-it-works | get-started | Lighter closing-half process; leads into the ask. |
| Integrations | integration-grid | Each connection needs a line of copy. |
| Integrations | integrations | Lighter marquee; the marks speak alone. |
| Comparison | compare-table | Us-versus-alternative or plan matrix; decision stage. |
| Comparison | comparison | A single comparison column for composing. |
| Pricing | pricing | Equal, parallel plans with a billing toggle. |
| Pricing | pricing-packages | Unequal offers/packages of differing scope. |
| Pricing | pricing-tabbed | Plans split by persona/audience. |
| Pricing | subscription-faq | Pricing and FAQ in one band; short pages. |

### Body · proof
| Family | Variant | Distinguishing angle |
| --- | --- | --- |
| Social proof / logos | logo-strip | Early trust marks under the hero; marks only. |
| Social proof / logos | logo-marquee | A trust beat within a contrasting rhythm. |
| Social proof / logos | grid-five-column-equal | Investor/credibility wall; never invented names. |
| Social proof / logos | results-proof | Proof hybrid: one story anchoring a few numbers. |
| Stats / outcomes | grid-four-column-equal-cards | A strong contrasting mid-page proof beat. |
| Stats / outcomes | stat-band | Quiet, low-drama proof between calmer bands. |
| Stats / outcomes | outcome-stats | Outcome argument with meters; numbers need narrative. |
| Stats / outcomes | stat-tiles | Drop-in metric tiles for composing into other bands. |
| Testimonials / case studies | wide-card-internal-columns | Quote plus metrics for one named customer. |
| Testimonials / case studies | testimonial-bento | Multi-voice set; shows breadth. |
| Testimonials / case studies | testimonial-slider | One long voice at a time. |
| Testimonials / case studies | reviews-carousel | Many short reviews; the volume-of-love signal. |
| Testimonials / case studies | carousel-cards | Editorial case studies; a heavier band. |
| Testimonials / case studies | customer-story | Deep single story plus outcomes. |
| Team / about | team-grid | Portrait card grid; genuine portraits required. |
| Team / about | team-leadership | Formal/executive leadership row. |
| Team / about | team-about | Team plus story hybrid; richer about pages. |
| Team / about | team-visionaries | Minimal founders row for a small team. |
| Resources / insights / news | latest-insights | Editorial article cards; the blog teaser. |
| Resources / insights / news | resources-insights | Denser resources grid. |
| Resources / insights / news | latest-news | Press/news row; source- and date-driven. |
| Resources / insights / news | resources-carousel | Sliding; more items than a static band holds. |
| FAQ | faq-split | Long lists that must stay scannable. |
| FAQ | faq-centered | Short, quiet lists near the page end. |
| FAQ | faq-single | Minimal single column; no creative panel. |
| FAQ | faq | A chip teaser linking to a fuller FAQ. |

### Closing · conversion
| Family | Variant | Distinguishing angle |
| --- | --- | --- |
| Call-to-action | cta-banner | Shortest close; when a footer follows immediately. |
| Call-to-action | cta-band | Close with link columns; near-footer hand-off. |
| Call-to-action | cta-orbit | Decorated flagship close; once per page. |
| Call-to-action | cta-footer-reveal | A close on a non-contrasting surface (a split). |
| Call-to-action | hero-horizon-light | A gentle mid-page or closing invitation (a centered close, not a hero). |
| Contact / lead form | contact-form | Plain capture plus reassurance. |
| Contact / lead form | contact-us | Contact plus newsletter combo. |
| Contact / lead form | contact-methods | Methods grid plus form; support-style. |
| Contact / lead form | contact | Full standalone contact-page body. |
| Contact / lead form | book-demo | Sales-led demo-booking band. |
| Contact / lead form | demo-modal | Overlay attached to any action; not a standalone band. |

### Structural frame
| Family | Variant | Distinguishing angle |
| --- | --- | --- |
| Footer | footer-dark | Footer with a capture form built in. |
| Footer | footer-orbit | Decorated footer; rounds off a quiet preceding band. |
| Footer | footer-mega | Editorial/brand-forward mega-footer. |
| Footer | footer-cta | CTA-fused footer; one-band close on short pages. |
| Footer | footer-links | Bare link columns for composing. |

### Atoms & transitions
| Family | Variant | Distinguishing angle |
| --- | --- | --- |
| Atoms & transitions | buttons | The canonical action styling; source for every call-to-action. |
| Atoms & transitions | industry-chips | A tag/category chip rail; hero or feature garnish. |
| Atoms & transitions | problem-card | A single problem-statement card; composes into grids. |
| Atoms & transitions | agent-status | A live-metric status mock; a creative filler panel. |
| Atoms & transitions | divider | A hand-off transition between bands; used sparingly. |
| Atoms & transitions | divider-halftone | A transition into a contrasting band. |
| Atoms & transitions | divider-dissolve | A playful dissolve transition. |
| Atoms & transitions | divider-dither | A retro/technical-voiced transition. |
| Atoms & transitions | divider-horizon | The final transition into the footer. |

*79 variants · 17 families. To select among these, use [`COMPOSITION.md`](COMPOSITION.md); to assemble a
new section from their blocks, use [`COMPOSE.md`](COMPOSE.md).*
