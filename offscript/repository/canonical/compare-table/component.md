---
schema_version: "1.0"
kind: component
identity:
  id: "canonical::compare-table"
  title: "compare-table"
ownership:
  owner: "offscript-authority"
scope:
  class: canonical
  identity: "offscript"
governance:
  authority: canonical-global
semantics:
  specializes:
    - "concept:role:comparison"
capabilities:
  satisfies:
    - "serves:comparison"
    - "serves:feature"
    - "serves:pricing"
    - "surface:base"
---

# compare-table

Us-versus-alternative or plan matrix; decision stage.

## Purpose

The decision-stage matrix: a full factor-by-column table that sets this option against its real
alternatives — a rival, or plan against plan — one distinguishing factor per row, so a reader who is
actively choosing can weigh the options for themselves. It exists to resolve the "is this the right
choice?" doubt at the moment of decision, earning belief by being fair rather than by asserting
superiority.

## Choose when

- The reader is at the decision stage, actively weighing this against a named alternative or between plans.
- The distinguishing factors are real and numerous enough to warrant a studied, cross-referenced matrix.
- Fair, side-by-side representation will do more to convert than another round of persuasion.
- The honest answer includes where this option is not the best fit, and saying so builds trust.

## Avoid when

- Only a single column is needed to drop into another band — reach for the composable comparison column.
- The axis is purely cost and packaging tiers — reach for a pricing role.
- The goal is to explain what the product does rather than adjudicate between options — reach for a feature role.
- There is no real alternative to weigh, so the "comparison" would be a straw-man — do not build one.

## Character

Candid and even-handed: a static instrument of adjudication that wins by fairness, not spin. It is
studied, not skimmed — the reader reads down rows and across columns deliberately, ordering the factors'
importance themselves. Its authority comes from admitting where this option loses; a matrix that only
ever flatters itself reads as marketing and forfeits the trust the format exists to earn.

## Composition

It is a factor-by-column table: the real options as columns, one distinguishing factor per row, each
cell a fair representation with its proof beside any claim. The alternatives must be represented
honestly, not straw-manned; every row must be a genuine point of difference; and no cell may assert an
advantage it cannot substantiate right there in the matrix.

## Contract

Assumes real alternatives and a reader deciding between them in good faith. It expects fair
representation as a hard condition — honest factors, honest cells, honesty about limits — because the
format's whole power is credibility; the moment it straw-mans a rival or hides where this option loses,
it destroys trust faster than it could ever win the point.

## Judgement

Used well, a deciding reader studies the matrix, satisfies themselves this is the right choice among
real options, and moves toward commitment on their own terms. The tempting misuse is tilting the table —
loading the rows, softening the rival, claiming a clean sweep — which a discerning reader detects
instantly and reads as a reason to distrust everything. Its value is fairness: it is believed precisely
because it concedes.
