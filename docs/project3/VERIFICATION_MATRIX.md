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

Status: Package D remains active and incomplete. D1 and D2 are approved and
complete. D3 — Student Account Management implementation and required
validation are complete and await independent QA. D4 through D7 have not
started.

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

D3 implementation and required validation are complete. D3 awaits independent
QA and is not yet approved.

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

D3 correction implementation and required validation are complete. D3 awaits
independent re-QA and is not yet approved.

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

D3 remains active and incomplete. The final re-QA blocker is corrected and D3
awaits final focused independent re-QA; D3 is not approved. D4 through D7 and
Package E remain not started. All Package D changes remain unstaged.

### D3 through D7 expected implementation evidence

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
