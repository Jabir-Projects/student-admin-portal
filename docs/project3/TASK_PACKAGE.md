# Project 3 Task Package Register

## Closed V2-7 Notifications and Audit package

| Field                 | Value                                                              |
| --------------------- | ------------------------------------------------------------------ |
| ID                    | `V2-7`                                                             |
| Name                  | Notifications and Audit                                            |
| Status                | `CLOSED — VERIFIED`                                                |
| Starting commit       | `f1c1ed58b1fbdb03ed921261a7286c5b1d336502`                         |
| Implementation commit | `32c896a17573a081b3a19c59d08e45ae7341e170`                         |
| Branch                | `codex/v2-7-notifications-audit`                                   |
| Database decision     | One additive outbox migration; isolated test mutation only         |
| Provider decision     | Provider-neutral adapter; deterministic fake provider for closure  |

The package implements V2-7.1 through V2-7.5: exact notification events,
private student and STAFF centres, localized email templates, Resend adapter,
transactional delivery outbox, bounded retry and idempotency controls, and the
VIEW_AUDIT_LOG-protected sanitized audit viewer. The combined serialized test
evidence executed all 690 Vitest tests, including all 30 database-gated tests.
Eight authenticated Chromium tests passed. V2-7 is closed and V2-8 has not
started.

## Closed V2-6 Administration Portal package

| Field                 | Value                                                             |
| --------------------- | ----------------------------------------------------------------- |
| ID                    | `V2-6`                                                            |
| Name                  | Administration Portal                                             |
| Status                | `CLOSED — VERIFIED`                                               |
| Starting commit       | `046f57bcb199d763908ee471858a64137221835d`                        |
| Implementation commit | `f28f6a9f8eef087b3a580635d3952b0f3abdc1d9`                        |
| Branch                | `codex/v2-6-administration-portal`                                |
| Database decision     | Existing schema and seven migrations only; isolated test mutation |

Implementation and closure verification are complete. The package delivers
the capability-aware STAFF dashboard, student administration export, request
queue and processing, request-category lifecycle, and authorized request CSV
export. Exact server capabilities, database-authoritative actor checks,
transactions, locking, audit rollback, privacy boundaries, bounded field
allowlists, and spreadsheet-injection protection are verified.

The serialized PostgreSQL set passed 7 files and 52 tests. The serialized
remaining Vitest set passed 55 files and 617 tests. The authenticated Chromium
suite passed 12 tests with one worker across the four approved viewports,
denial paths, accessible controls, and theme behavior. Scoped formatting,
ESLint, strict typecheck, Prisma format/validate/generate, webpack build,
production dependency audit, documentation links, diff review, and secret scan
passed. V2-6 is closed and V2-7 has not started.

## Closed V2-5 Student Core Portal package

| Field             | Value                                      |
| ----------------- | ------------------------------------------ |
| ID                | `V2-5`                                     |
| Name              | Student Core Portal                        |
| Status            | `CLOSED â€” VERIFIED`                      |
| Starting commit   | `c21c17dc86f3365d722f89b998c6b72e798e4459` |
| Branch            | `codex/v2-5-student-core-portal`           |
| Database decision | Existing schema only; no migration         |

Implementation and closure verification are complete. The browser root cause
was a render-prop function crossing the StudentShell Server-to-Client boundary;
the bounded correction declared StudentShell as the client entry point. The
Playwright harness now starts webpack against the isolated test database with a
browser-only signing key and refuses unrelated server reuse. This creates no
production authentication bypass. Verification passed 58 Vitest files and 635
tests with zero skips, focused PostgreSQL 5/5, authenticated Chromium 8/8,
ESLint, strict typecheck, Prisma validation/generation, the 16-route webpack
build, scoped formatting, documentation links, diff review, and secret scan.
Implementation commit: `bbf091eba431ed60444d7558c4ae0b0785027ac1`.
V2-5 is closed and V2-6 has not started.

This file preserves the historical CTRL-001 package record. Its Package C
restrictions describe CTRL-001 scope and are not the current Package C status.
See the current authorization addendum at the end of this file.

## Package

| Field  | Value                              |
| ------ | ---------------------------------- |
| ID     | `CTRL-001`                         |
| Name   | Create Project 3 control documents |
| Status | `CLOSED`                           |

Only one control package may be active at a time. `CTRL-001` and
`V2-3-CF-001` are closed. No later package is active.

## Status lifecycle

Before closure, `CTRL-001` remained `ACTIVE` while correction, QA, Git approval, commit, push, synchronization verification, clean repository verification, closure recording, and closure verification were incomplete. File creation or successful QA alone did not close the package.

After successful owner-approved commit and push, verified repository synchronization, clean repository verification, closure recording, and explicit package-closure approval, its status must be changed from `ACTIVE` to `CLOSED` through a separately authorized documentation update before another task package becomes active. Commit and push continue to require separate owner approval. Package C cannot become active until CTRL-001 is formally closed and a new package is separately approved.

## Objective

Create six concise, cross-linked control documents without changing application code, configuration, dependencies, database files, or root instructions.

## Starting-state expectations

- Worktree: `D:\PROJECT 3\PROJECT 3 SIST-v2-3`
- Branch: `codex/v2-3-roles-auth-authorization`
- Commit: `760638ee463a503e5f4fc64c365138ac83adfc5e`
- Clean worktree and index
- Upstream ahead/behind `0/0`

These expectations were `VERIFIED` before file creation.

## Included scope

- Create `ROADMAP.md`.
- Create `CURRENT_STATE.md`.
- Create `DECISIONS.md`.
- Create `TASK_PACKAGE.md`.
- Create `VERIFICATION_MATRIX.md`.
- Create `ARCHITECTURE.md`.
- Create `docs/project3/` only as required for those files.
- Perform documentation-only, read-only verification after creation.

## Excluded scope

- Application code, tests, Prisma files, configuration, dependencies, environment files, and existing documentation
- Root `AGENTS.md`
- Database, migration, seed, deployment, and production operations
- Git staging, commit, push, merge, rebase, or branch changes
- V2-3 Package C implementation

## Allowed files

- `docs/project3/ROADMAP.md`
- `docs/project3/CURRENT_STATE.md`
- `docs/project3/DECISIONS.md`
- `docs/project3/TASK_PACKAGE.md`
- `docs/project3/VERIFICATION_MATRIX.md`
- `docs/project3/ARCHITECTURE.md`

## Acceptance criteria

- All six files exist with the required purpose and sections.
- Relative links resolve among the six files.
- Reported and verified claims are distinguishable.
- Roles and all 18 capabilities match the approved model.
- Security invariants are preserved.
- No large section duplicates root `AGENTS.md`.
- Only the six allowed paths appear in the diff.
- The initial six-file commit and push are owner-authorized, completed, and verified.

## Security requirements

- Do not weaken or redefine the approved authorization model.
- Do not expose secrets, credentials, tokens, environment values, or personal data.
- Do not imply UI visibility replaces server authorization.
- Do not imply production or sensitive operations are pre-approved.

## Verification requirements

Use the CTRL-001 checks in [VERIFICATION_MATRIX.md](VERIFICATION_MATRIX.md): file inventory, Markdown structure, relative links, duplication, scope-only diff, and Git status review. Review the complete diff. Do not run application tests.

## Permissions

| Action                   | Permission |
| ------------------------ | ---------- |
| Database connection      | Prohibited |
| Database mutation        | Prohibited |
| Migration execution      | Prohibited |
| Staging                  | Prohibited |
| Commit                   | Prohibited |
| Push                     | Prohibited |
| Package C implementation | Prohibited |

These are the default CTRL-001 permissions. The owner-authorized one-shot finalization task separately authorizes staging, the two specified commits, and their pushes only for these six control files. It does not authorize database, migration, deployment, production, or Package C actions.

> Historical CTRL-001 boundary: V2-3 Package C — Staff Frontend was not
> approved by CTRL-001.

## Stop conditions

Stop as `BLOCKED` for repository mismatch, unexpected Git state, conflicting instructions, meaningful target content requiring overwrite, unsafe scope expansion, secret exposure risk, or any need for an unauthorized action.

## Required report

Report repository state, six created files, one-sentence content summaries, exact verification evidence, diff summary, issues, and explicit Git non-actions. End with `READY FOR QA`, `CORRECTIONS REQUIRED`, or `BLOCKED`.

## Closure conditions

CTRL-001 closes only after acceptance criteria and documentation QA pass, ChatGPT and owner approve the diff, authorized Git delivery completes, and synchronized clean state is verified. Do not begin the next package automatically.

## Closure evidence

- Scope completed: six approved control files only.
- Documentation QA passed.
- Owner-authorized initial commit completed: `ae9fbce48c05f077d8a8e5c01631f7b10d798009`.
- Owner-authorized first push completed successfully.
- Local and remote commits matched after the first push.
- Ahead/behind was verified as `0/0`.
- The index and working tree were clean after the first push.
- CTRL-001 closure was explicitly authorized and recorded.

CTRL-001 is `CLOSED`. Its closure did not itself activate V2-3 Package C.
Subsequent Package C authorization and current status are recorded below.

See [CURRENT_STATE.md](CURRENT_STATE.md), [ROADMAP.md](ROADMAP.md), and [DECISIONS.md](DECISIONS.md).

## Current Package C authorization

- CTRL-001 remains historically closed; its evidence above is unchanged.
- Package C — Custom STAFF Frontend was subsequently owner-authorized and is
  approved and complete.
- C1 — Repository and route readiness is complete.
- C2 — Design requirements lock is complete.
- C3 — Staff application shell implementation, focused corrections, and
  focused QA are approved and complete.
- C4 — STAFF Dashboard Presentation is approved and complete; independent QA
  passed with non-blocking notes.
- Authenticated browser, physical-device, and real screen-reader testing were
  not performed during C4 independent QA because database access was prohibited.
- C5 — Compatibility and Authorization UX is approved and complete.
- C5 final focused QA passed with no blockers.
- C6 — Final Package C Verification and Closure is approved and complete;
  final verification passed with no blockers.
- C1 through C6 are approved and complete.
- Final Package C evidence records:
  - focused Package C verification: 16 files and 209 tests passed;
  - full verification: 39 files and 439 tests passed;
  - three database-integration files and 39 tests safely skipped;
  - lint passed;
  - typecheck passed;
  - production build passed; and
  - `git diff --check` passed.
- Authenticated browser, physical-device, real screen-reader, and
  database-integration verification remain documented non-blocking
  limitations.
- V2-3 remains the active phase under `V2-3-CF-001`.
- Package D — Account and Capability Management is complete and pushed in
  `1e2961af619c7025cb0f322e1cc6d4759594f2ee`.
- Package E is complete and pushed at
  `81f799af50d2aeab22ade97d350bc4c03e434b29`.
- Package F is complete and V2-3 is closed.
- The owner-authorized final Package C closure includes one six-file commit and
  a normal push to the existing upstream branch.
- Package C closure did not authorize later packages. The separate
  owner-authorized `V2-3-CF-001` master package now governs Packages D through F.
  V2-4 work, production access, and deployment remain prohibited.

## Historical Package D authorization and completion

| Field  | Value                             |
| ------ | --------------------------------- |
| ID     | `V2-3-D`                          |
| Name   | Account and Capability Management |
| Status | `COMPLETE`                        |

### Objective

Manage existing student and STAFF account lifecycles and STAFF capability
assignments through capability-scoped, database-revalidated server boundaries.

### Locked mini-phases

The checkpoint details below are historical Package D records. Their earlier
“not started” statements are superseded by the final completion record and the
active `V2-3-CF-001` package.

1. D1 — Readiness and Scope Lock — Approved and complete
2. D2 — Shared Account-Management Read Contracts and Schemas — Implementation,
   corrections, security review, and final focused QA approved and complete;
   final QA passed with no blockers
3. D3 — Student Account Management — Implementation and required validation
   complete; two confirmed independent-QA blockers corrected and validated; the
   subsequent success-feedback ordering blocker corrected and validated; final
   independent QA approved; committed and pushed with D1 and D2 in
   `fd1695232e40295b145b99d6a7fdfd6d697cb995`
4. D4 — STAFF Inventory and Lifecycle — Next authorized task; not started
5. D5 — Capability Assignment Management — Not started
6. D6 — Destructive-Action and Edge-State UX — Not started
7. D7 — Package D Verification and Closure — Not started

The next authorized implementation task is D4 — STAFF Inventory and Lifecycle.
D4 has not started, and this control-document synchronization does not begin it.
It does not authorize database access, migrations, seeds, dependency changes,
Git writes, or deployment. D4 through D7 have not started.

### Included scope

- Manage existing STAFF accounts only; STAFF account creation is excluded.
- Reactivate disabled STAFF accounts with `MANAGE_STAFF_ACCOUNTS`.
- Use database revalidation, a transaction, required audit logging,
  `sessionVersion` invalidation, and final-manager protection where relevant for
  STAFF reactivation.
- After `/staff/student-accounts` exists, redirect STAFF safely from
  `/admin/users/pending` to that STAFF route. Preserve temporary legacy `ADMIN`
  compatibility until Package E without an `ADMIN` authorization bypass.
- Provide one capability-aware student-account page:
  - `MANAGE_STUDENT_ACCOUNTS` controls pending and active views, approval, and
    disabling.
  - `REACTIVATE_STUDENT_ACCOUNTS` controls disabled views and reactivation.
  - An actor with only one capability sees only its authorized section.
- Show STAFF capability assignments only with
  `MANAGE_STAFF_CAPABILITIES`; `MANAGE_STAFF_ACCOUNTS` alone authorizes neither
  viewing nor changing assignments.
- Continue transactional audit writes. Audit Log viewing is excluded and
  remains planned for V2-7.
- Default pagination to 25 records and cap it at 50.
- Search students by full name or student number and STAFF by full name.
- Order pending accounts oldest first with a deterministic stable secondary
  key.
- Resolve mutation targets server-side from safe opaque references rather than
  visibly exposing raw database IDs.
- Require clear confirmation for approve, reactivate, and grant. Require
  stronger destructive confirmation for disable and revoke.
- Prevent duplicate submissions and provide safe success or failure feedback.
- Use Native Server Actions with runtime Zod validation.

### Excluded scope

- STAFF account creation.
- Role-changing UI or mutations; legacy `ADMIN` conversion belongs to Package
  E.
- Audit Log viewing, which remains planned for V2-7.
- New dependencies, schema changes, and migrations.
- Database access or mutation during D1.
- Application implementation during D1.
- Commit, push, merge, rebase, reset, restore, stash, branch switching, branch
  creation, and worktree creation.

### Acceptance criteria for D1

- Package C is recorded as complete.
- Package D is recorded as active at D1 with no application implementation
  started.
- Package E is recorded as not started.
- All approved Package D decisions and all seven mini-phases are consistent
  across the required control documents.
- The Package D worktree, branch, HEAD, clean starting state, and absent upstream
  are recorded truthfully.
- Cross-document consistency, relative links, placeholder and secret patterns,
  and `git diff --check` pass.
- Only the required project-control documents are modified.
- No commit or push occurs.

### Repository state after D3 approval and Git delivery

- Worktree: `D:\PROJECT 3\PROJECT 3 SIST-v2-3-agent-d`
- Branch: `codex/v2-3-d-account-management`
- HEAD: `fd1695232e40295b145b99d6a7fdfd6d697cb995`
- Remote ref: `origin/codex/v2-3-d-account-management` aligned with local HEAD
- Upstream: none
- D1: approved and complete
- D2: implementation, corrections, security review, and final focused QA
  approved and complete; final QA passed with no blockers
- D3: implementation, two confirmed QA blocker corrections, the subsequent
  success-feedback ordering correction, and required validation complete; final
  independent QA approved
- D4: next authorized task; not started
- D5 through D7: not started
- Package E: not started
- D1–D3 commit and push:
  `fd1695232e40295b145b99d6a7fdfd6d697cb995`
- Index: empty before this documentation synchronization
- Working tree: clean before this documentation synchronization
- Historical independent D3 QA decision: `CORRECTIONS REQUIRED`
- Final independent D3 QA decision: `APPROVED`

### Final Package D completion

- D4 through D7 are complete under `V2-3-CF-001`.
- Final commit:
  `1e2961af619c7025cb0f322e1cc6d4759594f2ee`
- Package branch and live remote are synchronized.
- Package E follows on the integrated Package D baseline.

See [CURRENT_STATE.md](CURRENT_STATE.md), [ROADMAP.md](ROADMAP.md),
[DECISIONS.md](DECISIONS.md), and
[VERIFICATION_MATRIX.md](VERIFICATION_MATRIX.md).

## Closed V2-3 master control package

| Field  | Value                                        |
| ------ | -------------------------------------------- |
| ID     | `V2-3-CF-001`                                |
| Name   | Complete and close V2-3 Packages C through F |
| Status | `CLOSED`                                     |

### Verified starting state

- Integration worktree:
  `D:\PROJECT 3\PROJECT 3 SIST-v2-3`
- Integration branch:
  `codex/v2-3-roles-auth-authorization`
- Starting HEAD:
  `29f0195ae9563ed19894d1687691012cf7d9b27b`
- Package C final commit:
  `29f0195ae9563ed19894d1687691012cf7d9b27b`
- Package D final commit:
  `1e2961af619c7025cb0f322e1cc6d4759594f2ee`
- Package E starting branch HEAD:
  `52f009f8d64a1130c25d64eecefe2bdc965b678e`

### Authorized scope

- Verify and preserve completed Package C.
- Complete and integrate Package D account and capability management.
- Implement and integrate deterministic ADMIN-to-STAFF conversion in Package E.
- Run Package F integrated V2-3 verification.
- Update project-control evidence, close V2-3, commit, and push.
- Stop before V2-4.

### Git and database permissions

- Normal commits, pushes, and merge commits on the named V2-3 branches are
  owner-authorized.
- Rebase, force-push, history rewriting, deployment, and production access are
  prohibited.
- Migration creation is authorized.
- Migration execution is authorized only against a proven isolated
  non-production PostgreSQL database.
- `prisma db push` is prohibited.

### Closure checks

- Targeted and complete Vitest verification, including negative authorization
  paths.
- PostgreSQL migration and integration verification against an isolated database.
- Prisma format, validate, generate, and migration SQL review.
- ESLint, strict TypeScript typecheck, production build, relevant Playwright,
  responsive and accessibility review.
- Secret scan, complete staged-diff review, and final Git synchronization.

### Package E completion evidence

- Main conversion commit:
  `2a8f50531c506ef1db1c3714a0f7aa542be175d8`
- Seed documentation correction:
  `bd1416159d9392902f0924c35917c1186b6d6a17`
- Retired-route browser correction:
  `81f799af50d2aeab22ade97d350bc4c03e434b29`
- Package branch and live remote are synchronized.
- Focused verification passed 199 tests.
- Complete non-database verification passed 563 tests; 39 PostgreSQL tests
  skipped because no isolated database was configured.
- Four Package E Playwright tests passed.
- PostgreSQL migration execution completed against the verified isolated test
  target before closure.

### Deferred-improvement rule

Only non-blocking polish, physical-device review, full real-screen-reader
testing, optional filters, and equivalent low-risk work may move to the Final
Hardening Backlog. Security, authorization, migration-safety, build, or core
workflow failures block closure.

### Package F independent verification checkpoint

- Dependency hardening commit:
  `72e69e437706ce09367042f602308c976ca2c92f`.
- ESLint and strict TypeScript typecheck passed.
- Complete non-database Vitest verification passed: 50 files and 563 tests;
  three PostgreSQL files and 39 tests skipped.
- Prisma 7.9.1 format, validate, and generate passed.
- Next.js 16.2.12 production build passed with 13 expected routes and no
  retired ADMIN route.
- All 12 Playwright assertions passed across the closure and focused rerun.
  Both Windows invocations timed out only during web-server teardown.
- Production dependency audit passed with zero vulnerabilities.
- Nine development-only high-severity findings remain in the upstream
  ESLint/Next plugin `minimatch` chain. A fixed nested dependency override and
  the audit-recommended ESLint 10 update were both rejected after each broke
  lint execution.
- Isolated PostgreSQL migration execution and all 39 database integration tests
  passed. `V2-3-CF-001` and V2-3 are closed.

### Package F final PostgreSQL and closure evidence

- Sanitized control and test fingerprints proved distinct logical targets; only
  read-only identity queries touched the owner-reported non-production control
  database.
- The isolated target contained only deterministic suite-owned fixtures and
  empty student/request/document application tables before mutation.
- All seven migrations completed with no failed migration record. Redeploy was
  deterministic and reported no pending migration.
- Two ADMIN fixtures converted to STAFF with exact 4-capability and
  2-capability sets preserved, session versions incremented from 0 to 1, two
  redacted audit events, one surviving active capability manager, and no ADMIN
  enum value.
- Controlled audit failure and lock contention rolled back with no partial
  conversion.
- PostgreSQL verification: 5 files, 39 passed, 0 failed, 0 skipped.
- Full Vitest verification: 53 files, 602 passed, 0 failed, 0 skipped.
- Package D's five historical control-document modifications were archived to
  `D:\PROJECT 3\SIST-backups\v2-3-agent-d-control-docs-20260801-222519.patch`
  (26,475 bytes; SHA-256
  `cd33f2fedadba7466e71be997781eb8a4373a63b9c4c3539f53df07c309eaa8f`),
  then restored exactly. Its branch is clean and synchronized at `0/0`.
- At V2-3 closure, V2-4 remained planned and had not started.

## Closed V2-4 institutional UI foundation package

| Field               | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| ID                  | `V2-4`                                                |
| Name                | Institutional UI Foundation                           |
| Status              | `VERIFIED` `CLOSED`                                   |
| Starting commit     | `c7ed77884944663e8bd4ebd6ec837767f483c04c`            |
| Branch              | `codex/v2-4-institutional-ui-foundation`              |
| Database permission | No database access, schema change, migration, or seed |

### Approved Minimum Closure Scope

- V2-4.1 centralized the existing SIST navy/green brand values into semantic
  light and dark tokens without creating a competing token system.
- V2-4.2 established shared public, authentication/access, student, and STAFF
  foundations for existing routes only.
- V2-4.3 consolidated login, registration, pending approval, disabled/session
  messaging, unauthorized, safe authentication failure, and loading states.
- V2-4.4 reused the checked-in logo and existing UI primitives while adding only
  focused shared brand, shell, account-menu, drawer, feedback, and state
  components used by current pages.
- V2-4.5 applied reusable loading, error, not-found, unauthorized, pending, and
  session/access presentation without leaking internal details.
- V2-4.6 verified keyboard focus, drawer focus trapping/restoration, themes,
  contrast, no horizontal overflow, and the approved responsive viewport matrix.

### Closure evidence

- Verified implementation commit:
  `20e8115db274a0e584bd890004901ac3ff44e581`
  (`feat(v2-4): establish institutional UI foundation`).
- Focused Vitest: 9 files, 55 passed, 0 failed, 0 skipped.
- Full non-database Vitest: 52 files and 576 tests passed; 3 PostgreSQL files
  and 39 PostgreSQL tests intentionally skipped because V2-4 changed no backend
  or database-sensitive behavior.
- ESLint and strict TypeScript typecheck passed.
- Next.js 16.2.12 production build passed with 13 expected routes.
- Targeted Chromium: 18 passed, 0 failed, 0 skipped, including 360×800,
  768×1024, 1024×768, and 1440×900 verification.
- Scoped formatting, secret scan, diff check, documentation links, final Git
  synchronization, and cleanliness are required final delivery gates.
- V2-5 remains planned and was not started.
