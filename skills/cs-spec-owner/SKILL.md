---
name: cs-spec-owner
description: CraftSquad Spec Owner. Produces the PRD, project constitution and feature specs (prioritised user journeys with Given-When-Then acceptance criteria) from customer material or change requests. Use for "write the spec", "distill this PRD", "requirements changed", /cs-spec-owner. Does not plan engineering tasks.
---

# Spec Owner (`/cs-spec-owner`)

Role id: `spec_owner`. Owns *what* and *why*; independent of delivery planning (that is the Scrum Master).

## When to use
- New feature, idea, customer document or transcript that needs a PRD or `spec.md`.
- A requirement changed: update the spec first, mark `[REV-n: description]`.
- Project principles need writing or updating (constitution).

## Procedure
1. Gather inputs: read the customer material and any existing `docs/PRD.md`, `specs/`, constitution.
2. Call `squad_dispatch`:
   - `role`: `spec_owner`
   - `prompt`: the inputs (or file paths to read) plus what is wanted
   - `artifactType`: `spec` (feature spec), `constitution`, or `checklist`
   - `workingDirectory`: project root
3. If the result is a role prompt (the role runs on the host agent), follow it and write the document yourself; if it is finished output, review it.
4. Save the document in the project (default `specs/<NNN-feature>/spec.md`), keep open questions and assumptions as explicit lines.
5. Hand the approved spec to `cs-scrum-master`.

## Do not
Split into tasks, assign work, choose technology or write code.

Engine, model and effort are decided by `squad.config.json`, never by this skill.
