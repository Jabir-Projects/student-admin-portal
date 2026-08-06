# CI quality gates and release controls

## Purpose and boundary

`CI Quality Gates` provides secret-free validation of source changes. It does
not deploy, connect to a database, run migrations, use a provider account, or
replace Preview/release-candidate verification. The workflow runs with
`contents: read` only and never uses `pull_request_target` or write permissions.

## Workflow

Triggers: pull requests, pushes to repository branches, and controlled manual
dispatch. Superseded runs for the same workflow/ref are cancelled. Both jobs
run on `ubuntu-latest` with 20-minute timeouts.

| Job/status check   | Commands                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Quality gates`    | `npm ci`; `npm run db:generate`; `npm run format:check:changed -- --base <revision>`; `npm run lint`; `npm run typecheck`; `npm run db:validate`; `npm run test:ci` |
| `Production build` | `npm ci`; `npm run build` after `Quality gates` succeeds                                                                                                            |

The workflow uses Node `24.18.0`, the version observed in the Pack 1A/1B
execution environment, and npm caching keyed by `package-lock.json`. The
repository currently provides no `engines`, `.nvmrc`, `.node-version`, Volta,
or `packageManager` metadata; selecting and pinning an institutional supported
runtime remains a release-control follow-up.

## Formatting ratchet

During V2-12.2, global `npm run format:check` reported 317 untouched baseline
violations after Pack files were formatted. This observed count is technical
debt, not a permanent guaranteed count. Repository-wide remediation was not
authorized for this pack, and the global command remains the long-term full-
repository target.

CI instead runs the no-new-format-debt `format:check:changed` ratchet. It
accepts an explicit base revision and checks every added, copied, modified, or
renamed supported file, plus untracked additions during local verification.
Editing a historically noncompliant file subjects that file to Prettier; the
ratchet is not permission to ignore formatting in changed files. No baseline
paths are added to `.prettierignore`, and global formatting remediation remains
a separate controlled maintenance package.

## Safe CI environment policy

CI supplies only non-secret placeholders for `APP_URL`, `DATABASE_URL`,
`DIRECT_URL`, `AUTH_SECRET`, document-storage flags, and registration/seed
controls. The database URLs use an invalid local endpoint and
`TEST_DATABASE_URL` is empty. No value is echoed. CI must not use Production,
Preview, developer, provider, or database credentials.

`npm run db:validate` validates Prisma configuration/schema only; it is not a
migration command. The standard job must not run `db:status`, `db:seed`,
`prisma migrate`, `prisma db push`, backup, restore, or destructive database
commands.

`npm ci` leaves package lifecycle scripts pending under the repository policy,
so the workflow explicitly runs the existing non-migrating `npm run db:generate`
before type checking. It generates local Prisma client types using the safe CI
placeholder configuration and does not contact a database.

Secret-free CI uses `test:ci`, which excludes the repository's PostgreSQL
integration-test files rather than reporting them as passed. In particular, the
V2-9 PostgreSQL document lifecycle suite remains unchanged and is excluded from
this credential-free gate. Its full assertions require an isolated
`TEST_DATABASE_URL`, a distinct comparison database target, approved elevated
network execution where necessary, and sanitized isolation verification during
the mandatory V2-12.3 Preview/release-candidate gate. It must never fall back
to development or Production databases, and hosted CI receives no database
credentials.

## E2E policy

`npm run test:e2e` is intentionally excluded. The repository Playwright
configuration requires a verified isolated `TEST_DATABASE_URL` and launches a
browser server with that target. The V2-11 authenticated Chromium baseline is
49 passed and 0 failed; future V2-12.3 Preview/release-candidate verification
must provide isolated database resources and safe provider substitutes without
sharing Production resources or secrets.

## Release controls

- A Production candidate must be an approved reviewed commit on a clean,
  synchronized release branch with successful `Quality gates` and `Production
build` checks.
- Human Production approval is required. Force pushes and history rewrites are
  prohibited for release history.
- Preserve release evidence: commit, reviewers/approver, check run URLs and
  conclusions, environment, migration decision, deployment result, and rollback
  commit or provider release reference.
- Failed CI blocks promotion. Correct the bounded cause and rerun all required
  checks; do not remove, bypass, or weaken a gate to obtain success.
- Emergency changes still require an approved commit, human approval, recorded
  checks and decision, and a rollback reference. Emergency handling does not
  bypass audit evidence.
- Roll back to a previously approved release commit or provider release
  reference when safe; choose a documented forward fix where database state
  makes code rollback unsafe.

## External branch protection

Branch protection is not configured or verified by this repository change. An
authorized GitHub administrator must configure it externally and retain
evidence for the protected Production branch, required `Quality gates` and
`Production build` checks, review requirement, force-push prohibition, and
administrator-bypass policy.

## OWNER DECISION REQUIRED

- Protected Production branch and authorized GitHub administrator.
- Required reviewer count and authorized reviewers.
- Whether signed commits are mandatory.
- Whether administrator bypass is prohibited.
- Release approver and institutional Node runtime support policy.
