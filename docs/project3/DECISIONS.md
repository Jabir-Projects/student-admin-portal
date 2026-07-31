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

### DEC-011 — Package D account-management scope and authorization boundaries

- Date: 2026-07-29
- Status: `APPROVED`
- Context: Package D requires a formal scope lock before account-management
  implementation begins.
- Decision:
  1. STAFF account creation is excluded from Package D.
  2. Package D manages existing STAFF accounts only.
  3. Disabled STAFF reactivation is included and requires
     `MANAGE_STAFF_ACCOUNTS`.
  4. STAFF reactivation uses database revalidation, a transaction, audit
     logging, `sessionVersion` invalidation, and final-manager protection where
     relevant.
  5. After `/staff/student-accounts` exists, STAFF visits to
     `/admin/users/pending` redirect safely to the STAFF route. Legacy `ADMIN`
     retains temporary compatibility until Package E, without an authorization
     bypass.
  6. Student-account management uses one capability-aware page.
     `MANAGE_STUDENT_ACCOUNTS` controls pending and active views, approval, and
     disabling; `REACTIVATE_STUDENT_ACCOUNTS` controls disabled views and
     reactivation. Single-capability actors see only their authorized section.
  7. STAFF capability assignments are visible only with
     `MANAGE_STAFF_CAPABILITIES`.
  8. `MANAGE_STAFF_ACCOUNTS` alone authorizes neither viewing nor changing
     capability assignments.
  9. Audit writes remain transactional. Audit Log viewing is excluded from
     Package D and remains for V2-7.
  10. Pagination defaults to 25 and permits at most 50 records.
  11. Student search supports full name and student number.
  12. STAFF search supports
      full name.
  13. Pending accounts use oldest-first deterministic ordering with a stable
      secondary key.
  14. Mutation targets use safe opaque server-resolved references rather than
      visibly exposing raw database IDs.
  15. Approve, reactivate, and grant require clear confirmation.
  16. Disable and revoke require stronger destructive confirmation.
  17. Mutations prevent duplicate submissions and provide safe success or
      failure feedback.
  18. Role-changing functionality remains hidden and excluded; `ADMIN`
      conversion belongs to Package E.
  19. Package D uses Native Server Actions and runtime Zod validation.
  20. No new dependency, schema change, or migration is approved.
- Rationale: Separate lifecycle and capability authority, preserve
  database-authoritative authorization, and prevent privilege or privacy drift.
- Consequences: D2 through D7 must preserve these boundaries and must not infer
  approval for database operations, dependencies, migrations, Git writes, or
  Package E work.
- Related phase or package: V2-3 Package D; V2-7 Audit Log viewer; V2-3 Package
  E compatibility conversion.

### DEC-012 — Package D mini-phase sequence

- Date: 2026-07-29
- Status: `APPROVED`
- Context: Package D needs controlled delivery gates.
- Decision: Lock D1 Readiness and Scope Lock; D2 Shared Account-Management Read
  Contracts and Schemas; D3 Student Account Management; D4 STAFF Inventory and
  Lifecycle; D5 Capability Assignment Management; D6 Destructive-Action and
  Edge-State UX; and D7 Package D Verification and Closure.
- Rationale: Keep security-sensitive implementation and verification ordered and
  reviewable.
- Consequences: Package D is active at D1; no implementation has started, and
  later mini-phases do not begin automatically.
- Related phase or package: V2-3 Package D.

## Package D implementation status

- Package C remains approved and complete.
- D1 is approved and complete.
- D2 shared account-management read contracts, authorization composition,
  runtime schemas, and encrypted opaque account references are implemented and
  approved.
- D2 implementation, corrections, security review, and final focused QA are
  approved and complete.
- D2 final focused QA passed with no blockers.
- D3 — Student Account Management implementation and required validation are
  complete.
- Independent D3 QA returned `CORRECTIONS REQUIRED` for raw legacy database IDs
  and modal failure feedback rendered outside the active dialog.
- Both confirmed D3 blockers are corrected with focused regression coverage and
  required validation.
- Subsequent re-QA found one remaining success-feedback ordering blocker. The
  active modal now closes before local external success state is published, and
  the behavioral ordering regression test passes.
- D3 final independent QA decision is `APPROVED`.
- D3 is complete, approved, committed, and pushed with D1 and D2 in
  `fd1695232e40295b145b99d6a7fdfd6d697cb995`.
- D4 through D7 are complete under the later owner-authorized
  `V2-3-CF-001` master package.
- Package E is active under `V2-3-CF-001`.
- No database access, migration, dependency change, commit, push, or upstream
  configuration occurred during D3 implementation or correction validation;
  the later approved D1–D3 Git delivery is recorded above.
- Package D is complete and pushed in
  `1e2961af619c7025cb0f322e1cc6d4759594f2ee`.

### DEC-013 — V2-3 fast-close master execution

- Date: 2026-07-31
- Status: `APPROVED`
- Context: The owner authorized one continuous execution package to complete
  and close V2-3 Packages C through F.
- Decision: Activate `V2-3-CF-001`; preserve verified Package C work, complete
  Packages D and E, run Package F, and close V2-3 without beginning V2-4.
  Package D may include an authorized active-STAFF creation path with safe
  initial capability assignment. This supersedes only the earlier Package D
  exclusion of STAFF creation in DEC-011.
- Rationale: Finish the approved authorization phase without repeated
  mini-phase approval gates while preserving security boundaries.
- Consequences: Normal V2-3 commits, pushes, and merges are authorized.
  Production access, deployment, history rewriting, and `prisma db push` remain
  prohibited. Migration execution requires a proven isolated non-production
  PostgreSQL database.
- Related phase or package: V2-3 Packages C through F; `V2-3-CF-001`.

### DEC-014 — Retire ADMIN without capability escalation

- Date: 2026-07-31
- Status: `APPROVED`
- Context: Package E removes the temporary ADMIN compatibility role.
- Decision: Convert every historical ADMIN account to STAFF in one transaction,
  preserve its existing capability assignments exactly, increment its
  `sessionVersion`, write one redacted system audit event, and fail closed unless
  an active capability manager survives. Remove ADMIN from the current database
  enum and runtime authorization surface. Preserve historical migration SQL.
- Rationale: Complete the two-role model without silently widening authority or
  invalidating applied migration history.
- Consequences: An account already holding all 18 capabilities retains all 18;
  narrower or zero-capability accounts retain only their existing assignments.
  Migration execution must be proven against an isolated non-production
  PostgreSQL database before V2-3 closure.
- Related phase or package: V2-3 Package E and Package F.
