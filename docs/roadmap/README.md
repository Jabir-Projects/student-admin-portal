# SIST Portal canonical roadmap

## Authority and purpose

This roadmap is the owner-authorized canonical planning record established at
the start of V2-12. It did not exist in the V2-11 closure tree. It complements
the historical evidence in `docs/project3/`; it does not retroactively change
that evidence.

Roadmap items record approved scope, dependencies, decisions, evidence, and
closure gates. Updates require explicit project-owner authorization and must be
grounded in repository or operational evidence. Planned work must never be
described as implemented. Any external Preview or Production operation,
including deployment, credential configuration, provider provisioning, or
database migration, requires separate owner authorization.

## Status vocabulary

| Status        | Meaning                                                                                 |
| ------------- | --------------------------------------------------------------------------------------- |
| `NOT STARTED` | No work in the item is authorized or evidenced.                                         |
| `PLANNING`    | Scope or operational decisions are being defined; no capability is implied.             |
| `IN PROGRESS` | An authorized package is underway; only its evidenced work is complete.                 |
| `BLOCKED`     | A required decision, dependency, or safety condition prevents progress.                 |
| `VERIFIED`    | The stated evidence has been executed or inspected; closure may still require approval. |
| `CLOSED`      | Required evidence and authorized delivery for the item are recorded.                    |

## Current roadmap summary

| Item                                                            | Status                                 | Canonical record        |
| --------------------------------------------------------------- | -------------------------------------- | ----------------------- |
| V2-11 — QA, Security, and Accessibility Closure                 | `CLOSED`                               | [V2-11](items/V2-11.md) |
| V2-12 — DevOps, Production Readiness, and Deployment Governance | `IN PROGRESS — V2-12.3 CLOSED` | [V2-12](items/V2-12.md) |
