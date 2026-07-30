# Project 3 Task Package Register

This file preserves the historical CTRL-001 package record. Its Package C
restrictions describe CTRL-001 scope and are not the current Package C status.
See the current authorization addendum at the end of this file.

## Package

| Field  | Value                              |
| ------ | ---------------------------------- |
| ID     | `CTRL-001`                         |
| Name   | Create Project 3 control documents |
| Status | `CLOSED`                           |

Only one control package may be active at a time. `CTRL-001` is closed.
`V2-3-CF-001` is the active owner-authorized master package.

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
- Package E is the active implementation package.
- The owner-authorized final Package C closure includes one six-file commit and
  a normal push to the existing upstream branch.
- Package C closure did not authorize later packages. The separate
  owner-authorized `V2-3-CF-001` master package now governs Packages D through F.
  V2-4 work, production access, and deployment remain prohibited.

## Historical Package D authorization and completion

| Field  | Value                                           |
| ------ | ----------------------------------------------- |
| ID     | `V2-3-D`                                        |
| Name   | Account and Capability Management               |
| Status | `COMPLETE`                                      |

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

## Active V2-3 master control package

| Field  | Value                                           |
| ------ | ----------------------------------------------- |
| ID     | `V2-3-CF-001`                                   |
| Name   | Complete and close V2-3 Packages C through F    |
| Status | `ACTIVE`                                        |

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

### Deferred-improvement rule

Only non-blocking polish, physical-device review, full real-screen-reader
testing, optional filters, and equivalent low-risk work may move to the Final
Hardening Backlog. Security, authorization, migration-safety, build, or core
workflow failures block closure.
