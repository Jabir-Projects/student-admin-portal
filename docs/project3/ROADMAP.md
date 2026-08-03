# Project 3 Roadmap

## V2-8 closure addendum

V2-8 controlled registry imports are implemented and all technical closure
checks have passed. The package uses bounded server-only CSV/XLSX parsing,
fixed templates, validation preview, separate upload and approval capabilities,
four-eyes review, atomic execution with required audit rollback, safe retention,
and responsive accessible STAFF routes. Migration, PostgreSQL, authorization,
malicious-input, concurrency, browser, static, build, dependency, and audit
checks and authorized Git delivery passed. V2-8 is closed. Finance imports
remain excluded and V2-9 has not started.

## V2-7 closure addendum

V2-7 is verified complete and closed under the owner-approved Product Lock.
Private in-portal notifications, localized student email delivery through a
transactional outbox, exact staff recipient rules, retry and idempotency
controls, and the capability-protected sanitized audit viewer are implemented.
Migration, PostgreSQL, authorization, privacy, fake-provider, browser,
responsive, theme, accessibility, static, build, documentation, and Git
delivery gates passed. V2-8 has not started.

## V2-6 closure addendum

V2-6 is verified complete and closed under the owner-approved Product Lock.
Capability-aware administration, request processing, category lifecycle, and
authorized CSV exports are implemented using the existing schema. PostgreSQL,
security, concurrency, audit rollback, authenticated browser, responsive,
theme, accessibility, static, build, documentation, and Git delivery gates
passed. V2-7 has not started.

## V2-5 closure addendum

V2-5 is verified complete and closed under the owner-approved Product Lock. The
five student routes and V2-5.1 through V2-5.8 are implemented using the existing
schema. Authenticated browser, PostgreSQL, security, responsive, theme,
accessibility, static, build, documentation, and Git delivery gates passed.
V2-6 has not started.

## Purpose

Maintain the stable high-level sequence for SIST Portal V2. Current execution state is summarized in [CURRENT_STATE.md](CURRENT_STATE.md); control-package status is recorded in [TASK_PACKAGE.md](TASK_PACKAGE.md).

## Status vocabulary

| Status      | Meaning                                                                      |
| ----------- | ---------------------------------------------------------------------------- |
| Complete    | Reported as finished; repository verification may still be package-specific. |
| Active      | Current phase containing the controlled work.                                |
| Planned     | Ordered future work; not authorized by this document.                        |
| Not started | No implementation is authorized or claimed.                                  |

## Approved phase sequence

The names and ordering below are approved project-control decisions. Historical completion remains `REPORTED`, not `VERIFIED`.

### V2-0 — Existing Project Rebaseline

Status: `REPORTED COMPLETE`

- V2-0-A Environment and repository baseline
- V2-0-B Git and worktree baseline
- V2-0-C Backend baseline
- V2-0-D Frontend baseline
- V2-0-E Testing baseline
- V2-0-F Security baseline
- V2-0-G DevOps and documentation baseline
- V2-0-H Rebaseline report

### V2-1 — Requirements and Product Architecture

Status: `REPORTED COMPLETE`

- V2-1-A Actors and roles
- V2-1-B Capabilities and ownership
- V2-1-C Account lifecycle
- V2-1-D Request categories
- V2-1-E Request lifecycle
- V2-1-F Administration workflow
- V2-1-G Finance workflow
- V2-1-H Import contracts
- V2-1-I Document requirements
- V2-1-J Notification requirements
- V2-1-K Technical architecture
- V2-1-L UX architecture

### V2-2 — Database and Migration Design

Status: `REPORTED COMPLETE`

- V2-2-A Identity and roles
- V2-2-B Staff capabilities
- V2-2-C Requests
- V2-2-D History and communication
- V2-2-E Imports
- V2-2-F Documents
- V2-2-G Finance
- V2-2-H Notifications
- V2-2-I Audit
- V2-2-J Constraints and indexes
- V2-2-K Migration strategy

### V2-3 — Roles, Authentication, and Authorization

Status: `VERIFIED COMPLETE`

#### Package A — Additive database and session foundation

Status: `REPORTED COMPLETE`

- Role foundation
- Capability model
- Session version
- Migration and backfill

#### Package B — Backend capability authorization

Status: `REPORTED COMPLETE`

- Database-authoritative actor validation
- Capability guards
- Student account actions
- Staff capability actions
- Staff lifecycle
- Final-manager protection
- Typed audit
- PostgreSQL integration safety

#### Package C — Custom STAFF Frontend

Status: `APPROVED AND COMPLETE`

- C1 Repository and route readiness — Complete
- C2 Design requirements lock — Complete
- C3 Staff application shell — Implementation, focused corrections, and focused QA approved and complete
- C4 STAFF Dashboard Presentation — Approved and complete; independent QA passed with non-blocking notes
- C5 Compatibility and authorization UX — Approved and complete; final focused QA passed with no blockers
- C6 Final Package C Verification and Closure — Approved and complete; final verification passed with no blockers

Package C is approved and complete. C1 through C6 are approved and complete.
C5 final focused QA passed with no blockers. C6 final verification passed with
no blockers. Final evidence includes 16 focused files and 209 passing tests; 39
full-suite files and 439 passing tests; three database-integration files and 39
tests safely skipped; and passing lint, typecheck, production build, and
`git diff --check`. Authenticated browser, physical-device, real screen-reader,
and database-integration verification remain documented non-blocking
limitations.

#### Package D — Account and Capability Management

Status: `COMPLETE — FINAL PACKAGE COMMIT PUSHED`

- D1 — Readiness and Scope Lock — Approved and complete
- D2 — Shared Account-Management Read Contracts and Schemas — Implementation, corrections, security review, and final focused QA approved and complete; final QA passed with no blockers
- D3 — Student Account Management — Implementation and required validation
  complete; two confirmed independent-QA blockers corrected and validated; the
  subsequent success-feedback ordering blocker corrected and validated; final
  independent QA approved; committed and pushed with D1 and D2 in
  `fd1695232e40295b145b99d6a7fdfd6d697cb995`
- D4 — STAFF Inventory and Lifecycle — Complete
- D5 — Capability Assignment Management — Complete
- D6 — Destructive-Action and Edge-State UX — Complete
- D7 — Package D Verification and Closure — Complete

Package D includes student lifecycle management, authorized STAFF creation and
lifecycle management, and assignment of the approved 18 capabilities. Server
authorization remains database-authoritative; sensitive mutations are
transactional with required audit behavior and final-manager protection.

The historical D3 independent-QA `CORRECTIONS REQUIRED` decision and subsequent
re-QA correction evidence remain preserved. Those correction passes did not by
themselves approve D3; the final independent QA decision is `APPROVED`.
Package D is complete in
`1e2961af619c7025cb0f322e1cc6d4759594f2ee`.

#### Package E — Admin-to-Staff conversion

Status: `COMPLETE — FINAL PACKAGE BRANCH PUSHED`

- Conversion readiness — Complete
- Controlled conversion migration — Created and statically verified
- Compatibility cleanup — Complete
- Non-database verification — Complete

The migration preserves existing capability assignments exactly, invalidates
converted sessions, writes redacted system audit events, preserves an active
capability manager, and removes ADMIN from the current role enum. Execution was
verified against a distinct isolated non-production PostgreSQL database.

#### Package F — Final V2-3 verification

Status: `VERIFIED COMPLETE`

- Scope inventory
- Integrated authorization verification
- Repository verification
- Phase closure — Complete; 7 migrations and 39 PostgreSQL tests verified

### V2-4 — Institutional UI Foundation

Status: `VERIFIED COMPLETE`

- V2-4.1 Brand and design tokens — Complete
- V2-4.2 Shared application shells — Complete
- V2-4.3 Authentication and access states — Complete
- V2-4.4 Shared UI components — Complete
- V2-4.5 Shared system states — Complete
- V2-4.6 Accessibility and responsive verification — Complete

The owner-approved Design Lock reuses the repository SIST logo, deep navy and
green identity, existing typography, and existing theme mechanism. Shared
public, authentication, student, and STAFF foundations cover existing routes
without adding business workflows. Verification passed the required 360×800,
768×1024, 1024×768, and 1440×900 viewport matrix. V2-5 was not started.

### V2-5 — Student Core Portal

Status: `VERIFIED COMPLETE`

- V2-5.1 Student dashboard — Complete
- V2-5.2 Student profile — Complete
- V2-5.3 Request catalogue — Complete
- V2-5.4 Submit request — Complete
- V2-5.5 Request history — Complete
- V2-5.6 Request details and timeline — Complete
- V2-5.7 Student cancellation — Complete
- V2-5.8 Student portal verification — Complete

### V2-6 — Administration Portal

Status: `VERIFIED COMPLETE`

- V2-6.1 Staff dashboard — Complete
- V2-6.2 Student administration — Complete
- V2-6.3 Request queue — Complete
- V2-6.4 Request processing — Complete
- V2-6.5 Request categories — Complete
- V2-6.6 Authorized exports — Complete
- V2-6.7 Administration verification — Complete

### V2-7 — Notifications and Audit

Status: `VERIFIED COMPLETE`

- V2-7.1 Notification event rules — Complete
- V2-7.2 In-portal notifications — Complete
- V2-7.3 Email provider and templates — Complete
- V2-7.4 Delivery, idempotency, and audit viewer — Complete
- V2-7.5 Notification and audit verification — Complete

### V2-8 — Controlled Excel Imports

Status: `VERIFIED COMPLETE`

- V2-8.1 Import template definitions — Complete
- V2-8.2 Upload and safe parsing — Complete
- V2-8.3 Validation preview — Complete
- V2-8.4 Approval workflow — Complete
- V2-8.5 Controlled execution and reporting — Complete
- V2-8.6 Import security verification — Complete

### V2-9 — Documents and Private Storage

Status: `PLANNED`

- V2-9.1 Document model and lifecycle
- V2-9.2 Template and generation
- V2-9.3 Staff preview and private storage
- V2-9.4 Secure download, release, and revoke
- V2-9.5 Document security verification

### V2-10 — Finance

Status: `PLANNED`

- V2-10.1 Finance requirements and data model
- V2-10.2 Finance authorization and dashboard
- V2-10.3 Finance import upload
- V2-10.4 Finance import approval and corrections
- V2-10.5 Finance views and exports
- V2-10.6 Finance verification

### V2-11 — QA, Security, and Accessibility

Status: `PLANNED`

- V2-11.1 Functional QA
- V2-11.2 Authorization QA
- V2-11.3 Security QA
- V2-11.4 Accessibility QA
- V2-11.5 Performance and reliability
- V2-11.6 Release-candidate verification

### V2-12 — DevOps and Production

Status: `PLANNED`

- V2-12.1 Environment plan
- V2-12.2 Git governance and CI
- V2-12.3 Vercel and preview preparation
- V2-12.4 Production database, storage, and email
- V2-12.5 Monitoring, backup, recovery, and rollback
- V2-12.6 Production readiness and controlled release

## Completion rules

- A package completes only after its acceptance criteria, risk-based verification, required QA, approved Git delivery, synchronized remote state, and closure approval.
- A phase completes only after all approved packages and integrated checks pass.
- A planned phase or package is not implementation authorization.
- The next package must not begin automatically.
