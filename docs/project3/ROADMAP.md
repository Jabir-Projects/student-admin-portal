# Project 3 Roadmap

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

Status: `ACTIVE`

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

Status: `NOT STARTED — NEXT PACKAGE`

- Staff inventory
- Student account management
- Capability management
- Staff lifecycle management
- Verification

#### Package E — Admin-to-Staff conversion

Status: `NOT STARTED`

- Conversion readiness
- Controlled conversion
- Compatibility cleanup
- Verification

#### Package F — Final V2-3 verification

Status: `PLANNED`

- Scope inventory
- Integrated authorization verification
- Repository verification
- Phase closure

### V2-4 — Institutional UI Foundation

Status: `PLANNED`

- V2-4.1 Brand and design tokens
- V2-4.2 Shared application shells
- V2-4.3 Authentication and access states
- V2-4.4 Shared UI components
- V2-4.5 Shared system states
- V2-4.6 Accessibility and responsive verification

### V2-5 — Student Core Portal

Status: `PLANNED`

- V2-5.1 Student dashboard
- V2-5.2 Student profile
- V2-5.3 Request catalogue
- V2-5.4 Submit request
- V2-5.5 Request history
- V2-5.6 Request details and timeline
- V2-5.7 Student cancellation
- V2-5.8 Student portal verification

### V2-6 — Administration Portal

Status: `PLANNED`

- V2-6.1 Staff dashboard
- V2-6.2 Student administration
- V2-6.3 Request queue
- V2-6.4 Request processing
- V2-6.5 Request categories
- V2-6.6 Authorized exports
- V2-6.7 Administration verification

### V2-7 — Notifications and Audit

Status: `PLANNED`

- V2-7.1 Notification event rules
- V2-7.2 In-portal notifications
- V2-7.3 Email provider and templates
- V2-7.4 Delivery, idempotency, and audit viewer
- V2-7.5 Notification and audit verification

### V2-8 — Controlled Excel Imports

Status: `PLANNED`

- V2-8.1 Import template definitions
- V2-8.2 Upload and safe parsing
- V2-8.3 Validation preview
- V2-8.4 Approval workflow
- V2-8.5 Controlled execution and reporting
- V2-8.6 Import security verification

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
