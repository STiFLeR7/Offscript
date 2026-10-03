# SPACING — The Design Discipline of the Interval

> **What this is.** The Foundation discipline that owns **the interval** — the measured gap between
> things, and what a reader understands from its size. It decides what the available intervals are,
> what each one means, and how they must relate in sequence. Its output is not a margin, a scale or a
> token; it is **interval intent**.
>
> **What this is not.** Not spatial organization: what should feel together, what should feel apart,
> how contained or dense a moment is, are settled above in `SECTION_LAYOUT.md` and are never re-opened
> here. This discipline never decides *whether* two things belong together — only what a gap of a
> given size communicates once that relationship is settled. Not layout, not grid, not a responsive
> guide. It names no number.
>
> **The one boundary above all others.** *Spacing determines what intervals exist, what each one
> means, and how they relate in sequence. It never decides what belongs with what, how much room a
> moment occupies, or how dense it is. It governs interval intent, and nothing else.*
>
> **The test every line passes.** *Would this still be true if every number in the scale were
> replaced, while intervals still communicated the same things?*
>
> **Where this sits.** A Design Discipline of the Website Foundation, reasoned through after
> `EDITORIAL_ART_DIRECTION.md` — which tells it the pace a moment must be met at. **On any conflict,
> Governance wins, `SECTION_LAYOUT.md` wins on every spatial-organization question, and this document
> wins over `rulebooks/visual-language.md` §5 and §17, which operationalize it.**

---

## §0 — First principles

Two things placed near each other are read as related. The same two placed further apart are read as
separate. Nothing was said; the relationship was communicated entirely by the distance between them,
and the reader drew the conclusion before reading either.

This makes the interval one of the most communicative properties in an interface and one of the least
respected. It is respected poorly because it is easy to produce — a gap requires no asset, no
decision, no craft, and appears whether or not anyone intended it. Properties that arrive for free are
routinely treated as though they carry no meaning, and space is the clearest case: it is habitually
described as *whitespace*, as though it were the residue left over once the content was placed.

It is not residue. It is the mechanism by which structure is communicated before it is read. And
because it communicates whether or not it was decided, an undecided interval still says something —
usually that everything on the page is equally related to everything else, which is almost never true
and is exactly what a page assembled from evenly-spaced parts reports.

The characteristic failure follows directly. A system that owns a spacing scale will apply its steps
evenly, because even application is what a scale most obviously affords. The result satisfies every
rule about which values may be used and communicates nothing, because meaning in this discipline lives
in **difference** — a large gap means something only against a smaller one. A page of correct,
identical intervals has used the scale and abandoned the discipline.

## §1 — Identity

Spacing is the discipline of **the interval**.

It owns what gaps are available, what each communicates, and the relationships intervals must hold in
sequence. It exists independently of Section Layout for a reason worth stating plainly: Section Layout
decides *what should feel together* — a judgment about relationship. This discipline decides *what a
gap of this size says* — a judgment about communication. One settles the intent; the other settles the
vocabulary that expresses it.

Without it, spacing is applied from a scale by availability rather than by meaning, and every gap is
defensible while the page says nothing about its own structure.

## §2 — Mission

Spacing exists so that **a reader understands the structure of what they are looking at before reading
any of it, and never has to.**

Success is a page whose relationships are legible from its intervals alone — where what belongs
together is obviously together, what is separate is obviously separate, and the reader was never
required to work it out.

## §3 — Constitutional Responsibility

This discipline owns **interval intent**: the meaning carried by a gap of a given size, and the
relationships intervals must hold with one another.

**What it inherits.** Spatial relationships and density, from Section Layout — what should feel
together, and how concentrated a moment is. The felt register, from Editorial Art Direction — the pace
at which a moment should be met. The mechanisms that exist, from the Component System.

**What it contributes.** A closed set of available intervals; the meaning assigned to each; and the
ordering relationships that must hold regardless of what the intervals are.

**What it rejects.** It does not decide what belongs with what — that judgment is settled above and
this discipline expresses it. It does not decide how much room a moment occupies, or how contained it
is. It does not own the grid. It does not set a number: which numbers realize the intervals is Token
Architecture's, and this discipline must remain true when they change.

## §4 — Core Question

> **What does this gap say, and is it saying it differently from the gap beside it?**

The second clause carries the discipline's central claim: an interval has no meaning in isolation, so
a question about one gap that does not consider its neighbour cannot be answered.

## §5 — Inputs

- **The Spatial Model** — what should feel together and apart, and how dense the moment is.
- **The felt register** (Editorial Art Direction) — the pace and pressure the moment should carry.
- **The Mechanism Model** — the parts an interval sits between.
- **The Progression Model** — where the reader is, which determines whether an interval is an opening,
  a continuation or a close.

## §6 — Transformation

> **A settled relationship → the interval that communicates it.**

What enters is a relationship already decided and a moment with a required pace. What is applied is
the judgment of which interval says that, given what the neighbouring intervals say. What emerges is
interval intent.

## §7 — Outputs

- **The interval vocabulary** — a closed set of available gaps, each with an assigned meaning.
- **The ordering relationships** — the relative constraints that must hold between intervals.
- **Reasoning** — why an interval means what it does.

It outputs no number, no margin and no token.

## §8 — Discipline Knowledge

### Proximity is read before content

A reader infers grouping from distance pre-attentively. This is not a preference for tidy layouts; it
is how visual perception assembles a field into parts. The immediate consequence is that **an interval
cannot decline to communicate.** There is no neutral gap. A gap that was not decided still reports a
relationship, and it reports whatever its size happens to imply.

### Meaning lives in ratio, not in magnitude

A gap of a given size means nothing on its own. It means *larger than the one above it* or *smaller
than the one below it*, and the reader perceives the comparison rather than the measurement. Two
consequences follow, and both are load-bearing.

First, **the rule is the order, not the numbers.** A system that states its intervals as absolute
requirements has governed the wrong thing: the same numbers at a different viewport, or a different
scale, must still produce the same relationships, and only the relationships were ever the point.

Second, **even distribution destroys meaning entirely.** If every interval is the same, no interval is
larger than another, and the mechanism by which structure was going to be communicated has been
switched off. This failure is invisible to any check that validates values, because every value used
was legitimate.

### A scale exists to make intervals comparable, not to make them available

The purpose of a closed set of steps is that a reader encountering many gaps across an experience
perceives them as belonging to one system — the same few distances recurring, so differences between
them are meaningful. An arbitrary gap is not wrong because it is off-system; it is wrong because it is
*incomparable*, and an incomparable interval communicates nothing about relationship.

This is why the vocabulary must be closed. An open set of intervals is a continuum, and on a continuum
no gap is distinguishable from the one next to it.

### An interval is a moment in a sequence, not a property of a boundary

Spacing is usually described as belonging to a boundary between two things. It is more accurately a
moment in the reader's movement: a pause of a particular length. Read this way, a run of intervals is
a pattern of pauses, and a page is experienced as a rhythm rather than as a stack.

This reframing is what makes the discipline usable. It explains why a large gap before a section reads
as arrival rather than as separation, why a tight gap binds two things into one thought, and why the
same interval repeated becomes inaudible — the same reason a repeated note stops being heard.

### Compression earns expansion

Intervals are perceived relatively, so a generous gap is only generous against a tight one. A page
that is uniformly open is not spacious; it is undifferentiated, and it reads as empty rather than as
composed. Density and openness are not opposed qualities to choose between — they are a pair, and each
is what makes the other perceptible.

### Content length must not disturb the rhythm

A common and quiet failure: intervals adjusted so that a short section does not look sparse or a long
one does not look crowded. This substitutes the appearance of balance for the communication of
structure. Short content in a preserved rhythm reads as calm and deliberate; short content in a
collapsed rhythm reads as an accident. The rhythm is the constant; the content varies within it.

## §9 — Organizational Design System Decisions

- **This system uses a closed step set, and an off-step interval is a violation even where it looks
  correct.** Adopted so that every interval across the experience is comparable.
- **A moment opens on a fixed ladder of named roles rather than on chosen numbers** — an opening
  interval, a binding interval, and a content interval, each with an assigned meaning. Adopted so the
  opening of a section is a rhythm rather than a stack of margins.
- **The ordering between those roles is the rule; the magnitudes are not.** Opening exceeds content
  exceeds binding, at every viewport. Adopted because the same relationships must survive a change of
  scale, and because an absolute-only rule would pass a page that made every gap identical.
- **The rhythm is preserved regardless of content length.** Adopted because collapsing it to avoid
  sparseness trades communication for appearance.
- **Intervals scale down at narrower viewports; the relationships do not change.** Adopted because
  the relationships are the discipline and the magnitudes are its realization.

## §10 — Primary Primitives

**Interval — a single measured gap, and what it says.** The atom of the discipline. Every higher
decision is a decision about an interval's size relative to another's.

**Step — a discrete, available rung of the closed set.** The primitive that makes intervals
comparable. Steps are what turn a continuum into a vocabulary, and the reason an off-step gap fails
even when it looks right.

**Order — the required relationship between intervals in sequence.** The primitive that carries all
the meaning. Interval and Step describe gaps in isolation; Order is what makes a run of them say
something. A discipline holding the first two and not the third produces correct, evenly-distributed,
mute pages.

The dependency runs one way: Steps make Intervals comparable, and Order makes comparable Intervals
communicative. Order is the primitive most often left ungoverned, because it is the only one that
cannot be satisfied by checking a single value.

## §11 — Decision Intelligence

**Ask what the gap should say before asking how large it should be.** Size is the answer, not the
question. Reasoning from size produces intervals that are individually reasonable and collectively
uniform.

**Decide every interval against its neighbour.** No gap can be evaluated alone. The question is always
comparative, and a process that considers one boundary at a time will converge on evenness.

**Let the register set the pace.** Editorial Art Direction has decided whether a moment should be met
quickly or slowly. Interval is one of the primary instruments realizing that, and reasoning from the
register rather than from the content is what produces a page with pacing.

**Treat evenness as a defect requiring justification, not as a neutral default.** Where consecutive
intervals are equal, the burden is to explain what that is communicating. Usually the answer is
nothing.

**Preserve the rhythm; let the content be short.** Resist adjusting intervals so a sparse section
looks fuller. The rhythm is what the reader is reading.

**When an approved interval will not fit, change what is being spaced.** An off-step gap is not a
solution to a layout problem; it is a layout problem relocated into the one vocabulary that was
holding the experience together.

## §12 — Behaviour

The discipline behaves like a typesetter: precise about small distances, conscious that the reader
perceives the pattern rather than the measurement, and unwilling to adjust a system to accommodate one
awkward case. It is comparative by instinct — it does not look at a gap without looking at its
neighbour — and it is patient with emptiness, treating an open passage as something composed rather
than as space not yet filled.

## §13 — Cross-Discipline Relationships

- **Section Layout, above.** The seam is exact and constantly tested. Section Layout decides what
  should *feel* together; this discipline decides what a gap of a given size *says*. Where this
  discipline finds itself deciding whether two things are related, it has reached upward.
- **Editorial Art Direction, consulted before.** Supplies the pace a moment must be met at. This
  discipline realizes it and never re-decides register.
- **Typography.** Line spacing and measure are Typography's; the gaps *between* typographic blocks are
  this discipline's. The seam is the block boundary.
- **Component System.** Supplies the parts an interval sits between. Internal component spacing is
  realized from this discipline's vocabulary, never invented by the component.
- **Token Architecture, below.** Encodes the steps as reusable values. It stores the outcome of this
  reasoning; it never produces it.
- **`rulebooks/visual-language.md` §5 and §17, below.** Operationalize this expertise into the named
  roles and the opening ladder. They inherit this reasoning and never author it.

## §14 — Quality Intelligence

- What does this gap communicate, and is it the relationship that was actually settled above?
- Is this interval different from the one beside it? If not, what is the sameness saying?
- Could a reader infer this page's structure from its intervals alone, with the text blurred?
- Does the rhythm survive short content, or did it collapse to avoid looking sparse?
- Is there compression anywhere, or is the page uniformly open and calling that spacious?
- Does the ordering hold at every viewport, or only at the one it was designed on?
- Is every interval on a step — and where one is not, what was the actual problem?

## §15 — Failure Modes

**Even distribution.** Every interval the same because the steps exist. The discipline's defining
failure: fully compliant, entirely mute, and invisible to any value-checking verification.

**Absolute rules without relative ones.** A system that mandates magnitudes passes a page whose gaps
are all identical and all correct. Ordering must be checked, or the check cannot see the failure.

**Rhythm collapse under short content.** Intervals compressed so a sparse moment looks fuller.
Appearance bought with communication.

**Off-step intervals.** A gap chosen to make something fit. Incomparable, and therefore mute — and the
near-miss is the hardest to see and the most damaging, because it looks like the system.

**Uniform openness.** A page spaced generously throughout, mistaken for spacious. Without compression
there is nothing for openness to be perceived against.

**Reaching upward.** The discipline begins deciding what belongs with what. That judgment is Section
Layout's, and re-deciding it downstream produces two layers with conflicting answers.

**Spacing as leftover.** Intervals treated as the room remaining after content is placed. The
discipline is not applied at all, and the page reports that everything is equally related to
everything.

## §16 — Verification

**Vocabulary.** Every interval sits on an approved step — checkable, and checked.

**Ordering.** The required relationships hold at every viewport. This must be asserted *relationally*;
an absolute-only assertion passes a page with identical gaps everywhere, which is the failure.

**Differentiation.** Consecutive intervals within a moment are not uniformly equal. A page that never
varies its intervals has not used the discipline.

**Rhythm preservation.** The opening rhythm holds regardless of content length.

**Seam integrity.** No rule here decides what belongs with what.

## §17 — Evolution

The discipline matures by understanding what intervals communicate, not by adding steps. A larger step
set is a weaker one: it approaches a continuum, and on a continuum nothing is comparable.

It grows by learning which relationships readers actually infer, by getting more precise about the
ordering constraints that matter, and by finding that two steps were always one. It does not grow by
adopting new scales, which change the numbers and nothing about why a gap means what it means.

---

## Artifact A — Implementation Matrix

| Field | Value |
|---|---|
| **Consumes** | Spatial Model (relationships, density) · felt register — pace (Editorial Art Direction) · Mechanism Model · Progression Model |
| **Outputs** | The interval vocabulary · assigned meanings · the ordering relationships |
| **Consumed by** | `rulebooks/visual-language.md` §5, §17; Token Architecture |
| **Realised in** | Brand pack — the step set and the named rhythm roles |
| **Verified by** | on-step predicate · relational-ordering predicate · interval-differentiation predicate |
| **Rendered by** | The generator's assembly stage |

## Artifact B — Governance Coverage

| Retired by this discipline | Evidence |
|---|---|
| spacing read as margin rather than as rhythm | the ladder existed as values with no statement of what the intervals mean |
| even distribution | eleven of eleven bands opening on one identical three-step figure, every value legitimate |
| no rule against uniform intervals | the live ordering check is relational, but nothing required consecutive intervals to differ |

**Explicitly NOT retired here.** What belongs together belongs to **Section Layout**; creative
presence and its surrounding whitespace belong to **Illustration**; the 100px leading-edge drift on
section 4 is an **alignment** failure, adjacent to this discipline and not owned by it.

## Artifact C — Runtime Ownership

| Rule | Governed in | Realised in | Verified in | Rendered in |
|---|---|---|---|---|
| every interval sits on an approved step | this document | brand pack | on-step predicate | generator |
| opening exceeds content exceeds binding | `rulebooks/visual-language.md` §17 | brand pack | relational-ordering predicate | generator |
| consecutive intervals are not uniformly equal | this document | brand pack | differentiation predicate | generator |
| the rhythm survives short content | this document | brand pack | rhythm-preservation predicate | generator |

## Artifact D — Canonical Reference Mapping

| Reference | Observation | Rule it produces |
|---|---|---|
| `Frame 2147226586` | heading block anchored top, secondary block anchored bottom, a large deliberate gap between — the two are not evenly distributed | unequal intervals within a moment; evenness is a defect requiring justification |
| `Frame 2147226584` | generous opening before anything is said; tight binding between headline and lede | the opening interval and the binding interval carry different meanings |
| `Frame 2147226588` | tight binding within each step of the sequence, wide separation between steps | compression earns the expansion beside it |
| CTA reference | equal, tight vertical padding at the close | a closing moment takes a different rhythm from an opening one |
| all references | no two consecutive gaps are equal anywhere | difference is the mechanism; sameness communicates nothing |

**Completeness.** Every observation maps to a rule.
