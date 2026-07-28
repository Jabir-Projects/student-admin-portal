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

| Risk area | Typical risk | Required checks | Required evidence | Blocking conditions |
| --- | --- | --- | --- | --- |
| Documentation | Low | Content, structure, links, scope diff | Reviewed files and Git diff | Broken links, conflicting controls, unsupported claims |
| Styling-only frontend | Medium | Visual, responsive, accessibility, lint, typecheck, one build | Screenshots or manual states plus command results | Broken layouts, inaccessible interaction, failed required checks |
| Frontend behavior | Medium | Targeted interaction tests, responsive and accessibility review, lint, typecheck, one build | Test counts and reviewed scenarios | Incorrect behavior or failed required checks |
| Normal backend | Medium | Targeted unit and relevant integration tests, lint, typecheck, one build | Commands, exit codes, counts | Contract regression or unhandled failure |
| Authentication | High | Targeted and integration tests, negative paths, security review, lint, typecheck, build | Identity and session scenarios | Bypass, stale/disabled session access, secret exposure |
| Authorization | High | Allowed, denied, cross-user, zero-capability, and race-sensitive tests | Actor, resource, capability, and result evidence | Client-trusted privilege or server-side bypass |
| Account lifecycle | High | Disable/reactivate/role-transition tests and concurrency review | State transitions and negative results | Disabled access or final-manager invariant failure |
| Database migrations | High | SQL, constraints, indexes, data-loss, target, and recovery review; authorized execution checks | Reviewed SQL and explicit environment/approval evidence | Unclear target, destructive risk, missing rollback plan |
| Imports | High | File/content validation, malicious input, authorization, transactional tests | Rejected and accepted fixture evidence | Trusted client MIME/input, partial unsafe writes |
| Exports | High | Authorization, field minimization, injection and cross-user tests | Export schema and denied-path evidence | Unauthorized or excessive data disclosure |
| Documents and private storage | High | Access, release/revoke, storage privacy, traversal/content tests | Private-by-default and denied access evidence | Public leakage or unsafe file handling |
| Finance | High | Authorization, accuracy, import approval, transaction and audit tests | Reconciled fixtures and denied paths | Incorrect amounts, unauthorized access, partial writes |
| Notifications | Medium | Trigger, recipient, privacy, retry/idempotency tests | Delivery intent and sanitized payload evidence | Sensitive recipient leakage or duplicate harm |
| Audit | High | Required-event, sanitization, attribution, rollback tests | Minimal typed metadata and failure behavior | Missing required audit or secret/personal-data leakage |
| Accessibility | Medium | Keyboard, focus, semantics, contrast, screen-reader review | Reviewed states and tool/manual findings | Blocking interaction or critical WCAG failure |
| Performance and reliability | Medium to high | Query, concurrency, failure recovery, load-sensitive checks | Timings, query counts, retry/failure results | N+1 growth, race, unrecoverable failure |
| Production release | Critical | Approved deployment, smoke, monitoring, backup and recovery verification | Environment-specific release evidence | Missing approval, unhealthy release, unverified recovery |

## CTRL-001 expected verification

Status: Active; do not mark complete or passed before final review.

- File inventory
- Markdown structure review
- Relative-link review
- Duplication review
- Scope-only diff review
- Git status review

See [TASK_PACKAGE.md](TASK_PACKAGE.md) for permissions and [ARCHITECTURE.md](ARCHITECTURE.md) for stable invariants.
