# Production database, secrets, and deployment runbook

## Purpose and boundary

This V2-12.4 runbook covers the repository-controlled procedure for a human-
approved Production release. It does not authorize a Production deployment,
database connection, migration, backup, restore, or secret creation. Those
actions require the named owner and recorded approval.

Production is separate from Local, Preview, and the isolated test database.
Never use Production data for testing. Never configure `TEST_DATABASE_URL` in
the Production scope.

## Owner checkpoint — completed readiness evidence

The project owner supplied this checkpoint on 2026-08-08. It is recorded as
owner-reported external evidence; no Production provider, database, or secret
was accessed from this repository session.

| Area                     | Owner-reported state                                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Neon project/database    | `student-admin-portal` / `neondb`                                                                                                                                                                           |
| Runtime connection       | Production pooled `DATABASE_URL` uses `sist_runtime`                                                                                                                                                        |
| Migration connection     | Production direct `DIRECT_URL` uses `neondb_owner`                                                                                                                                                          |
| Runtime least privilege  | `sist_runtime` has LOGIN; no SUPERUSER, CREATEDB, CREATEROLE, REPLICATION, or BYPASSRLS; required DML privileges were verified on 19 public tables and configured for future owner-created tables/sequences |
| Application URL and auth | `APP_URL` is `https://student-admin-portal-phi.vercel.app`; a distinct Production `AUTH_SECRET` is configured                                                                                               |
| Test isolation           | `TEST_DATABASE_URL` is absent from Production                                                                                                                                                               |
| Recovery                 | Neon PITR history is 6 hours; manual restore and snapshot are available; project owner / Neon administrator owns restores                                                                                   |
| Deployment control       | GitHub `main` has the active Production main protection ruleset; Vercel Production tracks `main`; repository/project owner is release approver                                                              |

Production infrastructure is **READY**. The first live Production deployment is
**DEFERRED BY OWNER UNTIL FINAL RELEASE/HANDOFF**. This checkpoint does not
constitute a deployment, migration, backup, restore, or release approval.

## Ownership and access

Before a release, the owner must record the following outside this repository:

| Responsibility                                 | Required owner     | Evidence                                                                    |
| ---------------------------------------------- | ------------------ | --------------------------------------------------------------------------- |
| Production database account and backup service | Database owner     | Database identity, least-privilege roles, backup retention, restore contact |
| Production deployment project and approval     | Deployment owner   | Project access, protected release branch, approved release commit           |
| Production environment values and rotation     | Secret custodian   | Inventory completion and rotation contact; never secret values              |
| Migration execution                            | Migration operator | Approved migration list, pre-migration backup reference, command result     |

The application uses `DATABASE_URL` at runtime and Prisma uses `DIRECT_URL`
for CLI migration operations through `prisma.config.ts`. The migration operator
must use a dedicated, minimally privileged migration credential where the
provider supports it; the runtime application credential must not have broader
schema privileges than needed for normal operation.

## Production secrets inventory

Configure values only in the Production environment settings of the deployment
provider. Do not add them to Git, shell history, screenshots, CI logs, or this
document. Preview and Production require separate database endpoints and
distinct secrets.

| Variable                                   | Purpose                                                     | Production status                              | Custodian / validation                                                      | Preview and test boundary                                            |
| ------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `APP_URL`                                  | Canonical application URL used by application configuration | Required                                       | Deployment owner; `npm run production:verify` requires public HTTPS         | Preview has its own URL; Test does not use Production URL            |
| `DATABASE_URL`                             | Pooled PostgreSQL runtime connection                        | Required                                       | Database owner; runtime least-privilege account and TLS                     | Never shared with Preview/Test                                       |
| `DIRECT_URL`                               | Direct PostgreSQL connection used by Prisma CLI migrations  | Required for migration operations              | Migration operator; direct TLS endpoint and dedicated migration access      | Never shared with Preview/Test                                       |
| `AUTH_SECRET`                              | Auth.js signing secret                                      | Required                                       | Secret custodian; at least 32 characters, rotate after suspected disclosure | Unique per environment                                               |
| `BLOB_READ_WRITE_TOKEN` or `BLOB_STORE_ID` | Private Vercel Blob access/identity for document artifacts  | Required before document generation is enabled | Storage owner; private store only                                           | Separate non-Production store; never use memory driver in Production |
| `RESEND_API_KEY`                           | Resend provider API credential                              | Required before email delivery is enabled      | Email owner; provider key restricted to the Production sender/domain        | Separate non-Production key                                          |
| `EMAIL_FROM`                               | Approved sender address                                     | Required before email delivery is enabled      | Email owner; verified sender/domain                                         | Non-Production sender only                                           |
| `DOCUMENT_STORAGE_DRIVER`                  | Test-only memory driver selector                            | Must be unset or not `memory`                  | Deployment owner; verifier rejects `memory`                                 | Memory driver is allowed only under the test guard outside Vercel    |
| `V2_9_TEST_STORAGE_ALLOWED`                | Test-only storage guard                                     | Must be unset or `false`                       | Deployment owner; verifier rejects `true`                                   | Test-only, never Production                                          |
| `ALLOW_DEVELOPMENT_SEED`                   | Development seed guard                                      | Must be unset or `false`                       | Deployment owner; verifier rejects `true`                                   | Never enable in Preview/Production                                   |
| `TEST_DATABASE_URL`                        | Isolated integration-test target                            | Must be absent                                 | Deployment owner; verifier rejects any value                                | Test harness only, never deployment scopes                           |

`REGISTRATION_VERIFICATION_MODE` is not a secret. Its Production value must be
an approved supported mode (`MANUAL_APPROVAL` or `INTERNAL_REGISTRY`), verified
through the normal application configuration path.

## Pre-deployment procedure

1. Select an approved reviewed commit on a clean, synchronized protected release
   branch. Record its hash, reviewer, human approver, rollback release reference,
   and CI check URLs.
2. Confirm the Production database owner, deployment owner, secret custodian,
   and migration operator are available for the release and recovery window.
3. Configure the inventory above in the Production scope only. Do not copy a
   Preview value into Production or expose any value while verifying it.
4. In a shell that contains only Production deployment-scope environment values,
   run `npm run production:verify`. A successful result contains only field
   names and one-way fingerprints; it does not contact a database or provider.
5. Run the approved release checks: `npm run format:check:changed -- --base
<approved-base>`, `npm run lint`, `npm run typecheck`, `npm run db:validate`,
   `npm run test:ci`, and `npm run build`. Use the existing isolated E2E process
   when the release scope requires it; never substitute Production as its test
   database.
6. Review every checked-in migration since the previous Production release. If
   no migration is pending, record that decision rather than running a migration.

## Migration and database safety procedure

Only reviewed, checked-in migrations are permitted. Do not use `prisma db push`,
`prisma migrate reset`, seed commands, truncate/drop SQL, or production test
fixtures.

1. The database owner verifies the target identity using provider-side metadata
   and records a sanitized database/project identifier. Variable names alone are
   not proof of database identity.
2. Take and verify a pre-migration backup or point-in-time recovery reference.
   Record the timestamp, retention, and restore owner without putting provider
   credentials in release evidence.
3. The migration operator runs `npm run db:status` using the direct Production
   migration connection and records only the sanitized status result. This is a
   read-only status check but still needs Production access approval.
4. After explicit go/no-go approval, the migration operator runs `npm run
db:deploy` exactly once. This executes `prisma migrate deploy` and may mutate
   Production schema; it is never a test command.
5. Run `npm run db:status` again and record the result. If the migration fails,
   stop the deployment, preserve error evidence without credentials, and choose
   a reviewed forward fix or provider-supported restoration with the owners.

## Deployment, verification, and recovery

1. Deploy only the recorded approved commit through the authorized deployment
   project. Do not promote an unreviewed Preview artifact by assumption.
2. Verify the canonical HTTPS URL, unauthenticated boundaries, login, and a
   minimal authorized smoke path using non-sensitive accounts. Record response
   status and release reference; do not place student data in evidence.
3. Confirm that private document access and email delivery remain disabled until
   their V2-12.5 provider readiness decisions are complete, or verify their
   approved Production configuration under that phase's controls.
4. Declare the release healthy only with the approved commit, deployment URL,
   CI evidence, production verifier result, migration decision/result, backup
   reference, and human approval recorded together.

For an application-only regression with schema-compatible data, roll back to a
previously approved provider release reference. When a migration has changed
data or schema, prefer a reviewed forward fix unless the database owner approves
a tested provider restoration. Never run down migrations or restore a backup
without the database owner, recovery decision, and impact assessment.

## Failure and secret rotation

On configuration, migration, deployment, or suspected-secret failure: stop
promotion; preserve sanitized evidence; notify the deployment, database, and
secret owners; and use the approved rollback/forward-fix decision. Do not paste
environment values into tickets or chat.

For a suspected secret disclosure, revoke or replace the affected value in the
provider, update only the affected environment scope, redeploy or restart as
required, verify using this runbook, review access, and record sanitized incident
evidence. Rotate `AUTH_SECRET` with an explicit session-impact decision.

## V2-12.4 completion evidence

V2-12.4 is `CLOSED — READINESS COMPLETE; LIVE RELEASE DEFERRED`. The repository
verifier and runbook are complete, and the owner checkpoint supplies Production
database identity, ownership separation, configuration, recovery, deployment,
and release-ownership evidence. Production is intentionally not live; an actual
deployment, migration status, backup, restore, and release verification belong
to the owner-approved Final Release/Handoff workflow. Storage/email provider
activation and observability remain V2-12.5.
