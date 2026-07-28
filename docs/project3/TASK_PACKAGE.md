# Active Project 3 Task Package

## Package

| Field | Value |
| --- | --- |
| ID | `CTRL-001` |
| Name | Create Project 3 control documents |
| Status | Active; awaiting ChatGPT and owner diff review |

Only one control package may be active at a time. `CTRL-001` is the active control package.

## Status lifecycle

`CTRL-001` remains `ACTIVE` while correction, QA, Git approval, commit, push, synchronization verification, clean repository verification, closure recording, and closure verification are incomplete. File creation or successful QA alone does not close the package.

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
- CTRL-001 remains uncommitted pending review.

## Security requirements

- Do not weaken or redefine the approved authorization model.
- Do not expose secrets, credentials, tokens, environment values, or personal data.
- Do not imply UI visibility replaces server authorization.
- Do not imply production or sensitive operations are pre-approved.

## Verification requirements

Use the CTRL-001 checks in [VERIFICATION_MATRIX.md](VERIFICATION_MATRIX.md): file inventory, Markdown structure, relative links, duplication, scope-only diff, and Git status review. Review the complete diff. Do not run application tests.

## Permissions

| Action | Permission |
| --- | --- |
| Database connection | Prohibited |
| Database mutation | Prohibited |
| Migration execution | Prohibited |
| Staging | Prohibited |
| Commit | Prohibited |
| Push | Prohibited |
| Package C implementation | Prohibited |

These are the default CTRL-001 permissions. The owner-authorized one-shot finalization task separately authorizes staging, the two specified commits, and their pushes only for these six control files. It does not authorize database, migration, deployment, production, or Package C actions.

> V2-3 Package C — Staff Frontend has not been approved for implementation.

## Stop conditions

Stop as `BLOCKED` for repository mismatch, unexpected Git state, conflicting instructions, meaningful target content requiring overwrite, unsafe scope expansion, secret exposure risk, or any need for an unauthorized action.

## Required report

Report repository state, six created files, one-sentence content summaries, exact verification evidence, diff summary, issues, and explicit Git non-actions. End with `READY FOR QA`, `CORRECTIONS REQUIRED`, or `BLOCKED`.

## Closure conditions

CTRL-001 closes only after acceptance criteria and documentation QA pass, ChatGPT and owner approve the diff, authorized Git delivery completes, and synchronized clean state is verified. Do not begin the next package automatically.

See [CURRENT_STATE.md](CURRENT_STATE.md), [ROADMAP.md](ROADMAP.md), and [DECISIONS.md](DECISIONS.md).
