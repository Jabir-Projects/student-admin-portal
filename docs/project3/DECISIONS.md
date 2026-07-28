# Project 3 Decisions

## Purpose and usage

This append-oriented register records approved product, architecture, security, and workflow decisions. Add new entries rather than rewriting history. Changes in status or supersession require owner approval and a linked decision.

## Status vocabulary

- `PROPOSED`: awaiting approval.
- `APPROVED`: binding within its stated scope.
- `SUPERSEDED`: replaced by a later decision.
- `REJECTED`: explicitly not adopted.
- `NEEDS OWNER DECISION`: incomplete decision authority.

## Entry template

### DEC-XXX — Title

- Date:
- Status:
- Context:
- Decision:
- Rationale:
- Consequences:
- Related phase or package:

## Initial decision register

### DEC-001 — Preserve the existing technology stack

- Date: 2026-07-28
- Status: `APPROVED`
- Context: The portal already has an established repository stack.
- Decision: Preserve the stack recorded in root `AGENTS.md`; read exact installed versions from repository files.
- Rationale: Avoid unapproved architectural churn.
- Consequences: Dependency or platform changes require separate approval.
- Related phase or package: All.

### DEC-002 — Controlled collaboration responsibilities

- Date: 2026-07-28
- Status: `APPROVED`
- Context: Project work requires explicit management and sensitive-action gates.
- Decision: ChatGPT manages approved packages, Codex inspects and implements them, and the owner approves sensitive actions.
- Rationale: Maintain scope, traceability, and owner control.
- Consequences: Codex stops at approval gates.
- Related phase or package: All.

### DEC-003 — Repository evidence is authoritative

- Date: 2026-07-28
- Status: `APPROVED`
- Context: Historical summaries can become stale.
- Decision: Current repository and Git evidence override historical summaries.
- Rationale: Prevent unsupported claims and stale planning.
- Consequences: Conflicts are reported rather than guessed.
- Related phase or package: All.

### DEC-004 — Roles and capability model are locked

- Date: 2026-07-28
- Status: `APPROVED`
- Context: Authorization semantics are security-sensitive.
- Decision: Preserve roles `STUDENT`, `STAFF`, temporary legacy `ADMIN`, and the approved 18 capabilities in [ARCHITECTURE.md](ARCHITECTURE.md).
- Rationale: Prevent privilege drift.
- Consequences: Changes require a separately approved decision.
- Related phase or package: V2-3.

### DEC-005 — Server-side authorization is mandatory

- Date: 2026-07-28
- Status: `APPROVED`
- Context: UI visibility cannot enforce access control.
- Decision: Enforce protected operations at trusted server boundaries.
- Rationale: Prevent privilege and cross-user access.
- Consequences: Capability-aware UI remains presentation only.
- Related phase or package: All protected features.

### DEC-006 — Sensitive actions require separate approvals

- Date: 2026-07-28
- Status: `APPROVED`
- Context: Database and delivery actions have distinct risks.
- Decision: Database access or mutation, commit, push, integration, and production actions each require explicit applicable approval.
- Rationale: File-edit permission is not operational permission.
- Consequences: Packages record these permissions explicitly.
- Related phase or package: All.

### DEC-007 — Control documents have separate responsibilities

- Date: 2026-07-28
- Status: `APPROVED`
- Context: Repeated rules become inconsistent.
- Decision: Roadmap, state, decisions, task, verification, and architecture documents keep distinct responsibilities and do not duplicate root `AGENTS.md`.
- Rationale: Keep controls concise and maintainable.
- Consequences: Cross-link instead of copying large rule sections.
- Related phase or package: CTRL-001.

### DEC-008 — Staff frontend requires Design Lock

- Date: 2026-07-28
- Status: `APPROVED`
- Context: Institutional UI needs an approved visual direction.
- Decision: Staff frontend visual implementation requires Design Lock approval first.
- Rationale: Avoid unapproved redesign.
- Consequences: Package C cannot begin from CTRL-001.
- Related phase or package: V2-3 Package C.

### DEC-009 — Institutional UI must not use fake content

- Date: 2026-07-28
- Status: `APPROVED`
- Context: Fabricated institutional content undermines trust and privacy.
- Decision: Do not use fake statistics, fake student or institutional data, or AI-generated student photographs.
- Rationale: Preserve institutional credibility and data safety.
- Consequences: Designs use approved, non-deceptive content.
- Related phase or package: Frontend packages.

### DEC-010 — CTRL-001 does not authorize Package C

- Date: 2026-07-28
- Status: `APPROVED`
- Context: Documentation creation is a separate management gate.
- Decision: Creating these control files does not authorize V2-3 Package C implementation.
- Rationale: One package at a time.
- Consequences: Stop after CTRL-001 review.
- Related phase or package: CTRL-001; V2-3 Package C.
