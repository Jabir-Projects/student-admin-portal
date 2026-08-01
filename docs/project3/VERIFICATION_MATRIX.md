# Project 3 Verification Matrix

## Purpose

Define risk-based evidence expectations. This matrix does not claim that future checks have passed.

## General principles

- Target checks to the changed risk.
- Do not describe focused tests as complete suites.
- Report skipped tests and reasons.
- Include exact exit codes and test pass, fail, and skip counts.
- Require negative authorization tests for protected operations.
- Database migration execution always requires explicit approval.
- Do not infer production results from local checks.
- Do not weaken meaningful assertions to obtain a pass.

## Risk matrix

| Risk area                     | Typical risk   | Required checks                                                                                | Required evidence                                       | Blocking conditions                                              |
| ----------------------------- | -------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| Documentation                 | Low            | Content, structure, links, scope diff                                                          | Reviewed files and Git diff                             | Broken links, conflicting controls, unsupported claims           |
| Styling-only frontend         | Medium         | Visual, responsive, accessibility, lint, typecheck, one build                                  | Screenshots or manual states plus command results       | Broken layouts, inaccessible interaction, failed required checks |
| Frontend behavior             | Medium         | Targeted interaction tests, responsive and accessibility review, lint, typecheck, one build    | Test counts and reviewed scenarios                      | Incorrect behavior or failed required checks                     |
| Normal backend                | Medium         | Targeted unit and relevant integration tests, lint, typecheck, one build                       | Commands, exit codes, counts                            | Contract regression or unhandled failure                         |
| Authentication                | High           | Targeted and integration tests, negative paths, security review, lint, typecheck, build        | Identity and session scenarios                          | Bypass, stale/disabled session access, secret exposure           |
| Authorization                 | High           | Allowed, denied, cross-user, zero-capability, and race-sensitive tests                         | Actor, resource, capability, and result evidence        | Client-trusted privilege or server-side bypass                   |
| Account lifecycle             | High           | Disable/reactivate/role-transition tests and concurrency review                                | State transitions and negative results                  | Disabled access or final-manager invariant failure               |
| Database migrations           | High           | SQL, constraints, indexes, data-loss, target, and recovery review; authorized execution checks | Reviewed SQL and explicit environment/approval evidence | Unclear target, destructive risk, missing rollback plan          |
| Imports                       | High           | File/content validation, malicious input, authorization, transactional tests                   | Rejected and accepted fixture evidence                  | Trusted client MIME/input, partial unsafe writes                 |
| Exports                       | High           | Authorization, field minimization, injection and cross-user tests                              | Export schema and denied-path evidence                  | Unauthorized or excessive data disclosure                        |
| Documents and private storage | High           | Access, release/revoke, storage privacy, traversal/content tests                               | Private-by-default and denied access evidence           | Public leakage or unsafe file handling                           |
| Finance                       | High           | Authorization, accuracy, import approval, transaction and audit tests                          | Reconciled fixtures and denied paths                    | Incorrect amounts, unauthorized access, partial writes           |
| Notifications                 | Medium         | Trigger, recipient, privacy, retry/idempotency tests                                           | Delivery intent and sanitized payload evidence          | Sensitive recipient leakage or duplicate harm                    |
| Audit                         | High           | Required-event, sanitization, attribution, rollback tests                                      | Minimal typed metadata and failure behavior             | Missing required audit or secret/personal-data leakage           |
| Accessibility                 | Medium         | Keyboard, focus, semantics, contrast, screen-reader review                                     | Reviewed states and tool/manual findings                | Blocking interaction or critical WCAG failure                    |
| Performance and reliability   | Medium to high | Query, concurrency, failure recovery, load-sensitive checks                                    | Timings, query counts, retry/failure results            | N+1 growth, race, unrecoverable failure                          |
| Production release            | Critical       | Approved deployment, smoke, monitoring, backup and recovery verification                       | Environment-specific release evidence                   | Missing approval, unhealthy release, unverified recovery         |

## CTRL-001 expected verification

Status: Closed after documentation QA, owner-authorized Git delivery, synchronization verification, and closure recording.

- File inventory
- Markdown structure review
- Relative-link review
- Duplication review
- Scope-only diff review
- Git status review

See [TASK_PACKAGE.md](TASK_PACKAGE.md) for permissions and [ARCHITECTURE.md](ARCHITECTURE.md) for stable invariants.

## Package D expected verification

Status: Packages C through F and V2-3 are verified complete.

### D1 documentation checks

- Cross-document consistency across Package D status, scope, decisions, and
  mini-phases
- Relative-link resolution
- Placeholder and secret-pattern review
- Scope-only diff review
- `git diff --check`
- Git status, branch, HEAD, and upstream review

### D2 approved completion evidence

- Runtime Zod validation and Native Server Action boundary tests
- Database-authoritative identity, role, account-status, session-state, and
  capability revalidation
- Allowed, denied, zero-capability, and single-capability visibility tests
- Legacy `ADMIN` rejection without a management-read bypass
- Pagination default 25 and maximum 50; supported search and deterministic
  oldest-first pending ordering
- Opaque account-reference resolution and rejection of invalid or cross-target
  references
- AES-256-GCM reference encryption with an HKDF-SHA256-derived Package D key,
  fresh nonces, purpose binding, and malformed or tampered token rejection
- Field-minimized student, STAFF inventory, and capability-assignment results
- Focused unit and negative authorization tests, security review, lint,
  typecheck, scoped formatting, and final diff review

D2 correction validation completed without database access:

- Focused D2 and authorization regression tests: 9 files and 111 tests passed
- ESLint passed with zero warnings
- TypeScript typecheck passed with incremental output disabled
- Scoped D2 Prettier check passed, including `VERIFICATION_MATRIX.md`
- `git diff --check` passed
- Scoped secret scan found no secrets or connection strings
- Production build was not required for module integration

Final focused independent D2 QA passed with no blockers:

- Independent opaque-reference attack matrix: 23 checks passed
- Focused opaque-reference, schema, authorization, and read-contract tests: 4
  files and 33 tests passed
- Relevant authentication and authorization regression tests: 5 files and 85
  tests passed
- Combined focused test evidence: 9 files and 118 tests passed
- ESLint: 154 files checked with zero errors and zero warnings
- TypeScript: 151 source files checked with zero diagnostics; no emit and
  incremental output disabled
- Scoped Prettier: 15 D1 and D2 files checked with zero unformatted files
- `git diff --check` passed
- Scoped secret scan found no secrets, credentials, keys, or connection strings
- No database connection, migration, seed, PostgreSQL test, or production build
  was required or performed

D2 implementation, corrections, security review, and final focused QA are
approved and complete.

### D3 implementation validation status

- Focused D3, D2, Package B, and Package C regression validation: 16 files and
  161 tests passed.
- The D3 presentation test received one test-only correction to assert student
  identity independently in the desktop table and mobile list instead of using
  a brittle global duplicate-text count; the affected file then passed 4 tests.
- Repository ESLint passed with zero errors and zero warnings.
- Repository TypeScript typecheck passed with no emit and incremental output
  disabled.
- Scoped D3 and control-document Prettier check passed.
- `git diff --check` passed.
- Production build passed with Prisma Client 7.8.0 generation and the documented
  Next.js 16.2.10 webpack production mode; all 14 static pages generated and the
  `/staff/student-accounts` dynamic route was included.
- The default Turbopack build could not follow the explicitly approved external
  dependency junction, so the installed Next.js documentation-supported
  `--webpack` production mode was used without repository configuration changes.
- Database access, migrations, seeds, PostgreSQL tests, commit, push, and
  upstream configuration: not performed.

This implementation-validation checkpoint preceded independent QA. The
historical correction evidence and final approval are recorded below.

### D3 independent-QA correction validation

- Historical independent D3 QA decision: `CORRECTIONS REQUIRED`.
- Confirmed blockers: raw database IDs in legacy ADMIN hidden form values and
  failed mutation feedback rendered outside an open modal dialog.
- Legacy compatibility now renders encrypted, purpose-bound D2 account
  references only and resolves them on the trusted server under exact active
  ADMIN plus `MANAGE_STUDENT_ACCOUNTS` checks. Transactional authorization,
  target locking, audit rollback, concurrency checks, and `sessionVersion`
  invalidation remain enforced.
- Failed validation, authorization, and generic mutation feedback now remains
  inside the open native dialog with assertive alert semantics and focused
  feedback; success closes the dialog before external status feedback.
- Corrected compatibility tests: 3 files and 23 tests passed.
- Corrected modal/action tests: 2 files and 17 tests passed.
- After a test-only matcher correction and scoped formatting, the combined
  corrected set passed: 5 files and 40 tests.
- Focused D3, D2, Package B, and Package C regression validation: 22 files and
  202 tests passed.
- Repository ESLint passed with zero errors and zero warnings.
- TypeScript typecheck passed with no emit and incremental output disabled.
- Scoped Prettier passed across all 34 changed D1 through D3 paths.
- `git diff --check` passed.
- Prisma Client 7.8.0 generation and the Next.js 16.2.10 webpack production
  build passed; all 14 static pages generated and both account-management routes
  were included as dynamic routes.
- Database access, migrations, seeds, PostgreSQL tests, dependency changes,
  commit, push, and upstream configuration: not performed.

D3 correction implementation and required validation were complete at this
historical checkpoint. The subsequent ordering correction and final approval
are recorded below.

### D3 success-feedback ordering re-QA correction

- Subsequent re-QA confirmed one remaining blocker: raw Server Action success
  state could render external feedback before the passive dialog-close effect.
- Successful actions now close the active native dialog first and only then
  publish narrowly scoped local external success state for a subsequent render.
  Raw Server Action success state no longer renders external feedback directly.
- The behavioral regression test proves that external status feedback is absent
  while the dialog is open and when `close()` begins, then appears only after
  the dialog is closed. Reopening the dialog also removes prior external status
  before the modal opens.
- Validation, authorization-denied, and generic failure feedback remains inside
  the open dialog with assertive alert semantics and focus movement. Pending
  duplicate-submission blocking, destructive wording, keyboard controls, and
  confirmation behavior remain covered.
- Corrected success-ordering regression: 1 test passed.
- Corrected modal/action tests: 2 files and 17 tests passed.
- Corrected legacy compatibility/security tests: 3 files and 23 tests passed.
- Focused D3, D2, Package B, and Package C regression validation: 22 files and
  281 tests passed.
- Repository ESLint, non-incremental TypeScript typecheck, scoped Prettier, and
  `git diff --check` passed.
- Prisma Client 7.8.0 generation and the Next.js 16.2.10 webpack production
  build passed; all 14 static pages generated and both account-management routes
  were included as dynamic routes.
- Database access, migrations, seeds, PostgreSQL tests, dependency changes,
  commit, push, and upstream configuration: not performed.

At this historical checkpoint, the final re-QA blocker was corrected and all
Package D changes remained unstaged. The later final independent QA decision is
`APPROVED`; the Git delivery is recorded below.

### D3 final independent QA approval and Git delivery

- Final independent D3 QA decision: `APPROVED`.
- D3 implementation, corrections, and required validation are complete and
  approved.
- D1 through D3 were committed and pushed in
  `fd1695232e40295b145b99d6a7fdfd6d697cb995`.
- Local and remote Package D refs are aligned at that commit.
- The historical `CORRECTIONS REQUIRED` and subsequent re-QA correction
  evidence above remain part of the verification record.
- D4 — STAFF Inventory and Lifecycle is the next authorized task and has not
  started.
- D4 through D7 and Package E have not started.
- Package D remains active and incomplete.

### D3 through D7 implementation evidence

- Student approval, disable, and reactivation lifecycle tests
- STAFF disable and reactivation tests, including transaction, audit,
  `sessionVersion`, and final-manager invariants
- Capability grant, revoke, self-grant denial, and final-manager concurrency
  tests
- Safe `/admin/users/pending` redirect tests
- Confirmation strength, duplicate-submission prevention, and safe feedback
  review
- Relevant integration tests and production build where required

Database-connected checks, migrations, dependencies, Git delivery, and
deployment remain separately authorized actions. Audit Log viewing is outside
Package D and remains planned for V2-7.

### Package D final completion evidence

- Focused Package D verification: 12 files and 160 tests passed.
- Full Vitest verification: 52 files and 577 tests passed.
- Three PostgreSQL files and 39 tests skipped because no isolated database was
  configured.
- ESLint and strict TypeScript typecheck passed.
- Prisma validation and generation passed.
- Scoped Prettier and `git diff --check` passed.
- Webpack production build passed with 15 routes.
- High-confidence staged secret scan found no matches.
- Package D commit `1e2961af619c7025cb0f322e1cc6d4759594f2ee`
  was pushed and synchronized.

## V2-3-CF-001 closure verification

Status: `CLOSED`

- Package C targeted, browser, responsive, accessibility, and secret checks.
- Package D lifecycle, capability, audit, transaction, concurrency, and
  negative-authorization checks.
- Package E migration SQL review, static contract tests, and isolated
  PostgreSQL execution against prepared existing-data fixtures.
- Complete Vitest and PostgreSQL integration suites.
- Prisma format, validate, generate, and migration-history review.
- ESLint, strict TypeScript typecheck, production build, and relevant
  Playwright checks.
- Secret scan, dependency/configuration review, complete integrated diff review,
  and final local/remote synchronization.

### Package E completion evidence

- Focused migration, auth, seed, and runtime verification: 10 files and 199
  tests passed.
- Complete non-database Vitest verification: 50 files and 563 tests passed.
- Three PostgreSQL files and 39 tests skipped because no isolated database was
  configured.
- ESLint, strict typecheck, Prisma format/validate/generate, changed-file
  Prettier, build, diff check, and secret scan passed.
- Package E browser contract: 4 Chromium tests passed, including retired ADMIN
  route 404 behavior.
- Independent SQL/security review found no validated blocker.
- Migration execution, rollback, locks, enum replacement, audit-trigger
  interaction, and rerun behavior remain unverified against PostgreSQL.

### Package F independent verification checkpoint

| Check | Result |
| --- | --- |
| ESLint | `PASS` |
| TypeScript strict typecheck | `PASS` |
| Complete non-database Vitest | `PASS` — 50 files, 563 tests; 3 files and 39 PostgreSQL tests skipped |
| Prisma format, validate, generate | `PASS` — Prisma 7.9.1 |
| Production build | `PASS` — Next.js 16.2.12, 13 expected routes |
| Playwright assertions | `PASS` — 12/12 across two runs; runner teardown timed out |
| Production dependency audit | `PASS` — 0 vulnerabilities |
| Complete dependency audit | `LIMITED` — 9 high development-only upstream lint-tool findings |
| Migration and PostgreSQL integration | `PASS` — 7 migrations; 5 files and 39 tests passed with zero skips |
| V2-3 closure | `CLOSED` — all technical closure gates passed; V2-4 not started |

### Package F final database evidence

| Requirement | Result |
| --- | --- |
| Control/test target separation | `PASS` — distinct sanitized target fingerprints |
| Test-data classification | `PASS` — reserved suite fixtures only; meaningful application tables empty |
| Migration history | `PASS` — 7 successful, 0 failed, 0 pending |
| Deterministic redeploy | `PASS` — no pending migrations |
| Capability preservation | `PASS` — exact 4-capability and 2-capability sets unchanged |
| Session invalidation | `PASS` — converted ADMIN session versions incremented 0 to 1 |
| Audit behavior | `PASS` — 2 redacted conversion audits; forced audit failure rolled back |
| Locking and atomicity | `PASS` — lock contention rolled back with no partial conversion |
| Final-manager survival | `PASS` — one active manager survived conversion |
| Enum replacement | `PASS` — current role enum contains only STUDENT and STAFF |
| PostgreSQL suite | `PASS` — 5 files, 39 passed, 0 failed, 0 skipped |
| Full Vitest suite | `PASS` — 53 files, 602 passed, 0 failed, 0 skipped |
| Package D recovery | `PASS` — five-file patch verified; auxiliary worktree clean at 0/0 |

## V2-4 institutional UI foundation verification

Status: `CLOSED`

| Requirement | Result |
| --- | --- |
| Approved Design Lock | `PASS` — checked-in SIST logo, existing navy/green identity, existing fonts and theme mechanism |
| Shared tokens | `PASS` — semantic surface, feedback, header, sidebar, focus, light, and dark tokens centralized |
| Public/authentication foundations | `PASS` — existing landing, login, registration, pending, unauthorized, and not-found routes migrated |
| Student foundation | `PASS` — existing `/student` route uses responsive sidebar, topbar, valid dashboard link, theme, and account menu |
| STAFF foundation | `PASS` — capability-aware navigation and existing `/staff/*` behavior preserved; drawer focus behavior retained |
| System states | `PASS` — shared loading, empty, error, success, not-found, pending, disabled, session-ended, and access presentations covered |
| Keyboard and focus | `PASS` — visible focus, Tab/Shift+Tab containment, Escape close, and opener restoration |
| Theme and contrast | `PASS` — light/dark persistence, unchanged layout, and measured body contrast at least 4.5:1 |
| Responsive matrix | `PASS` — 360×800, 768×1024, 1024×768, and 1440×900; no horizontal page overflow |
| Focused Vitest | `PASS` — 9 files, 55 tests |
| Full Vitest | `PASS` — 52 files, 576 tests; 3 PostgreSQL files and 39 tests intentionally skipped |
| Production build | `PASS` — Next.js 16.2.12, 13 expected routes |
| Targeted Playwright | `PASS` — 18 Chromium tests |
| Database | `NOT APPLICABLE` — no database access or backend-sensitive change |
| Repository-wide formatting | `LIMITED` — pre-existing 151-file baseline; every V2-4 changed file passes scoped formatting |
| V2-4 closure | `CLOSED` — technical gates passed; V2-5 not started |
