# INFORMATION ARCHITECTURE-WEBSITE — The Information Constitution of the Website Track

> **What this is.** The governing layer that sits between the Communication & Perception System and Page Structure. It governs the single thing none of those layers govern: **the informational reality a website must possess before any page can be built.** It receives communication *requirements* — what must be understood, believed, remembered, and acted upon — and determines what information must exist, how that information relates, what it depends upon, and whether it is complete. Its output is not a page and not information; it is an **Information Model.**
>
> **What this is not.** Not a sitemap guide, not a page-planning guide, not a content-strategy guide, not a UX guide, not a layout guide, not a wireframing guide, not a section-planning guide. It names no section, page, layout, component, colour, type, spacing, or technique. Those are the layers beneath it. It also does not decide *what must happen in the reader's mind* — that belongs to Communication & Perception — nor *how the information appears on a page* — that belongs to Page Structure and everything below it.
>
> **The one boundary above all others.** *Information Architecture states facts about the information — what exists, how it relates, what depends on what, what is missing. It never makes a decision about the page — order, placement, emphasis, treatment. Facts are this layer's; decisions are downstream.* Everything in this document descends from that boundary.
>
> **The test every line passes.** *Would this still be true after a complete redesign — new brand, new palette, new typography, new components, new technology, new industry, new era?* If a statement depends on any of those, it does not belong here and has been removed. What remains is true of how information must be organized to support understanding, not of any one website.
>
> **How to read it.** Each principle states a behavior and the reason for it. The behavior is the law; the reason is why the law exists, so that it can be applied sensibly in situations this document never anticipated. When two principles tension, the **Non-Negotiables (§15)** resolve the conflict.
>
> **Where this sits.** Below `PURPOSE.md`, `PHILOSOPHY.md`, and `COMMUNICATION_AND_PERCEPTION_SYSTEM.md`; above Page Structure, Layout, Components, and Visual Language. **On any conflict, the three layers above win over this document, and this document wins over everything below it.** It fills the "Information Architecture" slot named in the Purpose layer's descent — *Purpose → Communication → Information Architecture → Layout → Component → Visual* — which has, until now, had no constitution.

---

## §0 — First principles

Begin from nothing and reason up.

A website is not a container of content. Behind every understanding a website must produce, there is an **informational reality** that has to exist first — a set of facts, relationships, dependencies, and proofs without which the understanding is impossible no matter how it is expressed or arranged. A reader cannot grasp a solution without first holding the problem it answers; cannot accept a claim without the evidence that validates it; cannot make a decision without the information that decision requires. None of that is a matter of words, pictures, sections, or style. It is a matter of *what information is present and how it connects.*

Every layer above this one decides *what must happen in the reader's mind*. Every layer below decides *how the information is given form on a page*. Neither governs the informational reality itself — the discovery of what information must exist, the mapping of how it relates, the proof that nothing required is missing. A website can have a flawless communication strategy, a beautiful surface, and a sound page, and still fail completely, because the information needed to support its understanding was never assembled. This document exists so that it is.

The informational reality has a structure of its own — independent of any page that will later present it. Discovering and constructing that structure is the only work this layer governs.

## §1 — Mission

The Information Architecture layer exists to construct the **informational reality** required for a required understanding to become possible — and to prove that reality complete before any page is built.

It is the bridge between two worlds. Above it, the Communication & Perception System speaks in terms of *what must happen in the mind* — what must be understood, believed, remembered, and acted upon. Below it, Page Structure and the layers beneath speak in terms of *arrangement and form*. Between the requirement and the form lies a question neither side answers: **what information must exist for that requirement to be satisfiable at all?** This layer answers it.

Its mission is therefore not to build pages and not to write content. It is to **define the Information Model** — the organized, connected account of the information a website must hold. The Information Model is this layer's identity and its only output:

> *Information Architecture does not output information. It outputs an Information Model.*

This mirrors the layer above it: Communication & Perception produces a communication account of how meaning must be perceived; Information Architecture produces an Information Model of what information must exist; Page Structure later converts that Information Model into a page progression. Each layer hands the next a complete, governed artifact — never raw material, never a finished page.

This layer **inherits and executes** two truths already established above it; it does not invent them and does not contradict them:

- **From Philosophy** — that information is organized around the reader's questions, in the order the reader asks them, never around the organization's internal shape (`PHILOSOPHY.md` §10). This layer operationalizes that principle into an actual model.
- **From Purpose** — that information architecture precedes and outranks visual hierarchy and layout; the informational structure is decided first, and form serves a structure it did not author (`PURPOSE.md` §6). This layer is where that "decided first" work is actually done.

Where those documents state the *law* that information governs form, this layer produces the *artifact* that law refers to.

## §2 — What this layer receives

This layer receives the output of the Communication & Perception System — but it does **not** inherit that output whole.

Communication & Perception produces a full perceptual account for the entire downstream stack: how each unit of meaning must be perceived, in what expression mode, through which communication medium, at what level of expression, with what communication energy. Most of that account is addressed to the layers that give information form — Layout, Components, Visual Language. **This layer consumes only one part of it: the requirements.**

What Information Architecture receives:

- **What must be understood** — the comprehension the website must produce.
- **What must be believed** — the claims that must be accepted as true.
- **What must be remembered** — the understanding that must persist.
- **What action must occur** — the decision or movement the website must make possible.
- **Which meaning is primary and which is secondary** — the relative weight of those requirements.

What Information Architecture explicitly does **not** inherit — these flow *past* it, to the layers that give information form:

- Expression modes, communication mediums, experiences, and communication energy.
- Any decision about how meaning will be perceived, expressed, or felt.
- Any visual, structural, or stylistic decision.

This layer takes the requirements and asks a single question of each: **what information must exist to make this understanding, this belief, this action possible?** It reads what the reader must end up holding in mind, and works backward to the information required to put it there. It never asks how that information should be expressed; that question was already answered above and will be executed below.

## §3 — The core question and the role of this layer

Information Architecture answers one question:

> **What information exists, how is it related, and what understanding depends upon it?**

Every principle in this document exists to support answering it. If a principle does not help **identify, relate, organize, validate, or complete** information, it does not belong here and has been removed.

The role that follows from the question is narrow and total. Communication & Perception determines *what must happen in the mind of the reader.* Information Architecture determines *what information must exist for that to happen.* It does not build pages. It constructs the informational foundation upon which pages can later be built — and it is responsible for that foundation being complete, connected, and free of gaps, before a single page is attempted.

## §4 — The information transformation model

This layer transforms a requirement into a model. The chain it runs is its spine, and the entire document descends from it:

> **Requirements → Information → Relationships → Dependencies → Understanding**

Communication & Perception supplies the **Requirements**. From them, this layer derives what **Information** must exist, maps how that information **Relates**, determines what it **Depends** upon, and thereby establishes what **Understanding** becomes possible. When the chain closes — when the information is present, connected, and sufficient — understanding is supported. When it breaks anywhere, understanding fails, no matter how the result is expressed or arranged.

Set beside the layer above, the division is exact:

- **Communication & Perception asks:** What must be understood? What must be believed? What must be remembered? What must be done?
- **Information Architecture asks:** What information is required? What supports it? What validates it? What does it depend upon? What is missing?

The output of this transformation is the **Information Model** — and nothing else. Not a page. Not a structure. Not a layout. Not a design. The model is informational through and through; the act of giving it form belongs to other layers and begins only after this one is complete.

## §5 — Information Discovery

**The governing truth.** Information requirements are not given; they are *discovered* — derived backward from communication requirements. For every required understanding there is a body of information without which that understanding cannot form, and discovering that body is the first act of this layer.

**Why it exists.** A requirement states an end state in the mind; it does not enumerate the information needed to reach it. Left undiscovered, that information is simply absent, and its absence is invisible until understanding fails. Discovery makes the invisible explicit.

**The behaviors that emerge.** For each requirement, this layer determines:

- **Required information** — what must be present for the understanding to form at all.
- **Supporting information** — what strengthens or deepens an understanding already made possible.
- **Validation information** — what allows a claim to be accepted as true rather than merely grasped.
- **Contextual information** — what a reader needs to make sense of the rest.
- **Missing information** — what the requirement demands that does not yet exist and must be obtained.

Discovery determines what information is *necessary*. It is the act that turns a requirement into the beginnings of a model.

**The failure when ignored.** When discovery is skipped, a website is built from whatever information happened to be on hand, and the understanding it was meant to produce silently fails for want of information no one realized was required.

## §6 — Information Classification

**The governing truth.** Information is not uniform. A problem, a proof, a process, and an outcome are different *kinds* of information, and they behave differently within the model — they relate differently, depend differently, and are validated differently. Classification names those kinds so the model can reason about them.

**Why it exists.** Without classification, information is an undifferentiated pile and the model can say nothing useful about how its parts behave. The purpose is not to create content categories for a page; it is to make the informational kinds explicit so relationships, dependencies, and completeness can be assessed.

**The behaviors that emerge.** Information is categorized by kind — among them: **Problem, Impact, Solution, Capability, Process, Outcome, Proof, Evidence, Risk, Decision-Support, Context, Validation.** These are kinds of information, not kinds of section. The same kind may later be expressed in any number of ways; the classification governs only what the information *is*, never how it is shown.

**The failure when ignored.** When information is left unclassified, validation information is mistaken for the claim it supports, context is mistaken for substance, and the model loses the ability to tell whether each requirement is actually met.

## §7 — Information Relationships

**The governing truth.** Information exists as a connected system, not a set of isolated fragments. The meaning of a piece of information is largely determined by what it connects to — what it causes, what it validates, what it depends on, what it contrasts with. The relationships are part of the model, not a commentary on it.

**Why it exists.** A fact in isolation supports almost nothing; the same fact, connected to the claim it proves or the problem it answers, becomes load-bearing. Understanding is built out of relationships. A model that lists information without relating it has not modeled anything.

**The behaviors that emerge.** This layer maps how information connects, among the recurring relationship kinds:

- **Cause-and-Effect** — one piece of information produces or explains another.
- **Validation** — one piece of information establishes another as true.
- **Dependency** — one piece of information cannot be understood without another.
- **Supporting** — one piece of information strengthens another without being required by it.
- **Contrasting** — one piece of information takes its meaning from its difference with another.
- **Hierarchical** — one piece of information contains or generalizes another.
- **Transformational** — one piece of information describes movement from one informational state to another (a current state to a future state, a prior condition to a desired one). Transformation is neither hierarchical nor a dependency; it is its own structure, and it is among the most common informational shapes a website carries. Naming it as a distinct relationship keeps the model from forcing it into a shape it does not have.

**The failure when ignored.** When relationships go unmapped, information fragments — each piece individually present, none of it connected — and the reader is handed parts with no system to assemble them into understanding.

## §8 — Information Dependencies

**The governing truth.** Some understanding is impossible without prior understanding. Information has prerequisites: there are pieces that cannot be grasped until other pieces are already held. These dependencies are facts about the information itself, true regardless of how or where the information is ever presented.

**Why it exists.** Dependency is the property that makes information a structure rather than a list. It is also the property most easily confused with a decision about the page — and the distinction is the sharpest boundary this layer holds.

**The behaviors that emerge.** This layer determines, for each piece of information:

- **Prerequisites** — what must be understood before this can be.
- **Sequential dependencies** — the chains in which one understanding necessarily precedes another. These are *logical* dependencies — facts about what builds on what — not page order.
- **Foundational information** — the information other information is built upon.
- **Derived information** — the information that only makes sense once the foundation is held.

**The boundary, stated sharply.** A dependency is a fact: *understanding B is impossible without first understanding A.* The order in which sections appear on a page is a decision: *A is shown before B.* This layer owns the fact and never the decision. The dependency graph **constrains** the eventual page sequence — Page Structure may not present derived information before its foundation — but it does not **decide** that sequence. Page Structure decides the order, within the constraints this layer emits and within the narrative the layers above mandate. To emit the constraint is this layer's work; to choose the sequence is not.

**The failure when ignored.** When dependencies go unmapped, derived information is treated as if it stood alone, foundations are assumed rather than established, and understanding collapses because it was asked to build on ground that was never laid.

## §9 — Information Clustering

**The governing truth.** Related information groups naturally — by informational affinity, before any page or section exists to hold it. Pieces that share a subject, a purpose, or a dependency belong together as a matter of the information's own structure, and recognizing those groupings is part of modeling the information.

**Why it exists.** Clustering reveals the natural boundaries within the informational reality — where one body of information ends and another begins. These boundaries are real properties of the information, and they exist whether or not a page ever honors them.

**The behaviors that emerge.** This layer identifies:

- **Information domains** — the largest natural bodies of related information.
- **Information groups** — the coherent subsets within a domain.
- **Information collections** — sets of information that travel together because they serve one understanding.
- **Information boundaries** — where one body of information genuinely ends and another begins.

**The boundary, stated explicitly.** *Information is clustered because information possesses affinity, not because pages require sections.* Clustering exists purely because information naturally belongs together; Page Structure later decides how — and whether — those clusters appear as anything a reader sees. The moment clustering begins reasoning about readability, sections, page grouping, or content blocks, it has stopped modeling information and started solving Page Structure's problem — which is forbidden here. This layer says *these belong together;* it never says *therefore show them together.*

**The failure when ignored.** When clustering is skipped, related information scatters and unrelated information is forced together, and every layer downstream inherits a model whose natural seams have been lost.

## §10 — Information Priority

**The governing truth.** Not all information carries equal weight toward an understanding. Some is foundational — the understanding cannot form without it; some is supporting — it strengthens an understanding already possible. Priority is the ranking of that **informational importance**, and it is decided by the information's role in the model, not by anything about how it will be shown.

**Why it exists.** A model in which everything is equally important is a model that cannot guide anything, because it cannot say what must be present and what may be thinned. Priority gives the model a spine of necessity. This layer is where Purpose's law that *information hierarchy is decided before and above visual hierarchy* (`PURPOSE.md` §6) is actually carried out — this is the deciding, not the law.

**The behaviors that emerge.** This layer ranks information as **primary**, **secondary**, or **supporting** — purely by its contribution to the required understanding: what the understanding depends on, what is necessary to it, what is informationally significant to it.

**The boundary, stated as a governing rule.** ***Information priority emerges from dependency, not desire.*** Priority comes from informational necessity — which information is foundational, which information depends on other information — never from key messages, marketing emphasis, persuasion, or communication intent. This section carries the highest risk of drifting upward into Communication & Perception's territory, and the rule is the guard: the moment priority is decided by what the website *wants* to stress rather than by what the understanding *requires*, this layer has begun answering a question that is not its own. **Informational importance, never communication importance.** How importance is then communicated or emphasized belongs to Communication & Perception; how it is then shown belongs to the layers below. This layer decides only which information is foundational and which is supporting — never its order, never its visual weight.

**The failure when ignored.** When priority is set by desire instead of dependency, supporting information is treated as foundational and foundational information is thinned away, and the model misrepresents what the understanding actually requires.

## §11 — Information Completeness

**The governing truth.** A model is only as good as its completeness. Information Architecture is not responsible for *creating* understanding — that is the work of perception and expression, which belong above. It is responsible for ensuring the Information Model contains **sufficient** information to make understanding *possible.* This is the layer's clearest statement of identity.

**Why it exists.** Information that is almost complete is, for the purpose of understanding, often not complete at all: a claim with no proof, a process with a missing step, a decision with an absent input. The gap is silent until understanding fails on it. Completeness is the discipline of finding the gap before the failure.

**The behaviors that emerge — Informational Sufficiency.** Communication & Perception asks *what understanding is required?* This layer asks *is the Information Model sufficient to support that understanding?* — and answers it by surfacing:

- **Missing information** — what a requirement demands that the model does not contain.
- **Unsupported information** — claims present without the information that would establish them.
- **Unvalidated information** — assertions the model offers no means of crediting.
- **Incomplete information systems** — relationships or dependencies with a piece absent, so the chain cannot close.

The test is sufficiency, not abundance: enough information that the required understanding *can* form — no less, and not a heap more. This layer surfaces every informational gap **before** page creation begins, so that no website is built on a model that cannot support what it was asked to.

**The failure when ignored.** When completeness goes unchecked, a model that looks finished ships with a hidden hole, and the understanding it was built to produce fails at exactly the point the missing information was needed — see **False Completeness** in §14.

## §12 — What Information Architecture must never do

This section is the layer's discipline, and it is absolute. Information Architecture explicitly rejects ownership of everything below. For each, the decision belongs to a named layer, and this layer claims none of it.

**Not communication strategy.** It does not decide expression modes, communication strategies, communication mediums, experiences, or communication energy. Those belong to **Communication & Perception** (`COMMUNICATION_AND_PERCEPTION_SYSTEM.md`). This layer determines what information must exist; it never determines how that information is communicated.

**Not belief or persuasion strategy.** It does not decide trust strategy, persuasion strategy, or credibility strategy. Those belong to **Communication & Perception** and, above it, to Philosophy. This layer determines what *validation information* must exist; it never decides how belief is engineered.

**Not page structure.** It does not decide sections, section order, page flow, narrative flow, hero areas, or call-to-action placement. Those belong to **Page Structure**. This layer emits the dependency and priority constraints a sequence must honor; it never chooses the sequence.

**Not layout.** It does not decide columns, alignment, density, widths, distribution, or containment. Those belong to **Section Layout** (`SECTION_LAYOUT.md`).

**Not components.** It does not decide cards, accordions, tables, tabs, or carousels. Those belong to the **Component System** (`COMPONENT_SYSTEM.md`, executed by `component-governance/components.md`, `COMPOSITION.md`, `COMPOSE.md`).

**Not visual language.** It does not decide typography, colour, contrast, motion, or styling. Those belong to **Visual Language** (`VISUAL_LANGUAGE.md`, executed by `rulebooks/visual-language.md`).

**Not brand expression.** It does not decide personality, brand character, or brand expression. Those belong to **Brand Expression** (`BRAND_EXPRESSION.md`, executed by `rulebooks/design-charter.md` and `creatives.md`) and, above all, to the Creative Director.

The rule beneath every line of this section is the one boundary from the header: this layer states facts about information; it never makes a decision about the page.

## §13 — The output of Information Architecture

The output of this layer is a single artifact: the **Information Model.** It comprises:

- **Information domains** — the natural bodies of related information.
- **Information relationships** — how the information connects.
- **Information dependencies** — what requires what.
- **Information clusters** — what belongs together by affinity.
- **Information priorities** — what is foundational and what is supporting.
- **Completeness model** — the proof that the information is sufficient and the record of any gap.

It never outputs page structures, section structures, layouts, components, or visual systems. The output remains informational from end to end. **Page Structure is the layer that converts this Information Model into a page progression** — it is the consumer of this layer's artifact, not part of it. When this layer hands down a complete, connected, sufficient Information Model, everything below it has a foundation it can trust and did not have to assemble.

## §14 — Failure modes

Each failure below is a violation of a principle established above; the cure is the principle.

- **Missing Information** — a required understanding has no information to support it; the requirement was never discovered (violates §5, §11).
- **Unsupported Claims** — an assertion is present with no validation information to credit it; belief is asked for without grounds (violates §6, §11).
- **Orphaned Information** — a piece of information connects to nothing; it neither supports, validates, nor depends, and carries no load (violates §7).
- **Circular Dependencies** — two pieces of information each require the other first, so neither can ever be understood; the dependency chain cannot close (violates §8).
- **Relationship Blindness** — information is present but unrelated; the model is a list, not a system, and the reader is left to assemble it alone (violates §7).
- **Information Fragmentation** — naturally related information is scattered across the model; its affinity was never recognized (violates §9).
- **Information Overlap** — the same information occupies two clusters or roles with no clear boundary, so the model contradicts itself about where it belongs (violates §9).
- **Information Redundancy** — the same information is modeled repeatedly with no added role, inflating the model without strengthening any understanding (violates §10, §11).
- **Incomplete Information Systems** — a relationship or dependency is missing a piece, so a chain that should support understanding cannot close (violates §8, §11).
- **False Completeness** — the most dangerous failure of this layer: the Information Model *appears* complete but hides assumptions, unsupported gaps, or missing validation. The system believes it holds enough information to support understanding when, in reality, critical supporting information is absent. The model looks finished and is not — and because it looks finished, the gap is never sought (violates §11, and is the precise failure Informational Sufficiency exists to prevent).

## §15 — Non-Negotiables

These are immutable. They are permanent, universal, technology-agnostic, and medium-agnostic. They define what Information Architecture fundamentally is and is not, and no downstream need or upstream pressure may override them.

1. **Information Architecture determines what information must exist — never how it is communicated or shown.** The relationship between requirement and information is its whole territory.
2. **Its output is an Information Model — never a page, structure, layout, component, or visual.** The output is informational from end to end.
3. **It states facts about information; it never makes decisions about the page.** Order, placement, emphasis, and treatment are always downstream.
4. **Dependency is a fact, not a sequence.** This layer emits the constraint; Page Structure chooses the order within it.
5. **Priority emerges from dependency, not desire.** Informational importance only — never communication or marketing importance.
6. **Information is clustered by affinity, not because pages require sections.** Clustering models the information's own structure, nothing else.
7. **The model must be sufficient, not abundant.** Enough information that the required understanding can form — no gap, and no heap.
8. **Completeness is proven, not assumed.** Every gap is surfaced before page creation begins; a model that looks complete is not trusted until it is shown to be.
9. **It executes the laws above it, never contradicts them.** It operationalizes Philosophy §10 and Purpose §6; it does not re-author or overrule them.

## §16 — The final governing principle

Information Architecture does not decide how information is communicated. It determines what informational reality must exist.

Communication & Perception decides what must happen in the mind. Information Architecture produces the **Information Model** — the organized, complete, connected account of what information is required to make that happen — from which all downstream systems operate.

If any section of this document begins to discuss pages, layouts, components, visuals, interactions, experiences, or styling, it has left its territory and must return to information, relationships, dependencies, clustering, prioritization, and completeness. That return is always available, because those six are the whole of what this layer governs, and the whole of what it must.
