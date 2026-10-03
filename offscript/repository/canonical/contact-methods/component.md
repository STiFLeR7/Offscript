---
schema_version: "1.0"
kind: component
identity:
  id: "canonical::contact-methods"
  title: "contact-methods"
ownership:
  owner: "offscript-authority"
scope:
  class: canonical
  identity: "offscript"
governance:
  authority: canonical-global
semantics:
  specializes:
    - "concept:role:contact-lead-form"
capabilities:
  satisfies:
    - "serves:contact"
    - "surface:base"
---

# contact-methods

Methods grid plus form; support-style.

## Purpose

The methods-plus-form layout: a grid of contact methods shown alongside a capture form, for
support-style pages where a reader may prefer a channel — email, phone, chat — over filling in a field
set. It answers "how do I reach you?" by offering the routes plainly and letting the form be one option
among several, not the only door.

## Choose when

- The page is support-style and readers arrive wanting a channel, not just a form.
- Several genuine contact methods exist and showing them serves the reader.
- A reader may prefer to reach out their own way rather than submit a form.
- Making the routes explicit lowers the friction of getting help.

## Avoid when

- General contact through a single simple form is all that is needed — reach for the plain capture split.
- Contact plus a newsletter is the goal — reach for the contact-plus-newsletter combo.
- A sales-led demo booking is the task — reach for the booking band.
- The next step is a single freely-chosen action, not information — reach for a call-to-action role.

## Character

Low-friction and multi-channel: a set of real contact routes presented beside a form, so the reader
chooses the way that suits them. It keeps the family's reassuring, door-opening character but widens
it — the methods are the reassurance — and stays honest that each channel is genuinely staffed and
answered.

## Composition

It sits on support-style pages, pairing a grid of real contact methods with an optional capture form.
The methods must be genuine and monitored; the form must ask only for what it needs; and the whole must
make reaching out easier, not bury the direct routes beneath a form the reader would rather skip.

## Contract

Assumes real, monitored contact channels shown honestly beside a minimal form. It expects every listed
method to actually reach someone — an unstaffed inbox or a phone no one answers is worse than not listing
it — and the form to stay light; presenting dead channels or over-asking betrays the help the page
promises.

## Judgement

Used well, a reader in need finds the channel that suits them and reaches out with minimal friction. The
tempting misuse is listing methods that go unanswered, or making the form the only real route while the
methods are decoration. Its value is honest, open access — every channel must work, or the layout
promises help it does not deliver.
